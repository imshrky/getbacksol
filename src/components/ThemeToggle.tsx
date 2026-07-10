"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light / dark mode"
      className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border-strong)] text-[var(--foreground)] transition-colors surface-hover"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
