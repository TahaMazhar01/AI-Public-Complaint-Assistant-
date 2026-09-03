import type { Metadata, Viewport } from "next";
import {
  Archivo,
  JetBrains_Mono,
  Noto_Nastaliq_Urdu,
  Noto_Sans_SC,
} from "next/font/google";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
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

/* Urdu is set in Nastaliq, not a Naskh fallback — anything else reads
   as foreign to the people this is built for. */
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  display: "swap",
});

const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-notosc",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return {
    title: { default: `Awaaz — ${t.hero.eyebrow}`, template: "%s · Awaaz" },
    description: t.hero.lead,
  };
}

export const viewport: Viewport = {
  themeColor: "#F4F2EC",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <html
      lang={t.meta.htmlLang}
      dir={t.meta.dir}
      data-locale={locale}
      className={`${archivo.variable} ${jetbrains.variable} ${nastaliq.variable} ${notoSC.variable} h-full`}
    >
      <body className="grain flex min-h-full flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
