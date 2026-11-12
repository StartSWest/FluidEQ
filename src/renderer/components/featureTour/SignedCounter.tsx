/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { FLUIDEQ_BEGAN_AT, useLiveFor } from './liveFor';

type TUnit = 'day' | 'hour' | 'minute' | 'second';

/**
 * The plural forms the locales here use. `Intl.PluralRules` answers `zero`
 * and `two` only for languages FluidEQ does not ship (Arabic, Welsh...), and
 * those read as `other`; every locale carries all four forms, a language
 * with fewer simply repeating one.
 */
type TForm = 'one' | 'few' | 'many' | 'other';
const formOf = (rule: Intl.LDMLPluralRule): TForm =>
  rule === 'one' || rule === 'few' || rule === 'many' ? rule : 'other';

const unitKey = (unit: TUnit, form: TForm): TranslationKey =>
  `tour.signed.unit.${unit}.${form}`;

/** Two digits under the days, so the row keeps its width as it ticks. */
const pad = (value: number) => String(value).padStart(2, '0');

interface ISignedCounterProps {
  /** The clock it reads; a test hands in its own. */
  now?: () => number;
}

/**
 * How long FluidEQ has been alive, ticking on 2.5's opening page: days,
 * hours, minutes and seconds since the repository was created, each unit
 * named in the reader's language with the right plural for its number.
 */
export default function SignedCounter({ now }: ISignedCounterProps) {
  const { t, locale } = useTranslation();
  const live = useLiveFor(now);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const since = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
        FLUIDEQ_BEGAN_AT,
      ),
    [locale],
  );
  const units: readonly [TUnit, number, string][] = [
    ['day', live.days, String(live.days)],
    ['hour', live.hours, pad(live.hours)],
    ['minute', live.minutes, pad(live.minutes)],
    ['second', live.seconds, pad(live.seconds)],
  ];

  return (
    <div className="signed-counter">
      <span className="signed-counter__label" id="signed-counter-label">
        {t('tour.signed.liveFor')}
      </span>
      <span
        className="signed-counter__units"
        role="group"
        aria-labelledby="signed-counter-label"
      >
        {units.map(([unit, value, shown]) => (
          <span key={unit} className={`signed-counter__unit is-${unit}`}>
            <strong>{shown}</strong>
            <small>{t(unitKey(unit, formOf(plural.select(value))))}</small>
          </span>
        ))}
      </span>
      <span className="signed-counter__since">
        {t('tour.signed.since', { date: since })}
      </span>
    </div>
  );
}
