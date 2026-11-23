/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab's state: which microphones the engine's helper lists, which one
 * is shown, and each one's sound (`mic-sound.json` in main).
 *
 * A mic met for the first time starts from the Streaming profile, the one a
 * person who opens a Mic tab is most likely after; picking another is one
 * press. Its sound is created only when it is first edited or picked, so
 * merely looking at a mic writes nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IFluidEngineMicrophone } from '../../common/audioEngine';
import type { IDspSettings } from '../../common/dsp/chain';
import {
  isMicProfileId,
  micProfileSettings,
  TMicProfileId,
} from '../../common/mic/micProfiles';
import {
  clampMicSettings,
  EMPTY_MIC_SOUND,
  IMicLowCutParts,
  IMicSoundEntry,
  LOW_CUT_WHEN_ON,
  IMicSoundFile,
  TMicSoundResult,
} from '../../common/micSound';
import { reportError } from '../utils/logger';
import { getMicSound, selectMic, setMicSound } from '../utils/micSoundApi';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';

export const FIRST_MIC_PROFILE: TMicProfileId = 'stream';

export interface IMicSoundHook {
  microphones: readonly IFluidEngineMicrophone[];
  /** The mic shown, or undefined when the helper lists none. */
  mic: IFluidEngineMicrophone | undefined;
  /** Its sound: saved, or the first profile's when nothing is saved yet. */
  entry: IMicSoundEntry;
  /** What the last write came to, for the page's line. */
  lastResult: TMicSoundResult | undefined;
  select: (guid: string) => void;
  pickProfile: (id: TMicProfileId) => void;
  /** A control moving: written to the engine, not saved yet. */
  patch: (next: Partial<IDspSettings>) => void;
  /** A control let go: saved. */
  commit: () => void;
  /**
   * The Low cut card's switch: the low cut, "Close to the mic" and the pop
   * guard off together, and back on as they were. Saved at once.
   */
  switchLowCut: (on: boolean) => void;
}

const freshEntry = (name: string, id: TMicProfileId): IMicSoundEntry => ({
  name,
  profileId: id,
  tuned: false,
  settings: micProfileSettings(id),
});

/**
 * What switching the low cut on brings back when nothing was kept from a
 * switch-off (an entry saved before there was one): the profile's own parts,
 * or a plain 80 Hz cut.
 */
const lowCutPartsOf = (profileId: string): IMicLowCutParts => {
  const voice = isMicProfileId(profileId)
    ? micProfileSettings(profileId).voice
    : undefined;
  return voice && voice.lowCutHz > 0
    ? {
        lowCutHz: voice.lowCutHz,
        proximityDb: voice.proximityDb,
        deplosive: voice.deplosive,
      }
    : { lowCutHz: LOW_CUT_WHEN_ON, proximityDb: 0, deplosive: 0 };
};

