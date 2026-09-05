/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useTranslation } from '../../utils/I18nContext';
import type { ISlideActions } from './slides';

/**
 * A drawn diagram rather than a capture of the tab: the real screen carries
 * a pairing code, which is a secret, and the names of whoever's machines were
 * on the network when the picture was taken. Three senders on the left, the
 * headset computer on the right, one encrypted wire between them.
 */
function ShareAudioDiagram() {
  const { t } = useTranslation();
  const senders = [30, 110, 190];
  return (
    <svg
      className="tour-share__diagram"
      viewBox="0 0 620 300"
      role="img"
      aria-label={t('tour.share.title')}
    >
      <defs>
        <linearGradient id="tour-wire" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--accent-light)" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Senders: three laptops, each with a small waveform on screen. */}
      {senders.map((y) => (
        <g key={y} transform={`translate(24 ${y})`}>
          <rect
            className="tour-share__device"
            x="0"
            y="0"
            width="118"
            height="60"
            rx="8"
          />
          <rect
            className="tour-share__screen"
            x="10"
            y="9"
            width="98"
            height="34"
            rx="4"
          />
          <polyline
            className="tour-share__wave"
            points="18,26 26,18 32,34 40,20 48,32 56,22 64,30 72,19 80,33 88,24 96,28"
          />
          <rect
            className="tour-share__foot"
            x="30"
            y="50"
            width="58"
            height="4"
            rx="2"
          />
          {/* The wire out of this sender into the shared trunk. */}
          <path
            className="tour-share__link"
            d={`M118 30 C 170 30, 170 ${110 - y + 30}, 222 ${110 - y + 30}`}
          />
        </g>
      ))}

      {/* The trunk: one line, one lock. */}
      <path
        className="tour-share__trunk"
        d="M246 140 L406 140"
        stroke="url(#tour-wire)"
      />
      <g transform="translate(307 124)">
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
        x="319"
        y="176"
        textAnchor="middle"
      >
        {t('tour.share.wireLabel')}
      </text>

      {/* The receiver: a desktop with a headset on top. */}
      <g transform="translate(410 70)">
        <rect
          className="tour-share__device"
          x="0"
          y="24"
          width="160"
          height="108"
          rx="10"
        />
        <rect
          className="tour-share__screen"
          x="14"
          y="38"
          width="132"
          height="64"
          rx="5"
        />
        <polyline
          className="tour-share__wave tour-share__wave--big"
          points="24,70 34,54 44,84 54,60 64,80 74,52 84,86 94,62 104,78 114,58 124,74 134,66"
        />
        <rect
          className="tour-share__foot"
          x="56"
          y="112"
          width="48"
          height="6"
          rx="3"
        />
        {/* Headset. */}
        <path className="tour-share__headset" d="M50 22 a30 30 0 0 1 60 0" />
        <rect
          className="tour-share__ear"
          x="42"
          y="16"
          width="14"
          height="20"
          rx="5"
        />
        <rect
          className="tour-share__ear"
          x="104"
          y="16"
          width="14"
          height="20"
          rx="5"
        />
      </g>

      <text className="tour-share__caption" x="24" y="288" textAnchor="start">
        <tspan className="tour-share__caption-label">
          {t('tour.share.senderLabel')}
        </tspan>
        <tspan>{' · '}</tspan>
        <tspan>{t('tour.share.senderName')}</tspan>
      </text>
      <text className="tour-share__caption" x="596" y="288" textAnchor="end">
        <tspan className="tour-share__caption-label">
          {t('tour.share.receiverLabel')}
        </tspan>
        <tspan>{' · '}</tspan>
        <tspan>{t('tour.share.receiverName')}</tspan>
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
