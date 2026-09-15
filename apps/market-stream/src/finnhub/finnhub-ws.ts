import WebSocket from 'ws';
import type { FinnhubSocketLike } from './finnhub-socket';

/** Default Finnhub transport — one real WebSocket per process (AC1). */
export function createFinnhubWebSocket(url: string): FinnhubSocketLike {
  const ws = new WebSocket(url);
  return {
    send: (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    close: () => {
      ws.close();
    },
    on: (event, handler) => {
      if (event === 'message') {
        ws.on('message', (raw: Buffer | string) => {
          handler(typeof raw === 'string' ? Buffer.from(raw) : raw);
        });
        return;
      }
      ws.on(event, handler);
    },
  };
}
