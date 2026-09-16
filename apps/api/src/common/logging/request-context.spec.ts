import { getRequestId, requestContextStorage } from './request-context';

describe('request-context', () => {
  it('AC33: returns undefined outside any active AsyncLocalStorage scope', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('AC33: returns the requestId set for the current scope via .run()', () => {
    requestContextStorage.run({ requestId: 'req-1' }, () => {
      expect(getRequestId()).toBe('req-1');
    });
  });

  it('AC33: an inner scope does not leak into an outer/sibling scope once it exits', () => {
    requestContextStorage.run({ requestId: 'outer' }, () => {
      requestContextStorage.run({ requestId: 'inner' }, () => {
        expect(getRequestId()).toBe('inner');
      });
      expect(getRequestId()).toBe('outer');
    });
    expect(getRequestId()).toBeUndefined();
  });

  it('AC33: propagates through nested async continuations (setTimeout)', async () => {
    await new Promise<void>((resolve) => {
      requestContextStorage.run({ requestId: 'async-req' }, () => {
        setTimeout(() => {
          expect(getRequestId()).toBe('async-req');
          resolve();
        }, 0);
      });
    });
  });
});
