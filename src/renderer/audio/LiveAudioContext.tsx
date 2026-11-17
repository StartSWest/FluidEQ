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
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import useLiveOutputSpectrum, {
  TCaptureClaim,
} from '../graph/useLiveOutputSpectrum';
import { useFluidEqShell } from '../utils/FluidEqContext';
import useSenderSpectrum from '../remoteAudio/useSenderSpectrum';
import { SceneAudioProvider, type ISceneAudio } from './SceneAudioContext';
import type { ILiveFrame } from '../graph/liveFrameReader';
import {
  createVisibleFrameStore,
  type ILiveAudioFrame,
  type ILiveFrameStore,
} from './liveFrameStore';
import { useStoreListener, useStoreSelector } from '../utils/useStoreSelector';

type LiveAudioValue = ReturnType<typeof useLiveOutputSpectrum>;

/**
 * Two contexts, not one, because the analyser publishes at two completely
 * different rates.
 *
 * The frame context carries what the pump produces with every block of audio,
 * about thirty times a second - as a store, which never changes identity, so
 * the context itself never wakes anybody (`liveFrameStore.ts`). The control
 * context carries the capture's status and API, which change only when it
 * starts, stops, pauses or fails. Served from a single context, every
 * consumer re-rendered at frame rate regardless of which field it read — most
 * expensively MainContent, which reads two values that never change and
 * re-renders every band in the layout when it does.
 */
const LiveAudioFrameContext = createContext<ILiveFrameStore | undefined>(
  undefined,
);
const LiveAudioControlContext = createContext<
  | (LiveAudioValue['control'] & {
      setSharingAudio(active: boolean): void;
      readBackgroundFrame(): Promise<
        Pick<ILiveFrame, 'points' | 'waveform' | 'stereo'> | undefined
      >;
    })
  | undefined
>(undefined);

export const LiveAudioProvider = ({ children }: { children: ReactNode }) => {
  const { control, frame: localFrames } = useLiveOutputSpectrum();
  const [sharingAudio, setSharingAudio] = useState(false);
  const { frame: senderFrame, readFrame: readSenderFrame } = useSenderSpectrum(
    sharingAudio,
    control.isPaused,
  );
  const [frames] = useState(() => createVisibleFrameStore(localFrames));
  // Laid over the local frames before anything reads them in an effect.
  useLayoutEffect(() => frames.setSender(senderFrame), [frames, senderFrame]);
  // A remote sender's frame replaces the local capture's everywhere, so a
  // drawing reading the local analyser directly would show the wrong music.
  // Undefined sends it back to the visible frame, which is the sender's.
  const senderFrameRef = useRef(senderFrame);
  senderFrameRef.current = senderFrame;
  const { readFrame: readLocalFrame } = control;
  const readFrame = useCallback(
    () => (senderFrameRef.current ? undefined : readLocalFrame()),
    [readLocalFrame],
  );
  const readBackgroundFrame = useCallback(
    async () => (sharingAudio ? readSenderFrame() : readLocalFrame()),
    [sharingAudio, readSenderFrame, readLocalFrame],
  );
  const controls = useMemo(
    () => ({ ...control, readFrame, readBackgroundFrame, setSharingAudio }),
    [control, readFrame, readBackgroundFrame],
  );
  const { isEnabled } = useFluidEqShell();
  const wasEngineEnabledRef = useRef(isEnabled);

  useEffect(() => {
    const wasEngineEnabled = wasEngineEnabledRef.current;
    wasEngineEnabledRef.current = isEnabled;

    if (!wasEngineEnabled && isEnabled) {
      // Equalizer APO changing state can invalidate or mute Windows' loopback
      // stream. The analyser retries while that happens, but those attempts can
      // all be spent before the engine comes back. Re-enabling it is fresh
      // evidence that capture can work again, so restore the attempts and start
      // immediately. `retry` is harmless when the old stream survived: `start`
      // sees that stream and returns without opening a second capture.
      control.retry().catch(() => undefined);
    }
  }, [control, isEnabled]);

  return (
    <LiveAudioControlContext.Provider value={controls}>
      {/* `children` keeps its identity across the provider's own re-renders,
          so React skips the subtree and only context consumers wake up. */}
      <LiveAudioFrameContext.Provider value={frames}>
        <LiveSceneAudio
          frames={frames}
          isPaused={control.isPaused}
          readFrame={readFrame}
        >
          {children}
        </LiveSceneAudio>
      </LiveAudioFrameContext.Provider>
    </LiveAudioControlContext.Provider>
  );
};

