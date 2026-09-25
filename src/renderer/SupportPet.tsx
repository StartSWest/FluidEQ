/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { PRODUCT_NAME } from 'common/branding';
import {
  useLiveAudioControl,
  useLiveAudioFrame,
} from './audio/LiveAudioContext';
import { amplitudeToDb, type IOutputLevel } from './graph/outputLevel';
import { prefersReducedMotion } from './utils/bandReveal';
import { PetArt } from './PetArt';
import './styles/SupportPet.scss';

// The drawing has a file of its own; the EQ bubble and the share card have
// always found it here.
export { PetArt, EYE_WAVE_AMPLITUDE, EYE_WAVE_PERIOD } from './PetArt';

/** A waveform peak of 0.625, about -4 dBFS, is the pet at full stretch. */
const PET_LEVEL_GAIN = 1.6;

/**
 * One scalar is all the animation needs, so the whole waveform is reduced
 * rather than rendered.
 */
const getPetLevel = (waveform: number[]) => {
  if (waveform.length === 0) {
    return 0;
  }
  let peak = 0;
  for (let index = 0; index < waveform.length; index += 1) {
    if (waveform[index] > peak) {
      peak = waveform[index];
    }
  }
  return Math.min(1, peak * PET_LEVEL_GAIN);
};

/**
 * How many values `--pet-level` is allowed to take.
 *
 * Every write invalidates the style of the creature's whole subtree, and a
 * continuous value changes on literally every frame for differences nobody can
 * see. Twelve steps means a handful of writes a second instead of twenty-two,
 * and the squash is not visibly steppier for it.
 */
const LEVEL_STEPS = 12;

/**
 * Above the noise floor. Digital silence reads as 0 and a single least
 * significant bit of dither as 0.0125, so this sits clear of both while still
 * catching a quiet passage.
 */
export const HEARING_LEVEL = 0.03;
/** The same threshold as a peak on the meters, about -34.5 dBFS. */
const HEARING_PEAK_DB = amplitudeToDb(HEARING_LEVEL / PET_LEVEL_GAIN);

/**
 * Whether the meters have let go of the last sound she could hear: every
 * channel's held peak below her threshold.
 *
 * The held peak is the meters' slow reading — it holds a second and then falls
 * at 12 dB/s (`outputLevel.ts`) — so the rest of a bar, a breath, or the
 * second of silence between two tracks never gets there, and a song that has
 * really ended does in about three and a half seconds. A quiet source that
 * never reaches her threshold lets go the same way. The frame the capture
 * publishes when everything has come to rest (`isMeterAtRest`), after which it
 * publishes nothing until sound returns, has every peak on the floor, so it
 * always answers yes: the last frame she is sent is never one she is left
 * listening to. So does no frame at all — no channels, no capture.
 */
export const hasLetGo = (levels: readonly IOutputLevel[]) =>
  levels.every((level) => level.peakDb < HEARING_PEAK_DB);

/**
 * Whether something is actually playing.
 *
 * `isActive` from the analyser means the capture stream is running, not that
 * there is any sound in it: it goes true when the stream opens and false only
 * on teardown. The squash rides `--pet-level` so it settles by itself in
 * silence, but the sway is a keyframe animation and does not — left on
 * `isActive` the pet leans back and forth in a silent room.
 *
 * Instant attack, slow release. Music has gaps — between tracks, between beats,
 * in a rest — and a bare threshold would strobe the class on and off through
 * every one of them, restarting the sway from its first keyframe each time.
 *
 * The release used to be a 1.2 s timer started when the level dipped, which
 * guessed how long a gap lasts and was cancelled and restarted through every
 * one. It is the meters' own held peak now (`hasLetGo`): the frames say when
 * the sound has gone, and the last frame of a silence always says so.
 */
