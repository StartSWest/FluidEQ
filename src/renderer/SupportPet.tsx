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

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveAudio } from './audio/LiveAudioContext';
import './styles/SupportPet.scss';

/**
 * One scalar is all the animation needs, so the whole waveform is reduced
 * rather than rendered.
 */
const usePetLevel = (waveform: number[]) =>
  useMemo(() => {
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
  }, [waveform]);

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
 * Note this only ever *adds* behaviour. A user who never contributes still has
 * a pet that breathes, blinks and moves with the music; it is simply not
 * throwing a party.
 */
const useOccasionalDance = (
  isUnlocked: boolean,
  isActive: boolean,
  level: number,
) => {
  const [isDancing, setIsDancing] = useState(false);
  const levelRef = useRef(level);
  levelRef.current = level;

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
  }, [isActive, isUnlocked]);

  return isDancing;
};

interface ISupportPetProps {
  hasContributed: boolean;
  onOpen: () => void;
}

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
  const { waveform, isActive } = useLiveAudio();
  const level = usePetLevel(waveform);
  const isDancing = useOccasionalDance(hasContributed, isActive, level);

  return (
    <div
      className={`support-pet support-pet--hero${
        isActive ? ' is-listening' : ''
      }${isDancing ? ' is-dancing' : ''}${
        hasContributed ? ' is-celebrating' : ''
      }`}
      style={{ '--pet-level': level } as CSSProperties}
      aria-hidden="true"
    >
      <PetArt />
    </div>
  );
}

/**
 * The app's mascot, and the way in to the support dialog.
 *
 * It bobs along to whatever is playing and blinks and breathes when nothing
 * is. Contributing unlocks a star and the occasional dance.
 *
 * It is never sad and it never nags. Everything tied to contributing is
 * additive, so someone who ignores it forever still has a happy creature
 * moving to their music — they just do not get the party.
 */
export default function SupportPet({
  hasContributed,
  onOpen,
}: ISupportPetProps) {
  const { waveform, isActive } = useLiveAudio();
  const level = usePetLevel(waveform);
  const isDancing = useOccasionalDance(hasContributed, isActive, level);

  const title = hasContributed
    ? 'Thank you for supporting FluidEQ'
    : 'Support the work';

  return (
    <button
      type="button"
      className={`support-pet${isActive ? ' is-listening' : ''}${
        isDancing ? ' is-dancing' : ''
      }${hasContributed ? ' is-celebrating' : ''}`}
      style={{ '--pet-level': level } as CSSProperties}
      aria-label={title}
      title={title}
      onClick={onOpen}
    >
      <PetArt />
    </button>
  );
}
