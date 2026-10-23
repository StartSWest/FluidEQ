/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The De-esser at work, as its page draws it: four seconds of a voice going
 * past, each S standing over the line where the stage starts with its cut
 * hanging under it in amber, and the hi-hats between them in grey, over the
 * line too and left alone. Above the strip the stage's head and how it
 * reduces, Spectral chosen; under it the three chains that switch it on.
 *
 * The strip is one pattern drawn twice side by side and slid by half its
 * width, so it scrolls for ever without a seam (CSS, held still under
 * reduced motion). Made-up speech: a sentence's worth of vowels, five S's
 * of different strength, and a hi-hat every quarter of a second.
 */

const COLUMNS = 80;
const WIDTH = 400;
const COLUMN = WIDTH / COLUMNS;
/** The standout lane, with the line where the stage starts across it. */
const LANE = { top: 4, bottom: 62, threshold: 30 };
/** The cut lane, hanging down from its top. */
const CUT = { top: 72, bottom: 100 };

type TKind = 'body' | 'voice' | 'hat';

interface IColumn {
  kind: TKind;
  /** 0 to 1 of the standout lane. */
  level: number;
  /** 0 to 1 of the cut lane. */
  cut: number;
}

/** Where each S starts, how many columns it lasts and how far it stands up. */
const ESSES = [
  { at: 6, length: 4, peak: 0.92 },
  { at: 21, length: 3, peak: 0.74 },
  { at: 37, length: 5, peak: 1 },
  { at: 55, length: 3, peak: 0.8 },
  { at: 68, length: 4, peak: 0.88 },
];
const HAT_EVERY = 5;

/** How far over the line a level stands, 0 below it. */
const threshold = 1 - (LANE.threshold - LANE.top) / (LANE.bottom - LANE.top);

const columns: IColumn[] = Array.from({ length: COLUMNS }, (_, index) => {
  const ess = ESSES.find(
    (one) => index >= one.at && index < one.at + one.length,
  );
  if (ess) {
    // Up fast, down slower, as a sibilant's energy does.
    const share = (index - ess.at + 0.5) / ess.length;
    const level = ess.peak * Math.sin(Math.PI * share ** 0.7);
    return {
      kind: 'voice',
      level,
      cut: Math.max(0, (level - threshold) / (1 - threshold)),
    };
  }
  if (index % HAT_EVERY === 2) {
    return { kind: 'hat', level: 0.62 + 0.08 * ((index * 7) % 3), cut: 0 };
  }
  // The vowels under the S's, which the stage never reaches.
  const body =
    0.22 + 0.14 * Math.abs(Math.sin(index * 0.9) * Math.cos(index * 0.37));
  return { kind: 'body', level: body, cut: 0 };
});

const laneY = (level: number) => LANE.bottom - level * (LANE.bottom - LANE.top);

function Strip({ offset }: { offset: number }) {
  return (
    <g transform={`translate(${offset} 0)`}>
      {columns.map((column, index) => (
        // eslint-disable-next-line react/no-array-index-key -- a column's place is its identity: the pattern never reorders
        <g key={index}>
          <rect
            className={`deesser-visual__bar deesser-visual__bar--${column.kind}`}
            x={index * COLUMN + COLUMN * 0.18}
            width={COLUMN * 0.64}
            y={laneY(column.level)}
            height={LANE.bottom - laneY(column.level)}
          />
          {column.cut > 0 && (
            <rect
              className="deesser-visual__cut"
              x={index * COLUMN + COLUMN * 0.18}
              width={COLUMN * 0.64}
              y={CUT.top}
              height={column.cut * (CUT.bottom - CUT.top)}
            />
          )}
        </g>
      ))}
    </g>
  );
}

const MODES: { key: TranslationKey; isOn: boolean }[] = [
  { key: 'dsp.deEsser.mode.spectral', isOn: true },
  { key: 'dsp.deEsser.mode.treble', isOn: false },
  { key: 'dsp.deEsser.mode.whole', isOn: false },
];

const CHAINS: TranslationKey[] = [
  'dsp.preset.speech',
  'dsp.eqPreset.podcast',
  'dsp.eqPreset.audiobook',
];

export default function DeEsserVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="deesser-visual"
      role="img"
      aria-label={t('tour.deesser.imageAlt')}
    >
      <div className="deesser-visual__card">
        <span className="deesser-visual__head">
          <strong>{t('dsp.deEsser.title')}</strong>
          <span className="deesser-visual__switch" />
        </span>
        <span className="deesser-visual__modes">
          {MODES.map((mode) => (
            <span key={mode.key} className={mode.isOn ? 'is-selected' : ''}>
              {t(mode.key)}
            </span>
          ))}
        </span>

        <span className="deesser-visual__well">
          <span className="deesser-visual__window">
            <svg
              className="deesser-visual__strip"
              viewBox={`0 0 ${WIDTH * 2} 100`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <Strip offset={0} />
              <Strip offset={WIDTH} />
            </svg>
            <svg
              className="deesser-visual__lines"
              viewBox={`0 0 ${WIDTH} 100`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <line
                className="deesser-visual__threshold"
                x1="0"
                x2={WIDTH}
                y1={LANE.threshold}
                y2={LANE.threshold}
              />
              <line
                className="deesser-visual__floor"
                x1="0"
                x2={WIDTH}
                y1={CUT.top}
                y2={CUT.top}
              />
            </svg>
            <span className="deesser-visual__starts">
              {t('dsp.deEsser.graph.threshold')}
            </span>
            <span className="deesser-visual__now">
              {t('dsp.deEsser.graph.now')}
            </span>
          </span>
          <span className="deesser-visual__key">
            <span>
              <i className="deesser-visual__swatch deesser-visual__swatch--voice" />
              {t('dsp.deEsser.graph.voice')}
            </span>
            <span>
              <i className="deesser-visual__swatch deesser-visual__swatch--hat" />
              {t('dsp.deEsser.graph.spared')}
            </span>
            <span>
              <i className="deesser-visual__swatch deesser-visual__swatch--cut" />
              {t('dsp.deEsser.graph.cut')}
            </span>
          </span>
        </span>
      </div>

      <span className="deesser-visual__chains">
        {CHAINS.map((chain) => (
          <span key={chain} className="deesser-visual__chain">
            <i />
            {t(chain)}
          </span>
        ))}
      </span>
    </div>
  );
}
