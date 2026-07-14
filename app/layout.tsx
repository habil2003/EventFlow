import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "EventFlow - Event Management System",
  description: "Nepal's complete event management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <SessionProviderWrapper>
            <Navigation />
            {children}
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}