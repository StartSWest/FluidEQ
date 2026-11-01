/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import type { TAudioEngine } from '../common/audioEngine';
import type { IState } from '../common/constants';
import { pickDspPreset, rackAtEngineSwitch } from '../common/dsp/presetPick';
import type { IUserDspPreset } from '../common/dsp/userPresets';
import { ErrorCode } from '../common/errors';
import type { IKeptFile } from '../core/files/keptFile';
import type { IMainSession } from './mainSession';
import { playingRack, putRackOn } from './outputRack';
import { handleError, isErrorReply, type TReplySink } from './updatePath';

export interface IPresetPicksDeps {
  state: IState;
  session: IMainSession;
  /** The saved chains, as the core's copy holds them (`coreCopies.ts`). */
  savedChains: () => readonly IUserDspPreset[];
  /** Which preset's rack Equalizer APO holds off, '' for none. */
  rackHold: IKeptFile<string>;
  /** A switched-off layer comes back as it is changed (`profileStore.ts`). */
  applyingLayer: (layer: 'voicing') => void;
  /**
   * The update path: the state, the output's profile and the engine's files
   * written together, the answer on `sink`.
   */
  update: (sink: TReplySink, label: string) => Promise<void>;
  /** Serialises everything that changes which output, or which sound, is edited. */
  runProfileMutation: (work: () => Promise<void>) => Promise<void>;
  /** The output Windows plays put in the editor (`IProfilesIpc`). */
  openPlayingOutput: () => Promise<boolean>;
  /**
   * The edited output's rack, for an engine older than per-output files;
   * asked only while the edited output is the one Windows plays.
   */
  writeLegacyRack: () => Promise<void>;
  /** The window reads the edited output's sound again. */
  tellWindow: () => void;
}

/**
 * Presets put on by the core: every picker's pick, and the rack following a
 * switch of engine. The rules are `common/dsp/presetPick.ts`; this applies
 * them to the edited output and writes them down, the way every other edit
 * is — the profile, the engine's files, and the hold Equalizer APO put on a
 * rack, kept by the core so it outlives the window and a restart.
 *
 * No new edit generation. The output is the same one, and a new generation
 * is what tells the window's song memory its editor was replaced: it would
 * drop the song's sound it is due to hand back.
 */
export const createPresetPicks = ({
  state,
  session,
  savedChains,
  rackHold,
  applyingLayer,
  update,
  runProfileMutation,
  openPlayingOutput,
  writeLegacyRack,
  tellWindow,
}: IPresetPicksDeps) => {
  /**
   * Write what was put on; whether it landed. An engine older than the
   * per-output files plays one rack for every output, the playing one's, so
   * its file follows a pick on that output and on no other.
   */
  const land = async (sink: TReplySink, label: string): Promise<boolean> => {
    let landed = true;
    await update(
      {
        reply: (channel, ...args) => {
          if (isErrorReply(args[0])) {
            landed = false;
          }
          sink.reply(channel, ...args);
        },
      },
      label,
    );
    if (
      landed &&
      session.playbackAudioDevice?.id === session.activeAudioDeviceId
    ) {
      await writeLegacyRack().catch((error: unknown) =>
        log.error('Could not write the rack for the older engine', error),
      );
    }
    return landed;
  };

  /**
   * Put a preset on the output being edited, as a picker asks — refused
   * where another output is in the editor by the time it runs. Answers on
   * `sink`: the update path's own answer, or `false` where nothing resolves
   * the id — a saved chain deleted since — and nothing changed.
   */
  const pick = (
    { id, quick, deviceId }: { id: string; quick: boolean; deviceId: string },
    sink: TReplySink,
    label: string,
  ): Promise<void> =>
    runProfileMutation(async () => {
      if (deviceId !== session.activeAudioDeviceId) {
        handleError(sink, label, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const picked = pickDspPreset({
        id,
        rack: playingRack(state, session),
        voicing: state.voicing,
        saved: savedChains(),
        engine: session.audioEngine,
        quick,
      });
      if (!picked) {
        sink.reply(label, { result: false });
        return;
      }
      if (picked.voicing !== state.voicing) {
        applyingLayer('voicing');
        state.voicing = picked.voicing;
      }
      putRackOn(state, session, picked.rack);
      rackHold.keep(picked.heldForApo ?? '');
      await land(sink, label);
    });

  /**
   * The rack of the output Windows plays, after a switch of engine from
   * `from` to the engine now chosen (`rackAtEngineSwitch`). The editor goes
   * back to that output first, as it does for a game's sound: taken on a
   * second output left in "Edit sound", it held that output's rack off and
   * left the playing one's on an engine that has none.
   */
  const followEngineSwitch = (from: TAudioEngine | null): Promise<void> =>
    runProfileMutation(async () => {
      const engine = session.audioEngine;
      if (from === null || engine === null || from === engine) {
        return;
      }
      if (!(await openPlayingOutput())) {
        return;
      }
      const rack = playingRack(state, session);
      const after = rackAtEngineSwitch({
        engine,
        rack,
        voicing: state.voicing,
        held: rackHold.read() || undefined,
        saved: savedChains(),
      });
      rackHold.keep(after.heldForApo ?? '');
      if (after.rack === rack) {
        return;
      }
      putRackOn(state, session, after.rack);
      const sink: TReplySink = { reply: () => undefined };
      if (await land(sink, 'rackFollowsEngine')) {
        tellWindow();
      }
    });

  return { pick, followEngineSwitch };
};
