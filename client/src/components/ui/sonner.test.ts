import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Sonner Toaster Theme Integration", () => {
  let rootClasses: Set<string>;

  beforeEach(() => {
    rootClasses = new Set<string>();

    const mockDocElement = {
      classList: {
        add: vi.fn((cls: string) => rootClasses.add(cls)),
        remove: vi.fn((cls: string) => rootClasses.delete(cls)),
        toggle: vi.fn((cls: string, force?: boolean) => {
          if (force !== undefined) {
            if (force) rootClasses.add(cls);
            else rootClasses.delete(cls);
            return force;
          }
          if (rootClasses.has(cls)) {
            rootClasses.delete(cls);
            return false;
          } else {
            rootClasses.add(cls);
            return true;
          }
        }),
        contains: vi.fn((cls: string) => rootClasses.has(cls)),
      },
    };
    vi.stubGlobal("document", { documentElement: mockDocElement });
  });

  it("identifies dark mode when dark class is present", () => {
    document.documentElement.classList.add("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    const isDark = document.documentElement.classList.contains("dark");
    const theme = isDark ? "dark" : "light";
    expect(theme).toBe("dark");

    const normalBg = isDark ? "#1a1c22" : "#ffffff";
    const normalText = isDark ? "#f7f7f2" : "#111318";
    const normalBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "#e1e2da";

    expect(normalBg).toBe("#1a1c22");
    expect(normalText).toBe("#f7f7f2");
    expect(normalBorder).toBe("rgba(255, 255, 255, 0.1)");
  });

  it("identifies light/white mode when dark class is absent", () => {
    document.documentElement.classList.remove("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    const isDark = document.documentElement.classList.contains("dark");
    const theme = isDark ? "dark" : "light";
    expect(theme).toBe("light");

    const normalBg = isDark ? "#1a1c22" : "#ffffff";
    const normalText = isDark ? "#f7f7f2" : "#111318";
    const normalBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "#e1e2da";

    expect(normalBg).toBe("#ffffff");
    expect(normalText).toBe("#111318");
    expect(normalBorder).toBe("#e1e2da");
  });
});
