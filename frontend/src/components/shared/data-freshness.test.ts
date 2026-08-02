import { describe, it, expect } from "vitest";
import { formatFreshness } from "./data-freshness";

const NOW = new Date(2026, 7, 2, 12, 0, 0).getTime();
const agoMs = (ms: number) => NOW - ms;

describe("formatFreshness", () => {
  it("says so plainly when nothing has loaded", () => {
    expect(formatFreshness(0, NOW)).toBe("Not loaded yet");
  });

  it("treats the last few seconds as just now", () => {
    expect(formatFreshness(agoMs(0), NOW)).toBe("Updated just now");
    expect(formatFreshness(agoMs(44_000), NOW)).toBe("Updated just now");
  });

  it("switches to minutes, hours then days as data ages", () => {
    expect(formatFreshness(agoMs(5 * 60_000), NOW)).toBe("Updated 5 min ago");
    expect(formatFreshness(agoMs(3 * 3_600_000), NOW)).toBe("Updated 3 hr ago");
    expect(formatFreshness(agoMs(2 * 86_400_000), NOW)).toBe("Updated 2 d ago");
  });

  it("never reports a negative age when clocks disagree", () => {
    expect(formatFreshness(NOW + 60_000, NOW)).toBe("Updated just now");
  });
});
