/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import BrandMark from '../../icons/BrandMark';
import { useTranslation } from '../../utils/I18nContext';

/**
 * Where the sound goes under the FluidEQ Engine, drawn as the path it takes:
 * everything the computer plays, into the engine inside Windows audio, through
 * the EQ and the whole DSP rack, out to the headphones and the speakers.
 *
 * A diagram and not a capture, because the point is the one thing no screen
 * of the app shows — that a game or a browser now goes through the rack too.
 *
 * The boxes are HTML so every language wraps inside them; the wires are an
 * SVG stretched over the gap between two columns. Both columns lay their rows
 * out in equal quarters, so a row's middle is always at 50, 150, 250 or 350
 * of the wires' 400-unit height, whatever size the panel is.
 */

const SOURCE_ROWS = [50, 150, 250, 350];
const OUTPUT_ROWS = [150, 250];

/** The rack in the order the engine runs it. */
const STAGES: TranslationKey[] = [
  'dsp.normalizer.title',
  'dsp.denoise.title',
  'dsp.exciter.title',
  'dsp.bassForge.title',
  'dsp.eq.title',
  'dsp.bassPunch.title',
  'dsp.dimension.title',
  'dsp.maximizer.title',
  'dsp.master.title',
];

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="engine-flow__glyph" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

const SOURCES: { id: string; label: TranslationKey; icon: ReactNode }[] = [
  {
    id: 'games',
    label: 'tour.engine.flow.games',
    icon: (
      <Icon>
        <path d="M7.2 8.5h9.6a4.2 4.2 0 0 1 4.1 5.2l-.7 3a2.3 2.3 0 0 1-3.9 1.1l-1.8-1.9H9.5l-1.8 1.9a2.3 2.3 0 0 1-3.9-1.1l-.7-3a4.2 4.2 0 0 1 4.1-5.2Z" />
        <path d="M8 11.4v3.2M6.4 13h3.2" />
        <circle cx="15.6" cy="12.2" r="0.9" />
        <circle cx="17.4" cy="14" r="0.9" />
      </Icon>
    ),
  },
  {
    id: 'browser',
    label: 'tour.engine.flow.browser',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M3.6 12h16.8M12 3.6c2.4 2.3 3.6 5.1 3.6 8.4s-1.2 6.1-3.6 8.4c-2.4-2.3-3.6-5.1-3.6-8.4s1.2-6.1 3.6-8.4Z" />
      </Icon>
    ),
  },
  {
    id: 'music',
    label: 'tour.engine.flow.music',
    icon: (
      <Icon>
        <path d="M9.5 17.2V6.4l9.5-2.2v10.8" />
        <circle cx="7" cy="17.2" r="2.5" />
        <circle cx="16.5" cy="15" r="2.5" />
      </Icon>
    ),
  },
  {
    id: 'video',
    label: 'tour.engine.flow.video',
    icon: (
      <Icon>
        <rect x="3" y="5.2" width="18" height="13.6" rx="3" />
        <path d="M10.2 9.2 15 12l-4.8 2.8Z" />
      </Icon>
    ),
  },
];

const OUTPUTS: { id: string; label: TranslationKey; icon: ReactNode }[] = [
  {
    id: 'headphones',
    label: 'tour.engine.flow.headphones',
    icon: (
      <Icon>
        <path d="M4.5 15.5v-3a7.5 7.5 0 0 1 15 0v3" />
        <rect x="3.5" y="13.8" width="4" height="6.4" rx="1.6" />
        <rect x="16.5" y="13.8" width="4" height="6.4" rx="1.6" />
      </Icon>
    ),
  },
  {
    id: 'speakers',
    label: 'tour.engine.flow.speakers',
    icon: (
      <Icon>
        <rect x="6" y="3" width="12" height="18" rx="2.6" />
        <circle cx="12" cy="14.2" r="3.4" />
        <circle cx="12" cy="7.4" r="1.3" />
      </Icon>
    ),
  },
];

/** Four wires into one, or one into two, across a 60×400 gap. */
const Wires = ({ from, to }: { from: number[]; to: number[] }) => {
  const paths = from.flatMap((start) =>
    to.map((end) => `M0 ${start} C 32 ${start}, 28 ${end}, 60 ${end}`),
  );
  return (
    <svg
      className="engine-flow__wires"
      viewBox="0 0 60 400"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} className="engine-flow__wire" d={d} />
      ))}
      {paths.map((d, index) => (
        <path
          key={`pulse-${d}`}
          className="engine-flow__pulse"
          d={d}
          style={{ animationDelay: `${index * -0.45}s` }}
        />
      ))}
    </svg>
  );
};

export default function EngineFlow() {
  const { t } = useTranslation();

  return (
    <div
      className="engine-flow"
      role="img"
      aria-label={t('tour.engine.flow.label')}
    >
      <ul className="engine-flow__column engine-flow__column--sources">
        {SOURCES.map((source) => (
          <li key={source.id} className="engine-flow__node">
            {source.icon}
            <span>{t(source.label)}</span>
          </li>
        ))}
      </ul>

      <Wires from={SOURCE_ROWS} to={[200]} />

      <div className="engine-flow__engine">
        <div className="engine-flow__head">
          <BrandMark className="engine-flow__mark" />
          <div>
            <strong>{t('engine.fluid.name')}</strong>
            <span>{t('tour.engine.flow.inside')}</span>
          </div>
        </div>

        <div className="engine-flow__eq">
          <span className="engine-flow__label">{t('tour.engine.flow.eq')}</span>
          <svg
            viewBox="0 0 200 56"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="engine-flow__grid"
              d="M0 28H200M50 0V56M100 0V56M150 0V56"
            />
            <path
              className="engine-flow__curve-fill"
              d="M0 34 C 22 34, 30 16, 52 18 S 88 40, 110 36 S 150 14, 172 20 S 194 30, 200 30 V56 H0 Z"
            />
            <path
              className="engine-flow__curve"
              d="M0 34 C 22 34, 30 16, 52 18 S 88 40, 110 36 S 150 14, 172 20 S 194 30, 200 30"
            />
          </svg>
        </div>

        <div className="engine-flow__rack">
          <span className="engine-flow__label">
            {t('tour.engine.flow.rack')}
          </span>
          <ol>
            {STAGES.map((stage) => (
              <li key={stage}>{t(stage)}</li>
            ))}
          </ol>
        </div>
      </div>

      <Wires from={[200]} to={OUTPUT_ROWS} />

      <ul className="engine-flow__column engine-flow__column--outputs">
        {OUTPUTS.map((output) => (
          <li key={output.id} className="engine-flow__node">
            {output.icon}
            <span>{t(output.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
