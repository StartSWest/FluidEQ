/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import eqModeShot from '../../../../assets/tour/eq-mode.jpg';

/**
 * The FluidEQ Engine's sound, shown where the listener chooses it and as it
 * was measured: the EQ mode menu open under its button with the Treble row
 * ringed (a photograph of the real menu, `scratchpad/tour-shots`,
 * `shoot-eqmode.mjs`), a treble curve that Precise plays as drawn and
 * Classic plays short, and a preset switch that used to crackle and now
 * crosses over under the music.
 *
 * The numbers are the measurements the engine's changes were made against
 * (CLAUDE.md): Classic, the cookbook Equalizer APO builds, left a 48 kHz
 * output's treble 1.5 dB short at 8 kHz and 3.8 dB at 20 kHz; a preset switch
 * landed at -24 to -30 dBFS above 5 kHz, and now none passes -80.
 */

/** Where the button and the Treble row stand in the photograph (340 x 358.8). */
const SHOT = { width: 340, height: 358.8 };
const TRIGGER = { left: 223.6, top: 14, width: 102.4, height: 32 };
const TREBLE = { left: 32, top: 273, width: 276, height: 32 };

const share = (box: typeof TRIGGER) => ({
  left: `${(box.left / SHOT.width) * 100}%`,
  top: `${(box.top / SHOT.height) * 100}%`,
  width: `${(box.width / SHOT.width) * 100}%`,
  height: `${(box.height / SHOT.height) * 100}%`,
});

/** 1 kHz to 20 kHz across 10..190 of the chart's 200 units. */
const xOf = (hz: number) => 10 + (Math.log10(hz / 1000) / Math.log10(20)) * 180;
/** 0 to +8 dB up 84..12 of its 100. */
const yOf = (db: number) => 84 - db * 9;

/** The curve as drawn: a treble shelf of +6 dB around 4 kHz. */
const drawn = (hz: number) => {
  const s = (hz / 4000) ** 2;
  return (6 * s) / (1 + s);
};
/** How far short Classic plays it: 1.5 dB at 8 kHz, 3.8 at 20 kHz. */
const shortfall = (hz: number) => 3.8 * (hz / 20000) ** 1.01;

const FREQUENCIES = Array.from({ length: 49 }, (_, i) => 1000 * 20 ** (i / 48));
const line = (gain: (hz: number) => number) =>
  FREQUENCIES.map(
    (hz) => `${xOf(hz).toFixed(2)},${yOf(gain(hz)).toFixed(2)}`,
  ).join(' ');
const DRAWN = line(drawn);
const CLASSIC = line((hz) => drawn(hz) - shortfall(hz));
const TICKS = [1000, 2000, 5000, 10000, 20000];
const tickName = (hz: number) => `${hz / 1000}k`;

/** The switch: -100 dBFS to -20 over 90..10; -20 ms to +60 across 10..190. */
const levelY = (dbfs: number) => 90 - ((dbfs + 100) / 80) * 80;
const timeX = (ms: number) => 10 + ((ms + 20) / 80) * 180;
const BEFORE = [
  [-20, -98],
  [-2, -97],
  [0, -26],
  [3, -70],
  [8, -95],
  [60, -97],
]
  .map(([ms, db]) => `${timeX(ms).toFixed(2)},${levelY(db).toFixed(2)}`)
  .join(' ');
const NOW = Array.from({ length: 41 }, (_, i) => {
  const ms = -20 + i * 2;
  const db = -93 + Math.sin(i * 1.7) * 1.4 + Math.sin(i * 0.6) * 0.8;
  return `${timeX(ms).toFixed(2)},${levelY(db).toFixed(2)}`;
}).join(' ');

export default function EngineSoundVisual() {
  const { t, locale } = useTranslation();
  // Decimals in the reader's own way, and a real minus sign, as the app's
  // readouts write them.
  const decibels = useMemo(() => {
    const number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return (value: number) =>
      `${value < 0 ? '−' : ''}${number.format(Math.abs(value))}`;
  }, [locale]);
  const whole = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const minus = (value: number) => `−${whole.format(value)}`;

  return (
    <div
      className="sound-visual"
      role="img"
      aria-label={t('tour.sound.imageAlt', {
        eqMode: t('eq.mode'),
        treble: t('eq.mode.treble'),
        precise: t('eq.mode.precise'),
        classic: t('eq.mode.classic'),
      })}
    >
      <span className="sound-visual__menu">
        <img src={eqModeShot} alt="" width={680} height={716} />
        <span className="sound-visual__ring" style={share(TRIGGER)} />
        <span className="sound-visual__ring" style={share(TREBLE)} />
      </span>

      <span className="sound-visual__charts">
        <span className="sound-visual__chart">
          <span className="sound-visual__chart-title">
            {t('tour.sound.trebleChart')}
          </span>
          <svg viewBox="0 0 200 100" preserveAspectRatio="none">
            {TICKS.map((hz) => (
              <line
                key={hz}
                className="sound-visual__grid"
                x1={xOf(hz)}
                x2={xOf(hz)}
                y1="8"
                y2="84"
              />
            ))}
            <line
              className="sound-visual__grid"
              x1="10"
              x2="190"
              y1={yOf(0)}
              y2={yOf(0)}
            />
            <polyline className="sound-visual__classic" points={CLASSIC} />
            <polyline className="sound-visual__precise" points={DRAWN} />
            <polyline className="sound-visual__drawn" points={DRAWN} />
            <line
              className="sound-visual__gap"
              x1="186"
              x2="186"
              y1={yOf(drawn(20000))}
              y2={yOf(drawn(20000) - shortfall(20000))}
            />
          </svg>
          <span className="sound-visual__ticks">
            {TICKS.map((hz) => (
              <span key={hz} style={{ left: `${(xOf(hz) / 200) * 100}%` }}>
                {tickName(hz)}
              </span>
            ))}
          </span>
          <span className="sound-visual__note">
            {decibels(-shortfall(20000))} dB
          </span>
          <span className="sound-visual__legend">
            <span className="is-precise">{t('eq.mode.precise')}</span>
            <span className="is-classic">{t('eq.mode.classic')}</span>
          </span>
        </span>

        <span className="sound-visual__chart">
          <span className="sound-visual__chart-title">
            {t('tour.sound.switchChart')}
          </span>
          <svg viewBox="0 0 200 100" preserveAspectRatio="none">
            <line
              className="sound-visual__floor"
              x1="10"
              x2="190"
              y1={levelY(-80)}
              y2={levelY(-80)}
            />
            <line
              className="sound-visual__grid"
              x1={timeX(0)}
              x2={timeX(0)}
              y1="8"
              y2="90"
            />
            <polyline className="sound-visual__before" points={BEFORE} />
            <polyline className="sound-visual__now" points={NOW} />
          </svg>
          <span
            className="sound-visual__peak"
            style={{ left: `${(timeX(0) / 200) * 100}%` }}
          >
            {minus(26)} dBFS
          </span>
          <span className="sound-visual__floor-label">{minus(80)} dBFS</span>
          <span className="sound-visual__legend">
            <span className="is-before">{t('tour.sound.before')}</span>
            <span className="is-now">{t('tour.sound.now')}</span>
          </span>
        </span>
      </span>
    </div>
  );
}
