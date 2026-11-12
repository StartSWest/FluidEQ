/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { ULTRA_WIDE_BAND } from './studioStageScreen';

const percent = (share: number) => `${share * 100}%`;

/**
 * THE ULTRA-WIDE GRAPH FRAMED ON ITS WINDOW (Ivan, 2026-11-12: "show the
 * ultra-wide in the middle, or maybe at the top. The main part more
 * visible, or outlined with a frame. But the scene must be seen complete").
 * Laid over a scene drawn on the whole ultra-wide window with the graph as
 * its panel (`ULTRA_WIDE_PANEL_VIEW`): the band where the graph really
 * stands, at full strength and outlined, everything round it veiled, so a
 * picture that stops short under the graph is seen stopping.
 *
 * Only a picture over the scene: nothing on it can be pressed or read out,
 * and the scene's own hands under it hear every press.
 */
export default function StudioUltraWideFrame({
  style,
}: {
  /** Where a closer look has moved and sized it, as it does the scene. */
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const bandFoot = ULTRA_WIDE_BAND.top + ULTRA_WIDE_BAND.height;
  return (
    <div className="studio-ultra-frame" inert aria-hidden="true" style={style}>
      <div
        className="studio-ultra-frame__band"
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
      <span
        className="studio-ultra-frame__tag studio-ultra-frame__tag--rest"
        style={{
          left: percent(ULTRA_WIDE_BAND.left),
          top: percent(bandFoot),
        }}
      >
        {t('studio.stage.ultraRest')}
      </span>
    </div>
  );
}
