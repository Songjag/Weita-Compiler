import strings from "./language.json";

export type UILang = "en" | "vi";
export type I18nKey = keyof typeof strings["en"];

const VALID_LANGS: UILang[] = ["en", "vi"];

export function t(lang: UILang, key: I18nKey): string {
  const safeLang: UILang = VALID_LANGS.includes(lang) ? lang : "en";
  return (strings[safeLang]?.[key] ?? strings["en"][key] ?? key) as string;
}

// Convenience: create a bound translator for a given lang
export function makeT(lang: UILang) {
  return (key: I18nKey) => t(lang, key);
}
