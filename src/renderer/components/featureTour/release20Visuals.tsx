/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_STYLES } from '../../../common/graphAnalysis';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import TitlebarCorner from './TitlebarCorner';
import lookBackdrop from '../../../../assets/tour/look-backdrop.jpg';
import lookWindowColours from '../../../../assets/tour/look-window-colours.jpg';

/**
 * The pictures on the two headline slides only 2.0 has: the window's new look
 * and the graph's measuring views.
 *
 * The new look is photographed: it is the window itself, and what the
 * Backdrop does is only seen in the real thing. The measuring views are drawn
 * like the release's other pictures (`release18Visuals.tsx`): the app's own
 * words in the reader's language and the theme's own colours, so neither goes
 * stale when a pane moves or the Brightness slider does. Each is composed
 * about as tall as it is wide.
 */

// ---------------------------------------------------------------------------
// The new look: the window on the Backdrop, photographed, and the Window
// colours menu that put the visualizer there, cut from the same window.

/**
 * The photographs' own sizes, so each holds its place before it loads. Both
 * are from the running window at 2560 x 1392 on 2026-09-29, Brightness at
 * half: the EQ page with Aurora on the Backdrop, and its Window colours menu
 * cut out at the size the window draws it (Ivan, 2026-09-28: "the number 1
 * take full picture if the app in backdrop mode"). A drawing small enough for
 * this slide could not show what the Backdrop is, a scene behind every pane.
 * Retake both when the window changes.
 */
const WINDOW_PHOTO = { width: 1400, height: 761 };
const MENU_PHOTO = { width: 301, height: 473 };

