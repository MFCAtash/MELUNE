import { describe, it, expect, beforeEach } from "vitest";
import {
  registerPlayerAudioElement,
  getSharedAnalyser,
  isAnalyserPermanentlyUnavailable,
  resumeSharedAudioContext,
} from "../audio-analyser-bridge";

describe("audio-analyser-bridge", () => {
  beforeEach(() => {
    registerPlayerAudioElement(null);
  });

  it("returns null and never throws when no audio element has registered yet", () => {
    expect(() => getSharedAnalyser()).not.toThrow();
    expect(getSharedAnalyser()).toBeNull();
  });

  it("returns null and never throws when Web Audio API is unavailable (jsdom has no AudioContext)", () => {
    const el = document.createElement("audio");
    registerPlayerAudioElement(el);
    expect(() => getSharedAnalyser()).not.toThrow();
    expect(getSharedAnalyser()).toBeNull();
  });

  it("reports permanent unavailability rather than retrying forever once a build attempt has failed", () => {
    const el = document.createElement("audio");
    registerPlayerAudioElement(el);
    getSharedAnalyser();
    expect(isAnalyserPermanentlyUnavailable()).toBe(true);
  });

  it("resumeSharedAudioContext is a safe no-op when there is no context yet", () => {
    expect(() => resumeSharedAudioContext()).not.toThrow();
  });
});