/**
 * The scenes' view of the frames, the one part of the provider a frame
 * re-renders: `children` keeps its identity, so only the scenes reading it
 * wake, as they always did.
 */
const LiveSceneAudio = ({
  frames,
  isPaused,
  readFrame,
  children,
}: {
  frames: ILiveFrameStore;
  isPaused: boolean;
  readFrame: ISceneAudio['readFrame'];
  children: ReactNode;
}) => {
  const points = useSyncExternalStore(
    frames.subscribe,
    () => frames.read().points,
  );
  const waveform = useSyncExternalStore(
    frames.subscribe,
    () => frames.read().waveform,
  );
  const sceneAudio = useMemo(
    () => ({ points, waveform, isPaused, readFrame }),
    [points, waveform, isPaused, readFrame],
  );
  return <SceneAudioProvider value={sceneAudio}>{children}</SceneAudioProvider>;
};

/** The frames as a store: for a drawing that subscribes rather than renders. */
export const useLiveAudioFrames = (): ILiveFrameStore => {
  const value = useContext(LiveAudioFrameContext);
  if (!value) {
    throw new Error('useLiveAudioFrames must be used inside LiveAudioProvider');
  }
  return value;
};

/**
 * Per-frame analyser output. Re-renders the caller with every block of
 * audio, about thirty times a second: a component that prints a reading
 * wants `useLiveAudioFrameSelector`, and one that draws it
 * `useLiveAudioFrameListener`.
 */
export const useLiveAudioFrame = (): ILiveAudioFrame => {
  const frames = useLiveAudioFrames();
  return useSyncExternalStore(frames.subscribe, frames.read);
};

/** What the caller makes of the frame, re-rendering only when that changes. */
export const useLiveAudioFrameSelector = <S,>(
  select: (frame: ILiveAudioFrame) => S,
  isEqual?: (previous: S, next: S) => boolean,
): S => useStoreSelector(useLiveAudioFrames(), select, isEqual);

/** Every frame handed to `listener` as it arrives, rendering nothing. */
export const useLiveAudioFrameListener = (
  listener: (frame: ILiveAudioFrame) => void,
) => useStoreListener(useLiveAudioFrames(), listener);

/** Capture status and controls. Re-renders the caller only when they change. */
export const useLiveAudioControl = () => {
  const value = useContext(LiveAudioControlContext);
  if (!value) {
    throw new Error(
      'useLiveAudioControl must be used inside LiveAudioProvider',
    );
  }
  return value;
};

/**
 * Hold the system capture open for as long as this component wants frames.
 *
 * The capture is a loopback of the output endpoint, so opening one keeps that
 * endpoint awake — a DAC or a headset stays out of its low-power state and its
 * noise floor is audible while every meter still reads silence. It therefore
 * belongs to whatever actually reads it, and it exists only while at least one
 * such owner does.
 *
 * `isWanted` is the owner's own condition, not a mode: a graph that is closed,
 * a meter on a hidden tab or a job that is not running wants nothing, and
 * passing `false` is how it says so without unmounting.
 *
 * `kind` decides what minimising the window does. The default, `display`, is
 * for anything drawn — hiding the window releases the endpoint, because nobody
 * can see the frames. `work` is for a job that must survive being hidden: a
 * Smart EQ balance run gathers evidence over minutes and stopping the capture
 * aborts it.
 *
 * Components that only report the capture's status must not call this. Reading
 * `isActive` to draw a badge, or `error` to offer a retry, is not a reason to
 * hold a device open.
 */
export const useLiveAudioCapture = (
  isWanted = true,
  kind: TCaptureClaim = 'display',
) => {
  const { claim } = useLiveAudioControl();
  useEffect(() => {
    if (!isWanted) {
      return undefined;
    }
    return claim(kind);
  }, [claim, isWanted, kind]);
};
