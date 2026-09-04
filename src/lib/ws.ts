type EventHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: any = null;

  connect() {
    let url = import.meta.env.VITE_WS_URL;
    if (!url) {
      const customApi = import.meta.env.VITE_API_URL ||
        (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
          ? 'https://echowire-2pw0.onrender.com'
          : '');
      if (customApi) {
        const wsProtocol = customApi.startsWith('https') ? 'wss:' : 'ws:';
        const cleanHost = customApi.replace(/^https?:\/\//, '').replace(/\/$/, '');
        url = `${wsProtocol}//${cleanHost}/api/ws`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        url = `${protocol}//${host}/api/ws`;
      }
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected to EchoWire Gateway');
    };

    this.ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        const listeners = this.handlers.get(type);
        if (listeners) {
          listeners.forEach((h) => h(data));
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