const useHearingGate = (
  isCapturing: boolean,
  onChange: (isHearing: boolean) => void,
) => {
  const isHearingRef = useRef(false);

  const setHearing = useCallback(
    (next: boolean) => {
      if (isHearingRef.current === next) {
        return;
      }
      isHearingRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const feed = useCallback(
    (level: number, levels: readonly IOutputLevel[]) => {
      if (!isCapturing) {
        setHearing(false);
      } else if (level >= HEARING_LEVEL) {
        setHearing(true);
      } else if (hasLetGo(levels)) {
        setHearing(false);
      }
    },
    [isCapturing, setHearing],
  );

  useEffect(() => {
    if (!isCapturing) {
      setHearing(false);
    }
  }, [isCapturing, setHearing]);

  return feed;
};

/**
 * The only thing in the creature that watches the audio, and it renders
 * nothing.
 *
 * That separation is the entire point. Subscribing to the frame from the pet
 * itself re-rendered her — and the whole of her SVG — around twenty-two times a
 * second for the life of the app, purely to set one custom property. She lives
 * in the titlebar, so it never stopped: not when the window was idle, not when
 * nothing was playing, not ever.
 *
 * Here the level is written straight to her element as a style, quantised so
 * most frames write nothing at all, and the only thing that escapes into React
 * is whether she can hear anything — which flips a few times a minute rather
 * than twenty-two times a second.
 */
const PetLevelPump = ({
  target,
  isCapturing,
  isPaused,
  onLevel,
  onHearingChange,
}: {
  target: RefObject<HTMLElement | null>;
  isCapturing: boolean;
  isPaused: boolean;
  onLevel: (level: number) => void;
  onHearingChange: (isHearing: boolean) => void;
}) => {
  const { waveform, outputLevels } = useLiveAudioFrame();
  const publishedRef = useRef(-1);
  const heardRef = useRef<number[] | undefined>(undefined);
  const feed = useHearingGate(isCapturing && !isPaused, onHearingChange);

  useEffect(() => {
    // Pausing freezes the analyser mid-frame, so the last waveform sits there
    // reading as music. Paused is zero, or the ears stay stretched on a frame
    // that stopped being true.
    const level = isPaused ? 0 : getPetLevel(waveform);
    feed(level, outputLevels);
    // Once per frame: the dance counts frames, and this runs again with the
    // same one whenever anything else it reads changes.
    if (heardRef.current !== waveform) {
      heardRef.current = waveform;
      onLevel(level);
    }

    const stepped = Math.round(level * LEVEL_STEPS) / LEVEL_STEPS;
    if (stepped === publishedRef.current || !target.current) {
      return;
    }
    publishedRef.current = stepped;
    target.current.style.setProperty('--pet-level', String(stepped));
  }, [feed, isPaused, onLevel, outputLevels, target, waveform]);

  return null;
};

/** Loud enough that it is clearly music rather than a notification blip. */
export const DANCE_LEVEL = 0.32;
/**
 * Frames heard at `DANCE_LEVEL` or above between one chance to dance and the
 * next: at the capture's thirty frames a second, a minute of loud music.
 */
export const DANCE_LOUD_FRAMES = 1800;
/** Roughly one dance every three or four minutes of it. */
const DANCE_CHANCE = 0.3;
/**
 * The dance's sway (`SupportPet.scss`), which runs a whole number of times
 * and stops: its end is the end of the dance.
 */
export const DANCE_ANIMATION = 'pet-dance';

/**
 * Occasionally the pet gets up and dances.
 *
 * Two gates. It only dances for a supporter — dancing is part of the reward,
 * alongside the star — and even then only sometimes: a creature that dances
 * non-stop in a titlebar the user stares at for hours stops being charming
 * within a minute. The delight is in catching it.
 *
 * A user who never contributes still has a pet that breathes and blinks; it
 * just does not hear the music.
 *
 * The music decides, not a clock. A minute's interval used to look at whatever
 * the level was at that instant, and ran through silence and a quiet film
 * alike; now every frame she hears loud counts, and every `DANCE_LOUD_FRAMES`
 * of them she considers it. Silence sends no frames and a quiet passage counts
 * none, so the minute is a minute of music she could dance to. The dance ends
 * with its own last sway (`animationend`) — it was stopped by a 7 s timer
 * that knew nothing of where the sway had got to — or as soon as it is taken
 * off the page (`animationcancel`: the titlebar hides her, motion is turned
 * down). Not at all for someone who asked for less motion, whose pet would
 * stand still through it and then never hear it end.
 *
 * The count lives in a ref and the level arrives by call, never through
 * render, because it changes every frame and the pet must not re-render on
 * the frame clock — which is the one thing the pump above exists to prevent.
 */
const useOccasionalDance = (
  target: RefObject<HTMLElement | null>,
  isUnlocked: boolean,
  isListening: boolean,
) => {
  const [isDancing, setIsDancing] = useState(false);
  const isDancingRef = useRef(false);
  const loudFramesRef = useRef(0);
  const canDance = isUnlocked && isListening;

  const setDancing = useCallback((next: boolean) => {
    isDancingRef.current = next;
    setIsDancing(next);
  }, []);

  const hear = useCallback(
    (level: number) => {
      if (!canDance || isDancingRef.current || level < DANCE_LEVEL) {
        return;
      }
      loudFramesRef.current += 1;
      if (loudFramesRef.current < DANCE_LOUD_FRAMES) {
        return;
      }
      loudFramesRef.current = 0;
      if (Math.random() <= DANCE_CHANCE && !prefersReducedMotion()) {
        setDancing(true);
      }
    },
    [canDance, setDancing],
  );

  useEffect(() => {
    if (!canDance) {
      setDancing(false);
    }
  }, [canDance, setDancing]);

  useEffect(() => {
    const element = target.current;
    if (!element) {
      return undefined;
    }
    const end = (event: AnimationEvent) => {
      if (event.animationName === DANCE_ANIMATION) {
        setDancing(false);
      }
    };
    element.addEventListener('animationend', end);
    element.addEventListener('animationcancel', end);
    return () => {
      element.removeEventListener('animationend', end);
      element.removeEventListener('animationcancel', end);
    };
  }, [setDancing, target]);

  return { isDancing, hear };
};

/**
 * Everything the two pets share: the pump, the hearing gate and the dance.
 *
 * Returns the pump as an element for the caller to render, because it has to
 * sit inside the component that owns the element it writes to.
 */
const usePetAudio = (
  target: RefObject<HTMLElement | null>,
  hasContributed: boolean,
) => {
  const { isActive, isPaused } = useLiveAudioControl();
  const [isListening, setIsListening] = useState(false);
  const { isDancing, hear } = useOccasionalDance(
    target,
    hasContributed,
    isListening,
  );

  const pump = (
    <PetLevelPump
      target={target}
      isCapturing={isActive}
      isPaused={isPaused}
      onLevel={hear}
      onHearingChange={setIsListening}
    />
  );

  return { pump, isListening, isDancing };
};

interface ISupportPetProps {
  hasContributed: boolean;
  onOpen: () => void;
}

/** The same creature at hero size inside the support dialog. Decorative: the
 * dialog it lives in is already the interactive thing. */
export function SupportPetHero({
  hasContributed,
}: {
  hasContributed: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { pump, isListening, isDancing } = usePetAudio(ref, hasContributed);

  return (
    <div
      ref={ref}
      className={`support-pet support-pet--hero${
        isListening ? ' is-listening' : ''
      }${isDancing ? ' is-dancing' : ''}${
        hasContributed ? ' is-celebrating' : ''
      }`}
      aria-hidden="true"
    >
      {pump}
      <PetArt />
    </div>
  );
}

/**
 * The app's mascot, and the way in to the support dialog.
 *
 * It breathes and blinks on its own. Contributing unlocks the star and every
 * response to the music: the squash, the sway, and the occasional dance.
 *
 * It is never sad and it never nags. Everything tied to contributing is
 * additive — someone who ignores it forever still has a happy creature in
 * their titlebar, it simply does not hear what they are listening to.
 */
export default function SupportPet({
  hasContributed,
  onOpen,
}: ISupportPetProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { pump, isListening, isDancing } = usePetAudio(ref, hasContributed);

  const title = hasContributed
    ? `Thank you for supporting ${PRODUCT_NAME}`
    : 'Support the work';

  return (
    <button
      ref={ref}
      type="button"
      className={`support-pet${isListening ? ' is-listening' : ''}${
        isDancing ? ' is-dancing' : ''
      }${hasContributed ? ' is-celebrating' : ''}`}
      aria-label={title}
      title={title}
      onClick={onOpen}
    >
      {pump}
      <PetArt />
    </button>
  );
}
