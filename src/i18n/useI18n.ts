import strings from "./language.json";

export type UILang = "en" | "vi";
export type I18nKey = keyof typeof strings["en"];

export function t(lang: UILang, key: I18nKey): string {
  return strings[lang][key] ?? strings["en"][key] ?? key;
}

// Convenience: create a bound translator for a given lang
export function makeT(lang: UILang) {
  return (key: I18nKey) => t(lang, key);
}
