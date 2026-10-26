/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import PlayerPicture, { type TPlayerPicture } from './PlayerPicture';
import TitlebarCorner from './TitlebarCorner';
import { PICTURE_WIDTH } from './playerPictureData';

/**
 * The Compact player's slide: the switch in the title bar that makes it,
 * ringed where it stands, and the one player it makes, twice — over a scene
 * on the Backdrop with the EQ's bands open, and with a standard visualizer
 * behind the song and the Tone knobs open — so both kinds of picture and
 * both faces of Sound are on the slide (Ivan, 2026-10-25: one amp for every
 * window colour).
 *
 * Each is the player drawn by its own parts (`PlayerPicture`), not a
 * photograph of it, so the slide shows the player as it is in whatever
 * colours and language the reader has, and changes when it changes.
 */

/**
 * The player at its own width, made as wide as the slot the slide gives it:
 * `zoom` lays it out at that size, so the slot is as tall as the player is.
 * Measured on the slot's own resizing, never on a clock.
 */
const PictureSlot = ({ picture }: { picture: TPlayerPicture }) => {
  const slotRef = useRef<HTMLSpanElement>(null);
  const [zoom, setZoom] = useState(0);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) {
      return undefined;
    }
    const fit = () => setZoom(slot.clientWidth / PICTURE_WIDTH);
    fit();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(fit);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);
  return (
    <span className="player-pair__frame" ref={slotRef}>
      <PlayerPicture picture={picture} zoom={zoom} />
    </span>
  );
};

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
      {/* The player itself, so nothing in it may be pressed, focused or
          read out: the description above says what it shows. */}
      <div className="player-pair__amps" inert aria-hidden="true">
        <span className="player-pair__amp">
          <PictureSlot picture="scene" />
          <span className="player-pair__caption">
            {t('tour.player.scene', { backdrop })}
          </span>
        </span>
        <span className="player-pair__amp">
          <PictureSlot picture="look" />
          <span className="player-pair__caption">
            {t('tour.player.standard')}
          </span>
        </span>
      </div>
    </div>
  );
}
