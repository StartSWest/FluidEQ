/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { IMPORT_EARS, type TImportEars } from '../../../common/bandEars';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import { prefersReducedMotion } from '../../utils/bandReveal';
import MenuIcon from '../../icons/MenuIcon';
import {
  curveArea,
  curvePath,
  type TMiniBand,
  xOfHz,
  yOfDb,
} from './miniCurve';

/**
 * One band, two ears: the graph with the left ear's curve solid and the
 * right's dashed, as the EQ draws them, the band's own menu hanging over its
 * corner, and Squiglink's import row under it with the left ear chosen. The
 * band starts on both ears; Left + right is ticked and the two halves walk
 * apart, each to a frequency and gain of its own; Both ears is ticked and
 * they meet again in their middle — halfway in frequency on a log scale, the
 * average gain — which is where the band started, because that is where
 * joining puts it.
 *
 * Driven a frame at a time (`requestAnimationFrame`) so each half's numbers
 * read what its curve is drawn at; with motion reduced it holds still on the
 * two ears apart, the one state that shows the whole feature.
 */

const PLOT = { width: 200, height: 92, range: 9 };

/** The frequencies the graph names along its foot, as its own axis does. */
const AXIS = [
  { hz: 20, name: '20' },
  { hz: 100, name: '100' },
  { hz: 1000, name: '1k' },
  { hz: 10000, name: '10k' },
  { hz: 20000, name: '20k' },
];

/** What both ears share: the rest of the curve, which stays put. */
const SHARED: TMiniBand[] = [
  { kind: 'lowShelf', hz: 70, db: 3.5 },
  { kind: 'highShelf', hz: 9000, db: 2 },
];

const Q = 1.4;
/**
 * The two halves at their furthest apart, left of the middle: the band's
 * menu hangs over the plot's right-hand side, as a right-click menu does.
 */
const LEFT = { hz: 500, db: 6 };
const RIGHT = { hz: 1250, db: -4 };
/** Where both ears' band stands: the pair's middle, as Both ears joins it. */
const JOINED = {
  hz: Math.sqrt(LEFT.hz * RIGHT.hz),
  db: (LEFT.db + RIGHT.db) / 2,
};

/**
 * The loop, in seconds: joined, ticked apart, walking apart, apart, ticked
 * joined, walking back to the middle.
 */
const CYCLE = 9;
const APART_AT = 1.8;
const WALK = 1.6;
const JOIN_AT = 6;

interface IHalf {
  hz: number;
  db: number;
}

interface IPose {
  left: IHalf;
  right: IHalf;
  isApart: boolean;
}

/** The import's choices by the words the ears go by on screen. */
const IMPORT_NAMES: Record<TImportEars, TranslationKey> = {
  both: 'eq.channels.both',
  left: 'graph.curve.leftEar',
  right: 'graph.curve.rightEar',
};

const ease = (share: number) => 0.5 - Math.cos(Math.PI * share) / 2;

/** One half on its way, by a log scale in frequency, as the graph spaces it. */
const between = (from: IHalf, to: IHalf, share: number): IHalf => ({
  hz: from.hz * (to.hz / from.hz) ** share,
  db: from.db + (to.db - from.db) * share,
});

const APART: IPose = { left: LEFT, right: RIGHT, isApart: true };

const poseAt = (seconds: number): IPose => {
  const at = seconds % CYCLE;
  if (at < APART_AT) {
    return { left: JOINED, right: JOINED, isApart: false };
  }
  if (at < JOIN_AT) {
    const share = ease(Math.min(1, (at - APART_AT) / WALK));
    return {
      left: between(JOINED, LEFT, share),
      right: between(JOINED, RIGHT, share),
      isApart: true,
    };
  }
  const share = ease(Math.min(1, (at - JOIN_AT) / WALK));
  return {
    left: between(LEFT, JOINED, share),
    right: between(RIGHT, JOINED, share),
    isApart: false,
  };
};

