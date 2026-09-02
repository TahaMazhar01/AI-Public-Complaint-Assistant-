import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

/* Archivo carries a width axis (wdth 62–125). One family, two voices:
   expanded for signage-grade display type, normal for body. */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

/* Urdu complaints render in their own script, not transliterated. */
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Awaaz — AI Public Complaint Assistant",
    template: "%s · Awaaz",
  },
  description:
    "Speak or write your complaint in plain language. Awaaz understands it, routes it to the right department, and files a formal, tracked case on your behalf.",
};

export const viewport: Viewport = {
  themeColor: "#F4F2EC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrains.variable} ${nastaliq.variable} h-full`}
    >
      <body className="grain min-h-full flex flex-col">{children}</body>
    </html>
  );
}
