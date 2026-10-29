import {
  JetBrains_Mono,
  Noto_Sans,
  Noto_Sans_Ethiopic,
  Sora,
} from "next/font/google";

// Self-hosted at build time by next/font: the browser never contacts Google.

/** UI text. */
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

/** Page titles and big numbers. */
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

/** Amharic data (names, places). Not preloaded: only downloaded when Ethiopic text is on the page. */
const notoSansEthiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  variable: "--font-noto-ethiopic",
  display: "swap",
  preload: false,
});

/** Codes, plates and references. */
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  notoSans.variable,
  sora.variable,
  notoSansEthiopic.variable,
  jetBrainsMono.variable,
].join(" ");
