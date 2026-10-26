/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import TitlebarCorner from './TitlebarCorner';
import playerScene from '../../../../assets/tour/player-scene.jpg';
import playerLook from '../../../../assets/tour/player-look.jpg';

/**
 * The Compact player's slide: the switch in the title bar that makes it,
 * ringed where it stands, and the one player it makes, twice — over a scene
 * on the Backdrop with the EQ's bands open, and with a standard visualizer
 * behind the song and the Tone knobs open — so both kinds of picture and
 * both faces of Sound are on the slide (Ivan, 2026-10-25: one amp for every
 * window colour).
 *
 * Photographs of the real player, not drawings, as the slide has always
 * had: taken from the player harness at its own width with made-up songs
 * and covers (`?songs=demo`), never real music, on the window's middle
 * Brightness so they read on a dark tour and a light one. Retake both when
 * the player changes.
 */

/**
 * The photographs' own pixels (the player's 480 x 966 at 1.5x), so each
 * holds its place before it loads.
 */
const PHOTO = { width: 720, height: 1449 };

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
        <span className="player-pair__amp">
          <img
            src={playerScene}
            alt=""
            width={PHOTO.width}
            height={PHOTO.height}
          />
          <span className="player-pair__caption">
            {t('tour.player.scene', { backdrop })}
          </span>
        </span>
        <span className="player-pair__amp">
          <img
            src={playerLook}
            alt=""
            width={PHOTO.width}
            height={PHOTO.height}
          />
          <span className="player-pair__caption">
            {t('tour.player.standard')}
          </span>
        </span>
      </div>
    </div>
  );
}
