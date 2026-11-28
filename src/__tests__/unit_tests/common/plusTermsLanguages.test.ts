/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import deTerms from 'common/i18n/de/terms';
import deNotice from 'common/i18n/de/termsNotice';
import enTerms from 'common/i18n/en/terms';
import enNotice from 'common/i18n/en/termsNotice';
import esTerms from 'common/i18n/es/terms';
import esNotice from 'common/i18n/es/termsNotice';
import frTerms from 'common/i18n/fr/terms';
import frNotice from 'common/i18n/fr/termsNotice';
import hiTerms from 'common/i18n/hi/terms';
import hiNotice from 'common/i18n/hi/termsNotice';
import itTerms from 'common/i18n/it/terms';
import itNotice from 'common/i18n/it/termsNotice';
import jaTerms from 'common/i18n/ja/terms';
import jaNotice from 'common/i18n/ja/termsNotice';
import koTerms from 'common/i18n/ko/terms';
import koNotice from 'common/i18n/ko/termsNotice';
import ptTerms from 'common/i18n/pt/terms';
import ptNotice from 'common/i18n/pt/termsNotice';
import ruTerms from 'common/i18n/ru/terms';
import ruNotice from 'common/i18n/ru/termsNotice';
import zhTerms from 'common/i18n/zh/terms';
import zhNotice from 'common/i18n/zh/termsNotice';
import zhHantTerms from 'common/i18n/zh-Hant/terms';
import zhHantNotice from 'common/i18n/zh-Hant/termsNotice';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';

/**
 * The terms, and the notice that they changed, in every language FluidEQ
 * ships them in, read straight from each language's own dictionaries.
 *
 * The words are a promise, so a sentence left in English, a placeholder a
 * translation dropped, or a passage of an older revision a language kept
 * after English took it out is a promise that language's reader was never
 * made. The coverage test cannot see any of those: it counts English's keys
 * in each language, so a key kept after English removed it passes, and so
 * does an English sentence pasted in as the translation.
 */

type TDictionary = Readonly<Record<string, string>>;
type TCode =
  | 'en'
  | 'es'
  | 'pt'
  | 'fr'
  | 'de'
  | 'it'
  | 'ru'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'zh-Hant'
  | 'hi';

const TERMS: Readonly<Record<TCode, TDictionary>> = {
  en: enTerms,
  es: esTerms,
  pt: ptTerms,
  fr: frTerms,
  de: deTerms,
  it: itTerms,
  ru: ruTerms,
  ja: jaTerms,
  ko: koTerms,
  zh: zhTerms,
  'zh-Hant': zhHantTerms,
  hi: hiTerms,
};
const NOTICE: Readonly<Record<TCode, TDictionary>> = {
  en: enNotice,
  es: esNotice,
  pt: ptNotice,
  fr: frNotice,
  de: deNotice,
  it: itNotice,
  ru: ruNotice,
  ja: jaNotice,
  ko: koNotice,
  zh: zhNotice,
  'zh-Hant': zhHantNotice,
  hi: hiNotice,
};
const TRANSLATIONS = (Object.keys(TERMS) as TCode[]).filter(
  (code) => code !== 'en',
);
const ENGLISH: TDictionary = { ...enTerms, ...enNotice };
const both = (code: TCode): TDictionary => ({
  ...TERMS[code],
  ...NOTICE[code],
});

const placeholders = (text: string): string[] =>
  (text.match(/\{\w+\}/g) ?? []).sort();

/**
 * English phrases inside a translated sentence: four or more Latin words in
 * a row, one of them a word only English has. The words are chosen so a
 * language's own never match — German "was" and "will", Italian "in" and
 * "account", the "Credits" German keeps — and product names (Buy Me a
 * Coffee, GitHub Discussions, Razer Chroma) carry none of them.
 */
const ENGLISH_ONLY =
  /(?<!\p{L})(?:the|your|you|this|that|each|every|when|then|which|while|from|only|after|before|with|are|were|could|would|should)(?!\p{L})/iu;
const englishIn = (text: string): string[] =>
  (
    text.match(/(?<!\p{L})[A-Za-z]+(?:[\s,;:]+[A-Za-z]+){3,}(?!\p{L})/gu) ?? []
  ).filter((phrase) => ENGLISH_ONLY.test(phrase));

