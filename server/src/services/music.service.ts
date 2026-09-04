import type { MusicTrackMetadata, EphemeralMusicState } from '../shared/types';

export class MusicService {
  private static rooms = new Map<string, EphemeralMusicState>();

  static getState(roomId: string): EphemeralMusicState {
    let state = this.rooms.get(roomId);
    if (!state) {
      state = {
        roomId,
        track: null,
        isPlaying: false,
        basePositionSeconds: 0,
        updatedAtServerTime: Date.now(),
        queue: [],
      };
      this.rooms.set(roomId, state);
    }
    return state;
  }

  static control(roomId: string, action: string, position?: number, track?: any): EphemeralMusicState {
    const s = this.getState(roomId);
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
      } else {
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
