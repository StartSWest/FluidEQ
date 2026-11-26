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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useLiveAudioControl,
  useLiveAudioFrameListener,
  useLiveAudioFrames,
} from './audio/LiveAudioContext';
import type { ILiveAudioFrame } from './audio/liveFrameStore';
import { amplitudeToDb, type IOutputLevel } from './graph/outputLevel';
import PetCanvas, { TITLEBAR_PET_ART } from './pet/PetCanvas';
import usePetMusic from './pet/usePetMusic';
import { useTranslation } from './utils/I18nContext';
import './styles/SupportPet.scss';

/** A waveform peak of 0.625, about -4 dBFS, is the pet at full stretch. */
const PET_LEVEL_GAIN = 1.6;

/** The loudest sample, as a share of what she calls loud. */
const getPetLevel = (waveform: number[]) => {
  let peak = 0;
  for (let index = 0; index < waveform.length; index += 1) {
    if (waveform[index] > peak) {
      peak = waveform[index];
    }
  }
  return Math.min(1, peak * PET_LEVEL_GAIN);
};

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
 * really ended does in about three and a half seconds. The frame the capture
 * publishes when everything has come to rest, after which it publishes
 * nothing until sound returns, has every peak on the floor, so it always
 * answers yes. So does no frame at all — no channels, no capture.
 */
export const hasLetGo = (levels: readonly IOutputLevel[]) =>
  levels.every((level) => level.peakDb < HEARING_PEAK_DB);

/**
 * Whether she can hear anything: instant on, and off once the meters let go.
 *
 * It decides when she is listening, when she grows drowsy and, after a
 * while of it, when she falls asleep (`petChoreography.ts`). The release is
 * the meters' own held peak, never a timer: the frames say when the sound
 * has gone, and the last frame of a silence always says so.
 */
const PetHearing = ({
  isCapturing,
  onHearingChange,
}: {
  isCapturing: boolean;
  onHearingChange: (isHearing: boolean) => void;
}) => {
  const frames = useLiveAudioFrames();
  const isHearingRef = useRef(false);
  const setHearing = useCallback(
    (next: boolean) => {
      if (isHearingRef.current !== next) {
        isHearingRef.current = next;
        onHearingChange(next);
      }
    },
    [onHearingChange],
  );
  // Each frame handed straight here, never through a render: this renders
  // nothing, and only whether she hears escapes into React, a few times a
  // minute.
  const hear = useCallback(
    ({ waveform, outputLevels }: ILiveAudioFrame) => {
      if (!isCapturing) {
        setHearing(false);
      } else if (getPetLevel(waveform) >= HEARING_LEVEL) {
        setHearing(true);
      } else if (hasLetGo(outputLevels)) {
        setHearing(false);
      }
    },
    [isCapturing, setHearing],
  );
  useLiveAudioFrameListener(hear);
  useEffect(() => {
    hear(frames.read());
  }, [frames, hear]);
  return null;
};

/**
 * What both of her copies share: whether she hears anything, whether the
 * music is paused, and the music itself, read on her clock.
 */
const usePetAudio = () => {
  const { isActive, isPaused } = useLiveAudioControl();
  const [isListening, setIsListening] = useState(false);
  const readMusic = usePetMusic(isPaused);
  // Pausing freezes the analyser mid-frame, so the last waveform sits there
  // reading as music: paused is not hearing.
  const hearing = (
    <PetHearing
      isCapturing={isActive && !isPaused}
      onHearingChange={setIsListening}
    />
  );
  return { hearing, isListening, isPaused, readMusic };
};

/**
 * The same creature at hero size inside the support dialog. Decorative: the
 * dialog it lives in is already the interactive thing, and the face a tap
 * earned is the dialog's (`mood`).
 */
export function SupportPetHero({
  hasContributed,
  mood = '',
}: {
  hasContributed: boolean;
  mood?: '' | 'perfect' | 'miss';
}) {
  const { hearing, isListening, isPaused, readMusic } = usePetAudio();
  // No press: a tap here is a hop of a fixed length (`.support-pet-tap`),
  // never a squash held for as long as the mouse is down, or a tap could not
  // keep time.
  return (
    <div
      className={`support-pet support-pet--hero${isListening ? ' is-listening' : ''}`}
      aria-hidden="true"
    >
      {hearing}
      <PetCanvas
        art={126}
        readMusic={readMusic}
        isCelebrating={hasContributed}
        isListening={isListening}
        isPaused={isPaused}
        mood={mood}
      />
    </div>
  );
}

interface ISupportPetProps {
  hasContributed: boolean;
  onOpen: () => void;
}

/**
 * The app's mascot, and the way in to the support dialog.
 *
 * She breathes, blinks, looks around and falls asleep in silence for
 * everyone. Contributing unlocks the star and every response to the music.
 *
 * She is never sad and never nags. Everything tied to contributing is
 * additive — someone who ignores it forever still has a happy creature in
 * their titlebar, she simply does not hear what they are listening to.
 */
export default function SupportPet({
  hasContributed,
  onOpen,
}: ISupportPetProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { hearing, isListening, isPaused, readMusic } = usePetAudio();
  const { t } = useTranslation();
  const title = hasContributed
    ? t('support.pet.thanks')
    : t('support.pet.title');

  return (
    <button
      ref={ref}
      type="button"
      // Whether she hears anything, said on her button for anybody looking.
      className={`support-pet${isListening ? ' is-listening' : ''}`}
      aria-label={title}
      title={title}
      onClick={onOpen}
    >
      {hearing}
      <PetCanvas
        art={TITLEBAR_PET_ART}
        host={ref}
        readMusic={readMusic}
        isCelebrating={hasContributed}
        isListening={isListening}
        isPaused={isPaused}
      />
    </button>
  );
}
