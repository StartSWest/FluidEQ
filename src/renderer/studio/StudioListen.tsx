/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { STUDIO_SIGNALS, type TStudioSignal } from './studioSignals';
import { SIGNAL_ICONS } from './studioTestIcons';

interface IStudioListenProps {
  signal: TStudioSignal;
  onSignal: (signal: TStudioSignal) => void;
  /** Nothing is on the stage: the tiles stay where they will be, unlit. */
  idle: boolean;
}

/**
 * What the stage plays the scene to: the member's music or one of the test
 * signals, beside what the scene hears of it (`StudioMeters`), so the input
 * and the reading of it are one glance (layout A, Ivan 2026-09-27).
 *
 * Tiles in a fixed grid of four, each drawing what it is over its name: pills
 * that wrapped broke into ragged rows whose breaks moved with the language.
 * Four equal columns keep one shape in every language, and a long name takes
 * a second line inside its own tile. The line under them names the one that
 * is playing, which is what the narrowest column relies on once the names
 * give way to the drawings alone.
 */
export default function StudioListen({
  signal,
  onSignal,
  idle,
}: IStudioListenProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const signalName = (entry: TStudioSignal) =>
    t(`studio.signal.${entry}` as TranslationKey);
  return (
    <section
      className={`studio-card studio-listen${idle ? ' is-idle' : ''}`}
      aria-labelledby={titleId}
    >
      <span className="studio-card__eyebrow" id={titleId}>
        {t('studio.signals.title')}
      </span>
      <div
        className="studio-tiles"
        role="group"
        aria-label={t('studio.signals.title')}
      >
        {STUDIO_SIGNALS.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-tile"
            aria-pressed={signal === entry}
            aria-label={signalName(entry)}
            title={`${signalName(entry)}: ${t(
              `studio.signalHint.${entry}` as TranslationKey,
            )}`}
            disabled={idle}
            onClick={() => onSignal(entry)}
          >
            {SIGNAL_ICONS[entry]}
            <span className="studio-tile__name">{signalName(entry)}</span>
          </button>
        ))}
      </div>
      <span className="studio-test__now" role="status">
        <span className="studio-test__now-name">{signalName(signal)}</span>
        {t(`studio.signalHint.${signal}` as TranslationKey)}
      </span>
      <span className="studio-test__hint">{t('studio.signals.hint')}</span>
    </section>
  );
}
