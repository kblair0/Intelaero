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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ubuntu.variable}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}