/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspSettings } from '../../common/dsp/chain';
import { gameCurveForProfile } from '../../common/dsp/gameCurves';
import { pickGame } from '../../common/dsp/gameRoom';
import { roomPresetSettings } from '../../common/dsp/roomPresets';
import {
  gamingProfileRef,
  readyGamingChain,
  readyGamingRoom,
  TGameSeed,
} from '../../common/gaming';
import {
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../dsp/dspPresetCatalog';

/**
 * What main makes a game's copy from, for a Gaming profile.
 *
 * Worked out here because the chains and the Game filter's rules live in the
 * window: a ready-made profile is its kind's gaming chain (`readyGamingChain`)
 * with the Game filter set for that kind or title, and the Room as the filter
 * decides it for this listener (`pickGame`: off for a game with its own 3D
 * sound, the game's room only for somebody who said they wear headphones),
 * with the profile's own game curve as its Preset layer (`gameCurves.ts`) —
 * the curve Ivan chose for it, never the static tone of the chain's EQ, whose
 * dynamic bands, subsonic and mono stay in the rack. An old row's chain
 * keeps the chain's own curve, what picking it puts there. `rack` is
 * the rack as it stands, which keeps what is the listener's — the
 * crossfade, the surround switch, the head — as every chain pick does.
 */
const gameSeedFor = (
  profileId: string,
  rack: IDspSettings,
): TGameSeed | undefined => {
  const ref = gamingProfileRef(profileId);
  if (!ref) {
    return undefined;
  }
  if (ref.kind === 'yours') {
    return { kind: 'yours', id: ref.id };
  }
  if (ref.kind === 'chain') {
    const dsp = resolveDspPreset(ref.chainId, rack);
    return dsp
      ? { kind: 'rack', dsp, curve: resolveDspPresetCurve(ref.chainId) }
      : undefined;
  }
  // Whether this listener wears headphones is theirs: the word kept on the
  // filter, or their own Room switched on — the rule `pickGame` reads. The
  // gaming chains carry no Room, so on headphones the room a kind keeps is
  // handed in as the chain's (`readyGamingRoom`), with the listener's head;
  // on speakers the Room stays as they have it, off. `pickGame` then puts a
  // title in its own room, or holds the Room off for a game with its own 3D
  // sound, as it does on the Game filter.
  const onHeadphones = rack.footsteps.useRoom || rack.room.enabled;
  const chain = resolveDspPreset(readyGamingChain(ref.preset), rack);
  if (!chain) {
    return undefined;
  }
  const game = pickGame(
    {
      footsteps: { ...chain.footsteps, useRoom: onHeadphones },
      room: onHeadphones
        ? {
            ...roomPresetSettings(chain.room, readyGamingRoom(ref.preset)),
            enabled: true,
          }
        : chain.room,
    },
    ref.preset,
    true,
  );
  // The profile's own curve, never the chain's (Ivan, 2026-11-03: "instead
  // of inheriting the gaming curve from those root ones we draw our own"):
  // none at all for a title kept as it was mixed.
  return {
    kind: 'rack',
    dsp: { ...chain, footsteps: game.footsteps, room: game.room },
    gameCurve: gameCurveForProfile(ref.preset)?.voicingId,
  };
};

export default gameSeedFor;