const usePose = () => {
  const [pose, setPose] = useState<IPose>(() =>
    prefersReducedMotion() ? APART : poseAt(0),
  );
  useEffect(() => {
    if (prefersReducedMotion()) {
      return undefined;
    }
    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      setPose(poseAt((now - start) / 1000));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  return pose;
};

const withHalf = (half: IHalf): TMiniBand[] => [
  ...SHARED,
  { kind: 'bell', hz: half.hz, db: half.db, q: Q },
];

const at = (half: IHalf): CSSProperties =>
  ({
    '--x': `${(xOfHz(half.hz, PLOT) / PLOT.width) * 100}%`,
    '--y': `${(yOfDb(half.db, PLOT) / PLOT.height) * 100}%`,
  }) as CSSProperties;

export default function EarsVisual() {
  const { t, locale } = useTranslation();
  const pose = usePose();
  const left = withHalf(pose.left);
  const right = withHalf(pose.right);
  // A half still walking home is still its own band: the tags go with the
  // tick only once the two stand on one spot again.
  const isTwo =
    pose.isApart || Math.abs(pose.left.hz - pose.right.hz) > JOINED.hz * 0.01;
  const format = useMemo(() => {
    const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const oneDecimal = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return {
      // To the ten hertz the band menu's subject is written at.
      hz: (hz: number) => `${whole.format(Math.round(hz / 10) * 10)} Hz`,
      db: (db: number) => {
        // Rounded to the half decibel the editor steps by.
        const half = Math.round(db * 2) / 2;
        let sign = '';
        if (half > 0) {
          sign = '+';
        } else if (half < 0) {
          sign = '−';
        }
        return `${sign}${oneDecimal.format(Math.abs(half))} dB`;
      },
    };
  }, [locale]);
  const choices = [
    { key: 'eq.channels.both', isOn: !pose.isApart },
    { key: 'eq.channels.split', isOn: pose.isApart },
  ] as const;

  return (
    <div
      className="ears-visual"
      role="img"
      aria-label={t('tour.ears.imageAlt')}
    >
      <div className="ears-visual__stage">
        <div className="ears-visual__graph">
          <span className="ears-visual__plot">
            <svg
              viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              {[100, 1000, 10000].map((hz) => (
                <line
                  key={hz}
                  className="ears-visual__grid"
                  x1={xOfHz(hz, PLOT)}
                  x2={xOfHz(hz, PLOT)}
                  y1="0"
                  y2={PLOT.height}
                />
              ))}
              <line
                className="ears-visual__zero"
                x1="0"
                x2={PLOT.width}
                y1={PLOT.height / 2}
                y2={PLOT.height / 2}
              />
              <path className="ears-visual__area" d={curveArea(left, PLOT)} />
              <path
                className="ears-visual__line ears-visual__line--left"
                d={curvePath(left, PLOT)}
              />
              <path
                className="ears-visual__line ears-visual__line--right"
                d={curvePath(right, PLOT)}
              />
            </svg>
            <span className="ears-visual__axis" aria-hidden="true">
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
            {(isTwo ? (['left', 'right'] as const) : (['both'] as const)).map(
              (ear) => {
                const half = ear === 'right' ? pose.right : pose.left;
                return (
                  <span
                    key={ear}
                    className={`ears-visual__band ears-visual__band--${ear}${
                      half.db < 0 ? ' is-below' : ''
                    }`}
                    style={at(half)}
                  >
                    <span className="ears-visual__dot" />
                    {ear !== 'both' && (
                      <span className="ears-visual__tag">
                        {t(`eq.channels.letter.${ear}`)}
                      </span>
                    )}
                    <span className="ears-visual__label">
                      <span>{format.hz(half.hz)}</span>
                      <span>{format.db(half.db)}</span>
                    </span>
                  </span>
                );
              },
            )}
          </span>
          <span className="ears-visual__key">
            <span>
              <i className="ears-visual__swatch" />
              {t('graph.curve.leftEar')}
            </span>
            <span>
              <i className="ears-visual__swatch ears-visual__swatch--right" />
              {t('graph.curve.rightEar')}
            </span>
          </span>
        </div>

        <div className="ears-visual__menu">
          <span className="ears-visual__subject">
            {t('eq.menu.subject', {
              frequency: Math.round(JOINED.hz / 10) * 10,
            })}
          </span>
          <span className="ears-visual__item">
            <MenuIcon name="reset" className="ears-visual__icon" />
            {t('eq.menu.reset')}
          </span>
          <span className="ears-visual__item">
            <MenuIcon name="trash" className="ears-visual__icon" />
            {t('eq.delete')}
          </span>
          <span className="ears-visual__rule" />
          {choices.map((choice) => (
            <span
              key={choice.key}
              className={`ears-visual__item${choice.isOn ? ' is-on' : ''}`}
            >
              <MenuIcon
                name="check"
                className="ears-visual__icon ears-visual__tick"
              />
              {t(choice.key)}
            </span>
          ))}
        </div>
      </div>

      {/* Squiglink's row: the curve going into the left ear alone. */}
      <div className="ears-visual__import">
        <small>{t('eq.channels.importInto')}</small>
        <span className="ears-visual__ears">
          {IMPORT_EARS.map((ears) => (
            <span key={ears} className={ears === 'left' ? 'is-selected' : ''}>
              {t(IMPORT_NAMES[ears])}
            </span>
          ))}
        </span>
        <span className="ears-visual__apply">
          <MenuIcon name="import" className="ears-visual__icon" />
          {t('squigImport.apply')}
        </span>
      </div>
    </div>
  );
}
