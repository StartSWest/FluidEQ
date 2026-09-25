/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chime's audio context is let go once its notes have played.
 *
 * It was made on the first press and kept for the session, holding a stream
 * open on the default output — for a chord nobody presses twice.
 */

interface IFakeAudio {
  oscillators: EventTarget[];
  close: jest.Mock;
}

/** Every context the chime made, in order. */
let made: IFakeAudio[];

/** Called with `new` by the chime, which gets the object it returns. */
const FakeAudioContext = jest.fn(() => {
  const oscillators: EventTarget[] = [];
  const audio = {
    state: 'running',
    currentTime: 0,
    destination: {},
    oscillators,
    close: jest.fn(() => Promise.resolve()),
    resume: jest.fn(() => Promise.resolve()),
    createOscillator: () => {
      const oscillator = Object.assign(new EventTarget(), {
        type: '',
        frequency: { setValueAtTime: jest.fn() },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      });
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain: () => ({
      gain: {
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    }),
  };
  made.push(audio);
  return audio;
});

const end = (oscillator: EventTarget) =>
  oscillator.dispatchEvent(new Event('ended'));

let playChime: (direction: 'up' | 'down') => void;

beforeEach(async () => {
  made = [];
  Object.assign(window, { AudioContext: FakeAudioContext });
  // The module holds the context, so each case starts with a fresh one.
  jest.resetModules();
  playChime = (await import('renderer/utils/chime')).default;
});

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioContext');
});

it('closes the context once the last note has ended, and makes another for the next press', () => {
  playChime('up');
  const [first] = made;
  expect(first.oscillators).toHaveLength(2);
  end(first.oscillators[0]);
  expect(first.close).not.toHaveBeenCalled();
  end(first.oscillators[1]);
  expect(first.close).toHaveBeenCalledTimes(1);

  playChime('down');
  expect(made).toHaveLength(2);
  expect(made[1].oscillators).toHaveLength(2);
});

it('shares one context between presses whose notes overlap', () => {
  playChime('up');
  playChime('down');
  expect(made).toHaveLength(1);
  const [audio] = made;
  audio.oscillators.slice(0, 3).forEach(end);
  expect(audio.close).not.toHaveBeenCalled();
  end(audio.oscillators[3]);
  expect(audio.close).toHaveBeenCalledTimes(1);
});