/**
 * What each language called the old membership and what came with it
 * (gifts, free trials, earned months), in the words its own revision 14
 * used. Revision 15 gives the name Plus to the scene subscription, and
 * nobody holds the old membership (Ivan, 2026-11-27), so none of these
 * belong in the terms any more. Portuguese and Hindi have no word for the
 * membership itself to look for: their "assinatura" and Hindi's own terms
 * now name the subscription, so only what came with it is looked for there.
 */
const OLD_MEMBERSHIP: Readonly<Record<TCode, RegExp>> = {
  en: /membership|gift|earned month|free trials/i,
  es: /membresía|regalo|mes ganado|pruebas gratuitas/i,
  pt: /(?<!\p{L})presentes?(?!\p{L})|mês ganho|meses ganhos|testes gratuitos/iu,
  fr: /cadeau|mois gagné|essais gratuits/i,
  de: /Mitgliedschaft|Geschenk|verdiente[nr]? Monat/i,
  it: /regalo|mese guadagnato|mesi guadagnati|prove gratuite/i,
  ru: /подар|заработанн\S* месяц/i,
  ja: /メンバーシップ|ギフト|獲得した1か月/,
  ko: /멤버십|선물|회원권/,
  zh: /礼物|赢得的月份|会员资格/,
  'zh-Hant': /禮物|賺取的月份|會員資格/,
  hi: /उपहार|सदस्यता/,
};

/**
 * How each language says "Plus members", the accounts that have Plus, kept
 * apart from "members", which is every account. A sentence that lets
 * members play a scene grants it to every account; the ones that grant it
 * through Plus have to say Plus members.
 */
const PLUS_MEMBERS: Readonly<Record<TCode, RegExp>> = {
  en: /Plus members/,
  es: /miembros de Plus/,
  pt: /membros do Plus/,
  fr: /membres Plus/,
  de: /Plus-Mitglieder/,
  it: /membri Plus/,
  ru: /участник\p{L}* Plus/u,
  ja: /Plus メンバー/,
  ko: /Plus 회원/,
  zh: /Plus 会员/,
  'zh-Hant': /Plus 會員/,
  hi: /Plus सदस्य/,
};

describe('the terms in every language', () => {
  it('have exactly English’s sentences, no more and no fewer', () => {
    const english = Object.keys(ENGLISH).sort();
    const differ = TRANSLATIONS.filter(
      (code) => Object.keys(both(code)).sort().join() !== english.join(),
    );
    expect(differ).toEqual([]);
    // The positive control: a dictionary that kept one removed sentence is
    // seen as different.
    expect(
      Object.keys({ ...both('es'), 'terms.membership.p1': '' })
        .sort()
        .join(),
    ).not.toBe(english.join());
  });

  it('keep every placeholder English has, in every sentence', () => {
    const dropped = TRANSLATIONS.flatMap((code) => {
      const own = both(code);
      return Object.keys(ENGLISH)
        .filter(
          (key) =>
            placeholders(own[key] ?? '').join() !==
            placeholders(ENGLISH[key]).join(),
        )
        .map((key) => `${code} ${key}`);
    });
    expect(dropped).toEqual([]);
  });

  it('leave no sentence, and no phrase inside one, in English', () => {
    const left = TRANSLATIONS.flatMap((code) => {
      const own = both(code);
      return Object.keys(ENGLISH).flatMap((key) => {
        const text = own[key] ?? '';
        const copied = text === ENGLISH[key] && englishIn(text).length > 0;
        return [
          ...(copied ? [`${code} ${key}: copied`] : []),
          ...englishIn(text).map((phrase) => `${code} ${key}: ${phrase}`),
        ];
      });
    });
    expect(left).toEqual([]);
    // The positive controls: an English sentence inside a translated one is
    // found, and a product name alone is not.
    expect(
      englishIn('この文は Plus plays every scene while it lasts のままです'),
    ).toEqual(['Plus plays every scene while it lasts']);
    expect(englishIn('payé via Buy Me a Coffee et GitHub Discussions')).toEqual(
      [],
    );
  });

  it('say in every language what the current revision changed', () => {
    const key = `termsNotice.change.${PLUS_TERMS_VERSION}`;
    expect(key in ENGLISH).toBe(true);
    expect(ENGLISH[key].trim()).not.toBe('');
    const untold = TRANSLATIONS.filter((code) => {
      const text = NOTICE[code][key];
      return text === undefined || text.trim() === '' || text === ENGLISH[key];
    });
    expect(untold).toEqual([]);
  });
});

