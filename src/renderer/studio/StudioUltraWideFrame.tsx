/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { ULTRA_WIDE_BAND } from './studioStageScreen';
import { toggleUltraWhole, useUltraWholeShown } from './studioUltraWhole';

const percent = (share: number) => `${share * 100}%`;

/**
 * THE ULTRA-WIDE GRAPH FRAMED ON ITS WINDOW (Ivan, 2026-11-12: "show the
 * ultra-wide in the middle, or maybe at the top. The main part more
 * visible, or outlined with a frame. But the scene must be seen complete").
 * Laid over a scene drawn on the whole ultra-wide window with the graph as
 * its panel (`ULTRA_WIDE_PANEL_VIEW`): the band where the graph really
 * stands, at full strength and outlined, everything round it under a light
 * veil, so a picture that stops short under the graph is seen stopping.
 *
 * WHOLE PICTURE. The veil was 58% black, and what fell outside the graph
 * could not be judged through it (Ivan, 2026-11-13: "there is not a good
 * way to see the overflow, we need to be able to see it better"). It is a
 * fifth now, and the switch under the band lifts it altogether, leaving the
 * outline alone. The switch is the frame's own, so every place the view is
 * drawn has it, and one press holds for all of them (`studioUltraWhole.ts`).
 *
 * Nothing else on it can be pressed or read out: the scene's own hands
 * under it hear every press but the switch's.
 */
export default function StudioUltraWideFrame({
  style,
}: {
  /** Where a closer look has moved and sized it, as it does the scene. */
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const whole = useUltraWholeShown();
  const bandFoot = ULTRA_WIDE_BAND.top + ULTRA_WIDE_BAND.height;
  return (
    <div
      className={`studio-ultra-frame${whole ? ' is-whole' : ''}`}
      style={style}
    >
      <div
        className="studio-ultra-frame__band"
        aria-hidden="true"
        style={{
          left: percent(ULTRA_WIDE_BAND.left),
          top: percent(ULTRA_WIDE_BAND.top),
          width: percent(ULTRA_WIDE_BAND.width),
          height: percent(ULTRA_WIDE_BAND.height),
        }}
      >
        <span className="studio-ultra-frame__tag">
          {t('studio.stage.ultraBand')}
        </span>
      </div>
      <div
        className="studio-ultra-frame__rest"
        style={{
          left: percent(ULTRA_WIDE_BAND.left),
          top: percent(bandFoot),
          maxWidth: percent(ULTRA_WIDE_BAND.width),
        }}
      >
        {!whole && (
          <span
            className="studio-ultra-frame__tag studio-ultra-frame__tag--rest"
            aria-hidden="true"
          >
            {t('studio.stage.ultraRest')}
          </span>
        )}
        <button
          type="button"
          className="studio-ultra-frame__tag studio-ultra-frame__whole"
          aria-pressed={whole}
          title={t('studio.stage.ultraWholeHint')}
          onClick={toggleUltraWhole}
        >
          {/* An eye: see all of it. */}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M1.5 8Q8 1.6 14.5 8Q8 14.4 1.5 8Z" />
            <circle cx="8" cy="8" r="2.1" />
          </svg>
          {t('studio.stage.ultraWhole')}
        </button>
      </div>
    </div>
  );
}
