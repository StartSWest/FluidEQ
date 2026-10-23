/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';

/** Where a new curve is taken from, in the Add dialog. */
export type TCurveOrigin = 'paste' | 'file' | 'eq' | 'opra';

const ORIGINS: ReadonlyArray<{
  origin: TCurveOrigin;
  title: TranslationKey;
  hint: TranslationKey;
}> = [
  {
    origin: 'paste',
    title: 'myCurves.from.paste',
    hint: 'myCurves.from.pasteHint',
  },
  {
    origin: 'file',
    title: 'myCurves.from.file',
    hint: 'myCurves.from.fileHint',
  },
  { origin: 'eq', title: 'myCurves.from.eq', hint: 'myCurves.from.eqHint' },
  {
    origin: 'opra',
    title: 'myCurves.from.opra',
    hint: 'myCurves.from.opraHint',
  },
];

/**
 * The four ways a curve comes in, side by side: pasted text, a .txt file,
 * the EQ as it plays, or the OPRA correction playing now. A file is chosen
 * from its own card; OPRA's waits until one of its corrections plays.
 */
export default function MyCurveSourcePick({
  value,
  hasOpra,
  onPick,
}: {
  value: TCurveOrigin;
  /** An OPRA correction is playing now, to be kept a copy of. */
  hasOpra: boolean;
  onPick: (origin: TCurveOrigin) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="my-curve-sources"
      role="group"
      aria-label={t('myCurves.from')}
    >
      {ORIGINS.map(({ origin, title, hint }) => {
        const isOff = origin === 'opra' && !hasOpra;
        return (
          <button
            key={origin}
            type="button"
            className={`my-curve-source${value === origin ? ' is-selected' : ''}`}
            aria-pressed={value === origin}
            disabled={isOff}
            onClick={() => onPick(origin)}
          >
            <strong>{t(title)}</strong>
            <span>{t(isOff ? 'myCurves.from.opraNone' : hint)}</span>
          </button>
        );
      })}
    </div>
  );
}
