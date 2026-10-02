/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useTranslation } from '../../utils/I18nContext';
import type { ISlideActions } from './slides';

/** One computer of the pair: a screen with its sound on it, a headset on top,
 * because whichever of the two you sit at, you hear both. */
function LinkedComputer({ x, wave }: { x: number; wave: string }) {
  return (
    <g transform={`translate(${x} 58)`}>
      <rect
        className="tour-share__device"
        x="0"
        y="24"
        width="150"
        height="104"
        rx="10"
      />
      <rect
        className="tour-share__screen"
        x="13"
        y="37"
        width="124"
        height="62"
        rx="5"
      />
      <polyline
        className="tour-share__wave tour-share__wave--big"
        points={wave}
      />
      <rect
        className="tour-share__foot"
        x="51"
        y="108"
        width="48"
        height="6"
        rx="3"
      />
      <path className="tour-share__headset" d="M45 22 a30 30 0 0 1 60 0" />
      <rect
        className="tour-share__ear"
        x="37"
        y="16"
        width="14"
        height="20"
        rx="5"
      />
      <rect
        className="tour-share__ear"
        x="99"
        y="16"
        width="14"
        height="20"
        rx="5"
      />
    </g>
  );
}

/**
 * A drawn diagram rather than a capture of the tab: the real screen carries
 * a pairing code, which is a secret, and the names of whoever's machines were
 * on the network when the picture was taken. Two computers, one link, the
 * sound running both ways along it — each computer's own, never sent back.
 */
function ShareAudioDiagram() {
  const { t } = useTranslation();
  return (
    <svg
      className="tour-share__diagram"
      viewBox="0 0 620 300"
      role="img"
      aria-label={t('tour.share.title')}
    >
      <defs>
        <linearGradient id="tour-wire-out" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--accent-light)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="tour-wire-back" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--accent-light)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <LinkedComputer
        x={30}
        wave="22,68 32,52 42,82 52,58 62,78 72,50 82,84 92,60 102,76 112,56 122,72 128,66"
      />
      <LinkedComputer
        x={440}
        wave="22,66 32,58 42,76 52,48 62,84 72,60 82,74 92,52 102,80 112,62 122,70 128,64"
      />

      {/* Each computer's sound to the other, on a wire of its own: the
          upper one left to right, the lower one back. */}
      <path
        className="tour-share__trunk"
        d="M196 120 L428 120"
        stroke="url(#tour-wire-out)"
      />
      <path className="tour-share__flow" d="M196 120 L428 120" />
      <polygon className="tour-share__arrow" points="436,120 424,113 424,127" />
      <path
        className="tour-share__trunk"
        d="M424 160 L192 160"
        stroke="url(#tour-wire-back)"
      />
      <path
        className="tour-share__flow tour-share__flow--back"
        d="M424 160 L192 160"
      />
      <polygon className="tour-share__arrow" points="184,160 196,153 196,167" />

      <g transform="translate(298 123)">
        <rect
          className="tour-share__lock"
          x="0"
          y="10"
          width="24"
          height="18"
          rx="4"
        />
        <path
          className="tour-share__lock-arc"
          d="M5 10 V7 a7 7 0 0 1 14 0 V10"
        />
      </g>
      <text
        className="tour-share__wire-label"
        x="310"
        y="200"
        textAnchor="middle"
      >
        {t('tour.share.wireLabel')}
      </text>

      <text className="tour-share__caption" x="310" y="286" textAnchor="middle">
        <tspan className="tour-share__caption-label">
          {t('tour.share.pairLabel')}
        </tspan>
        <tspan>{' · '}</tspan>
        <tspan>{t('tour.share.pairName')}</tspan>
      </text>
    </svg>
  );
}

export default function ShareAudioSlide({
  actions,
}: {
  actions: ISlideActions;
}) {
  const { t } = useTranslation();
  const steps = [1, 2, 3] as const;
  const facts = [1, 2, 3] as const;

  return (
    <div className="tour-slide tour-slide--share">
      <div className="tour-slide__text">
        <span className="tour-slide__kicker">{t('tour.share.kicker')}</span>
        <h3 className="tour-slide__title">{t('tour.share.title')}</h3>
        <p className="tour-slide__lead">{t('tour.share.lead')}</p>

        <span className="tour-slide__how-title">
          {t('tour.share.stepsTitle')}
        </span>
        <ol className="tour-share__steps">
          {steps.map((step) => (
            <li key={step}>
              <span className="tour-share__step-number">{step}</span>
              <div>
                <strong>{t(`tour.share.step${step}Title`)}</strong>
                <p>{t(`tour.share.step${step}`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="button small"
          onClick={() => actions.openTab('share')}
        >
          {t('tour.share.open')}
        </button>
      </div>

      <div className="tour-share__aside">
        <ShareAudioDiagram />
        <ul className="tour-share__facts">
          {facts.map((fact) => (
            <li key={fact}>
              <strong>{t(`tour.share.fact${fact}Title`)}</strong>
              <span>{t(`tour.share.fact${fact}`)}</span>
            </li>
          ))}
        </ul>
        <p className="tour-share__tip">{t('tour.share.tip')}</p>
      </div>
    </div>
  );
}
