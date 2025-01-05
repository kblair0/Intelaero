import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import "./globals.css";

const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"], // Use desired font weights
  variable: "--font-ubuntu",
});

export const metadata: Metadata = {
  title: "Intel.Aero",
  description: "Intelligent Mission Assurance For RPAS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ubuntu.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
