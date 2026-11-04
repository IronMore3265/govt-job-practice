import type { Metadata, Viewport } from "next";
import { Doto, Noto_Sans_Bengali, Outfit } from "next/font/google";
import "./globals.css";

// Fonts (PLAN.md section 10): Outfit for English text, Doto 900 for one accent word per English title,
// Noto Sans Bengali for Bangla. The stack in globals.css is Outfit, "Noto Sans Bengali", sans-serif.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: ["900"],
});

const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Practice Studio",
  description: "Private MCQ practice for government job exams.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F2EFE8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${doto.variable} ${bengali.variable}`}>
      <body>{children}</body>
    </html>
  );
}
