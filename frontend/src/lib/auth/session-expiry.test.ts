import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildLoginUrlWithReturnPath,
  notifySessionExpired,
  onSessionExpired,
  resetSessionExpiredNotice,
  resolveReturnPath,
} from "./session-expiry";

describe("session expiry signalling", () => {
  beforeEach(() => {
    resetSessionExpiredNotice();
  });

  it("notifies subscribers once per expiry, not once per failed request", () => {
    const handler = vi.fn();
    const unsubscribe = onSessionExpired(handler);

    notifySessionExpired();
    notifySessionExpired();
    notifySessionExpired();

    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("notifies again after a reset, so the next session can expire too", () => {
    const handler = vi.fn();
    const unsubscribe = onSessionExpired(handler);

    notifySessionExpired();
    resetSessionExpiredNotice();
    notifySessionExpired();

    expect(handler).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("tells a subscriber that arrives after the expiry, not only before it", () => {
    const handler = vi.fn();

    notifySessionExpired();
    const unsubscribe = onSessionExpired(handler);

    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not replay an expiry that a reset has already cleared", () => {
    const handler = vi.fn();

    notifySessionExpired();
    resetSessionExpiredNotice();
    const unsubscribe = onSessionExpired(handler);

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops notifying once unsubscribed", () => {
    const handler = vi.fn();
    onSessionExpired(handler)();

    notifySessionExpired();

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("buildLoginUrlWithReturnPath", () => {
  it("encodes the current location so login can send the user back", () => {
    expect(buildLoginUrlWithReturnPath("/inventory/stocktake", "?tab=open")).toBe(
      "/login?next=%2Finventory%2Fstocktake%3Ftab%3Dopen",
    );
  });

  it("does not make login return to itself", () => {
    expect(buildLoginUrlWithReturnPath("/login")).toBe("/login");
  });
});

describe("resolveReturnPath", () => {
  it("accepts an in-app path", () => {
    expect(resolveReturnPath("/hr/leave?status=PENDING")).toBe("/hr/leave?status=PENDING");
  });

  it("rejects absolute URLs and protocol-relative open redirects", () => {
    expect(resolveReturnPath("https://evil.example/steal")).toBeNull();
    expect(resolveReturnPath("//evil.example/steal")).toBeNull();
  });

  it("rejects a loop back to login", () => {
    expect(resolveReturnPath("/login?next=%2F")).toBeNull();
  });

  it("treats a missing param as no return path", () => {
    expect(resolveReturnPath(null)).toBeNull();
    expect(resolveReturnPath("")).toBeNull();
  });
});
