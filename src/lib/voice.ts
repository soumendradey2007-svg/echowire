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
  // Multi-stage Studio DSP Nodes
  private highpassFilter1: BiquadFilterNode | null = null;
  private highpassFilter2: BiquadFilterNode | null = null;
  private notchFilter50: BiquadFilterNode | null = null;
  private notchFilter60: BiquadFilterNode | null = null;
  private voiceEqNode: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
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
          googEchoCancellation: { ideal: true },
          googAutoGainControl: { ideal: true },
          googNoiseSuppression: { ideal: true },
          googHighpassFilter: { ideal: true },
          googNoiseReduction: { ideal: true },
        } as any,
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawStream);

      // --- DISCORD-GRADE MULTI-STAGE DSP CHAIN ---
      // 1. Dual-stage Cascading 24dB/octave Sub-bass Butterworth Filter (85Hz)
      // Eliminates table vibrations, desk knocks, AC air turbulence, phone buzzing
      this.highpassFilter1 = this.audioContext.createBiquadFilter();
      this.highpassFilter1.type = 'highpass';
      this.highpassFilter1.frequency.setValueAtTime(85, this.audioContext.currentTime);
      this.highpassFilter1.Q.setValueAtTime(0.7071, this.audioContext.currentTime);

      this.highpassFilter2 = this.audioContext.createBiquadFilter();
      this.highpassFilter2.type = 'highpass';
      this.highpassFilter2.frequency.setValueAtTime(85, this.audioContext.currentTime);
      this.highpassFilter2.Q.setValueAtTime(0.7071, this.audioContext.currentTime);

      // 2. Dual Mains Power Hum Notch Filters (50Hz and 60Hz)
      // Cuts electrical ground hum and AC adapter buzzing
      this.notchFilter50 = this.audioContext.createBiquadFilter();
      this.notchFilter50.type = 'notch';
      this.notchFilter50.frequency.setValueAtTime(50, this.audioContext.currentTime);
      this.notchFilter50.Q.setValueAtTime(4.0, this.audioContext.currentTime);

      this.notchFilter60 = this.audioContext.createBiquadFilter();
      this.notchFilter60.type = 'notch';
      this.notchFilter60.frequency.setValueAtTime(60, this.audioContext.currentTime);
      this.notchFilter60.Q.setValueAtTime(4.0, this.audioContext.currentTime);

      // 3. Speech Intelligibility & Presence Peaking Filter (2800Hz)
      // Boosts human vocal clarity and formant definition
      this.voiceEqNode = this.audioContext.createBiquadFilter();
      this.voiceEqNode.type = 'peaking';
      this.voiceEqNode.frequency.setValueAtTime(2800, this.audioContext.currentTime);
      this.voiceEqNode.Q.setValueAtTime(1.2, this.audioContext.currentTime);
      this.voiceEqNode.gain.setValueAtTime(2.2, this.audioContext.currentTime);

      // 4. Lowpass Hiss Cutoff Filter (11500Hz)
      // Eliminates coil whine, RF interference, and USB static hiss
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(11500, this.audioContext.currentTime);
      this.lowpassFilter.Q.setValueAtTime(0.7071, this.audioContext.currentTime);

      // 5. Broadcast Dynamic Voice Compressor & Downward Expander
      // Tightens vocal dynamics, prevents clipping, and pushes down background room noise
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-28, this.audioContext.currentTime);
      this.compressorNode.knee.setValueAtTime(12, this.audioContext.currentTime);
      this.compressorNode.ratio.setValueAtTime(3.5, this.audioContext.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressorNode.release.setValueAtTime(0.12, this.audioContext.currentTime);

      // 6. Precision Noise Gate Gain Node
      this.gateGainNode = this.audioContext.createGain();
      this.gateGainNode.gain.setValueAtTime(this.noiseCancellation ? 0.0 : 1.0, this.audioContext.currentTime);

      // 7. WebRTC Destination
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Bypass path (when NC is disabled)
      this.bypassGainNode = this.audioContext.createGain();
      this.bypassGainNode.gain.setValueAtTime(this.noiseCancellation ? 0.0 : 1.0, this.audioContext.currentTime);

      // Connect Processed Signal Chain:
      // source -> hp1 -> hp2 -> notch50 -> notch60 -> voiceEq -> lowpass -> compressor -> gateGain -> destination
      this.sourceNode.connect(this.highpassFilter1);
      this.highpassFilter1.connect(this.highpassFilter2);
      this.highpassFilter2.connect(this.notchFilter50);
      this.notchFilter50.connect(this.notchFilter60);
      this.notchFilter60.connect(this.voiceEqNode);
      this.voiceEqNode.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.gateGainNode);
      this.gateGainNode.connect(this.destinationNode);

      // Connect Bypass Signal Chain:
      this.sourceNode.connect(this.bypassGainNode);
      this.bypassGainNode.connect(this.destinationNode);

      // 8. High-Resolution Spectral Analyser for Voice Activity & Noise Detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.25;
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
    const fftSize = this.analyser.fftSize;
    const timeData = new Uint8Array(fftSize);
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    let lastSpokenTime = 0;
    const HOLD_TIME_MS = 340; // 340ms hold prevents word clipping

    const loop = () => {
      if (!this.analyser || !this.audioContext) return;
      this.analyser.getByteTimeDomainData(timeData);
      this.analyser.getByteFrequencyData(freqData);

      // 1. Calculate true RMS
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const norm = (timeData[i] - 128) / 128;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      // 2. Decibel Calculation for UI meters
      const db = 20 * Math.log10(Math.max(rms, 0.0001));
      const minDb = -48;
      const maxDb = -12;
      const rawPercent = ((db - minDb) / (maxDb - minDb)) * 100;
      const micPercent = Math.min(100, Math.max(0, Math.round(rawPercent)));

      for (const cb of this.onMicLevelCallbacks) {
        cb(micPercent);
      }

      // 3. Multi-Band Spectral Voice Discrimination
      // At 48kHz with 1024 FFT, each bin is ~46.875Hz
      // Vocal formant range: 280Hz to 3400Hz (bins 6 to 72)
      let vocalSum = 0;
      for (let b = 6; b <= 72; b++) {
        vocalSum += freqData[b];
      }
      const vocalAvg = vocalSum / 67;

      // High noise, mechanical keyboard clicks & mic hiss (>4000Hz, bins 85 to 220)
      let hissSum = 0;
      for (let b = 85; b <= 220; b++) {
        hissSum += freqData[b];
      }
      const hissAvg = hissSum / 136;

      // 4. Adaptive Room Noise Floor Tracking
      if (rms < this.ambientFloor) {
        this.ambientFloor = rms * 0.15 + this.ambientFloor * 0.85;
      } else {
        this.ambientFloor = this.ambientFloor * 0.998 + rms * 0.002;
      }

      const noiseThreshold = Math.max(0.011, this.ambientFloor * 2.2);
      const now = performance.now();

      // Vocal Formant Pattern Match:
      // True human speech has dominant energy in vocal formants vs broadband hiss
      const isVoiceFormantPresent = vocalAvg > 12 && (vocalAvg > hissAvg * 1.15 || vocalAvg > 35);
      const isSpeech = rms > noiseThreshold && isVoiceFormantPresent;

      if (isSpeech) {
        lastSpokenTime = now;
      }

      const isVoiceActive = isSpeech || (now - lastSpokenTime < HOLD_TIME_MS);

      // 5. Studio-Grade Psychoacoustic Gate (8ms attack, 40ms smooth release)
      if (this.gateGainNode && this.noiseCancellation) {
        const targetGain = isVoiceActive && !this.isMuted && !this.isDeafened ? 1.0 : 0.0;
        const timeConstant = targetGain > 0.5 ? 0.008 : 0.040;
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

  private optimizeOpusSdp(sdp: string): string {
    if (!sdp) return sdp;
    return sdp.replace(/a=fmtp:(\d+)\s+([^\r\n]+)/g, (match, pt, params) => {
      if (params.includes('minptime') || params.includes('useinbandfec') || match.toLowerCase().includes('opus')) {
        return `a=fmtp:${pt} ${params};useinbandfec=1;usedtx=1;maxaveragebitrate=64000;stereo=0;sprop-stereo=0`;
      }
      return match;
    });
  }

  private async initiateCall(targetUserId: string) {
    const peer = await this.getOrCreatePeer(targetUserId);
    const offer = await peer.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    if (offer.sdp) {
      offer.sdp = this.optimizeOpusSdp(offer.sdp);
    }
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
      if (answer.sdp) {
        answer.sdp = this.optimizeOpusSdp(answer.sdp);
      }
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
