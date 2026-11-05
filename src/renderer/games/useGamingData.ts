/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IYoursGamingProfile } from '../../common/gaming';
import { GAME_SOUND_PARTS, TGameSoundPart } from '../../common/gameSoundParts';
import { useDspSettings } from '../dsp/store';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { readGameTuned, readGamingProfiles } from '../utils/gamingApi';
import { reportError } from '../utils/logger';

const PROFILES_CHANGED = 'fluideq-gaming-profiles-changed';
const COPY_CHANGED = 'fluideq-game-copy-changed';

/**
 * A game's copy made again, or its profile changed under it: every "tuned"
 * is asked again. Main says nothing of its own when the copy it rewrote is
 * not the one playing.
 */
export const sayGameCopyChanged = (): void => {
  window.dispatchEvent(new Event(COPY_CHANGED));
};

/** Every list of the listener's Gaming profiles reads them again. */
export const sayGamingProfilesChanged = (): void => {
  window.dispatchEvent(new Event(PROFILES_CHANGED));
};

/** The listener's own Gaming profiles, as main keeps them. */
export const useYoursGamingProfiles = (): IYoursGamingProfile[] => {
  const [profiles, setProfiles] = useState<IYoursGamingProfile[]>([]);
  useEffect(() => {
    let live = true;
    const read = () => {
      readGamingProfiles()
        .then((next) => {
          if (live) {
            setProfiles(next);
          }
          return undefined;
        })
        .catch((error: unknown) => {
          reportError('Could not read the Gaming profiles', error);
        });
    };
    read();
    window.addEventListener(PROFILES_CHANGED, read);
    return () => {
      live = false;
      window.removeEventListener(PROFILES_CHANGED, read);
    };
  }, []);
  return profiles;
};

const isPart = (value: string): value is TGameSoundPart =>
  (GAME_SOUND_PARTS as readonly string[]).includes(value);

/**
 * The parts of a game's copy tuned away from its profile, as main measures
 * them against the copy as it was made (`gameSoundParts.ts`).
 *
 * Asked again whenever the sound on screen moves while that game's copy is
 * the one playing — a band, the Tone, the curve, any stage of the rack —
 * because every one of those edits is saved into the copy. One question in
 * flight at a time: a drag moves the sound every frame, and only the answer
 * for where it stopped matters, so a change that arrives while one is out
 * is asked once more when it returns.
 */
export const useGameTuned = (
  gameId: string | undefined,
  isLoaded: boolean,
): TGameSoundPart[] => {
  const [tuned, setTuned] = useState<TGameSoundPart[]>([]);
  const { filters, tone, headphone, eqImport, headset } = useFluidEqContext();
  const rack = useDspSettings();
  const asking = useRef(false);
  const again = useRef(false);
  const latestId = useRef(gameId);
  latestId.current = gameId;

  const ask = useCallback(() => {
    const id = latestId.current;
    if (!id) {
      setTuned([]);
      return;
    }
    if (asking.current) {
      again.current = true;
      return;
    }
    asking.current = true;
    readGameTuned(id)
      .then((parts) => {
        if (latestId.current === id) {
          setTuned(parts.filter(isPart));
        }
        return undefined;
      })
      .catch((error: unknown) => {
        reportError('Could not compare a game’s copy with its profile', error);
      })
      .finally(() => {
        asking.current = false;
        if (again.current) {
          again.current = false;
          ask();
        }
      });
  }, []);

  // A game picked, or another output's copy now the one shown.
  useEffect(() => {
    ask();
    window.addEventListener('fluideq-output-changed', ask);
    window.addEventListener(COPY_CHANGED, ask);
    return () => {
      window.removeEventListener('fluideq-output-changed', ask);
      window.removeEventListener(COPY_CHANGED, ask);
    };
  }, [ask, gameId]);

  // The sound moved while this game's copy plays: the copy moved with it.
  useEffect(() => {
    if (isLoaded) {
      ask();
    }
  }, [ask, isLoaded, filters, tone, headphone, eqImport, headset, rack]);

  return tuned;
};

const SOUNDING_TUNED = 'fluideq-sounding-game-tuned';

let isSoundingTuned = false;

/**
 * Keeps the answer to "has the game whose sound is on been tuned away from
 * its profile" where any surface can read it as one yes or no. Rendered once,
 * for the life of the window (`GameSound`), and alone: it re-renders with
 * every band moved, which the surfaces that show the answer — the presets
 * pick, memoised against exactly that — must not.
 */
export const SoundingTunedWatch = ({ gameId }: { gameId?: string }) => {
  const tuned = useGameTuned(gameId, gameId !== undefined);
  const isTuned = gameId !== undefined && tuned.length > 0;
  useEffect(() => {
    if (isSoundingTuned !== isTuned) {
      isSoundingTuned = isTuned;
      window.dispatchEvent(new Event(SOUNDING_TUNED));
    }
  }, [isTuned]);
  return null;
};

/** Whether the game whose sound is on has been tuned away from its profile. */
export const useSoundingIsTuned = (): boolean => {
  const [isTuned, setIsTuned] = useState(isSoundingTuned);
  useEffect(() => {
    const changed = () => setIsTuned(isSoundingTuned);
    window.addEventListener(SOUNDING_TUNED, changed);
    changed();
    return () => window.removeEventListener(SOUNDING_TUNED, changed);
  }, []);
  return isTuned;
};
