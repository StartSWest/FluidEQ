/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type ReactNode, useEffect, useState } from 'react';
import { LiveAudioPicture } from '../../audio/LiveAudioContext';
import {
  createLiveFrameStore,
  type ILiveAudioFrame,
} from '../../audio/liveFrameStore';

/**
 * Made-up music for a figure whose parts move with the sound — the title
 * bar's meter — so the figure moves as the window does without the reader's
 * output ever being looped back for a picture (`LiveAudioPicture`).
 *
 * Shaped like music: a bass hump, a broad middle, a quiet top, a beat every
 * half second and a slow drift, on the graphs' own scale (-60..0 dB over
 * the plot's -20..+20, `liveGraphBand.ts`), as the help harness's stand-in
 * for the capture has it.
 */

const AXIS = Array.from(
  { length: 96 },
  (_, index) => 20 * (20000 / 20) ** (index / 95),
);

const shapeDb = (hz: number) => {
  const bass = 12 * Math.exp(-((Math.log10(hz / 60) / 0.5) ** 2));
  const middle = 5 * Math.exp(-((Math.log10(hz / 900) / 0.9) ** 2));
  const top = -14 * Math.min(1, Math.max(0, Math.log10(hz / 6000)));
  return -38 + bass + middle + top;
};

const frameAt = (now: number): ILiveAudioFrame => {
  const beat = (now % 500) / 500;
  const punch = 9 * (1 - beat) ** 3;
  const points = AXIS.map((hz, index) => {
    const drift = 3 * Math.sin(now / 900 + index / 7);
    const low =
      punch *
      (0.12 + 0.23 / (1 + (hz / 1200) ** 3) + 0.65 / (1 + (hz / 160) ** 3));
    const db = shapeDb(hz) + drift + low;
    return {
      x: hz,
      y: Math.max(-20, Math.min(20, ((db + 60) / 60) * 40 - 20)),
    };
  });
  const waveform = Array.from({ length: 256 }, (_, index) => {
    const phase = (index / 256) * Math.PI * 2;
    return (
      (0.55 * Math.sin(phase * 2 + now / 300) +
        0.25 * Math.sin(phase * 5 + now / 170) +
        0.12 * Math.sin(phase * 11 + now / 90)) *
      (0.6 + 0.4 * (1 - beat))
    );
  });
  const peaks = [
    0.35 + 0.12 * Math.sin(now / 640) + 0.1 * (1 - beat),
    0.33 + 0.12 * Math.sin(now / 590 + 1) + 0.1 * (1 - beat),
  ];
  return {
    points,
    graphPoints: points,
    waveform,
    isClipping: false,
    outputLevels: peaks.map((peak) => ({
      levelDb: 20 * Math.log10(peak),
      peakDb: 20 * Math.log10(peak) + 2,
      isClipping: false,
    })),
  };
};

/**
 * Its children hear the made-up music, one frame per painted frame, for as
 * long as they are drawn: the figure is taken down out of view
 * (`useNearView`), and its frames stop with it.
 */
export default function HelpMusic({ children }: { children: ReactNode }) {
  const [frames] = useState(() => createLiveFrameStore(frameAt(0)));
  useEffect(() => {
    let painted = 0;
    const next = (now: number) => {
      frames.publish(frameAt(now));
      painted = requestAnimationFrame(next);
    };
    painted = requestAnimationFrame(next);
    return () => cancelAnimationFrame(painted);
  }, [frames]);
  return <LiveAudioPicture frames={frames}>{children}</LiveAudioPicture>;
}
