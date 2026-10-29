/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { LOCALES } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/** The two languages 2.2 brought. */
const NEW_LOCALES: ReadonlySet<string> = new Set(['ko', 'zh-Hant']);

/**
 * The same line in each new language, as the site's own tour writes it
 * ("Everything you hear, shaped your way"). Not translated: it is the
 * language being shown, so it reads the same in every one.
 */
const SAMPLES = [
  { lang: 'ko', text: '들리는 모든 소리를, 내 방식대로.' },
  { lang: 'zh-Hant', text: '你聽到的一切，都照你的方式來。' },
] as const;

/**
 * Every language FluidEQ speaks, each named in its own script as the
 * language menu names it, the two new ones lit, and a line in each of them
 * over the list.
 */
export default function LanguagesVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="tour-languages"
      role="img"
      aria-label={t('tour.languages.imageAlt')}
    >
      <div className="tour-languages__samples">
        {SAMPLES.map((sample) => (
          <p key={sample.lang} lang={sample.lang}>
            {sample.text}
          </p>
        ))}
      </div>
      <ul className="tour-languages__list">
        {LOCALES.map((entry) => {
          const isNew = NEW_LOCALES.has(entry.code);
          return (
            <li
              key={entry.code}
              lang={entry.code}
              className={isNew ? 'is-new' : undefined}
            >
              {entry.name}
              {isNew && (
                <span className="tour-languages__new">
                  {t('tour.newBadge')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
