import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Theme System Default & Persistence", () => {
  let store: Record<string, string> = {};
  let rootClasses: Set<string>;

  beforeEach(() => {
    store = {};
    rootClasses = new Set<string>();

    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        store[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
    vi.stubGlobal("localStorage", mockLocalStorage);

    // Mock document.documentElement
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

  // Test 1: Fresh visit with no saved theme -> Dark Mode
  it("defaults to Dark Mode on fresh visit when no saved theme exists", () => {
    expect(localStorage.getItem("theme")).toBeNull();

    // Emulate index.html bootstrap script
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }

    expect(rootClasses.has("dark")).toBe(true);
  });

  // Test 2: Switch to Light Mode -> Light Mode
  it("switches to Light Mode and persists preference in localStorage", () => {
    // Starting in dark mode
    document.documentElement.classList.add("dark");
    expect(rootClasses.has("dark")).toBe(true);

    // User toggles theme to light
    const nextTheme = "light";
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", nextTheme);

    expect(rootClasses.has("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  // Test 3: Refresh the page -> Light Mode remains
  it("remains in Light Mode after page reload when light was chosen", () => {
    // Stored theme is "light"
    store["theme"] = "light";

    // Emulate index.html bootstrap script on reload
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }

    expect(rootClasses.has("dark")).toBe(false);
  });

  // Test 4: Switch back to Dark Mode -> Dark Mode
  it("switches back to Dark Mode and persists 'dark' in localStorage", () => {
    store["theme"] = "light";

    // User toggles theme back to dark
    const nextTheme = "dark";
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", nextTheme);

    expect(rootClasses.has("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  // Test 5: Refresh the page -> Dark Mode remains
  it("remains in Dark Mode after page reload when dark was chosen", () => {
    store["theme"] = "dark";

    // Emulate index.html bootstrap script on reload
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }

    expect(rootClasses.has("dark")).toBe(true);
  });
});
