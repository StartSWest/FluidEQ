/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  type MutableRefObject,
  type RefObject,
} from 'react';
import {
  useLiveAudioControl,
  useLiveAudioFrame,
} from './audio/LiveAudioContext';
import './styles/SupportPet.scss';

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
  return Math.min(1, peak * 1.6);
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
const HEARING_LEVEL = 0.03;
/**
 * Instant attack, slow release. Music has gaps — between tracks, between beats,
 * in a rest — and a bare threshold would strobe the class on and off through
 * every one of them, restarting the sway from its first keyframe each time.
 */
const HEARING_RELEASE_MS = 1200;

/**
 * Whether something is actually playing.
 *
 * `isActive` from the analyser means the capture stream is running, not that
 * there is any sound in it: it goes true when the stream opens and false only
 * on teardown. The squash rides `--pet-level` so it settles by itself in
 * silence, but the sway is a keyframe animation and does not — left on
 * `isActive` the pet leans back and forth in a silent room.
 */
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
 */
const useHearingGate = (
  isCapturing: boolean,
  onChange: (isHearing: boolean) => void,
) => {
  const releaseRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isHearingRef = useRef(false);

  const clearRelease = () => {
    if (releaseRef.current !== undefined) {
      clearTimeout(releaseRef.current);
      releaseRef.current = undefined;
    }
  };

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
    (level: number) => {
      if (!isCapturing) {
        clearRelease();
        setHearing(false);
        return;
      }
      if (level >= HEARING_LEVEL) {
        clearRelease();
        setHearing(true);
      } else if (isHearingRef.current && releaseRef.current === undefined) {
        releaseRef.current = setTimeout(() => {
          releaseRef.current = undefined;
          setHearing(false);
        }, HEARING_RELEASE_MS);
      }
    },
    [isCapturing, setHearing],
  );

  useEffect(() => {
    if (!isCapturing) {
      clearRelease();
      setHearing(false);
    }
  }, [isCapturing, setHearing]);

  useEffect(() => () => clearRelease(), []);

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
  levelRef,
  onHearingChange,
}: {
  target: RefObject<HTMLElement | null>;
  isCapturing: boolean;
  isPaused: boolean;
  levelRef: MutableRefObject<number>;
  onHearingChange: (isHearing: boolean) => void;
}) => {
  const { waveform } = useLiveAudioFrame();
  const publishedRef = useRef(-1);
  const feed = useHearingGate(isCapturing && !isPaused, onHearingChange);

  useEffect(() => {
    // Pausing freezes the analyser mid-frame, so the last waveform sits there
    // reading as music. Paused is zero, or the ears stay stretched on a frame
    // that stopped being true.
    const level = isPaused ? 0 : getPetLevel(waveform);
    levelRef.current = level;
    feed(level);

    const stepped = Math.round(level * LEVEL_STEPS) / LEVEL_STEPS;
    if (stepped === publishedRef.current || !target.current) {
      return;
    }
    publishedRef.current = stepped;
    target.current.style.setProperty('--pet-level', String(stepped));
  }, [feed, isPaused, levelRef, target, waveform]);

  return null;
};

/** Loud enough that it is clearly music rather than a notification blip. */
const DANCE_LEVEL = 0.32;
const DANCE_DURATION_MS = 7000;
/** Checked once a minute; roughly one dance every three or four minutes. */
const DANCE_CHECK_MS = 60000;
const DANCE_CHANCE = 0.3;

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
 * The level arrives by ref rather than as a prop, because this reads it once a
 * minute and taking it through render would put the pet back on the frame
 * clock — which is the one thing the pump above exists to prevent.
 */
const useOccasionalDance = (
  isUnlocked: boolean,
  isActive: boolean,
  levelRef: MutableRefObject<number>,
) => {
  const [isDancing, setIsDancing] = useState(false);

  useEffect(() => {
    if (!isUnlocked || !isActive) {
      setIsDancing(false);
      return undefined;
    }

    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const maybeDance = () => {
      if (levelRef.current < DANCE_LEVEL || Math.random() > DANCE_CHANCE) {
        return;
      }
      setIsDancing(true);
      stopTimer = setTimeout(() => setIsDancing(false), DANCE_DURATION_MS);
    };

    const timer = setInterval(maybeDance, DANCE_CHECK_MS);
    return () => {
      clearInterval(timer);
      if (stopTimer !== undefined) {
        clearTimeout(stopTimer);
      }
      setIsDancing(false);
    };
  }, [isActive, isUnlocked, levelRef]);

  return isDancing;
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
  const levelRef = useRef(0);
  const [isListening, setIsListening] = useState(false);
  const isDancing = useOccasionalDance(hasContributed, isListening, levelRef);

  const pump = (
    <PetLevelPump
      target={target}
      isCapturing={isActive}
      isPaused={isPaused}
      levelRef={levelRef}
      onHearingChange={setIsListening}
    />
  );

  return { pump, isListening, isDancing };
};

