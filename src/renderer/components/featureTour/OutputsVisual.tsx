/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { curveArea, curvePath, type TMiniBand } from './miniCurve';

/**
 * Every output keeping its own sound, drawn from the side panel's own words:
 * the Output card with a headset and speakers, each under its own preset,
 * curve and DSP stages, the one playing lit in turn — what the listener sees
 * switching from one to the other — and the Second output playing beside them
 * with a sound of its own, how far behind it plays and its battery.
 *
 * Real devices, because the feature is about the outputs people own; the
 * presets and stages are the catalogue's own names, so a renamed one renames
 * the picture.
 */

const PLOT = { width: 120, height: 36, range: 6.5 };

interface IOutput {
  id: string;
  name: string;
  glyph: 'headset' | 'speaker';
  preset: TranslationKey;
  stages: TranslationKey[];
  bands: TMiniBand[];
}

const MAIN: IOutput[] = [
  {
    id: 'headset',
    name: 'Kraken V4 Pro',
    glyph: 'headset',
    preset: 'dsp.eqPreset.rock',
    stages: ['dsp.bassPunch.title', 'dsp.room.title'],
    bands: [
      { kind: 'lowShelf', hz: 90, db: 5 },
      { kind: 'bell', hz: 420, db: -2.5, q: 1.1 },
      { kind: 'bell', hz: 3200, db: 3.5, q: 1.3 },
      { kind: 'highShelf', hz: 11000, db: 2.5 },
    ],
  },
  {
    id: 'speakers',
    name: 'Speakers (Realtek Audio)',
    glyph: 'speaker',
    preset: 'dsp.eqPreset.movie',
    stages: ['dsp.dimension.title', 'dsp.maximizer.title'],
    bands: [
      { kind: 'lowShelf', hz: 70, db: 3.5 },
      { kind: 'bell', hz: 250, db: -1.5, q: 0.9 },
      { kind: 'bell', hz: 2400, db: 4, q: 0.8 },
      { kind: 'highShelf', hz: 9000, db: -1.5 },
    ],
  },
];

const SECOND: IOutput = {
  id: 'second',
  name: 'BlackShark V2 Pro',
  glyph: 'headset',
  preset: 'dsp.eqPreset.gaming',
  stages: [],
  bands: [
    { kind: 'lowShelf', hz: 120, db: -3 },
    { kind: 'bell', hz: 2800, db: 5, q: 1 },
    { kind: 'bell', hz: 6500, db: 2.5, q: 1.6 },
  ],
};

const Glyph = ({ kind }: { kind: IOutput['glyph'] }) => (
  <svg
    className="outputs-visual__glyph"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    {kind === 'headset' ? (
      <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5zM20 14h-3v6h2a1 1 0 0 0 1-1v-5z" />
    ) : (
      <path d="M6 3.5h12v17H6zM12 8.2h0M12 16.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z" />
    )}
  </svg>
);

const Curve = ({ bands }: { bands: TMiniBand[] }) => (
  <svg
    className="outputs-visual__curve"
    viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <line
      className="outputs-visual__zero"
      x1="0"
      x2={PLOT.width}
      y1={PLOT.height / 2}
      y2={PLOT.height / 2}
    />
    <path className="outputs-visual__area" d={curveArea(bands, PLOT)} />
    <path className="outputs-visual__line" d={curvePath(bands, PLOT)} />
  </svg>
);

export default function OutputsVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="outputs-visual"
      role="img"
      aria-label={t('tour.outputs.imageAlt')}
    >
      <div className="outputs-visual__panel">
        <span className="outputs-visual__head">{t('output.title')}</span>
        <ul className="outputs-visual__outputs">
          {MAIN.map((output, index) => (
            <li
              key={output.id}
              className="outputs-visual__output"
              style={{ '--turn': index } as CSSProperties}
            >
              <span className="outputs-visual__name">
                <Glyph kind={output.glyph} />
                <strong>{output.name}</strong>
                <span className="outputs-visual__active">
                  {t('output.active')}
                </span>
              </span>
              <span className="outputs-visual__sound">
                <span className="outputs-visual__preset">
                  {t(output.preset)}
                </span>
                <Curve bands={output.bands} />
              </span>
              <span className="outputs-visual__stages">
                {output.stages.map((stage) => (
                  <span key={stage}>{t(stage)}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="outputs-visual__panel outputs-visual__panel--second">
        <span className="outputs-visual__head">{t('extraOutput.title')}</span>
        <span className="outputs-visual__output is-second">
          <span className="outputs-visual__name">
            <span className="outputs-visual__switch" />
            <strong>{SECOND.name}</strong>
            <span className="outputs-visual__battery">
              <span />
              82%
            </span>
          </span>
          <span className="outputs-visual__sound">
            <span className="outputs-visual__preset">{t(SECOND.preset)}</span>
            <Curve bands={SECOND.bands} />
          </span>
          <span className="outputs-visual__foot">
            <span className="outputs-visual__delay">
              {t('extraOutput.delay', { milliseconds: 38 })}
            </span>
            <span className="outputs-visual__edit">
              {t('extraOutput.edit')}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
