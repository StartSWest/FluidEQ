import { renderHook } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import type { ILibraryQueue } from 'common/library/queue';
import useTrackEnd from 'renderer/library/player/useTrackEnd';

type TOptions = Parameters<typeof useTrackEnd>[0];

const queue: ILibraryQueue = {
  trackIds: ['song'],
  order: [0],
  position: 0,
  repeat: 'one',
  isShuffled: false,
};

/** The player at the end of its one song, on the host or on the element. */
const setUp = (hostOwns: boolean) => {
  const play = jest.fn(() => Promise.resolve());
  const element = { currentTime: 180, play } as unknown as HTMLAudioElement;
  const seekHost = jest.fn();
  const endedTrackRef: TOptions['endedTrackRef'] = { current: undefined };
  const options = (hostEnded: boolean): TOptions => ({
    queueRef: { current: queue },
    setQueue: jest.fn(),
    setIsPlaying: jest.fn(),
    setRetainWhenHidden: jest.fn(),
    trackIdRef: { current: 'song' },
    audioElementRef: { current: element },
    endedTrackRef,
    naturalCrossfadeTrackRef: { current: undefined },
    programmeEdgesRef: { current: new Map() },
    hostOwnsTransportRef: { current: hostOwns },
    seekHost,
    hostEnded,
    dspSettings: DSP_DEFAULTS,
    publishedPositionMs: 180_000,
    publishedDurationMs: 180_000,
  });
  const hook = renderHook(
    (props: { hostEnded: boolean }) => useTrackEnd(options(props.hostEnded)),
    { initialProps: { hostEnded: false } },
  );
  return { element, play, seekHost, endedTrackRef, hook };
};

describe('repeat one at the end of the song', () => {
  it('restarts the deck the host is playing, not the muted element', () => {
    const { play, seekHost, endedTrackRef, hook } = setUp(true);
    hook.rerender({ hostEnded: true });
    expect(seekHost).toHaveBeenCalledWith(0);
    // The element is paused and muted while the deck holds the track;
    // restarting it restarted nothing anyone could hear.
    expect(play).not.toHaveBeenCalled();
    // And the same song's next end must count as one.
    expect(endedTrackRef.current).toBeUndefined();
  });

  it('repeats again at the next end, and again', () => {
    const { seekHost, hook } = setUp(true);
    hook.rerender({ hostEnded: true });
    hook.rerender({ hostEnded: false });
    hook.rerender({ hostEnded: true });
    hook.rerender({ hostEnded: false });
    hook.rerender({ hostEnded: true });
    expect(seekHost).toHaveBeenCalledTimes(3);
  });

  it('does not act on a held end twice', () => {
    const { seekHost, hook } = setUp(true);
    hook.rerender({ hostEnded: true });
    hook.rerender({ hostEnded: true });
    expect(seekHost).toHaveBeenCalledTimes(1);
  });

  it('restarts the element when the element is what plays', () => {
    const { element, play, seekHost, hook } = setUp(false);
    hook.result.current(element);
    expect(element.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);
    expect(seekHost).not.toHaveBeenCalled();
  });
});
