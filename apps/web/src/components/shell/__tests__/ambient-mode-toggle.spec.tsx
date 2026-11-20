import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AmbientModeToggle } from "../ambient-mode-toggle";
import { useAmbientThemeStore } from "@/store/ambient-theme-store";

describe("AmbientModeToggle", () => {
  beforeEach(() => {
    useAmbientThemeStore.setState({ mode: "dynamic" });
  });

  it("renders a single button (mirrors ThemeToggle's shape, not a dropdown)", async () => {
    render(<AmbientModeToggle />);
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(1));
  });

  it("cycles the store's mode on click", async () => {
    render(<AmbientModeToggle />);
    const button = await screen.findByRole("button");

    fireEvent.click(button);
    expect(useAmbientThemeStore.getState().mode).toBe("static");

    fireEvent.click(button);
    expect(useAmbientThemeStore.getState().mode).toBe("system");

    fireEvent.click(button);
    expect(useAmbientThemeStore.getState().mode).toBe("amoled");

    fireEvent.click(button);
    expect(useAmbientThemeStore.getState().mode).toBe("dynamic");
  });
});
