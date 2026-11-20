import { describe, it, expect, beforeEach } from "vitest";
import { useAmbientThemeStore } from "../ambient-theme-store";
import { useThemeStore } from "../theme-store";

describe("ambient-theme-store", () => {
  beforeEach(() => {
    useAmbientThemeStore.setState({ mode: "dynamic" });
    useThemeStore.setState({ theme: "dark" });
    delete document.documentElement.dataset.amoled;
  });

  it("defaults to dynamic — matches the app's existing per-track tinting behavior", () => {
    expect(useAmbientThemeStore.getState().mode).toBe("dynamic");
  });

  it("setMode sets an explicit mode", () => {
    useAmbientThemeStore.getState().setMode("static");
    expect(useAmbientThemeStore.getState().mode).toBe("static");
  });

  it("cycleMode cycles dynamic -> static -> system -> amoled -> dynamic", () => {
    const { cycleMode } = useAmbientThemeStore.getState();

    expect(useAmbientThemeStore.getState().mode).toBe("dynamic");
    cycleMode();
    expect(useAmbientThemeStore.getState().mode).toBe("static");
    cycleMode();
    expect(useAmbientThemeStore.getState().mode).toBe("system");
    cycleMode();
    expect(useAmbientThemeStore.getState().mode).toBe("amoled");
    cycleMode();
    expect(useAmbientThemeStore.getState().mode).toBe("dynamic");
  });

  it("cycles correctly even starting from a non-default mode", () => {
    useAmbientThemeStore.getState().setMode("system");
    useAmbientThemeStore.getState().cycleMode();
    expect(useAmbientThemeStore.getState().mode).toBe("amoled");
  });

  it("selecting amoled sets the data-amoled DOM attribute and forces dark theme", () => {
    useThemeStore.getState().setTheme("light");
    useAmbientThemeStore.getState().setMode("amoled");

    expect(document.documentElement.dataset.amoled).toBe("true");
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("leaving amoled clears the data-amoled DOM attribute", () => {
    useAmbientThemeStore.getState().setMode("amoled");
    expect(document.documentElement.dataset.amoled).toBe("true");

    useAmbientThemeStore.getState().setMode("dynamic");
    expect(document.documentElement.dataset.amoled).toBeUndefined();
  });
});
