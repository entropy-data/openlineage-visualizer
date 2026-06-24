import i18next from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import de from './locales/de.json';

/**
 * Scoped i18next instance for the OpenLineage Visualizer.
 *
 *  - Standalone instance via `createInstance()` (not the global singleton) so embedding
 *    never collides with a host app that also uses i18next.
 *  - Translations bundled inline (no http backend) — self-contained.
 *  - Locale source: the host passes it via the container's `data-locale` attribute
 *    (single-mode embed) or `init({ locale })` (multi-mode), which wins. When absent
 *    (standalone), the detector resolves it: `?lang=` -> localStorage (`olv-locale`) ->
 *    browser. `load: 'languageOnly'` maps `de-DE` -> `de`; fallback `en`.
 */
const i18n = i18next.createInstance();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {en: {translation: en}, de: {translation: de}},
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    load: 'languageOnly',
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'olv-locale',
    },
    interpolation: {escapeValue: false},
    react: {useSuspense: false},
  });

export default i18n;
