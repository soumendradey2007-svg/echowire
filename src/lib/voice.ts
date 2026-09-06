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
  public isMuted: boolean = false;
  public isDeafened: boolean = false;
  private noiseCancellation: boolean = true;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  // Multi-stage Studio DSP Nodes
  private highpassFilter1: BiquadFilterNode | null = null;
  private highpassFilter2: BiquadFilterNode | null = null;
  private notchFilter50: BiquadFilterNode | null = null;
  private notchFilter60: BiquadFilterNode | null = null;
  private voicePresenceEq: BiquadFilterNode | null = null;
  private highShelfBirdFilter: BiquadFilterNode | null = null;
  private lowpassFilter1: BiquadFilterNode | null = null;
  private lowpassFilter2: BiquadFilterNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
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
          autoGainControl: { ideal: false },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          googEchoCancellation: { ideal: true },
          googAutoGainControl: { ideal: false },
          googNoiseSuppression: { ideal: true },
          googHighpassFilter: { ideal: true },
          googNoiseReduction: { ideal: true },
          googExperimentalNoiseSuppression: { ideal: true },
        } as any,
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawStream);

      // --- ADVANCED MULTI-STAGE VOICE ISOLATION DSP CHAIN ---
      const now = this.audioContext.currentTime;

      // 1. Dual-stage Cascading 24dB/octave Sub-bass Butterworth Filter (125Hz)
      // Eliminates table vibrations, desk knocks, AC air turbulence, fan hum (<120Hz)
      this.highpassFilter1 = this.audioContext.createBiquadFilter();
      this.highpassFilter1.type = 'highpass';
      this.highpassFilter1.frequency.setValueAtTime(125, now);
      this.highpassFilter1.Q.setValueAtTime(0.7071, now);

      this.highpassFilter2 = this.audioContext.createBiquadFilter();
      this.highpassFilter2.type = 'highpass';
      this.highpassFilter2.frequency.setValueAtTime(125, now);
      this.highpassFilter2.Q.setValueAtTime(0.7071, now);

      // 2. Dual Mains Power Hum Notch Filters (50Hz and 60Hz)
      // Cuts international electrical ground hum and AC adapter buzzing
      this.notchFilter50 = this.audioContext.createBiquadFilter();
      this.notchFilter50.type = 'notch';
      this.notchFilter50.frequency.setValueAtTime(50, now);
      this.notchFilter50.Q.setValueAtTime(6.0, now);

      this.notchFilter60 = this.audioContext.createBiquadFilter();
      this.notchFilter60.type = 'notch';
      this.notchFilter60.frequency.setValueAtTime(60, now);
      this.notchFilter60.Q.setValueAtTime(6.0, now);

      // 3. Speech Intelligibility & Presence Peaking Filter (2200Hz)
      // Boosts human vocal clarity, vowel formant definition and consonants
      this.voicePresenceEq = this.audioContext.createBiquadFilter();
      this.voicePresenceEq.type = 'peaking';
      this.voicePresenceEq.frequency.setValueAtTime(2200, now);
      this.voicePresenceEq.Q.setValueAtTime(1.1, now);
      this.voicePresenceEq.gain.setValueAtTime(2.0, now);

      // 4. Dedicated Bird Chirp & High-Whistle Attenuator (High Shelf @ 3400Hz)
      // Bird calls almost exclusively reside between 3500Hz and 7500Hz.
      // This ducks that entire band by -14dB continuously in the audio path!
      this.highShelfBirdFilter = this.audioContext.createBiquadFilter();
      this.highShelfBirdFilter.type = 'highshelf';
      this.highShelfBirdFilter.frequency.setValueAtTime(3400, now);
      this.highShelfBirdFilter.gain.setValueAtTime(-14, now);

      // 5. Dual Cascading Steep Lowpass Filter (4000Hz, 24dB/octave)
      // Brickwalls bird chirps, cricket noise, fan hiss, and high-frequency screech.
      // Human speech remains crystal clear and warm (human voice formants are <3400Hz).
      this.lowpassFilter1 = this.audioContext.createBiquadFilter();
      this.lowpassFilter1.type = 'lowpass';
      this.lowpassFilter1.frequency.setValueAtTime(4000, now);
      this.lowpassFilter1.Q.setValueAtTime(0.7071, now);

      this.lowpassFilter2 = this.audioContext.createBiquadFilter();
      this.lowpassFilter2.type = 'lowpass';
      this.lowpassFilter2.frequency.setValueAtTime(4200, now);
      this.lowpassFilter2.Q.setValueAtTime(0.7071, now);

      // 6. Transparent Peak Safety Limiter (ZERO Makeup Gain)
      // CRITICAL: We do NOT use a low-threshold compressor (-28dB) because Web Audio's
      // DynamicsCompressorNode adds +14dB automatic makeup gain that boosts background room noise!
      // Instead, we use a high-threshold transparent peak limiter (-3dB) with 0dB makeup gain,
      // which ONLY engages on loud shouts/peaks to prevent digital clipping.
      this.limiterNode = this.audioContext.createDynamicsCompressor();
      this.limiterNode.threshold.setValueAtTime(-3, now);
      this.limiterNode.knee.setValueAtTime(0, now);
      this.limiterNode.ratio.setValueAtTime(20, now);
      this.limiterNode.attack.setValueAtTime(0.001, now);
      this.limiterNode.release.setValueAtTime(0.04, now);

      // 7. Precision Psychoacoustic Expander / Noise Gate Node
      this.gateGainNode = this.audioContext.createGain();
      this.gateGainNode.gain.setValueAtTime(this.noiseCancellation ? 0.0 : 1.0, now);

      // 8. WebRTC Destination
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Bypass path (when NC is disabled)
      this.bypassGainNode = this.audioContext.createGain();
      this.bypassGainNode.gain.setValueAtTime(this.noiseCancellation ? 0.0 : 1.0, now);

      // Connect Processed Signal Chain:
      // source -> hp1 -> hp2 -> notch50 -> notch60 -> voicePresenceEq -> highShelfBirdFilter -> lp1 -> lp2 -> limiter -> gateGain -> destination
      this.sourceNode.connect(this.highpassFilter1);
      this.highpassFilter1.connect(this.highpassFilter2);
      this.highpassFilter2.connect(this.notchFilter50);
      this.notchFilter50.connect(this.notchFilter60);
      this.notchFilter60.connect(this.voicePresenceEq);
      this.voicePresenceEq.connect(this.highShelfBirdFilter);
      this.highShelfBirdFilter.connect(this.lowpassFilter1);
      this.lowpassFilter1.connect(this.lowpassFilter2);
      this.lowpassFilter2.connect(this.limiterNode);
      this.limiterNode.connect(this.gateGainNode);
      this.gateGainNode.connect(this.destinationNode);

      // Connect Bypass Signal Chain:
      this.sourceNode.connect(this.bypassGainNode);
      this.bypassGainNode.connect(this.destinationNode);

      // 9. High-Resolution Spectral Analyser for Voice Activity & Noise Discrimination
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
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
    const fftSize = this.analyser.fftSize;
    const timeData = new Uint8Array(fftSize);
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    let lastSpokenTime = 0;
    const HOLD_TIME_MS = 220; // 220ms natural speech hangover prevents clipping word endings

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
      // At 48kHz with 1024 FFT, each bin is ~46.875Hz.

      // Pitch Fundamental Band (140Hz - 330Hz, bins 3 to 7)
      // Near-field human speakers produce high acoustic energy here due to chest resonance & vocal cord oscillation.
      let pitchSum = 0;
      for (let b = 3; b <= 7; b++) {
        pitchSum += freqData[b];
      }
      const pitchFundAvg = pitchSum / 5;

      // Vocal Formant Core Band (350Hz to 2400Hz, bins 8 to 51)
      // Primary human speech intelligibility & vowel formant envelope
      let vocalCoreSum = 0;
      for (let b = 8; b <= 51; b++) {
        vocalCoreSum += freqData[b];
      }
      const vocalCoreAvg = vocalCoreSum / 44;

      // Bird Chirp & High Whistle Band (3500Hz to 7500Hz, bins 75 to 160)
      // Bird songs, whistling, crickets, coil whine
      let birdSum = 0;
      for (let b = 75; b <= 160; b++) {
        birdSum += freqData[b];
      }
      const birdNoiseAvg = birdSum / 86;

      // 4. Adaptive Room Noise Floor Tracking
      // Dynamically adapts to ambient background hum, fan speed, room reverberation
      if (rms < this.ambientFloor) {
        this.ambientFloor = rms * 0.15 + this.ambientFloor * 0.85;
      } else {
        this.ambientFloor = this.ambientFloor * 0.998 + rms * 0.002;
      }

      // Near-field speaker threshold:
      // When a user speaks into their mic, RMS is typically 0.025 to 0.30.
      // Distant background chatter (2-5m away) and quiet birds are typically 0.004 to 0.014.
      const nearFieldThreshold = Math.max(0.018, this.ambientFloor * 2.8);
      const hasNearFieldEnergy = rms > nearFieldThreshold;

      // 5. Bird Chirp Rejection:
      // Birds have high energy in 3.5k-7.5k and virtually ZERO energy in 140-330Hz pitch band!
      const isBirdChirp = birdNoiseAvg > 16 && (birdNoiseAvg > vocalCoreAvg * 0.9 || pitchFundAvg < 8);

      // 6. Near-Field Human Speech Identification:
      // - Must have sufficient near-field energy (rejects distant room chatter)
      // - Must NOT be bird chirping
      // - Vocal core must exceed baseline threshold (rejects room hum & fan whoosh)
      // - Vocal core must dominate over high-frequency noise
      // - Pitch fundamental or strong vocal resonance must be present
      const isSpeech = hasNearFieldEnergy &&
                       !isBirdChirp &&
                       vocalCoreAvg > 16 &&
                       vocalCoreAvg > birdNoiseAvg * 1.25 &&
                       (pitchFundAvg > 8 || vocalCoreAvg > 26);

      const now = performance.now();
      if (isSpeech) {
        lastSpokenTime = now;
      }

      const isVoiceActive = isSpeech || (now - lastSpokenTime < HOLD_TIME_MS);

      // 7. Smooth Downward Expander (10ms attack, 50ms smooth release)
      if (this.gateGainNode && this.noiseCancellation) {
        const targetGain = isVoiceActive && !this.isMuted && !this.isDeafened ? 1.0 : 0.0;
        const timeConstant = targetGain > 0.5 ? 0.010 : 0.050;
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
        return `a=fmtp:${pt} ${params};useinbandfec=1;usedtx=1;maxaveragebitrate=64000;stereo=0;sprop-stereo=0;cbr=0`;
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
    this.highpassFilter1 = null;
    this.highpassFilter2 = null;
    this.notchFilter50 = null;
    this.notchFilter60 = null;
    this.voicePresenceEq = null;
    this.highShelfBirdFilter = null;
    this.lowpassFilter1 = null;
    this.lowpassFilter2 = null;
    this.limiterNode = null;
    this.gateGainNode = null;
    this.destinationNode = null;
    this.bypassGainNode = null;
    this.analyser = null;
    this.currentRoomId = null;
    this.currentUserId = null;
  }
}

export const voiceManager = new VoiceManager();
