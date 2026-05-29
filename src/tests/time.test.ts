import { describe, it, expect } from "vitest";
import { formatDuration, formatRelative } from "../core/time.js";

describe("formatDuration", () => {
  it("formats sub-second", () => {
    expect(formatDuration(450)).toBe("450ms");
  });
  it("formats seconds", () => {
    expect(formatDuration(2500)).toBe("2.5s");
  });
  it("formats minutes and seconds", () => {
    expect(formatDuration(75_000)).toBe("1m 15s");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(3_725_000)).toBe("1h 2m");
  });
  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0ms");
  });
});

describe("formatRelative", () => {
  it("returns 'just now' for very recent", () => {
    const now = new Date();
    expect(formatRelative(now.toISOString(), now)).toBe("just now");
  });
  it("formats minutes ago", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:55:00Z").toISOString();
    expect(formatRelative(past, now)).toBe("5 minutes ago");
  });
  it("formats single minute ago", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const past = new Date("2026-01-01T11:59:00Z").toISOString();
    expect(formatRelative(past, now)).toBe("1 minute ago");
  });
});
