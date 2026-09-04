import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config';

export class LiveKitService {
  static async generateToken(params: {
    roomId: string;
    userId: string;
    username: string;
    canPublish: boolean;
    canSubscribe: boolean;
  }): Promise<string> {
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: params.userId,
      name: params.username,
      ttl: '15m',
    });

    at.addGrant({
      room: params.roomId,
      roomJoin: true,
      canPublish: params.canPublish,
      canSubscribe: params.canSubscribe,
      canPublishData: true,
    });

    return await at.toJwt();
  }
}
