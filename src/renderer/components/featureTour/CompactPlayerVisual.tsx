/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import TitlebarCorner from './TitlebarCorner';
import playerClassic from '../../../../assets/tour/player-classic.jpg';
import playerStage from '../../../../assets/tour/player-stage.jpg';

/**
 * The Compact player's slide: the switch in the title bar that makes it,
 * ringed where it stands, and the two players it makes side by side — the
 * classic amp every window-colour mode but the Backdrop gets, and the glass
 * one over the visualizer on the Backdrop.
 *
 * Photographs of the real players, not drawings (Ivan, 2026-09-28: "show a
 * nice legacy amp … show the 2 modes glassy and standard"): the amp's LED
 * clock, lamps and faders are what it is loved for, and a drawing small
 * enough for this slide had none of them. Taken at Brightness 50% from the
 * player harness with made-up albums (`scratchpad/tour-shots`), so one pair
 * reads on a dark window and a light one; retake them when the players
 * change.
 */

/**
 * The photographs' own sizes, so each holds its place before it loads: the
 * classic amp at its narrow width with Up next open, the glass one wider, as
 * each is used (Ivan, 2026-09-28: "the standard amp view is narrow and the
 * glass one wider").
 */
const CLASSIC = { width: 467, height: 1000 };
const STAGE = { width: 711, height: 1000 };

export default function CompactPlayerVisual() {
  const { t } = useTranslation();
  const backdrop = t('graph.sceneTint.short.cover');
  const player = t('player.switch.name');
  return (
    <div
      className="player-pair"
      role="img"
      aria-label={t('tour.player.imageAlt', { player, backdrop })}
    >
      <TitlebarCorner ringed="player" label={player} />
      <div className="player-pair__amps">
        <span className="player-pair__amp player-pair__amp--classic">
          <img
            src={playerClassic}
            alt=""
            width={CLASSIC.width}
            height={CLASSIC.height}
          />
          <span className="player-pair__caption">
            {t('tour.player.classic')}
          </span>
        </span>
        <span className="player-pair__amp player-pair__amp--glass">
          <img
            src={playerStage}
            alt=""
            width={STAGE.width}
            height={STAGE.height}
          />
          <span className="player-pair__caption">
            {t('tour.player.glass', { backdrop })}
          </span>
        </span>
      </div>
    </div>
  );
}
