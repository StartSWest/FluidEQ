/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import sceneAurora from '../../../../assets/tour/scene-aurora.jpg';

/**
 * Pointer sparks: a Plus visualizer throwing what it is made of from the
 * mouse — a trail as the pointer crosses it, a burst where it clicks — and
 * the switch for them in Window colours, under Rainbow mode, ringed.
 *
 * The sparks are drawn in the scene's own light, four-pointed glints and
 * embers that thin out along the trail the way the layer lets them fade
 * (`common/scenePointer.ts`).
 */

/**
 * The pointer's path across the picture, on a box 120 wide and 100 tall —
 * the stage's own shape (`_tour-sparks.scss`), so nothing is cut off.
 */
const TRAIL = 'M 8 78 C 24 56, 40 48, 58 56 S 84 70, 94 50';

/** Sparks along the trail: where, how big, how bright, glint or ember. */
const SPARKS: { x: number; y: number; r: number; a: number; glint: boolean }[] =
  [
    { x: 12, y: 73, r: 0.8, a: 0.25, glint: false },
    { x: 19, y: 64, r: 1.1, a: 0.35, glint: false },
    { x: 26, y: 57, r: 1.7, a: 0.4, glint: true },
    { x: 34, y: 52, r: 1.2, a: 0.5, glint: false },
    { x: 42, y: 50, r: 2.2, a: 0.6, glint: true },
    { x: 50, y: 52, r: 1.4, a: 0.65, glint: false },
    { x: 58, y: 56, r: 2.6, a: 0.75, glint: true },
    { x: 66, y: 61, r: 1.6, a: 0.8, glint: false },
    { x: 74, y: 64, r: 3, a: 0.9, glint: true },
    { x: 82, y: 63, r: 1.8, a: 0.9, glint: false },
    { x: 89, y: 56, r: 3.3, a: 1, glint: true },
    { x: 23, y: 66, r: 0.7, a: 0.35, glint: false },
    { x: 46, y: 44, r: 0.8, a: 0.45, glint: false },
    { x: 70, y: 55, r: 0.9, a: 0.6, glint: false },
    { x: 80, y: 71, r: 1, a: 0.7, glint: false },
  ];

/** The burst where the pointer clicked: rays out from its centre. */
const BURST = { x: 34, y: 27 };
const RAYS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2 + 0.2;
  const reach = index % 2 === 0 ? 13 : 9;
  return {
    x1: BURST.x + Math.cos(angle) * 4,
    y1: BURST.y + Math.sin(angle) * 4,
    x2: BURST.x + Math.cos(angle) * reach,
    y2: BURST.y + Math.sin(angle) * reach,
  };
});

/** A four-pointed glint of radius `r` at `x`, `y`. */
const glint = (x: number, y: number, r: number) => {
  const w = r * 0.28;
  return `M ${x} ${y - r} Q ${x + w} ${y - w} ${x + r} ${y} Q ${x + w} ${
    y + w
  } ${x} ${y + r} Q ${x - w} ${y + w} ${x - r} ${y} Q ${x - w} ${
    y - w
  } ${x} ${y - r} Z`;
};

export default function SparksVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="sparks-visual"
      role="img"
      aria-label={t('tour.sparks.imageAlt', {
        sparks: t('graph.sceneTint.sparks'),
        windowColours: t('graph.sceneTint.label'),
      })}
    >
      <span className="sparks-visual__stage">
        <img src={sceneAurora} alt="" width={960} height={540} />
        <svg
          className="sparks-visual__art"
          viewBox="0 0 120 100"
          preserveAspectRatio="xMidYMid slice"
        >
          <path className="sparks-visual__trail" d={TRAIL} />
          {SPARKS.map((spark) =>
            spark.glint ? (
              <path
                key={`${spark.x}-${spark.y}`}
                className="sparks-visual__glint"
                d={glint(spark.x, spark.y, spark.r)}
                opacity={spark.a}
              />
            ) : (
              <circle
                key={`${spark.x}-${spark.y}`}
                className="sparks-visual__ember"
                cx={spark.x}
                cy={spark.y}
                r={spark.r}
                opacity={spark.a}
              />
            ),
          )}
          <circle
            className="sparks-visual__ring"
            cx={BURST.x}
            cy={BURST.y}
            r="7"
          />
          {RAYS.map((ray) => (
            <line
              key={`${ray.x2.toFixed(2)}-${ray.y2.toFixed(2)}`}
              className="sparks-visual__ray"
              x1={ray.x1}
              y1={ray.y1}
              x2={ray.x2}
              y2={ray.y2}
            />
          ))}
          <path
            className="sparks-visual__glint"
            d={glint(BURST.x, BURST.y, 3.4)}
          />
          {/* The pointer, where the trail ends. */}
          <path
            className="sparks-visual__pointer"
            d="M 93 47 L 93 61 L 96.6 57.6 L 99.2 63.4 L 101.4 62.4 L 98.8 56.8 L 103.6 56.6 Z"
          />
        </svg>
      </span>

      <span className="sparks-visual__menu">
        <span className="sparks-visual__menu-title">
          {t('graph.sceneTint.label')}
        </span>
        <span className="sparks-visual__row">
          <span className="sparks-visual__label">
            {t('graph.sceneTint.rainbow')}
          </span>
          <span className="sparks-visual__switch" />
        </span>
        <span className="sparks-visual__row is-ringed">
          <span className="sparks-visual__label">
            {t('graph.sceneTint.sparks')}
          </span>
          <span className="sparks-visual__switch" />
        </span>
      </span>
    </div>
  );
}
