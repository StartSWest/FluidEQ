/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Translation, hand-rolled and dependency-free.
 *
 * i18next and friends are excellent and would be four times the size of this
 * file's entire feature set. FluidEQ needs one thing — a key and some
 * placeholders turned into a string — and buying a plural-rule engine, a
 * pluggable backend and a namespace resolver to get it would be the tail
 * wagging the dog in an offline desktop app that ships its own bundle.
 *
 * What this deliberately does NOT do:
 *  - Plural rules. Where a count changes the wording, the two forms get their
 *    own keys. Getting Russian plurals subtly wrong is worse than spelling
 *    both cases out.
 *  - Keep every language in memory. See `loadLocale`: only English is part
 *    of the bundle, and each other language is loaded when it is first asked
 *    for — before anything is drawn in it, so there is no flash of English.
 *  - Right-to-left. Arabic, Hebrew and Persian are missing from the locale
 *    list for exactly that reason: this layout has not been mirrored or
 *    tested, and shipping a broken Arabic is worse than shipping none.
 */

import en, { Dictionary, TranslationKey } from './en';

export type { Dictionary, TranslationKey };

export type LocaleCode =
  'en' | 'es' | 'pt' | 'fr' | 'de' | 'it' | 'ru' | 'zh' | 'ja' | 'hi';

export interface ILocale {
  code: LocaleCode;
  /** The language's name in that language — never in English. */
  name: string;
  /** English name, for a menu the user opened because they are lost. */
  englishName: string;
}

/**
 * The ten shipped languages.
 *
 * Chosen by number of speakers among left-to-right scripts, which is why
 * Arabic and Urdu are absent — see the note above.
 */
export const LOCALES: ILocale[] = [
  { code: 'en', name: 'English', englishName: 'English' },
  { code: 'zh', name: '简体中文', englishName: 'Chinese (Simplified)' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi' },
  { code: 'es', name: 'Español', englishName: 'Spanish' },
  { code: 'fr', name: 'Français', englishName: 'French' },
  { code: 'pt', name: 'Português', englishName: 'Portuguese' },
  { code: 'ru', name: 'Русский', englishName: 'Russian' },
  { code: 'ja', name: '日本語', englishName: 'Japanese' },
  { code: 'de', name: 'Deutsch', englishName: 'German' },
  { code: 'it', name: 'Italiano', englishName: 'Italian' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

/**
 * Every dictionary but English is partial, and held only once it is loaded.
 *
 * A key with no translation yet falls back to English rather than rendering
 * the key itself. A user who sees one English line in an otherwise translated
 * app has lost nothing; a user who sees `profiles.restoreAria` has.
 */
const DICTIONARIES: Partial<Record<LocaleCode, Partial<Dictionary>>> = { en };

type TDictionaryModule = { default: Partial<Dictionary> };

/**
 * Where each language lives: a chunk of its own, named after it.
 *
 * All ten used to be imported here, on the reasoning that ten dictionaries of
 * a couple of hundred short strings came to a few tens of kilobytes. By
 * 2026-09 they were ≈4,560 keys each, and the nine besides English were
 * 3.75 MB of each built bundle: the window's script went from 7.0 MB to
 * 3.3 MB without them and the main process's from 5.4 MB to 1.7 MB. Both
 * processes parsed every one and built it into objects at every launch,
 * before anything was on screen, then kept nine languages nobody was reading
 * in memory for the life of the app. English stays in the bundle because it
 * is every other dictionary's fallback, and so is never waited for.
 */
const LOADERS: Record<
  Exclude<LocaleCode, 'en'>,
  () => Promise<TDictionaryModule>
> = {
  es: () => import(/* webpackChunkName: "locale-es" */ './es'),
  pt: () => import(/* webpackChunkName: "locale-pt" */ './pt'),
  fr: () => import(/* webpackChunkName: "locale-fr" */ './fr'),
  de: () => import(/* webpackChunkName: "locale-de" */ './de'),
  it: () => import(/* webpackChunkName: "locale-it" */ './it'),
  ru: () => import(/* webpackChunkName: "locale-ru" */ './ru'),
  zh: () => import(/* webpackChunkName: "locale-zh" */ './zh'),
  ja: () => import(/* webpackChunkName: "locale-ja" */ './ja'),
  hi: () => import(/* webpackChunkName: "locale-hi" */ './hi'),
};

const loading = new Map<LocaleCode, Promise<void>>();

/** Whether `translate` can answer in this language rather than in English. */
export const isLocaleLoaded = (code: LocaleCode): boolean =>
  DICTIONARIES[code] !== undefined;

/**
 * Have a language's dictionary ready to translate with.
 *
 * Resolves at once for English and for a dictionary already held; two asks
 * for the same language while it loads share one load. The window waits on
 * this before its first render and before a language switch takes effect, so
 * nothing is ever drawn in English on the way to another language. A load
 * that fails rejects, and the language keeps translating as English — the
 * fallback every missing key already has — until a later ask succeeds.
 */
export const loadLocale = (code: LocaleCode): Promise<void> => {
  if (code === 'en' || isLocaleLoaded(code)) {
    return Promise.resolve();
  }
  const pending = loading.get(code);
  if (pending) {
    return pending;
  }
  const load = (async () => {
    try {
      DICTIONARIES[code] = (await LOADERS[code]()).default;
    } finally {
      loading.delete(code);
    }
  })();
  loading.set(code, load);
  return load;
};

/**
 * Turn whatever the platform reports into one of the ten.
 *
 * Windows and Electron both hand out BCP-47 tags — `pt-BR`, `zh-Hans-CN`,
 * `es-419`. Only the primary subtag is matched, so every Portuguese is
 * Portuguese and every Chinese is Simplified. That is a real limitation
 * (Traditional readers get Simplified) and an honest one at ten languages.
 */
export const resolveLocale = (tag?: string | null): LocaleCode => {
  if (!tag) {
    return DEFAULT_LOCALE;
  }
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  const match = LOCALES.find((locale) => locale.code === primary);
  return match ? match.code : DEFAULT_LOCALE;
};

export type TranslateVars = Record<string, string | number>;

/**
 * A lookup already bound to a language.
 *
 * Named because it gets passed around. Anything that builds a sentence out of
 * several keys — the Smart EQ readout is the one that does — has to be handed
 * the same `t` the component around it uses, or half the line comes back in one
 * language and half in another.
 */
export type Translate = (key: TranslationKey, vars?: TranslateVars) => string;

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Look up a key and fill in its placeholders.
 *
 * A placeholder with no matching variable is left as written rather than
 * blanked: `{count}` on screen says "a developer forgot something", whereas an
 * empty gap says "this app is broken".
 */
export const translate = (
  locale: LocaleCode,
  key: TranslationKey,
  vars?: TranslateVars,
): string => {
  const template = DICTIONARIES[locale]?.[key] ?? en[key] ?? key;
  if (!vars) {
    return template;
  }
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
};

/**
 * How much of a locale is actually translated, 0 to 1.
 *
 * Not shown in the UI; it exists so a test can fail when a dictionary drifts
 * far enough behind English to be worth someone's attention. A language that
 * has not been loaded counts as nothing translated, so the test loads first.
 */
export const getCoverage = (locale: LocaleCode): number => {
  const keys = Object.keys(en) as TranslationKey[];
  const dictionary = DICTIONARIES[locale] ?? {};
  const translated = keys.filter((key) => dictionary[key] !== undefined).length;
  return translated / keys.length;
};
