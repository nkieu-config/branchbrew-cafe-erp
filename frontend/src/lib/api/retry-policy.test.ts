import { describe, it, expect } from "vitest";
import { isRetriableFailure, retryBackoffMs, shouldRetryQuery } from "./retry-policy";
import { ApiError } from "./client";
import { NetworkError } from "./network-error";

describe("isRetriableFailure", () => {
  it("retries transport failures", () => {
    expect(isRetriableFailure(new NetworkError("offline", true))).toBe(true);
  });

  it("retries server-side and throttling responses", () => {
    expect(isRetriableFailure(new ApiError("boom", 500))).toBe(true);
    expect(isRetriableFailure(new ApiError("slow", 408))).toBe(true);
    expect(isRetriableFailure(new ApiError("easy", 429))).toBe(true);
  });

  it("never retries a client mistake — retrying cannot fix it", () => {
    expect(isRetriableFailure(new ApiError("bad input", 400))).toBe(false);
    expect(isRetriableFailure(new ApiError("nope", 401))).toBe(false);
    expect(isRetriableFailure(new ApiError("denied", 403))).toBe(false);
    expect(isRetriableFailure(new ApiError("gone", 404))).toBe(false);
    expect(isRetriableFailure(new ApiError("conflict", 409))).toBe(false);
  });

  it("does not retry unknown throwables", () => {
    expect(isRetriableFailure(new Error("???"))).toBe(false);
    expect(isRetriableFailure("string")).toBe(false);
  });
});

describe("shouldRetryQuery", () => {
  it("gives up after the attempt budget even for retriable errors", () => {
    const error = new NetworkError("offline", true);
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });

  it("stops immediately on a non-retriable error", () => {
    expect(shouldRetryQuery(0, new ApiError("bad", 400))).toBe(false);
  });
});

describe("retryBackoffMs", () => {
  it("backs off exponentially and then holds a ceiling", () => {
    expect(retryBackoffMs(0)).toBe(1000);
    expect(retryBackoffMs(1)).toBe(2000);
    expect(retryBackoffMs(2)).toBe(4000);
    expect(retryBackoffMs(10)).toBe(8000);
  });
});
