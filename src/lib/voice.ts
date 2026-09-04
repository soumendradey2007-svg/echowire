import { wsClient } from './ws';

interface PeerConnection {
  targetUserId: string;
  pc: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
}

export class VoiceManager {
  private localStream: MediaStream | null = null;
  private rawStream: MediaStream | null = null;
  private peers = new Map<string, PeerConnection>();
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private noiseCancellation: boolean = true;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private gateGainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private bypassGainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private animId: any = null;
  private ambientFloor: number = 0.005;
  private onMicLevelCallbacks: Set<(level: number) => void> = new Set();
  private unsubSignal: any = null;
  private unsubPeerJoined: any = null;
  private unsubPeerLeft: any = null;
  private unsubExistingPeers: any = null;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  };

  private getAudioContainer(): HTMLElement {
    let el = document.getElementById('webrtc-remote-audio-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'webrtc-remote-audio-container';
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
    }
    return el;
  }

  onMicLevel(callback: (level: number) => void): () => void {
    this.onMicLevelCallbacks.add(callback);
    return () => this.onMicLevelCallbacks.delete(callback);
  }

  async joinRoom(roomId: string, userId: string, onSpeaking: (speaking: boolean) => void) {
    this.leaveRoom();
    this.currentRoomId = roomId;
    this.currentUserId = userId;

    await this.captureMicrophone(onSpeaking);

    this.unsubSignal = wsClient.on('webrtc:signal', async (msg: any) => {
      await this.handleSignal(msg.fromUserId, msg.signal);
    });

    this.unsubPeerJoined = wsClient.on('voice:peer_joined', async (peer: any) => {
      if (peer.userId !== this.currentUserId) {
        if (this.currentUserId! < peer.userId) {
          await this.initiateCall(peer.userId);
        } else {
          await this.getOrCreatePeer(peer.userId);
        }
      }
    });

    this.unsubExistingPeers = wsClient.on('voice:existing_peers', async (data: any) => {
      if (data?.peers && Array.isArray(data.peers)) {
        for (const p of data.peers) {
          if (p.userId !== this.currentUserId) {
            if (this.currentUserId! < p.userId) {
              await this.initiateCall(p.userId);
            } else {
              await this.getOrCreatePeer(p.userId);
            }
          }
        }
      }
    });

    this.unsubPeerLeft = wsClient.on('voice:peer_left', (peer: any) => {
      this.removePeer(peer.userId);
    });

    wsClient.send('voice:join', { roomId });
  }

  private async captureMicrophone(onSpeaking: (speaking: boolean) => void) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone requires HTTPS on mobile. Please open via https://');
      return;
    }

    try {
      this.rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawStream);

      // Clean Sub-bass filter (85Hz, Q: 0.707): Cuts table bumps & AC rumble without muffling voice
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.setValueAtTime(85, this.audioContext.currentTime);
      this.highpassFilter.Q.setValueAtTime(0.707, this.audioContext.currentTime);

      // Precision Noise Gate Gain Node
      this.gateGainNode = this.audioContext.createGain();
      this.gateGainNode.gain.setValueAtTime(this.noiseCancellation ? 0.0 : 1.0, this.audioContext.currentTime);

      // WebRTC Peer Destination
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Bypass path (when NC is OFF)
      this.bypassGainNode = this.audioContext.createGain();
      this.bypassGainNode.gain.setValueAtTime(this.noiseCancellation ? 0.0 : 1.0, this.audioContext.currentTime);

      // Noise-cancelled chain: source -> highpass -> gateGain -> destination
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.gateGainNode);
      this.gateGainNode.connect(this.destinationNode);

      // Bypass chain: source -> bypassGain -> destination
      this.sourceNode.connect(this.bypassGainNode);
      this.bypassGainNode.connect(this.destinationNode);

      // High-resolution Analyser for Live Decibel Meter & Speaking loop
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      this.sourceNode.connect(this.analyser);

      this.localStream = this.destinationNode.stream;

      this.startNoiseGateAndSpeakingLoop(onSpeaking);
      this.setMuted(this.isMuted);

      for (const [, peer] of this.peers.entries()) {
        this.attachTracks(peer);
      }
    } catch (err: any) {
      console.error('[VOICE] Microphone permission error:', err);
      alert('Microphone error: ' + (err.message || err.name));
    }
  }

  private startNoiseGateAndSpeakingLoop(onSpeaking: (speaking: boolean) => void) {
    if (!this.analyser || !this.audioContext) return;
    const timeData = new Uint8Array(this.analyser.fftSize);
    let lastSpokenTime = 0;
    const HOLD_TIME_MS = 280;

    const loop = () => {
      if (!this.analyser || !this.audioContext) return;
      this.analyser.getByteTimeDomainData(timeData);

      // 1. Calculate true RMS
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const norm = (timeData[i] - 128) / 128;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      // 2. Calculate Decibel (dB) Level mapped to 0 - 100% for the Green Bar
      const db = 20 * Math.log10(Math.max(rms, 0.0001));
      const minDb = -48;
      const maxDb = -12;
      const rawPercent = ((db - minDb) / (maxDb - minDb)) * 100;
      const micPercent = Math.min(100, Math.max(0, Math.round(rawPercent)));

      // Broadcast live decibel level to UI (zero hearback overhead)
      for (const cb of this.onMicLevelCallbacks) {
        cb(micPercent);
      }

      // 3. Adaptive Noise Floor Tracking
      if (rms < this.ambientFloor) {
        this.ambientFloor = rms * 0.15 + this.ambientFloor * 0.85;
      } else {
        this.ambientFloor = this.ambientFloor * 0.999 + rms * 0.001;
      }

      const noiseThreshold = Math.max(0.012, this.ambientFloor * 2.2);
      const now = performance.now();
      const isSpeech = rms > noiseThreshold;

      if (isSpeech) {
        lastSpokenTime = now;
      }

      const isVoiceActive = isSpeech || (now - lastSpokenTime < HOLD_TIME_MS);

      // 4. Gate Gain: 10ms smooth ramp up, 50ms release
      if (this.gateGainNode && this.noiseCancellation) {
        const targetGain = isVoiceActive && !this.isMuted && !this.isDeafened ? 1.0 : 0.0;
        const timeConstant = targetGain > 0.5 ? 0.01 : 0.05;
        this.gateGainNode.gain.setTargetAtTime(
          targetGain,
          this.audioContext.currentTime,
          timeConstant
        );
      }

      const speaking = !this.isMuted && !this.isDeafened && isVoiceActive;
      onSpeaking(speaking);

      this.animId = requestAnimationFrame(loop);
    };

    loop();
  }

  private attachTracks(peer: PeerConnection) {
    if (!this.localStream) return;
    const senders = peer.pc.getSenders();
    this.localStream.getAudioTracks().forEach((track) => {
      if (!senders.some((s) => s.track === track)) {
        peer.pc.addTrack(track, this.localStream!);
      }
    });
  }

  private async getOrCreatePeer(targetUserId: string): Promise<PeerConnection> {
    let peer = this.peers.get(targetUserId);
    if (peer) return peer;

    const pc = new RTCPeerConnection(this.rtcConfig);
    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    (remoteAudio as any).playsInline = true;

    const container = this.getAudioContainer();
    container.appendChild(remoteAudio);

    peer = {
      targetUserId,
      pc,
      remoteAudio,
      pendingCandidates: [],
    };
    this.peers.set(targetUserId, peer);

    this.attachTracks(peer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send('webrtc:signal', {
          targetUserId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        peer!.remoteAudio.srcObject = event.streams[0];
        peer!.remoteAudio.play().catch(() => {});
      }
    };

    return peer;
  }

  private async initiateCall(targetUserId: string) {
    const peer = await this.getOrCreatePeer(targetUserId);
    const offer = await peer.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await peer.pc.setLocalDescription(offer);
    wsClient.send('webrtc:signal', {
      targetUserId,
      signal: { type: 'offer', sdp: offer },
    });
  }

  private async handleSignal(fromUserId: string, signal: any) {
    if (fromUserId === this.currentUserId) return;
    const peer = await this.getOrCreatePeer(fromUserId);

    if (signal.type === 'offer') {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      for (const cand of peer.pendingCandidates) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
      peer.pendingCandidates = [];

      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      wsClient.send('webrtc:signal', {
        targetUserId: fromUserId,
        signal: { type: 'answer', sdp: answer },
      });
    } else if (signal.type === 'answer') {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      for (const cand of peer.pendingCandidates) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
      peer.pendingCandidates = [];
    } else if (signal.type === 'candidate') {
      if (peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      } else {
        peer.pendingCandidates.push(signal.candidate);
      }
    }
  }

  private removePeer(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.remoteAudio.pause();
      peer.remoteAudio.srcObject = null;
      peer.remoteAudio.remove();
      peer.pc.close();
      this.peers.delete(userId);
    }
  }

  getNoiseCancellation(): boolean {
    return this.noiseCancellation;
  }

  setNoiseCancellation(enabled: boolean): boolean {
    this.noiseCancellation = enabled;
    if (this.audioContext && this.bypassGainNode && this.gateGainNode) {
      const now = this.audioContext.currentTime;
      if (enabled) {
        this.bypassGainNode.gain.setTargetAtTime(0.0, now, 0.02);
      } else {
        this.bypassGainNode.gain.setTargetAtTime(1.0, now, 0.02);
        this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.02);
      }
    }
    return this.noiseCancellation;
  }

  setMuted(muted: boolean) {
    if (this.isDeafened && !muted) {
      return;
    }
    this.isMuted = muted;
    if (this.audioContext && this.gateGainNode && muted) {
      this.gateGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
    if (this.rawStream) {
      this.rawStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    if (deafened) {
      this.isMuted = true;
    }
    if (this.audioContext && this.gateGainNode && deafened) {
      this.gateGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = deafened ? false : !this.isMuted;
      });
    }
    if (this.rawStream) {
      this.rawStream.getAudioTracks().forEach((t) => {
        t.enabled = deafened ? false : !this.isMuted;
      });
    }
    for (const [, peer] of this.peers.entries()) {
      peer.remoteAudio.muted = deafened;
    }
  }

  setPeerVolume(userId: string, volumePercent: number) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.remoteAudio.volume = Math.max(0, Math.min(1, volumePercent / 100));
    }
  }

  setPeerMuted(userId: string, muted: boolean) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.remoteAudio.muted = muted;
    }
  }

  unlockAudio() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    for (const [, peer] of this.peers.entries()) {
      if (peer.remoteAudio) {
        peer.remoteAudio.play().catch(() => {});
      }
    }
  }

  leaveRoom() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.unsubSignal) this.unsubSignal();
    if (this.unsubPeerJoined) this.unsubPeerJoined();
    if (this.unsubPeerLeft) this.unsubPeerLeft();
    if (this.unsubExistingPeers) this.unsubExistingPeers();

    if (this.currentRoomId) {
      wsClient.send('voice:leave', { roomId: this.currentRoomId });
    }

    for (const [, peer] of this.peers.entries()) {
      peer.remoteAudio.pause();
      peer.remoteAudio.srcObject = null;
      peer.remoteAudio.remove();
      peer.pc.close();
    }
    this.peers.clear();

    if (this.rawStream) {
      this.rawStream.getTracks().forEach((t) => t.stop());
      this.rawStream = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.sourceNode = null;
    this.highpassFilter = null;
    this.gateGainNode = null;
    this.destinationNode = null;
    this.bypassGainNode = null;
    this.analyser = null;
    this.currentRoomId = null;
    this.currentUserId = null;
  }
}

export const voiceManager = new VoiceManager();
