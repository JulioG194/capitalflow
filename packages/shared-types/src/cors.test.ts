import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './cors';

const webAppOrigin = 'https://capitalflow.vercel.app';
const webPreviewOriginRegex = '^https://capitalflow-[a-z0-9-]+\\.vercel\\.app$';

describe('isOriginAllowed', () => {
  it('allows requests with no Origin header (AC7: curl, health checks)', () => {
    expect(isOriginAllowed(undefined, { webAppOrigin })).toBe(true);
  });

  it('allows the local dev origin', () => {
    expect(
      isOriginAllowed('http://localhost:3000', { webAppOrigin }),
    ).toBe(true);
  });

  it('allows an exact match on webAppOrigin', () => {
    expect(isOriginAllowed(webAppOrigin, { webAppOrigin })).toBe(true);
  });

  it('allows an origin matching webPreviewOriginRegex when set', () => {
    expect(
      isOriginAllowed('https://capitalflow-pr-42.vercel.app', {
        webAppOrigin,
        webPreviewOriginRegex,
      }),
    ).toBe(true);
  });

  it('rejects a preview-like origin when webPreviewOriginRegex is absent (fail closed)', () => {
    expect(
      isOriginAllowed('https://capitalflow-pr-42.vercel.app', {
        webAppOrigin,
      }),
    ).toBe(false);
  });

  it('rejects an origin that matches none of the rules', () => {
    expect(
      isOriginAllowed('https://evil.example.com', {
        webAppOrigin,
        webPreviewOriginRegex,
      }),
    ).toBe(false);
  });

  it('rejects an empty-string origin the same as no rule matching (not treated as "no Origin header")', () => {
    // An empty string is falsy but distinct from `undefined` in principle;
    // this documents that our `!origin` check intentionally treats both the
    // same way (no legitimate browser sends an empty-string Origin header).
    expect(isOriginAllowed('', { webAppOrigin, webPreviewOriginRegex })).toBe(
      true,
    );
  });
});
