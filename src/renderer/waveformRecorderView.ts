/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The recorder as the title bar's meter drives it: what each drawn frame hands
 * it, where the samples come from, and the loudness figure beside the peak.
 *
 * Fed from the frame the drawing already reads (`liveFrameReader.ts`), whose
 * channel windows the reader filled once for this block of audio — nothing
 * here reads an analyser.
 *
 * Without that frame — another PC's audio, which arrives only as published
 * readings — each arrival stands for the time since the one before, at its
 * peak. With neither, time still passes: after a quarter of a
 * second with nothing arriving the strip runs on in silence until it is flat,
 * so a stopped capture never leaves the last music standing on screen.
 */
import type { ILiveFrame } from './graph/liveFrameReader';
import {
  type IRecorderBox,
  type IRecorderPalette,
  type IWaveRecorder,
  createWaveRecorder,
} from './waveformRecorder';
import { createSampleCursor } from './waveformSampleCursor';
import { createShortTermLoudness } from './waveformLoudness';

/** How long published readings may stop before the strip runs on silent. */
const STALE_MS = 250;

export interface IRecorderFrame {
  box: IRecorderBox;
  ratio: number;
  palette: IRecorderPalette;
  isPaused: boolean;
  /** The capture as it is at this frame, when the drawing can read it. */
  fresh: ILiveFrame | undefined;
  /** The newest published waveform and when it arrived (`performance.now`). */
  published: readonly number[];
  publishedAt: number;
  now: number;
}

export interface IRecorderView {
  /** One frame. Answers whether it is still moving. */
  draw(context: CanvasRenderingContext2D, frame: IRecorderFrame): boolean;
  /** The style was left: start from an empty strip next time. */
  clear(): void;
}

/** The loudest of a published waveform's bucket peaks. */
const peakOf = (waveform: readonly number[]): number =>
  waveform.reduce((loudest, value) => Math.max(loudest, Math.abs(value)), 0);

export const createRecorderView = (
  /** The loudness figure, called only when its tenth of a LU changes. */
  onLoudness: (lufs: number | undefined) => void,
): IRecorderView => {
  const recorder: IWaveRecorder = createWaveRecorder();
  const cursor = createSampleCursor();
  const loudness = createShortTermLoudness();
  let shownLoudness: number | undefined = Number.NaN;
  let lastArrival = Number.NaN;
  let filledUntil: number | undefined;

  const show = (lufs: number | undefined) => {
    const rounded = lufs === undefined ? undefined : Math.round(lufs * 10) / 10;
    if (rounded !== shownLoudness) {
      shownLoudness = rounded;
      onLoudness(rounded);
    }
  };

  const takeFresh = ({ channelSamples, sampleRate, audioMs }: ILiveFrame) => {
    if (!channelSamples || !sampleRate || channelSamples.length === 0) {
      return false;
    }
    filledUntil = undefined;
    const span = cursor.advance(audioMs, sampleRate, channelSamples[0].length);
    if (!span) {
      return true;
    }
    recorder.feed(channelSamples, span.from, span.to, span.unseen, sampleRate);
    if (
      loudness.feed(channelSamples, span.from, span.to, span.unseen, sampleRate)
    ) {
      show(loudness.read());
    }
    return true;
  };

  const takePublished = (frame: IRecorderFrame) => {
    cursor.reset();
    if (frame.publishedAt !== lastArrival) {
      lastArrival = frame.publishedAt;
      recorder.feedLevel(
        peakOf(frame.published),
        frame.now - (filledUntil ?? frame.now),
      );
      filledUntil = frame.now;
    } else if (frame.now - frame.publishedAt > STALE_MS) {
      recorder.feedLevel(0, frame.now - (filledUntil ?? frame.now));
      filledUntil = frame.now;
    }
    show(undefined);
  };

  return {
    draw: (context, frame) => {
      if (frame.isPaused) {
        // Frozen where it stood; the gap is not drawn when it comes back.
        cursor.reset();
        filledUntil = undefined;
      } else if (!frame.fresh || !takeFresh(frame.fresh)) {
        takePublished(frame);
      }
      return recorder.draw(context, frame);
    },
    clear: () => {
      recorder.clear();
      cursor.reset();
      loudness.reset();
      filledUntil = undefined;
      shownLoudness = Number.NaN;
    },
  };
};
