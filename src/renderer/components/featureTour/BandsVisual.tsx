/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import { prefersReducedMotion } from '../../utils/bandReveal';
import MenuIcon from '../../icons/MenuIcon';
import EqModeIcon from '../../icons/EqModeIcon';
import {
  curveArea,
  curvePath,
  type TMiniBand,
  xOfHz,
  yOfDb,
} from './miniCurve';

/**
 * The equaliser read out on its own graph: five bands with their frequency,
 * Q and gain stacked over each point, as View → Everything draws them, one
 * band moving under the arrow keys with its numbers following it, and the EQ
 * mode card standing under the curves instead of over them — Your EQ's tab
 * open on its Strength and Treble rows, in the app's own words.
 *
 * The moving band is driven a frame at a time (`requestAnimationFrame`), so
 * its label reads the gain the curve is drawn at; with motion reduced it
 * holds still at its resting gain.
 */

const PLOT = { width: 200, height: 92, range: 9 };

interface IBand {
  kind: TMiniBand['kind'];
  hz: number;
  db: number;
  q: number;
}

const RESTING: IBand[] = [
  { kind: 'lowShelf', hz: 62, db: 4.5, q: 0.7 },
  { kind: 'bell', hz: 250, db: -2, q: 1.2 },
  { kind: 'bell', hz: 1000, db: 3, q: 1.4 },
  { kind: 'bell', hz: 3500, db: 2.5, q: 2 },
  { kind: 'highShelf', hz: 10000, db: 3, q: 0.7 },
];
/** The band the arrow keys are moving. */
const MOVING = 2;
const SWING_DB = 4;
const SWING_SECONDS = 5.5;

const toMini = (band: IBand): TMiniBand =>
  band.kind === 'bell'
    ? { kind: 'bell', hz: band.hz, db: band.db, q: band.q }
    : { kind: band.kind, hz: band.hz, db: band.db };

/** The frequencies the graph names along its foot, as its own axis does. */
const AXIS = [
  { hz: 20, name: '20' },
  { hz: 100, name: '100' },
  { hz: 1000, name: '1k' },
  { hz: 10000, name: '10k' },
  { hz: 20000, name: '20k' },
];

/** The moving band's gain, swung from its resting gain by the clock. */
const useSwing = () => {
  const [db, setDb] = useState(RESTING[MOVING].db);
  useEffect(() => {
    if (prefersReducedMotion()) {
      return undefined;
    }
    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const turn = ((now - start) / 1000 / SWING_SECONDS) * 2 * Math.PI;
      // Half a decibel at a time, as a press of an arrow key moves it.
      setDb(
        Math.round((RESTING[MOVING].db - SWING_DB * Math.sin(turn)) * 2) / 2,
      );
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  return db;
};

export default function BandsVisual() {
  const { t, locale } = useTranslation();
  const movingDb = useSwing();
  const bands = useMemo(
    () =>
      RESTING.map((band, index) =>
        index === MOVING ? { ...band, db: movingDb } : band,
      ),
    [movingDb],
  );
  const mini = bands.map(toMini);
  const format = useMemo(() => {
    const oneDecimal = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const upToOne = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    });
    return {
      hz: (hz: number) =>
        hz >= 1000 ? `${upToOne.format(hz / 1000)} kHz` : `${hz} Hz`,
      q: (q: number) => `Q ${upToOne.format(q)}`,
      db: (db: number) => {
        let sign = '';
        if (db > 0) {
          sign = '+';
        } else if (db < 0) {
          sign = '−';
        }
        return `${sign}${oneDecimal.format(Math.abs(db))} dB`;
      },
    };
  }, [locale]);

  return (
    <div
      className="bands-visual"
      role="img"
      aria-label={t('tour.bands.imageAlt')}
    >
      <div className="bands-visual__graph">
        <span className="bands-visual__bar">
          <span className="bands-visual__view">
            {t('graph.view.normal')}
            <span>{t('graph.contents.everything')}</span>
          </span>
          <kbd>{t('tour.bands.shortcut')}</kbd>
        </span>
        <span className="bands-visual__plot">
          <svg
            viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            {[100, 1000, 10000].map((hz) => (
              <line
                key={hz}
                className="bands-visual__grid"
                x1={xOfHz(hz, PLOT)}
                x2={xOfHz(hz, PLOT)}
                y1="0"
                y2={PLOT.height}
              />
            ))}
            <line
              className="bands-visual__zero"
              x1="0"
              x2={PLOT.width}
              y1={PLOT.height / 2}
              y2={PLOT.height / 2}
            />
            <path className="bands-visual__area" d={curveArea(mini, PLOT)} />
            <path className="bands-visual__line" d={curvePath(mini, PLOT)} />
          </svg>
          <span className="bands-visual__axis" aria-hidden="true">
            {AXIS.map((tick) => (
              <span
                key={tick.hz}
                style={
                  {
                    '--x': `${(xOfHz(tick.hz, PLOT) / PLOT.width) * 100}%`,
                  } as CSSProperties
                }
              >
                {tick.name}
              </span>
            ))}
          </span>
          {bands.map((band, index) => {
            const below = band.db < 0 && index !== MOVING;
            return (
              <span
                key={band.hz}
                className={`bands-visual__band${
                  index === MOVING ? ' is-moving' : ''
                }${below ? ' is-below' : ''}`}
                style={
                  {
                    '--x': `${(xOfHz(band.hz, PLOT) / PLOT.width) * 100}%`,
                    '--y': `${(yOfDb(band.db, PLOT) / PLOT.height) * 100}%`,
                  } as CSSProperties
                }
              >
                <span className="bands-visual__dot" />
                <span className="bands-visual__label">
                  <span>{format.hz(band.hz)}</span>
                  <span>{format.q(band.q)}</span>
                  <span>{format.db(band.db)}</span>
                </span>
                {index === MOVING && (
                  <span className="bands-visual__keys" aria-hidden="true">
                    <kbd>↑</kbd>
                    <kbd>↓</kbd>
                  </span>
                )}
              </span>
            );
          })}
        </span>
      </div>

      <div className="bands-visual__card">
        <span className="bands-visual__card-head">
          <MenuIcon name="settings" className="bands-visual__icon" />
          <strong>{t('eq.mode')}</strong>
          <MenuIcon name="pin" className="bands-visual__pin" />
        </span>
        <span className="bands-visual__tabs">
          <span className="is-selected">
            <EqModeIcon kind="eq" />
            {t('eq.mode.yourEq')}
          </span>
          <span>
            <EqModeIcon kind="curves" />
            {t('eq.mode.curves')}
          </span>
        </span>
        <span className="bands-visual__rows">
          <span className="bands-visual__row">
            <small>{t('eq.mode.strength')}</small>
            <span className="bands-visual__choices">
              <span className="is-selected">{t('eq.mode.normal')}</span>
              <span>{`${t('eq.mode.studio')} · ×1.5`}</span>
              <span>×2</span>
            </span>
          </span>
          <span className="bands-visual__row">
            <small>{t('eq.mode.treble')}</small>
            <span className="bands-visual__choices">
              <span className="is-selected">{t('eq.mode.precise')}</span>
              <span>{t('eq.mode.classic')}</span>
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}