const useMicSound = (): IMicSoundHook => {
  const status = useKnownAudioEngineStatus();
  /**
   * The last list the helper gave. A status read without one (the helper
   * skipped it, or answered late) is "not known", not "no mics" — main says
   * so where it parses it — and taken as none it unmounted the mic for one
   * status: the tab closed its recording and opened it again 0.2 s later,
   * which Windows answers by building the mic's effect again (engine.log
   * 2026-11-22 23:24:59).
   */
  const lastMicrophones = useRef<readonly IFluidEngineMicrophone[]>([]);
  const microphones = useMemo(() => {
    const listed = status?.fluid.microphones;
    if (listed !== undefined) {
      lastMicrophones.current = listed;
    }
    return lastMicrophones.current;
  }, [status]);
  const [file, setFile] = useState<IMicSoundFile>(EMPTY_MIC_SOUND);
  const [lastResult, setLastResult] = useState<TMicSoundResult>();
  /**
   * The file as of the last change, kept in step with every change rather
   * than copied from `file` at render. A switch patches and commits in one
   * handler, before any render: copied at render, the commit read the file
   * from before the patch, saved it, and its state update landed last — so
   * every switch on the Mic tab sprang back to where it was (2026-11-22).
   */
  const latest = useRef(file);
  const change = useCallback(
    (next: (current: IMicSoundFile) => IMicSoundFile) => {
      latest.current = next(latest.current);
      setFile(latest.current);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    getMicSound()
      .then((loaded) => {
        if (alive) {
          change(() => loaded);
        }
        return undefined;
      })
      .catch((error: unknown) => reportError('reading the mics’ sound', error));
    return () => {
      alive = false;
    };
  }, [change]);

  // With none picked yet, a mic the engine is already on before the first in
  // Windows' list, which is often a webcam's or a docking station's.
  const mic =
    microphones.find((entry) => entry.guid.toUpperCase() === file.selected) ??
    microphones.find((entry) => entry.attached) ??
    microphones[0];
  const guid = mic?.guid.toUpperCase();
  const entry = useMemo(() => {
    if (!guid || !mic) {
      return freshEntry('', FIRST_MIC_PROFILE);
    }
    return file.mics[guid] ?? freshEntry(mic.name, FIRST_MIC_PROFILE);
  }, [file, guid, mic]);

  const send = useCallback(
    (next: IMicSoundEntry, save: boolean) => {
      if (!guid) {
        return;
      }
      change((current) => ({
        ...current,
        mics: { ...current.mics, [guid]: next },
      }));
      setMicSound(guid, next, save)
        .then(setLastResult)
        .catch((error: unknown) =>
          reportError('writing a microphone’s sound', error),
        );
    },
    [change, guid],
  );

  const select = useCallback(
    (next: string) => {
      change((current) => ({ ...current, selected: next.toUpperCase() }));
      selectMic(next).catch((error: unknown) =>
        reportError('remembering the shown microphone', error),
      );
    },
    [change],
  );

  const pickProfile = useCallback(
    (id: TMicProfileId) => {
      if (!mic || !isMicProfileId(id)) {
        return;
      }
      send(freshEntry(mic.name, id), true);
    },
    [mic, send],
  );

  const patch = useCallback(
    (next: Partial<IDspSettings>) => {
      if (!mic) {
        return;
      }
      const current = latest.current.mics[guid ?? ''] ?? entry;
      send(
        {
          ...current,
          name: mic.name,
          tuned: true,
          settings: clampMicSettings({ ...current.settings, ...next }),
        },
        false,
      );
    },
    [entry, guid, mic, send],
  );

  const commit = useCallback(() => {
    if (!guid) {
      return;
    }
    const current = latest.current.mics[guid] ?? entry;
    send(current, true);
  }, [entry, guid, send]);

  const switchLowCut = useCallback(
    (on: boolean) => {
      if (!mic) {
        return;
      }
      const current = latest.current.mics[guid ?? ''] ?? entry;
      const { voice } = current.settings;
      if (!voice) {
        return;
      }
      const { lowCutKept, ...rest } = current;
      const parts: IMicLowCutParts = on
        ? (lowCutKept ?? lowCutPartsOf(current.profileId))
        : {
            lowCutHz: voice.lowCutHz > 0 ? voice.lowCutHz : LOW_CUT_WHEN_ON,
            proximityDb: voice.proximityDb,
            deplosive: voice.deplosive,
          };
      send(
        {
          ...rest,
          name: mic.name,
          tuned: true,
          settings: clampMicSettings({
            ...current.settings,
            voice: on
              ? { ...voice, enabled: true, ...parts }
              : { ...voice, lowCutHz: 0, proximityDb: 0, deplosive: 0 },
          }),
          ...(on ? {} : { lowCutKept: parts }),
        },
        true,
      );
    },
    [entry, guid, mic, send],
  );

  return {
    microphones,
    mic,
    entry,
    lastResult,
    select,
    pickProfile,
    patch,
    commit,
    switchLowCut,
  };
};

export default useMicSound;
