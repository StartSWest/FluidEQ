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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAxisCells,
  IAxisCell,
  readAbsoluteLevels,
} from '../utils/autoBalanceCapture';
import { announceOutputSignal, createSignalEdge } from '../audio/outputSignal';
import { useTranslation } from '../utils/I18nContext';
import { IChartPointData } from './ChartController';
import {
  CLIP_HOLD_MS,
  DEVICE_LOST_GRACE_MS,
  FFT_SIZE,
  LEVEL_FFT_SIZE,
  MAX_START_RETRIES,
  METER_CHANNELS,
  NO_LEVELS,
  NO_POINTS,
  NO_WAVEFORM,
  OUTPUT_SWITCH_SETTLE_MS,
  START_RETRY_MS,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
  captureSystemOutput,
  createFrameBuffers,
  createFrequencyAxis,
  detectClipping,
  getPeakLevel,
  writeChannelWaveformPoints,
  writeFrequencyPoints,
  SPECTRUM_SMOOTHING,
} from './liveSpectrumFrames';
import {
  connectDrawAnalyser,
  createLiveFrameReader,
  type ILiveFrame,
  type ILiveFrameReader,
} from './liveFrameReader';
import { connectSoundAnalysers, createLiveSound } from './liveSound';
import { createLiveGraphBand } from './liveGraphBand';
import {
  ILevelFollower,
  IOutputLevel,
  LEVEL_FLOOR_DB,
  advanceLevel,
  amplitudeToDb,
  createLevelFollower,
  readPeakAmplitude,
} from './outputLevel';

/**
 * The live capture, handed out so other features can tap it.
 *
 * `source` is already connected to the analyser; connecting it somewhere else
 * as well is what a mirror does. Anything branching off it must end at its own
 * `MediaStreamAudioDestinationNode` and never at `context.destination`, which
 * is the endpoint this capture is a loopback of.
 */
export interface ICaptureGraph {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
}

/**
 * What a capture owner is doing with the frames, which is what decides whether
 * hiding the window may take the stream away. See the claim refs in the hook.
 */
export type TCaptureClaim = 'display' | 'work';

