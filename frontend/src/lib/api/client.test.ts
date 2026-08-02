import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAPI } from "./client";
import { OFFLINE_MESSAGE, UNREACHABLE_MESSAGE } from "./network-error";
import { onSessionExpired, resetSessionExpiredNotice } from "@/lib/auth/session-expiry";

describe("fetchAPI", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws a user-facing message when the network fails, never the dev hint", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(fetchAPI("/health")).rejects.toThrow(UNREACHABLE_MESSAGE);
    await expect(fetchAPI("/health")).rejects.not.toThrow(/npm run dev:backend/);
    await expect(fetchAPI("/health")).rejects.not.toThrow(/localhost:3000/);
  });

  it("reports being offline when the browser knows it is", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(fetchAPI("/health")).rejects.toThrow(OFFLINE_MESSAGE);
  });

  it("signals session expiry on 401 instead of hard-navigating away", async () => {
    resetSessionExpiredNotice();
    const onExpired = vi.fn();
    const unsubscribe = onSessionExpired(onExpired);
    const hrefBefore = window.location.href;

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    } as Response);

    await expect(fetchAPI("/branches")).rejects.toThrow("Unauthorized");

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe(hrefBefore);
    unsubscribe();
  });

  it("throws on non-ok responses with server message", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Invalid credentials" }),
    } as Response);

    await expect(fetchAPI("/auth/login", { method: "POST" })).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("returns parsed JSON on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ status: "ok" }),
    } as Response);

    await expect(fetchAPI("/health")).resolves.toEqual({ status: "ok" });
  });

  it("sends credentials on every request", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => "{}",
    } as Response);

    await fetchAPI("/branches");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("returns null for 204 No Content", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "",
    } as Response);

    await expect(fetchAPI("/auth/logout", { method: "POST" })).resolves.toBeNull();
  });
});
