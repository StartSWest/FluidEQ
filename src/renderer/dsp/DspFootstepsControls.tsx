/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import {
  FOOTSTEPS_DEFAULTS,
  FOOTSTEPS_MAX_CALM_DB,
  FOOTSTEPS_MAX_LIFT_DB,
  IFootstepsSettings,
} from '../../common/dsp/footsteps';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';
import { readDspFootstepsReport } from './footstepsTelemetry';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';

interface IDspFootstepsControlsProps {
  footsteps: IFootstepsSettings;
  onEdit: (next: Partial<IFootstepsSettings>) => void;
  onCommit: () => void;
}

/**
 * The three bands the stage lifts, in the engine's order (`kBands` in
 * `footsteps.cpp`), each with the most it can be lifted at a Lift of one.
 * Written out whole: the dead-keys guard reads keys, not templates.
 */
const BANDS: readonly {
  nameKey: TranslationKey;
  where: string;
  maxDb: number;
}[] = [
  { nameKey: 'dsp.footsteps.band.weight', where: '300 Hz', maxDb: 4 },
  { nameKey: 'dsp.footsteps.band.steps', where: '1.3 – 4.5 kHz', maxDb: 10 },
  { nameKey: 'dsp.footsteps.band.detail', where: '4.5 – 11 kHz', maxDb: 6 },
];

/** How long a lamp takes to fade once its band lets go, ms. */
const LAMP_RELEASE_MS = 300;
/** The smallest lift a lamp names: the strip draws nothing smaller either. */
const HEARD_DB = 0.3;

/**
 * The bands' lamps: each lights by as much as its band is being lifted, out
 * of the most that band can be. Painted straight onto the elements in the
 * frame loop, as the graphs are, so a lift twenty-three times a second is
 * never a React render.
 */
const FootstepsBandLamps = ({ enabled }: { enabled: boolean }) => {
  const { t } = useTranslation();
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const figures = useRef<(HTMLSpanElement | null)[]>([]);
  const held = useRef([0, 0, 0]);
  const lastFrame = useRef(0);

  useEffect(() => {
    const paint = ({ schedule }: IGraphLoopFrame) => {
      const now = performance.now();
      const dt = Math.min(100, Math.max(0, now - lastFrame.current));
      lastFrame.current = now;
      const report = enabled ? readDspFootstepsReport() : undefined;
      const ease = 1 - Math.exp(-dt / LAMP_RELEASE_MS);
      let fading = false;
      BANDS.forEach((band, index) => {
        const reading = report?.liftDb[index] ?? 0;
        const was = held.current[index];
        const next = reading > was ? reading : was + (reading - was) * ease;
        held.current[index] = next < 0.05 ? 0 : next;
        fading = fading || held.current[index] > 0;
        const fill = fills.current[index];
        if (fill) {
          fill.style.transform = `scaleX(${Math.min(1, held.current[index] / band.maxDb)})`;
        }
        const figure = figures.current[index];
        if (figure) {
          // A tenth of a decibel is not heard, and printed it flickers.
          const text =
            held.current[index] >= HEARD_DB
              ? `+${held.current[index].toFixed(1)} dB`
              : '';
          if (figure.textContent !== text) {
            figure.textContent = text;
          }
        }
      });
      // The loop sleeps while nothing plays; a lamp fading out asks for its
      // own frames.
      if (fading) {
        schedule();
      }
    };
    const loop = startGraphLoop(paint, {
      onEngineGone: () => {
        held.current = [0, 0, 0];
      },
    });
    loop.schedule();
    return () => loop.stop();
  }, [enabled]);

  return (
    <ul className="dsp-footsteps-lamps">
      {BANDS.map((band, index) => (
        <li key={band.nameKey} className="dsp-footsteps-lamp">
          <span className="dsp-footsteps-lamp-name">{t(band.nameKey)}</span>
          <span className="dsp-footsteps-lamp-where">{band.where}</span>
          <span className="dsp-footsteps-lamp-track" aria-hidden="true">
            <span
              className="dsp-footsteps-lamp-fill"
              ref={(element) => {
                fills.current[index] = element;
              }}
            />
          </span>
          <span
            className="dsp-footsteps-lamp-figure"
            ref={(element) => {
              figures.current[index] = element;
            }}
          />
        </li>
      ))}
    </ul>
  );
};

/** Footsteps' two dials and the bands they act on. */
const DspFootstepsControls = ({
  footsteps,
  onEdit,
  onCommit,
}: IDspFootstepsControlsProps) => {
  const { t } = useTranslation();
  const isOff = !footsteps.enabled;
  const upTo = (db: number) => t('dsp.footsteps.upTo', { db: db.toFixed(1) });

  return (
    <div className="dsp-footsteps-controls">
      <div className="dsp-band">
        <span className="dsp-band-title">{t('dsp.footsteps.lift')}</span>
        <p className="dsp-band-hint">{t('dsp.footsteps.liftHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.footsteps.lift"
            value={footsteps.lift * 100}
            defaultValue={FOOTSTEPS_DEFAULTS.lift * 100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(value) => onEdit({ lift: value / 100 })}
          />
        </div>
        <p className="dsp-footsteps-reach">
          {upTo(footsteps.lift * FOOTSTEPS_MAX_LIFT_DB)}
        </p>
      </div>

      <div className="dsp-band">
        <span className="dsp-band-title">{t('dsp.footsteps.calm')}</span>
        <p className="dsp-band-hint">{t('dsp.footsteps.calmHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.footsteps.calm"
            value={footsteps.calm * 100}
            defaultValue={FOOTSTEPS_DEFAULTS.calm * 100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(value) => onEdit({ calm: value / 100 })}
          />
        </div>
        <p className="dsp-footsteps-reach is-calm">
          {upTo(footsteps.calm * FOOTSTEPS_MAX_CALM_DB)}
        </p>
      </div>

      <div className="dsp-band">
        <span className="dsp-band-title">{t('dsp.footsteps.bands')}</span>
        <p className="dsp-band-hint">{t('dsp.footsteps.bandsHint')}</p>
        <FootstepsBandLamps enabled={footsteps.enabled} />
      </div>
    </div>
  );
};

export default DspFootstepsControls;
