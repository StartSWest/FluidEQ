/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { IMyCurve } from 'common/myCurves';
import type { TranslationKey } from '../../../common/i18n';
import MenuIcon from '../../icons/MenuIcon';
import MyCurveRow from '../../eq/MyCurveRow';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/AutoEQPanel.scss';
import '../../styles/MyCurves.scss';

/**
 * My curves, as the EQ presets page shows it: the three tabs with My curves
 * open, its toolbar and a listener's list, built from the page's own parts —
 * every row is the page's own row component, drawing its own curve. In turn,
 * a curve just saved from the Squiglink tab arrives at the head of the list
 * and plays as the headphone correction, where an older one was playing.
 *
 * Drawn with the real parts rather than a drawing of them (Ivan, 2026-10-18:
 * "generate the right ui"). Inert, so nothing in it can be pressed; the
 * reader's colours and language, because it is the page itself. The curves
 * are headphone fits of the kind a listener keeps, named by their models; a
 * list longer than the stage fades out at its foot (`_tour-mycurves.scss`).
 */

const DAY_MS = 86_400_000;

const HD600 =
  'Preamp: -6.2 dB\nFilter 1: ON PK Fc 58 Hz Gain 3.2 dB Q 2.000\nFilter 2: ON PK Fc 130 Hz Gain -4.3 dB Q 0.900\nFilter 3: ON PK Fc 2600 Hz Gain -3.0 dB Q 2.900\nFilter 4: ON PK Fc 4300 Hz Gain 6.0 dB Q 1.200\nFilter 5: ON PK Fc 7900 Hz Gain -4.4 dB Q 5.000';
const LATE_NIGHT =
  'Preamp: -1 dB\nFilter 1: ON LSC Fc 90 Hz Gain -3 dB Q 0.7\nFilter 2: ON HSC Fc 9000 Hz Gain -4 dB Q 0.7';
const ARIA_WARM =
  'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8\nFilter 2: ON PK Fc 2500 Hz Gain -2 dB Q 1.4\nFilter 3: ON HSC Fc 10000 Hz Gain -1.5 dB Q 0.7';
const ARIA_LEFT =
  'Filter 1: ON PK Fc 1800 Hz Gain -2.5 dB Q 3\nFilter 2: ON PK Fc 5200 Hz Gain 3 dB Q 4';
const JUST_SAVED =
  'Preamp: -5 dB\nFilter 1: ON LSC Fc 105 Hz Gain 4.5 dB Q 0.7\nFilter 2: ON PK Fc 2900 Hz Gain -3.5 dB Q 1.4\nFilter 3: ON PK Fc 6200 Hz Gain 2.5 dB Q 3\nFilter 4: ON HSC Fc 9500 Hz Gain 2 dB Q 0.7';

const curve = (
  id: string,
  name: string,
  text: string,
  source: IMyCurve['source'],
  ears: IMyCurve['ears'],
  daysAgo: number,
  now: number,
): IMyCurve => ({
  id,
  name,
  text,
  source,
  ears,
  addedAt: now - daysAgo * DAY_MS,
});

const nothing = () => undefined;

interface ITurn {
  curves: IMyCurve[];
  /** The curve playing as the headphone correction in this turn. */
  playing: string;
}

function CurvesPage({ turn, index }: { turn: ITurn; index: number }) {
  const { t } = useTranslation();
  const tabs: [string, TranslationKey][] = [
    ['opra', 'myCurves.tab.opra'],
    ['squiglink', 'myCurves.tab.squiglink'],
    ['mine', 'myCurves.tab.mine'],
  ];
  return (
    <div className={`my-curves-visual__turn my-curves-visual__turn--${index}`}>
      <div className="autoeq-panel__libraries" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="autoeq-panel__tab"
            aria-selected={id === 'mine'}
          >
            {t(label)}
            {id === 'mine' && (
              <span className="autoeq-panel__tab-count">
                {turn.curves.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="autoeq-panel__picker">
        <section className="my-curves">
          <div className="my-curves__toolbar">
            <span className="my-curves__search">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M20 20l-4.2-4.2" />
              </svg>
              <input
                type="search"
                readOnly
                placeholder={t('myCurves.search')}
                aria-label={t('myCurves.search')}
              />
            </span>
            <span className="segmented my-curves__sort">
              <span className="segmented__option is-selected">
                {t('myCurves.sort.recent')}
              </span>
              <span className="segmented__option">
                {t('myCurves.sort.name')}
              </span>
            </span>
            <span className="my-curves__spacer" />
            <span className="button small subtle">
              <MenuIcon name="download" />
              {t('myCurves.import')}
            </span>
            <span className="button small subtle">
              <MenuIcon name="upload" />
              {t('myCurves.export')}
            </span>
            <span className="button small">
              <MenuIcon name="plus" />
              {t('myCurves.add')}
            </span>
          </div>
          <ul className="my-curves__list">
            {turn.curves.map((one) => (
              <MyCurveRow
                key={one.id}
                curve={one}
                isPlaying={one.id === turn.playing}
                isDisabled={false}
                onApplyCurve={nothing}
                onApplyEq={nothing}
                onRename={nothing}
                onDuplicate={nothing}
                onEdit={nothing}
                onDelete={nothing}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function MyCurvesVisual() {
  const { t, locale } = useTranslation();
  const turns = useMemo((): ITurn[] => {
    const now = Date.now();
    const kept = [
      curve(
        'hd600',
        'HD 600 · Harman 2018',
        HD600,
        'squiglink',
        'both',
        2,
        now,
      ),
      curve('late', 'HD 600 · late night', LATE_NIGHT, 'eq', 'both', 5, now),
      curve('aria', 'Moondrop Aria · warm', ARIA_WARM, 'file', 'both', 9, now),
      curve(
        'left',
        'Aria · left ear fix',
        ARIA_LEFT,
        'squiglink',
        'left',
        12,
        now,
      ),
    ];
    const today = new Date(now).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    });
    const saved = curve(
      'saved',
      t('myCurves.defaultName', { date: today }),
      JUST_SAVED,
      'squiglink',
      'both',
      0,
      now,
    );
    return [
      { curves: kept, playing: 'hd600' },
      { curves: [saved, ...kept], playing: 'saved' },
    ];
  }, [locale, t]);

  return (
    <div
      className="my-curves-visual"
      role="img"
      aria-label={t('tour.myCurves.imageAlt')}
      inert
    >
      {turns.map((turn, index) => (
        <CurvesPage key={turn.playing} turn={turn} index={index} />
      ))}
    </div>
  );
}
