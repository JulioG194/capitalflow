export const FINNHUB_SOCKET_FACTORY = Symbol('FINNHUB_SOCKET_FACTORY');

export type FinnhubSocketEvent = 'open' | 'message' | 'close' | 'error';

export interface FinnhubSocketLike {
  send(data: string): void;
  close(): void;
  on(event: FinnhubSocketEvent, handler: (payload?: Buffer | Error) => void): void;
}

export type FinnhubSocketFactory = (url: string) => FinnhubSocketLike;
