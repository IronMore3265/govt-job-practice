import type { Metadata, Viewport } from "next";
import { Courier_Prime, Hanken_Grotesk, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

// Fonts (PLAN.md section 10): Hanken Grotesk for English text, Courier Prime for labels, numbers and one accent word
// per English title, Noto Sans Bengali for Bangla. The stack in globals.css is Hanken Grotesk, "Noto Sans Bengali", sans-serif.
const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Courier_Prime({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#10162F" },
  ],
};

// Runs before the first paint: the saved choice, or the device setting when there is none. Avoids a white flash in dark mode.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${bengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
