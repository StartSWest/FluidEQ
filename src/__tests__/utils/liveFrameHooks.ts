import { useEffect, useRef } from 'react';

/**
 * The frame hooks of `LiveAudioContext` for a suite that mocks it and
 * publishes by changing its frame and re-rendering.
 *
 * The real context publishes a store: a selector re-renders only when what
 * it selects changes, and a listener is handed every frame without a render.
 * Here a selector reads the frame of the render it is in, and a listener is
 * handed each new frame once that render commits, which is when the real one
 * would have heard it. Without these, a component that moved to the store
 * crashed every suite that still mocked `useLiveAudioFrame` alone.
 */
export const liveFrameHooks = <F>(readFrame: () => F) => ({
  useLiveAudioFrames: () => ({
    read: readFrame,
    subscribe: () => () => undefined,
  }),
  useLiveAudioFrameSelector: <S>(select: (frame: F) => S): S =>
    select(readFrame()),
  useLiveAudioFrameListener: (listener: (frame: F) => void) => {
    const latest = useRef(listener);
    latest.current = listener;
    const frame = readFrame();
    useEffect(() => {
      latest.current(frame);
    }, [frame]);
  },
});
