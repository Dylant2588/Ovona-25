import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Ovona - Smart Nutrition Companion",
  description:
    "Plan meals, track nutrition, and onboard smoothly with Ovona's AI assistant.",
  applicationName: "Ovona",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ovona",
  },
  manifest: "/manifest.webmanifest",
  themeColor: "#0c1020",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${inter.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
