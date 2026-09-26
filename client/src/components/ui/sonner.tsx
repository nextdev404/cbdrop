import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function useSafeTheme(): "light" | "dark" {
  try {
    const ctx = useTheme();
    return ctx?.theme === "light" ? "light" : "dark";
  } catch {
    if (typeof document !== "undefined" && !document.documentElement.classList.contains("dark")) {
      return "light";
    }
    return "dark";
  }
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSafeTheme();
  const isDark = theme === "dark";

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans rounded-2xl shadow-xl transition-all duration-200 border",
          title:
            "font-semibold text-sm tracking-tight text-[#111318] dark:text-[#f7f7f2]",
          description:
            "!text-[#686b75] dark:!text-[#9ea2b0] text-xs font-normal",
          actionButton:
            "bg-[#5e5ce6] text-white hover:bg-[#4d4bd6] font-semibold rounded-xl text-xs px-3 py-1.5 transition-colors",
          cancelButton:
            "bg-[#f0f0ea] text-[#111318] dark:bg-white/10 dark:text-[#f7f7f2] rounded-xl text-xs px-3 py-1.5 transition-colors",
          closeButton:
            "bg-white border-[#e1e2da] text-[#686b75] hover:text-[#111318] dark:bg-[#1a1c22] dark:border-white/10 dark:text-[#9ea2b0] dark:hover:text-[#f7f7f2]",
        },
      }}
      style={
        {
          "--normal-bg": isDark ? "#1a1c22" : "#ffffff",
          "--normal-text": isDark ? "#f7f7f2" : "#111318",
          "--normal-border": isDark ? "rgba(255, 255, 255, 0.1)" : "#e1e2da",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

