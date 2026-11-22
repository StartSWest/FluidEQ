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
  IMicSoundEntry,
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
}

const freshEntry = (name: string, id: TMicProfileId): IMicSoundEntry => ({
  name,
  profileId: id,
  tuned: false,
  settings: micProfileSettings(id),
});

const useMicSound = (): IMicSoundHook => {
  const status = useKnownAudioEngineStatus();
  const microphones = useMemo(() => status?.fluid.microphones ?? [], [status]);
  const [file, setFile] = useState<IMicSoundFile>(EMPTY_MIC_SOUND);
  const [lastResult, setLastResult] = useState<TMicSoundResult>();
  const latest = useRef(file);
  latest.current = file;

  useEffect(() => {
    let alive = true;
    getMicSound()
      .then((loaded) => {
        if (alive) {
          setFile(loaded);
        }
        return undefined;
      })
      .catch((error: unknown) => reportError('reading the mics’ sound', error));
    return () => {
      alive = false;
    };
  }, []);

  const mic =
    microphones.find((entry) => entry.guid.toUpperCase() === file.selected) ??
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
      setFile((current) => ({
        ...current,
        mics: { ...current.mics, [guid]: next },
      }));
      setMicSound(guid, next, save)
        .then(setLastResult)
        .catch((error: unknown) =>
          reportError('writing a microphone’s sound', error),
        );
    },
    [guid],
  );

  const select = useCallback((next: string) => {
    setFile((current) => ({ ...current, selected: next.toUpperCase() }));
    selectMic(next).catch((error: unknown) =>
      reportError('remembering the shown microphone', error),
    );
  }, []);

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

  return {
    microphones,
    mic,
    entry,
    lastResult,
    select,
    pickProfile,
    patch,
    commit,
  };
};

export default useMicSound;