interface ISupportPetProps {
  hasContributed: boolean;
  onOpen: () => void;
}

/** One cycle of the waveform in the eye, in SVG user units. */
export const EYE_WAVE_PERIOD = 3.2;
/** Enough cycles to cover the pupil plus a full period of scroll either side. */
const EYE_WAVE_CYCLES = 8;
/**
 * Exported so the share card can draw the same wave rather than a lookalike.
 * The card paints her on a canvas, which cannot use the path below, so the
 * numbers are the only thing the two can share — and if they drift, the
 * creature in the picture stops being the creature on screen.
 */
export const EYE_WAVE_AMPLITUDE = 1.1;

/**
 * A small horizontal waveform to run behind a pupil.
 *
 * Built rather than hand-written so the period is exact: the scroll animation
 * translates by precisely one period and loops, and the join is only invisible
 * if every cycle is identical. A hand-drawn path drifts and the wave visibly
 * jumps once a second.
 */
export const buildEyeWave = (centreX: number, centreY: number) => {
  const start = centreX - (EYE_WAVE_CYCLES * EYE_WAVE_PERIOD) / 2;
  const quarter = EYE_WAVE_PERIOD / 4;
  let path = `M ${start} ${centreY}`;
  for (let cycle = 0; cycle < EYE_WAVE_CYCLES; cycle += 1) {
    const x = start + cycle * EYE_WAVE_PERIOD;
    path += ` Q ${x + quarter} ${centreY - EYE_WAVE_AMPLITUDE} ${x + quarter * 2} ${centreY}`;
    path += ` Q ${x + quarter * 3} ${centreY + EYE_WAVE_AMPLITUDE} ${x + quarter * 4} ${centreY}`;
  }
  return path;
};

/**
 * The creature itself. Shared by the titlebar button and the dialog's hero, so
 * the two can never drift apart.
 */
export function PetArt() {
  return (
    <svg
      className="support-pet__art"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="pet-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ef7e6" />
          <stop offset="1" stopColor="#17a5c4" />
        </linearGradient>
        {/* The pupils, as clips. The waveform inside each eye runs well past
            the iris so it can scroll without its ends ever coming into view. */}
        <clipPath id="pet-eye-left">
          <circle cx="15.4" cy="22" r="3.4" />
        </clipPath>
        <clipPath id="pet-eye-right">
          <circle cx="24.6" cy="22" r="3.4" />
        </clipPath>
      </defs>

      {/* Ears double as a little EQ curve - the creature is made of the thing
          the app does. Kept chunky so they survive at 40px. */}
      <g className="support-pet__ears">
        <path
          d="M11 12 L14 6 L17 12"
          fill="none"
          stroke="url(#pet-body)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M23 12 L26 8 L29 12"
          fill="none"
          stroke="url(#pet-body)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <g className="support-pet__body">
        <circle cx="20" cy="24" r="12.5" fill="url(#pet-body)" />

        {/* Eyes carry almost all of the personality, so they are large and
            maximum contrast. */}
        <g className="support-pet__eyes">
          <circle cx="15.4" cy="22" r="3.4" fill="#06131d" />
          <circle cx="24.6" cy="22" r="3.4" fill="#06131d" />

          {/* Sound reflected in the eye: a little waveform scrolling across
              each pupil, clipped to it so it reads as something seen IN the eye
              rather than drawn over it. Invisible at rest and brightening with
              the streak — see `--pet-joy`. Always in the markup rather than
              mounted on demand, so nothing re-renders mid-run to make it
              appear. */}
          <g className="support-pet__eye-waves">
            <g clipPath="url(#pet-eye-left)">
              <path d={buildEyeWave(15.4, 22)} />
            </g>
            <g clipPath="url(#pet-eye-right)">
              <path d={buildEyeWave(24.6, 22)} />
            </g>
          </g>

          <circle cx="16.4" cy="21" r="1.15" fill="#ffffff" />
          <circle cx="25.6" cy="21" r="1.15" fill="#ffffff" />
        </g>

        <path
          className="support-pet__mouth"
          d="M16.6 28.4 Q20 31.4 23.4 28.4"
          fill="none"
          stroke="#06131d"
          strokeWidth="1.8"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {/* Only ever drawn for a supporter. */}
      <path
        className="support-pet__star"
        d="M31.5 8.2 L32.7 11 L35.6 11.3 L33.4 13.2 L34.1 16 L31.5 14.5 L28.9 16 L29.6 13.2 L27.4 11.3 L30.3 11 Z"
        fill="#ffe66d"
      />
    </svg>
  );
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
    ? 'Thank you for supporting FluidEQ'
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
