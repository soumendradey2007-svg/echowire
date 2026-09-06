import type { MusicTrackMetadata, EphemeralMusicState } from '../shared/types';

export class MusicService {
  private static roomStates = new Map<string, EphemeralMusicState>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  private static ensureCleanupStarted() {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        for (const [rid, state] of this.roomStates.entries()) {
          // If paused/empty and not updated for 2 hours, purge from memory
          if (!state.isPlaying && state.updatedAtServerTime < twoHoursAgo && rid !== 'global') {
            this.roomStates.delete(rid);
          }
        }
      }, 15 * 60 * 1000);
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  private static getOrCreateRoomState(roomId: string): EphemeralMusicState {
    this.ensureCleanupStarted();
    const rid = roomId || 'global';
    let s = this.roomStates.get(rid);
    if (!s) {
      s = {
        roomId: rid,
        track: null,
        isPlaying: false,
        basePositionSeconds: 0,
        updatedAtServerTime: Date.now(),
        queue: [],
      };
      this.roomStates.set(rid, s);
    }
    return s;
  }

  static getState(roomId?: string): EphemeralMusicState {
    return this.getOrCreateRoomState(roomId || 'global');
  }

  static clearRoom(roomId: string) {
    this.roomStates.delete(roomId);
  }

  static control(roomId: string, action: string, position?: number, track?: any): EphemeralMusicState {
    const s = this.getOrCreateRoomState(roomId);
    const now = Date.now();

    if (action === 'play') {
      s.isPlaying = true;
      s.updatedAtServerTime = now;
    } else if (action === 'pause') {
      s.isPlaying = false;
      s.updatedAtServerTime = now;
    } else if (action === 'seek') {
      s.basePositionSeconds = position || 0;
      s.updatedAtServerTime = now;
    } else if (action === 'play_now' && track) {
      if (s.track) {
        s.queue.unshift(s.track);
      }
      s.track = track;
      s.isPlaying = true;
      s.basePositionSeconds = 0;
      s.updatedAtServerTime = now;
    } else if (action === 'add_track' && track) {
      if (!s.track) {
        s.track = track;
        s.isPlaying = true;
        s.basePositionSeconds = 0;
        s.updatedAtServerTime = now;
      } else if (s.queue.length < 100) {
        s.queue.push(track);
      }
    } else if (action === 'skip') {
      if (s.queue.length > 0) {
        s.track = s.queue.shift() || null;
        s.basePositionSeconds = 0;
        s.isPlaying = true;
        s.updatedAtServerTime = now;
      } else {
        s.track = null;
        s.isPlaying = false;
      }
    } else if (action === 'play_index' && position !== undefined && s.queue[position]) {
      const selected = s.queue.splice(position, 1)[0];
      s.track = selected;
      s.isPlaying = true;
      s.basePositionSeconds = 0;
      s.updatedAtServerTime = now;
    } else if (action === 'remove_queue' && position !== undefined) {
      s.queue.splice(position, 1);
    }

    return s;
  }
}
