import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '../locales/ar.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import tr from '../locales/tr.json';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'tr';

i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    ar: { translation: ar },
    es: { translation: es },
    fr: { translation: fr },
  },
  lng: ['tr', 'en'].includes(deviceLanguage) ? deviceLanguage : 'tr',
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export default i18n;
