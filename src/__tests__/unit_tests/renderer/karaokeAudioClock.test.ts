/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The karaoke tab's musical waits, on the sound card's clock.
 *
 * A count-in was a chain of `setTimeout`s, each started when the one before
 * it fired, so every step's lateness was carried into the next; the Maker's
 * auditions were timers of a word's length started at the seek, and a 25 ms
 * poll. These hold the replacements: a cue runs when the audio clock reaches
 * it and no timer is ever set, and an audition ends when the song's own
 * playhead has reached the end of its stretch.
 */

import { createKaraokeAudioClock } from '../../../renderer/karaoke/karaokeAudioClock';
import { whenMediaReaches } from '../../../renderer/karaoke/karaokeMediaCue';
import { FakeClockContext, openFakeClock } from '../../utils/fakeAudioClock';

/**
 * Lets the clock's `resume()` settle, which is when a schedule is planned.
 * Microtasks only: a timer here would be the thing being tested for.
 */
const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- each turn is one microtask.
    await Promise.resolve();
  }
};

describe('the karaoke audio clock', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs each cue when the clock reaches it, and sets no timer', async () => {
    jest.useFakeTimers();
    const context = new FakeClockContext();
    const clock = createKaraokeAudioClock(openFakeClock(context));
    const heard: string[] = [];
    const heardAt: number[] = [];
    const cue = (label: string) => () => {
      heard.push(label);
      heardAt.push(context.currentTime);
    };

    clock.schedule(() => [
      { atSeconds: 0.55, run: cue('2') },
      { atSeconds: 1.1, run: cue('3') },
      { atSeconds: 1.65, run: cue('go') },
    ]);
    await settle();
    // The wait is the sound card's, not the window's.
    expect(jest.getTimerCount()).toBe(0);

    context.advance(0.549);
    expect(heard).toEqual([]);
    context.advance(0.002);
    expect(heard).toEqual(['2']);
    context.advance(0.55);
    expect(heard).toEqual(['2', '3']);
    context.advance(0.55);
    expect(heard).toEqual(['2', '3', 'go']);
    // Each at its own time past one origin: a cue heard late would not push
    // the next one later.
    [0.55, 1.1, 1.65].forEach((seconds, index) =>
      expect(heardAt[index]).toBeCloseTo(seconds, 9),
    );
  });

  it('measures from the moment the clock is running, and asks the plan then', async () => {
    const context = new FakeClockContext();
    const clock = createKaraokeAudioClock(openFakeClock(context));
    context.currentTime = 4;
    const plan = jest.fn(() => [{ atSeconds: 1, run: () => undefined }]);

    clock.schedule(plan);
    // Suspended until the device has started: nothing is planned yet.
    expect(plan).not.toHaveBeenCalled();
    await settle();
    expect(plan).toHaveBeenCalledTimes(1);
    expect(context.markers[0].startAt).toBe(4);
    expect(context.markers[0].stopAt).toBe(5);
  });

  it('never runs a cancelled cue, and still runs one that was not', async () => {
    const context = new FakeClockContext();
    const clock = createKaraokeAudioClock(openFakeClock(context));
    const cancelled = jest.fn();
    const kept = jest.fn();

    const cancel = clock.schedule(() => [{ atSeconds: 0.5, run: cancelled }]);
    clock.schedule(() => [{ atSeconds: 0.5, run: kept }]);
    await settle();
    cancel();
    context.advance(1);

    expect(cancelled).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('lets the device go when nothing is waiting, and keeps it between cues', async () => {
    const context = new FakeClockContext();
    const clock = createKaraokeAudioClock(openFakeClock(context));
    const again = jest.fn();

    clock.schedule(() => [
      {
        atSeconds: 0.2,
        // A pass that starts the next pass, as an audition loop does.
        run: () => {
          clock.schedule(() => [{ atSeconds: 0.2, run: again }]);
        },
      },
    ]);
    await settle();
    context.advance(0.2);
    // Still waiting on the second pass, so still running.
    expect(context.suspends).toBe(0);
    await settle();
    context.advance(0.2);
    expect(again).toHaveBeenCalledTimes(1);
    await settle();
    expect(context.state).toBe('suspended');
    expect(context.pending).toEqual([]);
  });

  it('opens nothing until something waits, and a new context after close', async () => {
    const contexts: FakeClockContext[] = [];
    const clock = createKaraokeAudioClock(() => {
      const context = new FakeClockContext();
      contexts.push(context);
      return context as unknown as AudioContext;
    });
    expect(contexts).toHaveLength(0);

    const run = jest.fn();
    clock.schedule(() => [{ atSeconds: 1, run }]);
    await settle();
    clock.close();
    expect(contexts[0].state).toBe('closed');
    contexts[0].advance(2);
    expect(run).not.toHaveBeenCalled();

    clock.schedule(() => [{ atSeconds: 1, run }]);
    await settle();
    expect(contexts).toHaveLength(2);
    contexts[1].advance(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

/** A media element as far as an audition can see one. */
class FakeMedia extends EventTarget {
  paused = true;

  seeking = false;

  currentTime = 0;

  playbackRate = 1;

  /** The audition's own seek and play, as the element takes them. */
  seekAndPlay(seconds: number) {
    this.currentTime = seconds;
    this.seeking = true;
    this.paused = false;
  }

  landSeek() {
    this.seeking = false;
    this.dispatchEvent(new Event('seeked'));
  }
}

describe('an audition timed by the playhead', () => {
  const setUp = () => {
    const context = new FakeClockContext();
    const clock = createKaraokeAudioClock(openFakeClock(context));
    const media = new FakeMedia();
    const reached = jest.fn();
    return { context, clock, media, reached };
  };

  it('does not count the seek, and ends when the playhead reaches the end', async () => {
    const { context, clock, media, reached } = setUp();
    media.seekAndPlay(10);

    whenMediaReaches(
      clock,
      media as unknown as HTMLMediaElement,
      10_400,
      reached,
    );
    await settle();
    // Still seeking: a playhead read now is where the song will be.
    expect(context.markers).toHaveLength(0);
    context.advance(1);
    expect(reached).not.toHaveBeenCalled();

    media.landSeek();
    await settle();
    context.advance(0.399);
    expect(reached).not.toHaveBeenCalled();
    context.advance(0.002);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('measures again from where playing actually began', async () => {
    const { context, clock, media, reached } = setUp();
    media.seekAndPlay(2);
    whenMediaReaches(
      clock,
      media as unknown as HTMLMediaElement,
      2_090,
      reached,
    );
    media.landSeek();
    await settle();
    // The element took 30 ms to start producing sound after its seek.
    context.advance(0.03);
    media.dispatchEvent(new Event('playing'));
    await settle();
    context.advance(0.089);
    expect(reached).not.toHaveBeenCalled();
    context.advance(0.002);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('waits while something else has paused the song, and follows its speed', async () => {
    const { context, clock, media, reached } = setUp();
    media.seekAndPlay(0);
    whenMediaReaches(
      clock,
      media as unknown as HTMLMediaElement,
      1_000,
      reached,
    );
    media.landSeek();
    await settle();

    media.paused = true;
    media.dispatchEvent(new Event('pause'));
    context.advance(5);
    expect(reached).not.toHaveBeenCalled();

    media.paused = false;
    media.currentTime = 0.5;
    media.playbackRate = 0.5;
    media.dispatchEvent(new Event('playing'));
    await settle();
    // Half a second of song left at half speed is a second of clock.
    context.advance(0.999);
    expect(reached).not.toHaveBeenCalled();
    context.advance(0.002);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('is silent once cancelled and stops listening to the element', async () => {
    const { context, clock, media, reached } = setUp();
    const removed = jest.spyOn(media, 'removeEventListener');
    const signals: AbortSignal[] = [];
    const add = media.addEventListener.bind(media);
    jest
      .spyOn(media, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (typeof options === 'object' && options.signal) {
          signals.push(options.signal);
        }
        add(type, listener, options);
      });
    media.seekAndPlay(0);
    const cancel = whenMediaReaches(
      clock,
      media as unknown as HTMLMediaElement,
      500,
      reached,
    );
    media.landSeek();
    await settle();

    cancel();
    context.advance(1);
    media.dispatchEvent(new Event('playing'));
    await settle();
    context.advance(1);

    expect(reached).not.toHaveBeenCalled();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    removed.mockRestore();
  });
});
