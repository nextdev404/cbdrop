import { describe, it, expect, vi } from "vitest";

describe("Automatic URL Analysis on Paste", () => {
  it("cleans pasted URL and strips outer quotes and whitespaces", () => {
    const rawUrl = '  "https://www.youtube.com/watch?v=aqz-KE-bpKQ"  ';
    const clean = rawUrl.trim().replace(/^["']|["']$/g, "");
    expect(clean).toBe("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
  });

  it("identifies valid URL patterns for auto-analyze triggers", () => {
    const isUrlOrMedia = (text: string) =>
      /^(https?:\/\/|www\.|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/)/i.test(text) ||
      text.startsWith("<");

    expect(isUrlOrMedia("https://www.youtube.com/watch?v=123")).toBe(true);
    expect(isUrlOrMedia("https://tiktok.com/@user/video/123")).toBe(true);
    expect(isUrlOrMedia("https://instagram.com/p/abc/")).toBe(true);
    expect(isUrlOrMedia("https://x.com/user/status/123")).toBe(true);
    expect(isUrlOrMedia("www.youtube.com/watch?v=123")).toBe(true);
    expect(isUrlOrMedia("<!DOCTYPE html><html><body>...</body></html>")).toBe(true);

    // Should not trigger on arbitrary plain text
    expect(isUrlOrMedia("hello world")).toBe(false);
    expect(isUrlOrMedia("just typing a normal sentence")).toBe(false);
  });

  it("triggers analysis when user pastes a URL", () => {
    const analyzeWithUrlMock = vi.fn();
    const setUrlMock = vi.fn();

    function triggerAutoAnalyze(pastedText: string) {
      const clean = pastedText.trim().replace(/^["']|["']$/g, "");
      if (!clean) return;
      setUrlMock(clean);
      analyzeWithUrlMock(clean);
    }

    const testUrl = "https://www.youtube.com/watch?v=LlhTEttKcwQ";
    triggerAutoAnalyze(testUrl);

    expect(setUrlMock).toHaveBeenCalledWith(testUrl);
    expect(analyzeWithUrlMock).toHaveBeenCalledWith(testUrl);
  });

  it("does not trigger auto-analyze on empty clipboard content", () => {
    const analyzeWithUrlMock = vi.fn();
    const setUrlMock = vi.fn();

    function triggerAutoAnalyze(pastedText: string) {
      const clean = pastedText.trim().replace(/^["']|["']$/g, "");
      if (!clean) return;
      setUrlMock(clean);
      analyzeWithUrlMock(clean);
    }

    triggerAutoAnalyze("   ");
    expect(setUrlMock).not.toHaveBeenCalled();
    expect(analyzeWithUrlMock).not.toHaveBeenCalled();
  });
});
