"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translateText } from "@/lib/de-translations";

type Locale = "en" | "de";
type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void };
const LanguageContext = createContext<LanguageContextValue>({ locale: "en", setLocale: () => {} });
const storageKey = "proteus-language";
let sourceTitle = "";
let translatedTitle = "";
const textSources = new WeakMap<Text, { source: string; translated: string }>();
const attributeSources = new WeakMap<Element, Map<string, { source: string; translated: string }>>();
const translatableAttributes = ["aria-label", "aria-description", "aria-roledescription", "placeholder", "title", "alt"];

function updateText(node: Text, locale: Locale) {
  const previous = textSources.get(node);
  const source = previous && node.data === previous.translated ? previous.source : node.data;
  const translated = translateText(source, locale);
  if (translated === source) {
    if (previous && node.data === previous.translated) node.data = source;
    textSources.delete(node);
    return;
  }
  textSources.set(node, { source, translated });
  if (node.data !== translated) node.data = translated;
}

function updateAttributes(element: Element, locale: Locale) {
  for (const name of translatableAttributes) {
    if (!element.hasAttribute(name)) continue;
    const previous = attributeSources.get(element)?.get(name);
    const current = element.getAttribute(name) ?? "";
    const source = previous && current === previous.translated ? previous.source : current;
    const translated = translateText(source, locale);
    if (translated === source) {
      if (previous && current === previous.translated) element.setAttribute(name, source);
      attributeSources.get(element)?.delete(name);
      continue;
    }
    const values = attributeSources.get(element) ?? new Map();
    values.set(name, { source, translated });
    attributeSources.set(element, values);
    if (current !== translated) element.setAttribute(name, translated);
  }
}

function translateDocument(locale: Locale) {
  const root = document.body;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current.parentElement?.closest("script, style, noscript, textarea, input, select, option[data-user-value], [data-no-translate]")) continue;
    updateText(current as Text, locale);
  }
  root.querySelectorAll("*").forEach((element) => updateAttributes(element, locale));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { window.localStorage.setItem(storageKey, next); } catch { /* Language can still be changed for this page. */ }
  }, []);

  useEffect(() => {
    // Restore after nested client controls have hydrated with the server's default locale.
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved === "en" || saved === "de") setLocaleState(saved);
      } catch { /* Default to English when storage is unavailable. */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncLocale = (event: StorageEvent) => {
      if (event.key === storageKey && (event.newValue === "en" || event.newValue === "de")) {
        setLocaleState(event.newValue);
      }
    };
    window.addEventListener("storage", syncLocale);
    return () => window.removeEventListener("storage", syncLocale);
  }, []);

  useEffect(() => {
    const updateTitle = () => {
      const current = document.title;
      const source = current === translatedTitle ? sourceTitle : current;
      const translated = translateText(source, locale);
      sourceTitle = source;
      translatedTitle = locale === "de" ? translated : "";
      if (translated !== current) document.title = translated;
    };
    document.documentElement.lang = locale;
    translateDocument(locale);
    updateTitle();
    const titleObserver = new MutationObserver(updateTitle);
    titleObserver.observe(document.head, { subtree: true, childList: true, characterData: true });
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) updateText(record.target, locale);
        for (const node of record.addedNodes) {
          if (node instanceof Text) updateText(node, locale);
          else if (node instanceof Element) {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let child: Node | null;
            while ((child = walker.nextNode())) updateText(child as Text, locale);
            updateAttributes(node, locale);
            node.querySelectorAll("*").forEach((element) => updateAttributes(element, locale));
          }
        }
        if (record.type === "attributes" && record.target instanceof Element) updateAttributes(record.target, locale);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: translatableAttributes });
    return () => { observer.disconnect(); titleObserver.disconnect(); };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useContext(LanguageContext);
  return <div className={`language-switcher ${className}`} role="group" aria-label={locale === "de" ? "Sprache wählen" : "Choose language"}>
    <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    <span aria-hidden="true">/</span>
    <button type="button" aria-pressed={locale === "de"} onClick={() => setLocale("de")}>DE</button>
  </div>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
