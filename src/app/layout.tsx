/**
 * /src/app/layout.tsx
 * 
 * Purpose:
 * Root layout for the Intel Aero Next.js application, wrapping all pages with
 * global styles, fonts, and analytics. Fixed syntax errors to resolve
 * "Unexpected EOF" issue causing 404 errors.
 * 
 * Dependencies:
 * - next/font/google: For Ubuntu font
 * - @vercel/analytics/next: For Vercel Analytics
 * 
 * Principles:
 * - Simplicity: Minimal layout with essential global setup
 * - Robustness: Proper JSX structure to avoid syntax errors
 * - Maintainability: Clear typing and commenting
 */

import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-ubuntu",
});

export const metadata: Metadata = {
  title: "Intel.Aero",
  description: "DroneView: Unmatched Visibility and Communications Coverage Analysis",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={ubuntu.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}