/** FluidEQ on the Backdrop, and the menu that put the visualizer there. */
export function LookVisual() {
  const { t } = useTranslation();
  return (
    <div className="look-photo" role="img" aria-label={t('tour.look.imageAlt')}>
      <TitlebarCorner
        ringed="actions"
        label={t('graph.sceneTint.brightness')}
      />
      <div className="look-photo__stage">
        <img
          className="look-photo__window"
          src={lookBackdrop}
          alt=""
          width={WINDOW_PHOTO.width}
          height={WINDOW_PHOTO.height}
        />
        <img
          className="look-photo__menu"
          src={lookWindowColours}
          alt=""
          width={MENU_PHOTO.width}
          height={MENU_PHOTO.height}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The graph's measuring views: the Analyzer as the graph draws it, and the
// picker's Analysis list beside it.

/**
 * The views under Analysis, in the picker's order and by the picker's names:
 * the picture lists what the picker lists, so a thirteenth view shows up here
 * by itself.
 */
const VIEWS = ANALYSIS_STYLES.map(
  (style) => `graph.styleName.${style}` as TranslationKey,
);

/** The plot as the graph spans it with its grid on: 10 Hz to 25 kHz, 80 dB. */
const LOW_HZ = 10;
const HIGH_HZ = 25_000;
const FLOOR_DB = -80;

/** Where a frequency stands across the plot, 0..100, on its log axis. */
const xOf = (hz: number) =>
  (Math.log10(hz / LOW_HZ) / Math.log10(HIGH_HZ / LOW_HZ)) * 100;

/** Where a level stands down the plot, 0..100, 0 dBFS at the top. */
const yOf = (db: number) =>
  (Math.min(0, Math.max(FLOOR_DB, db)) / FLOOR_DB) * 100;

/**
 * A record's level at a frequency, averaged: the kick and the bass line under
 * 120 Hz, then about 4 dB less an octave the way mixes fall, and next to
 * nothing under 25 Hz or over 17 kHz, where a lossy encoder has cut. A slow
 * ripple keeps it from reading as a ruler.
 */
const averageAt = (hz: number) => {
  const octaves = Math.log2(hz / 120);
  const tilt = octaves > 0 ? -4.2 * octaves : 1.5 * octaves;
  const lowCut = hz < 30 ? -40 * Math.log2(30 / hz) : 0;
  const highCut = hz > 16_500 ? -60 * Math.log2(hz / 16_500) : 0;
  const ripple =
    2.6 * Math.sin(octaves * 5.3) + 1.4 * Math.sin(octaves * 11.9 + 1);
  return -16 + tilt + lowCut + highCut + ripple;
};

/** The peaks the same moment holds: a few dB over the average, unevenly. */
const peakAt = (hz: number) =>
  averageAt(hz) + 6 + 2.4 * Math.sin(Math.log2(hz) * 7.7 + 2);

/** One point every twelfth of an octave, the resolution the graph reads at. */
const SPECTRUM_HZ = (() => {
  const points: number[] = [];
  for (let hz = LOW_HZ; hz <= HIGH_HZ; hz *= 2 ** (1 / 12)) {
    points.push(hz);
  }
  return points;
})();

const polyline = (levelAt: (hz: number) => number) =>
  SPECTRUM_HZ.map(
    (hz) => `${xOf(hz).toFixed(2)},${yOf(levelAt(hz)).toFixed(2)}`,
  ).join(' ');

const AVERAGE_LINE = polyline(averageAt);
const PEAK_LINE = polyline(peakAt);

/** The ISO third-octave centres the RTA's bars stand on. */
const THIRD_OCTAVES = [
  25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10_000, 12_500,
  16_000, 20_000,
];

/** A third-octave bar: its edges a sixth of an octave either side, less a gap. */
const RTA_BARS = THIRD_OCTAVES.map((hz) => {
  const left = xOf(hz * 2 ** (-1 / 6));
  const right = xOf(hz * 2 ** (1 / 6));
  const top = yOf(averageAt(hz) + 3);
  return {
    hz,
    x: left + 0.18,
    width: Math.max(0.2, right - left - 0.36),
    y: top,
    height: 100 - top,
  };
});

/**
 * The EQ curve on the EQ's own ±20 dB, which the graph gives the middle eight
 * tenths: a low shelf, a little cut in the low mids, presence and air.
 */
const eqGainAt = (hz: number) => {
  const octave = Math.log2(hz);
  const shelf = 4.5 / (1 + Math.exp((octave - Math.log2(90)) * 2.2));
  const mud = -2.5 * Math.exp(-(((octave - Math.log2(350)) / 0.8) ** 2));
  const presence = 1.8 * Math.exp(-(((octave - Math.log2(3200)) / 0.9) ** 2));
  const air = 3.5 / (1 + Math.exp(-(octave - Math.log2(11_000)) * 2.4));
  return shelf + mud + presence + air;
};

const EQ_LINE = SPECTRUM_HZ.map(
  (hz) => `${xOf(hz).toFixed(2)},${(50 - eqGainAt(hz) * 2).toFixed(2)}`,
).join(' ');

/** The frequencies the axis names, on the 1-2-5 series analysers print. */
const FREQUENCY_TICKS: { hz: number; label: string }[] = [
  { hz: 20, label: '20' },
  { hz: 50, label: '50' },
  { hz: 100, label: '100' },
  { hz: 200, label: '200' },
  { hz: 500, label: '500' },
  { hz: 1000, label: '1k' },
  { hz: 2000, label: '2k' },
  { hz: 5000, label: '5k' },
  { hz: 10_000, label: '10k' },
  { hz: 20_000, label: '20k' },
];

/** The levels the right-hand scale names, 80 dB deep. */
const LEVEL_TICKS = [0, -20, -40, -60, -80];

/** The analyser as the graph draws it, and the twelve views beside it. */
export function GraphViewsVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="analyser-visual"
      role="img"
      aria-label={t('tour.graph.imageAlt')}
    >
      <div className="analyser-visual__plot">
        <span className="analyser-visual__chip">
          {t('graph.styleName.analyzer')}
        </span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {FREQUENCY_TICKS.map((tick) => (
            <line
              key={tick.hz}
              className="analyser-visual__grid"
              x1={xOf(tick.hz)}
              x2={xOf(tick.hz)}
              y1="0"
              y2="100"
            />
          ))}
          {LEVEL_TICKS.slice(1, -1).map((db) => (
            <line
              key={db}
              className="analyser-visual__grid"
              x1="0"
              x2="100"
              y1={yOf(db)}
              y2={yOf(db)}
            />
          ))}
          {RTA_BARS.map((bar) => (
            <rect
              key={bar.hz}
              className="analyser-visual__bar"
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
            />
          ))}
          <polygon
            className="analyser-visual__fill"
            points={`0,100 ${AVERAGE_LINE} 100,100`}
          />
          <polyline
            className="analyser-visual__average"
            points={AVERAGE_LINE}
          />
          <polyline className="analyser-visual__peak" points={PEAK_LINE} />
          <polyline className="analyser-visual__eq" points={EQ_LINE} />
        </svg>
        <span className="analyser-visual__levels" aria-hidden="true">
          {LEVEL_TICKS.map((db) => (
            <span key={db} style={{ top: `${yOf(db)}%` }}>
              {db === 0 ? '0' : `−${Math.abs(db)}`}
            </span>
          ))}
        </span>
        <span className="analyser-visual__frequencies" aria-hidden="true">
          {FREQUENCY_TICKS.map((tick) => (
            <span key={tick.hz} style={{ left: `${xOf(tick.hz)}%` }}>
              {tick.label}
            </span>
          ))}
        </span>
      </div>

      <div className="analyser-visual__picker">
        <span className="analyser-visual__family">
          {t('graph.family.analysis')}
        </span>
        <ol>
          {VIEWS.map((view, index) => (
            <li key={view} className={index === 0 ? 'is-chosen' : undefined}>
              {t(view)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