describe('terms revision 15: Plus is the scene subscription', () => {
  it('is the revision this build carries', () => {
    expect(PLUS_TERMS_VERSION).toBe(15);
  });

  /**
   * Nobody holds the old Plus membership (Ivan, 2026-11-27: "No hay nadie
   * con plus viejo"), so the terms say nothing of it, of Buy Me a Coffee
   * that took its payments, or of the gifts, trials and earned months that
   * came with it, in any language.
   */
  it('say nothing more of the old membership, Buy Me a Coffee, gifts, trials or earned months', () => {
    const kept = (Object.keys(TERMS) as TCode[]).flatMap((code) =>
      Object.entries(TERMS[code])
        .filter(
          ([key, text]) =>
            /^terms\.(?:membership|sent\.membership|sent\.payment)\./.test(
              key,
            ) ||
            text.includes('Buy Me a Coffee') ||
            text.includes('{moveCredits}') ||
            OLD_MEMBERSHIP[code].test(text),
        )
        .map(([key]) => `${code} ${key}`),
    );
    expect(kept).toEqual([]);
    // The positive control: the notices of what earlier revisions changed
    // still speak of the old membership, and in every language the words
    // looked for above are the ones found there.
    const unseen = (Object.keys(NOTICE) as TCode[]).filter(
      (code) =>
        ![5, 6, 9, 11].some((version) =>
          OLD_MEMBERSHIP[code].test(
            NOTICE[code][`termsNotice.change.${version}`],
          ),
        ),
    );
    expect(unseen).toEqual([]);
  });

  it('keep Plus members apart from members, in every language', () => {
    const grantsThroughPlus = [
      'terms.sent.scenePublish.who',
      'terms.scenes.p9',
    ] as const;
    const unnamed = (Object.keys(TERMS) as TCode[]).flatMap((code) =>
      grantsThroughPlus
        .filter((key) => !PLUS_MEMBERS[code].test(TERMS[code][key]))
        .map((key) => `${code} ${key}`),
    );
    expect(unnamed).toEqual([]);
    // The positive control: a sentence about every account's members, which
    // says nothing of Plus, is not read as naming Plus members.
    const misread = (Object.keys(TERMS) as TCode[]).filter((code) =>
      PLUS_MEMBERS[code].test(TERMS[code]['terms.credits.p1']),
    );
    expect(misread).toEqual([]);
  });

  it('name the section Plus and say in its first line what Plus is', () => {
    const titles = (Object.keys(TERMS) as TCode[]).filter(
      (code) => TERMS[code]['terms.subscription.title'] !== 'Plus',
    );
    expect(titles).toEqual([]);
    expect(enTerms['terms.subscription.p1']).toMatch(
      /^Plus is the subscription that plays every scene, by the month or by the year\. /,
    );
    expect(esTerms['terms.subscription.p1']).toMatch(
      /^Plus es la suscripción que reproduce todas las escenas, por meses o por años\. /,
    );
  });

  /**
   * Plus covers scenes and nothing else: the terms never sell a preset, a
   * dial, the Room or the EQ as part of it. Every sentence that names Plus
   * in English is about scenes, prices, payments or the account.
   */
  it('cover scenes only, never sound', () => {
    const sellsSound = (text: string) =>
      /\bPlus\b/.test(text) &&
      /\b(?:presets?|dials?|Room|EQ|equali[sz]er|rack|sound)\b/.test(text);
    const sound = Object.entries(enTerms).filter(([, text]) =>
      sellsSound(text),
    );
    expect(sound.map(([key]) => key)).toEqual([]);
    // The positive controls: a sentence that names both is found, and the
    // sentence about the free equaliser, which names no Plus, is not.
    expect(sellsSound('Plus unlocks every preset')).toBe(true);
    expect(sellsSound(enTerms['terms.short.free.title'])).toBe(false);
  });

  /**
   * Spanish: Plus is masculine ("Hazte Plus", "Plus, una vez cancelado").
   * Words left over from "la suscripción" read as a slip, and FluidWallpapers'
   * review caught one ("hasta que la canceles").
   */
  it('speak of Plus as masculine in Spanish', () => {
    const slips = Object.entries(esTerms).filter(
      ([, text]) =>
        /\bPlus\b/.test(text) &&
        /hasta que la canceles|cancelarla|\b(?:la|una|esta) Plus\b|Plus,? (?:una vez )?cancelada/.test(
          text,
        ),
    );
    expect(slips.map(([key]) => key)).toEqual([]);
    expect(esTerms['terms.short.credits.body']).toContain(
      'se renueva hasta que lo canceles',
    );
    expect(esTerms['terms.subscription.p3']).toContain(
      'Plus, una vez cancelado',
    );
  });
});
