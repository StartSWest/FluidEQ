/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { PRODUCT_NAME } from '../../../common/branding';
import { ANALYSIS_STYLES } from '../../../common/graphAnalysis';
import type { TranslationKey } from '../../../common/i18n';
import BrandMark from '../../icons/BrandMark';
import { useTranslation } from '../../utils/I18nContext';
import TitlebarCorner from './TitlebarCorner';
import sceneAlpine from '../../../../assets/tour/scene-alpine.jpg';

/**
 * The pictures on the two headline slides only 2.0 has: the window's new look
 * and the graph's measuring views.
 *
 * Drawn, not captured, like the release's other pictures
 * (`release18Visuals.tsx`): the app's own words in the reader's language and
 * the theme's own colours, so neither goes stale when a pane moves or the
 * theme slider does. The Help pictures are the captures; these are
 * miniatures. Each is composed about as tall as it is wide.
 */

// ---------------------------------------------------------------------------
// The new look: the window with a visualizer behind its panes, and the Window
// colours menu that put it there.

/** The window-colours menu's four modes, in the menu's order. */
const MODES: { id: string; key: TranslationKey }[] = [
  { id: 'off', key: 'graph.sceneTint.short.off' },
  { id: 'tint', key: 'graph.sceneTint.short.tint' },
  { id: 'pulse', key: 'graph.sceneTint.short.pulse' },
  { id: 'cover', key: 'graph.sceneTint.short.cover' },
];

/** Backdrop: the mode the picture is drawn in. */
const CHOSEN_MODE = 'cover';

/** The tabs along the miniature's title bar, EQ open. */
const TABS: TranslationKey[] = [
  'tabs.eq',
  'tabs.dsp',
  'tabs.library',
  'tabs.karaoke',
];

/** The band sliders under the graph: a band's name and how far it is up. */
const BANDS: { hz: string; level: number }[] = [
  { hz: '31', level: 0.66 },
  { hz: '63', level: 0.72 },
  { hz: '125', level: 0.6 },
  { hz: '250', level: 0.47 },
  { hz: '500', level: 0.4 },
  { hz: '1k', level: 0.43 },
  { hz: '2k', level: 0.52 },
  { hz: '4k', level: 0.58 },
  { hz: '8k', level: 0.66 },
  { hz: '16k', level: 0.7 },
];

/**
 * The EQ curve over the backdrop, on a 0..100 box with gain up: a warm low
 * end, a dip in the low mids and some air, the shape the bands below make.
 */
const LOOK_CURVE = (() => {
  const points: string[] = [];
  for (let step = 0; step <= 60; step += 1) {
    const x = step / 60;
    const bass = 15 * Math.exp(-(((x - 0.12) / 0.11) ** 2));
    const dip = 8 * Math.exp(-(((x - 0.45) / 0.12) ** 2));
    const air = 12 / (1 + Math.exp(-(x - 0.84) * 16));
    const y = 56 - bass + dip - air;
    points.push(`${(x * 100).toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
})();

/** The name as the title bar writes it: "Fluid" in white, "EQ" in Lagoon. */
const NAME_SUFFIX = 'EQ';
const NAME_FIRST = PRODUCT_NAME.endsWith(NAME_SUFFIX)
  ? PRODUCT_NAME.slice(0, -NAME_SUFFIX.length)
  : PRODUCT_NAME;

/**
 * A slider as the menu draws it, Brightness and Transparency alike: the accent
 * filling the track up to the thumb, and the marks at the quarters the thumb
 * falls into.
 */
function MenuSlider({
  label,
  value,
}: {
  label: string;
  /** Where the thumb stands, 0..1. */
  value: number;
}) {
  return (
    <span className="window-visual__slider">
      <span className="window-visual__slider-label">{label}</span>
      <span
        className="window-visual__track"
        style={{ '--thumb': `${value * 100}%` } as CSSProperties}
      >
        <span className="window-visual__fill" />
        {[25, 50, 75].map((mark) => (
          <span
            key={mark}
            className="window-visual__mark"
            style={{ left: `${mark}%` }}
          />
        ))}
        <span className="window-visual__thumb" />
      </span>
    </span>
  );
}

/** FluidEQ with a visualizer behind its panes, and the menu that put it there. */
export function LookVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="window-visual"
      role="img"
      aria-label={t('tour.look.imageAlt')}
    >
      <TitlebarCorner
        ringed="actions"
        label={t('graph.sceneTint.brightness')}
      />
      <div className="window-visual__window">
        <img className="window-visual__scene" src={sceneAlpine} alt="" />
        <div className="window-visual__titlebar">
          <BrandMark className="window-visual__mark-tile" />
          <span className="window-visual__name">
            {NAME_FIRST}
            {NAME_FIRST !== PRODUCT_NAME && <span>{NAME_SUFFIX}</span>}
          </span>
          <span className="window-visual__tabs">
            {TABS.map((tab, index) => (
              <span key={tab} className={index === 0 ? 'is-open' : undefined}>
                {t(tab)}
              </span>
            ))}
          </span>
        </div>
        <div className="window-visual__floor">
          <div className="window-visual__side">
            <span className="window-visual__power" />
            <span className="window-visual__meter">
              <span />
            </span>
          </div>
          <div className="window-visual__main">
            <svg
              className="window-visual__curve"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline points={LOOK_CURVE} />
            </svg>
            <ul className="window-visual__bands">
              {BANDS.map((band) => (
                <li
                  key={band.hz}
                  style={{ '--level': band.level } as CSSProperties}
                >
                  <span className="window-visual__band-track">
                    <span />
                  </span>
                  <small>{band.hz}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="window-visual__menu">
        <strong className="window-visual__menu-title">
          {t('graph.sceneTint.label')}
        </strong>
        <ul className="window-visual__modes">
          {MODES.map((mode) => (
            <li
              key={mode.id}
              className={mode.id === CHOSEN_MODE ? 'is-chosen' : undefined}
            >
              <span
                className={`window-visual__swatch window-visual__swatch--${mode.id}`}
              />
              {t(mode.key)}
            </li>
          ))}
        </ul>
        <MenuSlider label={t('graph.sceneTint.brightness')} value={0.5} />
        <MenuSlider label={t('graph.backdropVeil')} value={0.25} />
        <span className="window-visual__rainbow">
          <span>{t('graph.sceneTint.rainbow')}</span>
          <span className="window-visual__switch" />
        </span>
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