const useLiveOutputSpectrum = () => {
  /**
   * The language, on a ref.
   *
   * Every message below is written from inside a callback that a running
   * capture holds — and `captureBalanceProfile`'s identity is in the Smart EQ
   * engine's effect dependencies, so if `t` went into these `useCallback` lists
   * a language change would rebuild the callback, restart the capture, and take
   * every region's accumulated evidence with it. A ref is current without being
   * a dependency of anything.
   */
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const [isActive, setIsActive] = useState(false);
  const [capture, setCapture] = useState<ICaptureGraph | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [points, setPoints] = useState<IChartPointData[]>([]);
  // The same frames across a graph's whole width (`liveGraphBand.ts`).
  const [graphPoints, setGraphPoints] = useState<IChartPointData[]>([]);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isClipping, setIsClipping] = useState(false);
  /**
   * The real output level, per channel, in real dBFS.
   *
   * Nothing to do with `points`, and deliberately so. The trace is referenced to
   * the record's own peak so that the volume knob cannot flatten it; this is
   * referenced to digital full scale, because a meter whose top follows the
   * programme cannot answer the only question a meter is asked. See
   * `LIVE_FULL_SCALE_DB` above and the head of `outputLevel.ts`.
   *
   * One entry per channel the capture actually carries — two ordinarily, one if
   * Windows hands over a mono endpoint. Never a copy of the left pretending to
   * be the right: a meter that invents a channel is worse than one that admits
   * it only has the one.
   */
  const [outputLevels, setOutputLevels] = useState<IOutputLevel[]>(NO_LEVELS);
  const isClippingRef = useRef(false);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const pumpRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // The device-lost timer and the listeners that arm it, on refs so that
  // `stop()` can reach them — see where they are installed for what happened
  // when they were locals of `start()`.
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const detachTrackRef = useRef<(() => void) | undefined>(undefined);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | undefined>(
    undefined,
  );
  // The meter's fan-out, held for the same reason the source is: it is the node
  // the two per-channel analysers hang off, and it is worth taking down on every
  // path rather than only on the one where the context is closed.
  const splitterNodeRef = useRef<ChannelSplitterNode | undefined>(undefined);
  // What a drawing reads at the moment it draws — see `liveFrameReader.ts`.
  const frameReaderRef = useRef<ILiveFrameReader | undefined>(undefined);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const retriesRef = useRef(0);
  const isStartingRef = useRef(false);
  const autoStartRef = useRef(true);
  const isPausedRef = useRef(false);
  /**
   * Who currently wants the capture, split by whether being on screen matters.
   *
   * This hook used to open a loopback the moment the provider mounted, which
   * is before anything has asked for a frame. A loopback is a capture stream
   * on the output endpoint, so opening one keeps that endpoint awake: a DAC or
   * a headset stays out of its low-power state and its analog noise floor is
   * audible in the room while every digital meter in the app still reads
   * silence. Nothing on screen was reading a single frame.
   *
   * `display` is a meter or a graph — it wants frames only while somebody can
   * see them, so minimising the window releases it and the device is allowed
   * to sleep. `work` is a job that outlives being looked at: a Smart EQ
   * balance run gathers evidence over minutes, and `stop()` aborts it, so
   * hiding the window mid-run would throw that evidence away.
   */
  const displayClaimsRef = useRef(0);
  const workClaimsRef = useRef(0);
  const scheduleStartRef = useRef<() => void>(() => undefined);
  // Mirrors `points` so the silence branch can avoid publishing a fresh empty
  // array 22 times a second for the whole of a long capture.
  const pointsRef = useRef<IChartPointData[]>(NO_POINTS);
  const isHiddenRef = useRef(
    typeof document !== 'undefined' && document.hidden,
  );

  const togglePaused = useCallback(() => {
    // Derived from the ref rather than the state updater: React may invoke an
    // updater more than once, which would flip the ref out of sync.
    const next = !isPausedRef.current;
    isPausedRef.current = next;
    setIsPaused(next);
  }, []);

  /**
   * The live frame as it is now, for a drawing to read inside its animation
   * frame. Undefined while paused or with no capture running, and the caller
   * then draws the frame it already holds — see `liveFrameReader.ts`.
   */
  const readFrame = useCallback(
    (): ILiveFrame | undefined =>
      isPausedRef.current ? undefined : frameReaderRef.current?.read(),
    [],
  );

  const stop = useCallback(() => {
    if (pumpRef.current !== undefined) {
      clearInterval(pumpRef.current);
      pumpRef.current = undefined;
    }
    // The device-lost watch, which outlives the track it was watching unless it
    // is taken down here.
    if (muteTimerRef.current !== undefined) {
      clearTimeout(muteTimerRef.current);
      muteTimerRef.current = undefined;
    }
    detachTrackRef.current?.();
    detachTrackRef.current = undefined;
    // Explicit, rather than left to `close()` to collect. Closing the context
    // does release the graph, but only on the path where closing happens — and
    // an analyser holding an FFT buffer is worth disconnecting on every path.
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = undefined;
    splitterNodeRef.current?.disconnect();
    splitterNodeRef.current = undefined;
    frameReaderRef.current = undefined;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = undefined;
    // Withdrawn before the context closes, so a mirror cannot be left holding
    // nodes from a context that is going away underneath it.
    setCapture(undefined);
    setIsActive(false);
    isPausedRef.current = false;
    setIsPaused(false);
    isClippingRef.current = false;
    setIsClipping(false);
    pointsRef.current = NO_POINTS;
    setPoints(NO_POINTS);
    setGraphPoints(NO_POINTS);
    setWaveform(NO_WAVEFORM);
    // Emptied rather than left at the floor. A meter pinned at silence says
    // "nothing is playing"; there being no capture at all is a different fact,
    // and the strip is taken off the graph to say it.
    setOutputLevels(NO_LEVELS);
  }, []);

  /**
   * Whether anything currently justifies holding the output endpoint open.
   *
   * Read on every path that could start or stop a capture, so that the answer
   * is derived in one place rather than each caller remembering the rule.
   */
  const isCaptureWanted = useCallback(
    () =>
      workClaimsRef.current > 0 ||
      (displayClaimsRef.current > 0 && !isHiddenRef.current),
    [],
  );

  /**
   * Take ownership of the capture until the returned function is called.
   *
   * Ownership is what decides whether a stream exists at all — see the claim
   * refs above for why the alternative kept a device awake for nobody. A
   * component that only reports the capture's status must NOT claim: reading
   * `isActive` to draw a badge, or `error` to offer a retry, is not a reason
   * to hold a stream open.
   */
  const claim = useCallback(
    (kind: TCaptureClaim = 'display') => {
      const claims = kind === 'work' ? workClaimsRef : displayClaimsRef;
      claims.current += 1;
      // A fresh owner is a fresh set of attempts, for the same reason a fresh
      // mount is: the failures spent before this one arrived say nothing about
      // whether the machine will allow it now.
      retriesRef.current = 0;
      scheduleStartRef.current();
      let isReleased = false;
      return () => {
        // Idempotent, because React may run an effect's cleanup more than the
        // caller expects and a double release would take the count negative —
        // at which point the last real owner could never bring it back to zero.
        if (isReleased) {
          return;
        }
        isReleased = true;
        claims.current -= 1;
        if (!isCaptureWanted()) {
          if (retryTimerRef.current !== undefined) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = undefined;
          }
          stop();
        }
      };
    },
    [isCaptureWanted, stop],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (
      !autoStartRef.current ||
      !isCaptureWanted() ||
      streamRef.current ||
      isStartingRef.current
    ) {
      return Boolean(streamRef.current);
    }

    isStartingRef.current = true;
    setError('');
    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    try {
      stream = await captureSystemOutput(tRef.current);
      // STOPPED, not disabled — and the difference is gigabytes.
      //
      // Windows only hands out loopback audio through `getDisplayMedia`, so a
      // video track arrives whether or not anything wants one. Setting
      // `enabled = false` mutes what the track delivers and does nothing at
      // all to the source behind it: Chromium carries on capturing the screen,
      // frame after full-resolution frame, for as long as the app is open.
      // Nothing reads them, and the memory climbs without limit.
      //
      // `stop()` releases the capture itself. The audio track is unaffected —
      // a stream stays live while any of its tracks is live — and the audio is
      // the only part that was ever wanted.
      stream.getVideoTracks().forEach((track) => {
        track.stop();
        stream?.removeTrack(track);
      });

      // Abandoned while the capture was being negotiated.
      //
      // The guard at the top of this function ran before the await above, and
      // `getDisplayMedia` is not quick — a permission decision, a Windows
      // Graphics Capture negotiation, seconds of it. If the hook was torn down
      // inside that window then `stop()` has already run, and it found both
      // refs still undefined and so cleared nothing at all.
      //
      // Carrying on from here would then install a live loopback stream, an
      // AudioContext, an analyser and a thirty-millisecond interval that
      // nothing holds a reference to and nothing will ever stop — publishing
      // frames into a dead hook for as long as the window is open. Once is a
      // leak; in development it is once per hot reload, which is how a renderer
      // reaches several gigabytes in an afternoon.
      // The same window covers the last owner leaving: minimising the window
      // during the negotiation releases the display claim, and carrying on
      // would install exactly the stream that release was asking to avoid.
      if (!autoStartRef.current || !isCaptureWanted()) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      const [audioTrack] = stream.getAudioTracks();
      if (!audioTrack) {
        throw new Error(tRef.current('eq.smart.error.noAudioTrack'));
      }

      audioContext = new AudioContext();
      const activeAudioContext = audioContext;
      // A suspended context stops its own clock, and every reader of it then
      // gets the same frame back for ever: the trace simply stops moving
      // while everything not fed by it carries on. Windows suspends one on
      // its own when an output changes underneath it, so the one resume at
      // startup is not enough - it is resumed again whenever it says it has
      // stopped, on the context's own event rather than by asking on a timer.
      activeAudioContext.addEventListener('statechange', () => {
        if (activeAudioContext.state === 'suspended') {
          activeAudioContext.resume().catch(() => undefined);
        }
      });
      await activeAudioContext.resume();
      // And again, for the same reason: `resume()` is a second await, and the
      // context it just started is a hardware stream nobody would ever close.
      if (!autoStartRef.current || !isCaptureWanted()) {
        stream.getTracks().forEach((track) => track.stop());
        activeAudioContext.close().catch(() => undefined);
        return false;
      }
      const analyser = activeAudioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.minDecibels = -100;
      analyser.maxDecibels = 0;
      // The analyser's own averaging, and the last place lag was hiding.
      //
      // This blends each FFT with the one before it, so at 0.62 a transient
      // reached only 38% of its real height on the frame it happened, 62% on
      // the next and 76% on the third — around 135ms to mostly arrive. That is
      // ahead of everything the display does, so no amount of attack further
      // down could recover it: the peak had already been averaged away before
      // anything drew it.
      //
      // At 0.4 the same transient is 60% there immediately and 94% by the
      // third frame. That was measured against a forty-five millisecond tick,
      // where three frames is 135ms of lag on its own — and it was the largest
      // single term in a delay somebody could hear as the bass arriving before
      // the graph did.
      //
      // 0.2 is 80% there immediately and 99% by the third, and the tick above
      // is shorter too, so the two compound the other way: the same steadying
      // costs about a fifth of the delay it used to. Still not zero, because a
      // raw FFT bin jitters frame to frame and a curve made of pure noise is
      // worse than a slow one.
      analyser.smoothingTimeConstant = SPECTRUM_SMOOTHING;
      // Kept, so it can be disconnected rather than left for `close()`.
      sourceNodeRef.current =
        activeAudioContext.createMediaStreamSource(stream);
      const source = sourceNodeRef.current;
      source.connect(analyser);

      /*
       * THE METER'S OWN ANALYSERS, AND WHY THE ONE ABOVE COULD NOT DO IT.
       *
       * An AnalyserNode reports one signal, not one per channel: whatever
       * arrives is folded down before the FFT, so the spectrum above already
       * describes left and right added together. That is right for a shape and
       * useless for a stereo meter — there is no way to ask it what the right
       * channel alone is doing, and a "right" meter driven from it would be the
       * left one with a different letter over it.
       *
       * A ChannelSplitterNode is how the channels are told apart. It fans the
       * source out into one output per channel, each carrying that channel and
       * nothing else, and an analyser on each gives two genuinely independent
       * readings. Hard-panned material moves one meter and not the other, which
       * is the test that says this is real.
       *
       * The source keeps its existing connection to the spectrum analyser as
       * well — a node may drive several destinations, and both see the same
       * samples.
       */
      const meterAnalysers: AnalyserNode[] = [];
      const createMeterAnalyser = () => {
        const meterAnalyser = activeAudioContext.createAnalyser();
        meterAnalyser.fftSize = LEVEL_FFT_SIZE;
        meterAnalyser.smoothingTimeConstant = 0;
        meterAnalysers.push(meterAnalyser);
        return meterAnalyser;
      };
      /*
       * How many channels there actually are, asked of the track rather than
       * assumed.
       *
       * A splitter always produces the number of outputs it was built with, so
       * splitting a mono endpoint into two would give a silent second output
       * and a right-hand meter that never moved — a fabricated channel, which is
       * the one outcome worth going out of the way to avoid. Windows loopback is
       * stereo on every ordinary endpoint; where it is not, one meter is drawn
       * and it says so.
       *
       * `channelCount` is optional in the settings dictionary, so an
       * implementation that does not report it is taken at the ordinary case
       * rather than demoted to mono.
       */
      /*
       * TWO OPINIONS ABOUT THE CHANNEL COUNT, AND ONLY ONE OF THEM IS EVIDENCE.
       *
       * `getSettings().channelCount` reports what the track was NEGOTIATED for,
       * and Chromium frequently answers with the constraint that was asked for
       * rather than with what the endpoint is delivering — so a perfectly
       * ordinary stereo loopback can describe itself as mono and get drawn as
       * one bar. Which is what happened.
       *
       * The source node's own `channelCount` is the graph's view of the same
       * stream and does not go through that negotiation, so it is the better
       * witness. Mono is believed only when BOTH say so; either one claiming
       * two is enough, and an implementation that reports nothing is taken at
       * the ordinary case.
       *
       * Guessing stereo wrongly costs a second bar that mirrors the first.
       * Guessing mono wrongly throws away half the meter on every machine
       * where the negotiation lies, which is the worse of the two by far.
       */
      const trackChannels = audioTrack.getSettings?.().channelCount;
      const nodeChannels = source.channelCount;
      const isStereoCapture =
        trackChannels === undefined ||
        trackChannels >= METER_CHANNELS ||
        (Number.isFinite(nodeChannels) && nodeChannels >= METER_CHANNELS);
      if (isStereoCapture) {
        const splitter =
          activeAudioContext.createChannelSplitter(METER_CHANNELS);
        splitterNodeRef.current = splitter;
        source.connect(splitter);
        for (let channel = 0; channel < METER_CHANNELS; channel += 1) {
          splitter.connect(createMeterAnalyser(), channel);
        }
      } else {
        source.connect(createMeterAnalyser());
      }

      streamRef.current = stream;
      audioContextRef.current = activeAudioContext;
      setIsActive(true);
      // Published so a mirror can branch off this same capture. Windows only
      // hands out loopback through `getDisplayMedia`, so a second consumer
      // opening its own would mean a second unwanted video track — which is
      // the leak documented above, twice over.
      setCapture({
        context: activeAudioContext,
        source: sourceNodeRef.current,
      });

      const frequencyData = new Float32Array(analyser.frequencyBinCount);
      const axis = createFrequencyAxis(activeAudioContext.sampleRate);
      const cells: IAxisCell[] = createAxisCells(
        axis,
        activeAudioContext.sampleRate,
        FFT_SIZE,
      );
      const levelBuffer = new Float64Array(axis.length);
      const buffers = createFrameBuffers();
      // The graphs' own points, taken from the drawing's reader below.
      const graphBuffers = createFrameBuffers();
      let bufferSlot = 0;
      // Shared with the drawing's reader, which may see a new peak first.
      const trackReference: { current: number | undefined } = {
        current: undefined,
      };
      const isSignalEdge = createSignalEdge();
      frameReaderRef.current = createLiveFrameReader({
        analyser: connectDrawAnalyser(activeAudioContext, source),
        channelAnalysers: meterAnalysers,
        axis,
        cells,
        graph: createLiveGraphBand(activeAudioContext, source, FFT_SIZE),
        trackReference,
        // The display pump skips hidden windows. Wallpaper reads still need a
        // reference that follows quieter music.
        releaseReference: () => isHiddenRef.current,
        sound: createLiveSound(
          connectSoundAnalysers(activeAudioContext, source),
        ),
      });

      // One block of samples, read into again per channel per tick, and the
      // ballistics that carry each channel's two readings between ticks.
      const meterSamples = meterAnalysers.map(
        () => new Float32Array(LEVEL_FFT_SIZE),
      );
      const meterFollowers: ILevelFollower[] = meterAnalysers.map(() =>
        createLevelFollower(),
      );
      // Kept per channel. The spectrum analyser combines the stereo signal,
      // which can cancel a rail in one side and can never say which side
      // clipped. The meter already owns discrete float samples, so those are
      // the only honest source for both the channel warning and the global OR.
      const meterClipUntilMs = meterAnalysers.map(() => 0);
      // Published in pairs for the same reason the points are: React needs a
      // changed identity to re-render, so the frame it is holding must not be
      // the one being overwritten. Two channels of two numbers is not much to
      // allocate, but it would be allocated thirty times a second forever.
      const meterFrames: [IOutputLevel[], IOutputLevel[]] = [
        meterAnalysers.map(() => ({
          levelDb: LEVEL_FLOOR_DB,
          peakDb: LEVEL_FLOOR_DB,
          isClipping: false,
        })),
        meterAnalysers.map(() => ({
          levelDb: LEVEL_FLOOR_DB,
          peakDb: LEVEL_FLOOR_DB,
          isClipping: false,
        })),
      ];
      // Wall clock rather than a frame count, because the fall rates are per
      // second and this interval runs late whenever the renderer is busy.
      let lastMeterMs = performance.now();

      const pump = () => {
        // Nothing to draw on: the entire frame is waste, down to the FFT the
        // analyser only computes when it is read. Smart EQ no longer measures
        // this stream — it hears the source (`rawSource.ts`) — so a hidden
        // window has nothing here to keep running.
        const isHidden = isHiddenRef.current;
        if (isHidden || isPausedRef.current) {
          return;
        }

        analyser.getFloatFrequencyData(frequencyData);
        readAbsoluteLevels(frequencyData, cells, levelBuffer);
        const peak = getPeakLevel(frequencyData);
        // Sound starting is the moment Windows is known to be playing through
        // this output — see `outputSignal.ts` for who needs to know.
        if (isSignalEdge(peak !== undefined)) {
          announceOutputSignal(activeAudioContext);
        }

        let reference: number | undefined;
        if (peak !== undefined) {
          // Instant attack, slow release: follows the track, ignores the
          // volume knob, and never lets a transient push the curve off-scale.
          // Kept running while hidden so the curve is already referenced
          // correctly the moment the window comes back.
          trackReference.current =
            trackReference.current === undefined
              ? peak
              : Math.max(
                  peak,
                  trackReference.current - TRACK_REFERENCE_RELEASE_DB,
                );
          reference = trackReference.current;
        }

        // Everything from here to the measurement is presentation. Behind a
        // hidden window it would publish frames nobody can see and re-render
        // every consumer to draw them.
        if (!isHidden) {
          // Alternate buffers: React needs a changed identity to re-render, so
          // the frame it is holding must not be the one being overwritten.
          bufferSlot = bufferSlot === 0 ? 1 : 0;
          if (reference === undefined) {
            if (pointsRef.current.length > 0) {
              pointsRef.current = NO_POINTS;
              setPoints(pointsRef.current);
              setGraphPoints(NO_POINTS);
            }
          } else {
            pointsRef.current = writeFrequencyPoints(
              buffers.points[bufferSlot],
              axis,
              levelBuffer,
              reference,
            );
            setPoints(pointsRef.current);
            // The drawing's own reading of this block, copied because the
            // reader reuses its frame. It used to be measured here a second
            // time, with a long window of its own: two 16384-point transforms
            // per block for one graph. The reader does its work once per
            // block of audio however many ask (`liveFrameReader.ts`), and the
            // picture the canvas falls back on between fresh reads is then
            // the one it drew.
            const drawn =
              frameReaderRef.current?.read().graphPoints ?? NO_POINTS;
            if (drawn.length === 0) {
              setGraphPoints(NO_POINTS);
            } else {
              const target = graphBuffers.points[bufferSlot];
              drawn.forEach(({ x, y }, index) => {
                target[index].x = x;
                target[index].y = y;
              });
              setGraphPoints(target);
            }
          }
          /*
           * The meter, in real decibels below full scale.
           *
           * Read here rather than beside the FFT above because it is
           * presentation and nothing else — no measurement consults it, so
           * behind a hidden window it is pure waste. The ballistics carry on
           * from wherever they were when the window went away; the attack is
           * instant, so the first visible frame is already correct and only the
           * fall has any catching up to do.
           *
           * Clamped, because a window that has been minimised for an hour hands
           * back an hour as its first delta and would drop the meter to the
           * floor in a single step for no reason anybody watching could name.
           */
          const meterNowMs = performance.now();
          const meterDeltaMs = Math.min(
            200,
            Math.max(0, meterNowMs - lastMeterMs),
          );
          lastMeterMs = meterNowMs;
          const meterFrame = meterFrames[bufferSlot];
          let anyChannelClipping = false;
          for (let channel = 0; channel < meterAnalysers.length; channel += 1) {
            const channelSamples = meterSamples[channel];
            meterAnalysers[channel].getFloatTimeDomainData(channelSamples);
            // A 45 ms clipped frame would disappear before the eye registers
            // it, but the hold must preserve the channel that actually railed.
            //
            // Railed samples, and nothing else. A peak at -1 dBFS used to
            // count as well, on the belief that Windows' loopback limits a
            // decibel under full scale; it called every loud record clipped
            // whether or not anything had touched it.
            const channelPeak = readPeakAmplitude(channelSamples);
            if (detectClipping(channelSamples)) {
              meterClipUntilMs[channel] = meterNowMs + CLIP_HOLD_MS;
            }
            const channelIsClipping = meterNowMs < meterClipUntilMs[channel];
            anyChannelClipping ||= channelIsClipping;
            const follower = advanceLevel(
              meterFollowers[channel],
              amplitudeToDb(channelPeak),
              meterDeltaMs,
            );
            meterFrame[channel].levelDb = follower.levelDb;
            meterFrame[channel].peakDb = follower.peakDb;
            meterFrame[channel].isClipping = channelIsClipping;
          }
          if (anyChannelClipping !== isClippingRef.current) {
            isClippingRef.current = anyChannelClipping;
            setIsClipping(anyChannelClipping);
          }
          setWaveform(
            writeChannelWaveformPoints(
              buffers.waveform[bufferSlot],
              meterSamples,
            ),
          );
          setOutputLevels(meterFrame);
        }
      };

      // An interval rather than requestAnimationFrame: rAF stops completely
      // while the window is minimised, and the pump has to notice the window
      // coming back on its own tick rather than waiting for a paint that a
      // covered window never gets.
      pumpRef.current = setInterval(pump, UPDATE_INTERVAL_MS);

      audioTrack.addEventListener(
        'ended',
        () => {
          stop();
          // Let the current capture promise finish before retrying. This
          // avoids the in-flight guard suppressing the restart.
          setTimeout(() => scheduleStartRef.current(), 0);
        },
        { once: true },
      );

      /**
       * The device went away without the track noticing.
       *
       * `ended` covers a track that stops. It does not cover the case that
       * actually happens here, which is Windows invalidating the endpoint
       * underneath a track that stays live — reinstalling Equalizer APO,
       * restarting the audio service, changing the default device. Chromium
       * reports `AUDCLNT_E_DEVICE_INVALIDATED`, quietly substitutes a *fake*
       * audio path, and carries on. The track is still there, still "live",
       * and delivering digital silence for ever.
       *
       * Which is why the trace simply stopped moving and nothing recovered it:
       * the one event being listened for was the one that never fired.
       *
       * `mute` is what does fire. It is also fired for ordinary gaps, so the
       * restart waits — a source that comes back on its own sends `unmute` and
       * cancels it, and only a mute that persists is treated as a device that
       * has gone.
       */
      // Held on a ref rather than in this closure, so `stop()` can reach it.
      //
      // It was a local, which meant nothing outside this call could clear it: a
      // restart cycle left the previous track's pending timer running, and when
      // it fired it called `stop()` on whatever stream had replaced it and
      // scheduled another restart. On a flapping endpoint that compounds — each
      // cycle leaving another timer behind to trigger the next — and what looks
      // like a device problem is the app restarting itself in a loop, opening
      // an AudioContext every time.
      muteTimerRef.current = undefined;
      const onMute = () => {
        if (muteTimerRef.current !== undefined) {
          return;
        }
        muteTimerRef.current = setTimeout(() => {
          muteTimerRef.current = undefined;
          // Still muted after the wait, so this is not a gap in the audio.
          if (audioTrack.muted && streamRef.current) {
            stop();
            setTimeout(() => scheduleStartRef.current(), 0);
          }
        }, DEVICE_LOST_GRACE_MS);
      };
      const onUnmute = () => {
        if (muteTimerRef.current !== undefined) {
          clearTimeout(muteTimerRef.current);
          muteTimerRef.current = undefined;
        }
      };
      audioTrack.addEventListener('mute', onMute);
      audioTrack.addEventListener('unmute', onUnmute);
      // Taken off the track when the capture ends. The `ended` listener below
      // uses `{ once: true }` and needs no such thing; these two fire many
      // times over a track's life, so they have to be removed by hand or every
      // restart leaves another pair attached to a track nobody is reading.
      detachTrackRef.current = () => {
        audioTrack.removeEventListener('mute', onMute);
        audioTrack.removeEventListener('unmute', onUnmute);
      };

      return true;
    } catch (captureError) {
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close().catch(() => undefined);
      stop();
      setError(
        captureError instanceof Error
          ? captureError.message
          : tRef.current('eq.smart.error.captureFailed'),
      );
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, [isCaptureWanted, stop]);

  const scheduleStart = useCallback(() => {
    if (
      !autoStartRef.current ||
      !isCaptureWanted() ||
      streamRef.current ||
      isStartingRef.current ||
      retryTimerRef.current !== undefined
    ) {
      return;
    }
    // JSDOM and non-Electron preview environments do not expose media capture.
    // Checked here rather than at the one call site it used to have, because a
    // claim can now arrive from any consumer and none of them should be able to
    // arm a retry loop that can never succeed.
    if (!navigator.mediaDevices) {
      return;
    }

    start().then((didStart) => {
      if (didStart) {
        retriesRef.current = 0;
        return didStart;
      }
      if (
        !autoStartRef.current ||
        !isCaptureWanted() ||
        retriesRef.current >= MAX_START_RETRIES
      ) {
        return didStart;
      }

      retriesRef.current += 1;
      retryTimerRef.current = setTimeout(
        () => {
          retryTimerRef.current = undefined;
          scheduleStartRef.current();
        },
        START_RETRY_MS * 2 ** (retriesRef.current - 1),
      );
      return didStart;
    });
  }, [isCaptureWanted, start]);

  /**
   * Assigned while rendering, not in an effect, because a claim beats it there.
   *
   * Effects run children first. Every consumer that claims the capture does so
   * from its own mount effect, which is below this hook's provider in the tree
   * and therefore runs before any effect here — so an assignment made in an
   * effect would still be the initial no-op when the first claim called it, and
   * the capture would silently never start.
   */
  scheduleStartRef.current = scheduleStart;

  useEffect(() => {
    // Minimising or fully occluding the window hides the document.
    //
    // The pump reads `isHiddenRef` to decide how much work a frame deserves.
    // The capture itself now reacts to the flip as well: a display claim is a
    // claim on being seen, so hiding the window releases the endpoint and lets
    // the device sleep, and restoring it opens a fresh one. A `work` claim — a
    // Smart EQ run — holds the stream through both.
    const trackVisibility = () => {
      isHiddenRef.current = document.hidden;
      if (isCaptureWanted()) {
        // A window coming back is somebody asking, exactly as a fresh mount is.
        retriesRef.current = 0;
        scheduleStartRef.current();
        return;
      }
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      }
      stop();
    };
    document.addEventListener('visibilitychange', trackVisibility);
    return () =>
      document.removeEventListener('visibilitychange', trackVisibility);
  }, [isCaptureWanted, stop]);

  /**
   * Follow the output, because the capture cannot notice that it moved.
   *
   * What is captured is a loopback of one Windows endpoint, fixed at the moment
   * the stream was granted. Switching output leaves that stream bound to the
   * old one — still live, still granted, and from now on delivering silence,
   * because nothing is being played through it any more.
   *
   * None of the existing recovery covers this. `ended` needs the track to stop
   * and it does not; `mute` needs Windows to invalidate the endpoint and it has
   * not, since the device is still perfectly valid. The result was a waveform
   * that simply stopped moving with nothing on screen to say why, and no way
   * back short of reopening the app.
   *
   * So the switch itself is the signal: tear the capture down and take a new
   * one, which arrives bound to whatever the output is now.
   */
  useEffect(() => {
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const rebind = () => {
      // Nothing running is nothing to move. A capture that was never started,
      // or that gave up, is not restarted by somebody changing device.
      if (!streamRef.current) {
        return;
      }
      stop();
      // A fresh endpoint deserves a fresh set of attempts: the count that was
      // spent failing against the previous device says nothing about this one.
      retriesRef.current = 0;
      if (settleTimer !== undefined) {
        clearTimeout(settleTimer);
      }
      settleTimer = setTimeout(
        () => scheduleStartRef.current(),
        OUTPUT_SWITCH_SETTLE_MS,
      );
    };
    window.addEventListener('fluideq-output-changed', rebind);
    return () => {
      window.removeEventListener('fluideq-output-changed', rebind);
      if (settleTimer !== undefined) {
        clearTimeout(settleTimer);
      }
    };
  }, [stop]);

  useEffect(() => {
    autoStartRef.current = true;
    // A fresh mount is a fresh set of attempts. The count is what stops a
    // hopeless capture grinding forever, not a verdict that the machine can
    // never do it — the graph being opened again is somebody asking.
    retriesRef.current = 0;
    /**
     * Mounting no longer starts anything. A claim does — but a claim made
     * before this line ran was refused, so the outstanding ones are honoured
     * here.
     *
     * That is not a corner case. Consumers claim from their own mount effects,
     * which run before this one, and in StrictMode React mounts, unmounts and
     * mounts again: the cleanup below clears `autoStartRef`, so on the second
     * pass every re-claim arrives while starting is still forbidden and the
     * capture would never open at all.
     */
    if (isCaptureWanted()) {
      scheduleStart();
    }

    return () => {
      autoStartRef.current = false;
      if (retryTimerRef.current !== undefined) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      }
      stop();
    };
  }, [isCaptureWanted, scheduleStart, stop]);

  // Split by publication rate, not by topic. `frame` is replaced ~22 times a
  // second; `control` only when the capture starts, stops, pauses or fails.
  // Handed out as one object they were indistinguishable to React, so a
  // consumer reading nothing but `isActive` still re-rendered at frame rate.
  const frame = useMemo(
    () => ({
      graphPoints,
      isClipping,
      outputLevels,
      points,
      waveform,
    }),
    [graphPoints, isClipping, outputLevels, points, waveform],
  );

  const control = useMemo(
    () => ({
      capture,
      claim,
      error,
      isActive,
      isPaused,
      readFrame,
      togglePaused,
      // So the notice about a failed capture can offer to try again rather
      // than only saying it went wrong. Windows refuses the loopback grab for
      // transient reasons — a device changing mid-start, a permission prompt
      // dismissed — and a second attempt very often works.
      //
      // Asking by hand also restores the automatic attempts. Those stop after
      // a few failures so a capture the machine will never allow does not
      // grind away in the background; a person pressing the button is saying
      // something has changed, and it is worth believing them.
      retry: () => {
        retriesRef.current = 0;
        return start();
      },
    }),
    [capture, claim, error, isActive, isPaused, readFrame, start, togglePaused],
  );

  return { control, frame };
};

export default useLiveOutputSpectrum;
