/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { KeyboardEvent, SyntheticEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AxisScale, NumberValue } from 'd3';
import { dspVoicingPresetId } from 'common/dsp/presetVoicing';
import type { TranslationKey } from 'common/i18n/en';
import {
  genreNoteKey,
  genreNotesFor,
  pinFrequencyLabel,
  signedTenth,
} from '../dsp/genreNotesModel';
import { openGenreNotes } from '../dsp/genreNotesStore';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import {
  IChartCurveData,
  IChartPointData,
  VOICING_CURVE_ID,
} from './ChartController';
import '../styles/GenreNotes.scss';

/**
 * A line's value at one frequency, between the two points either side of it
 * in log frequency, which is how the line is spaced and drawn. Nothing
 * outside the line's own span.
 */
const valueAt = (
  points: readonly IChartPointData[],
  hz: number,
): number | undefined => {
  const after = points.findIndex((point) => point.x >= hz);
  if (after < 0) {
    return undefined;
  }
  if (after === 0) {
    return points[0].x === hz ? points[0].y : undefined;
  }
  const a = points[after - 1];
  const b = points[after];
  const t = Math.log(hz / a.x) / Math.log(b.x / a.x);
  return a.y + (b.y - a.y) * t;
};

interface ITip {
  index: number;
  /** Where the pin stands in the window: its centre and its top and bottom. */
  x: number;
  top: number;
  bottom: number;
}

interface IGenrePinsProps {
  data: readonly IChartCurveData[];
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  /** The wave owns the plot, or the grid is off: no annotations on it. */
  isHidden: boolean;
}

/**
 * The frequencies a genre's curve was tuned around, numbered on the Preset
 * line where the main graph draws it, each saying what is there and why the
 * curve moves there — the same pins, numbers and words as the genre's notes,
 * which a press on one opens.
 *
 * Only for a `dsp:` voicing: an older voicing can share a genre's name and
 * not its curve. Placed on the line as drawn, strength and filter design
 * included, rather than on the curve as written, so a pin never floats beside
 * the line it names.
 */
const GenrePins = ({ data, xScale, yScale, isHidden }: IGenrePinsProps) => {
  const { t } = useTranslation();
  const { voicing } = useFluidEqContext();
  const [tip, setTip] = useState<ITip>();
  const presetId = dspVoicingPresetId(voicing);
  const notes = genreNotesFor(presetId);
  const line = data.find((curve) => curve.id === VOICING_CURVE_ID);
  if (isHidden || !presetId || !notes || !line) {
    return null;
  }

  const pins = notes.note.pins.flatMap((hz, index) => {
    const db = valueAt(line.line.points, hz);
    return db === undefined ? [] : [{ hz, index, db }];
  });
  const shown = tip ? pins.find((pin) => pin.index === tip.index) : undefined;

  const show = (index: number) => (event: SyntheticEvent<SVGGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setTip({
      index,
      x: box.left + box.width / 2,
      top: box.top,
      bottom: box.bottom,
    });
  };
  const hide = () => setTip(undefined);
  const open = () => {
    setTip(undefined);
    openGenreNotes(presetId);
  };

  // Above the pin unless the window has less room over it than the tip is
  // tall with its longest reason (about 140px at 260 wide), then below it.
  // Sideways it is held 138px from either edge in the style below: half its
  // 260px width and the 8px every menu keeps from the window's edge.
  const isAbove = !tip || tip.top > 150;

  return (
    <g className="genre-pins">
      {pins.map(({ hz, index, db }) => {
        const x = Number(xScale(hz));
        const y = Number(yScale(db));
        const what = t(genreNoteKey(notes.id, `pin.${hz}`));
        return (
          <g
            key={hz}
            className={`genre-pin${index === tip?.index ? ' is-active' : ''}`}
            transform={`translate(${x} ${y})`}
            role="button"
            tabIndex={0}
            aria-label={`${index + 1} · ${pinFrequencyLabel(hz)} · ${signedTenth(db)} dB: ${what}`}
            onPointerEnter={show(index)}
            onPointerLeave={hide}
            onFocus={show(index)}
            onBlur={hide}
            // The plot's own gestures — the marquee, the full-screen chrome
            // toggle, double-click to fill the screen — are not a pin's.
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              open();
            }}
            onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
              }
            }}
          >
            <circle className="genre-pin__halo" r={10} />
            <circle className="genre-pin__dot" r={3.4} />
            <circle className="genre-pin__badge" cy={-15} r={7} />
            <text y={-15} textAnchor="middle" dominantBaseline="central">
              {index + 1}
            </text>
          </g>
        );
      })}
      {shown &&
        tip &&
        createPortal(
          <div
            className={`genre-pin-tip${isAbove ? ' is-above' : ''}`}
            role="tooltip"
            style={{
              left: `clamp(138px, ${tip.x}px, calc(100vw - 138px))`,
              top: isAbove ? tip.top - 8 : tip.bottom + 8,
            }}
          >
            <b>
              {`${shown.index + 1} · ${pinFrequencyLabel(shown.hz)} · ${signedTenth(shown.db)} dB`}
            </b>
            <span>{t(genreNoteKey(notes.id, `pin.${shown.hz}`))}</span>
            <small>{t(genreNoteKey(notes.id, `pin.${shown.hz}.why`))}</small>
            <em>
              {t('genre.notes.pinOpen', {
                name: t(notes.labelKey as TranslationKey),
              })}
            </em>
          </div>,
          document.body,
        )}
    </g>
  );
};

export default GenrePins;
