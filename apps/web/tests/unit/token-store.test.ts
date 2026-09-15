import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getAccessToken,
  setAccessToken,
  subscribeToAccessToken,
} from "@/lib/auth/token-store";

describe("token-store", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it("starts with no token", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores and returns the token set via setAccessToken", () => {
    setAccessToken("access-token-123");
    expect(getAccessToken()).toBe("access-token-123");
  });

  it("notifies subscribers on every change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAccessToken(listener);

    setAccessToken("token-a");
    setAccessToken(null);

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("stops notifying a listener after it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAccessToken(listener);
    unsubscribe();

    setAccessToken("token-b");

    expect(listener).not.toHaveBeenCalled();
  });
});
