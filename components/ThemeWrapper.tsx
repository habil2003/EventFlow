"use client";

import { ThemeProvider } from "@/components/ThemeProvider";
import { ReactNode } from "react";

export default function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}