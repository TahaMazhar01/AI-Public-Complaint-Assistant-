"use client";

import { createContext, useContext } from "react";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

/* Client components read the locale from here. The dictionary is
   resolved on the client from the locale alone, so nothing large
   crosses the server/client boundary. */

const LocaleContext = createContext<{ locale: Locale; t: Dictionary }>({
  locale: "en",
  t: getDictionary("en"),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t: getDictionary(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  return useContext(LocaleContext);
}
