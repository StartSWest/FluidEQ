/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library engine's messages do while nobody can see the window.
 *
 * The close button hides the window into the tray rather than minimising it,
 * and hidden was not treated as out of sight: a Library playing from the tray
 * still sent telemetry forty times a second, and the DSP page's analysis
 * frames too if it had been left open.
 */

import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import { DECK_ENDED, DECK_READY } from 'common/dsp/deckState';
import { createDspHostPublisher } from 'main/dspHost/windowPublisher';
import type { IHostTelemetry } from 'main/dspHost/wire';

jest.mock('electron', () => ({}));

interface IFakeWindow {
  window: BrowserWindow;
  sent: Array<[string, unknown]>;
  hide: () => void;
  show: () => void;
  minimize: () => void;
  restore: () => void;
}

const fakeWindow = (): IFakeWindow => {
  let visible = true;
  let minimized = false;
  const sent: Array<[string, unknown]> = [];
  const emitter = new EventEmitter();
  const window = Object.assign(emitter, {
    isDestroyed: () => false,
    isVisible: () => visible,
    isMinimized: () => minimized,
    webContents: {
      send: (channel: string, payload: unknown) =>
        sent.push([channel, payload]),
    },
  }) as unknown as BrowserWindow;
  return {
    window,
    sent,
    hide: () => {
      visible = false;
      emitter.emit('hide');
    },
    show: () => {
      visible = true;
      emitter.emit('show');
    },
    minimize: () => {
      minimized = true;
      emitter.emit('minimize');
    },
    restore: () => {
      minimized = false;
      emitter.emit('restore');
    },
  };
};

const telemetry = (
  positionSeconds: number,
  deckState = DECK_READY,
): IHostTelemetry => ({
  sequence: 0,
  appliedRevision: 0,
  framesProcessed: 0,
  latencyFrames: 480,
  deviceGeneration: 1,
  peak: [0.5, 0.5],
  callbackP50Us: 100,
  callbackP99Us: 200,
  xruns: 0,
  drops: 0,
  repairedSamples: 0,
  sampleRate: 48000,
  channels: 2,
  activeDeck: 0,
  deckState,
  deckPositionSeconds: positionSeconds,
  deckDurationSeconds: 200,
});

const channelsOf = (sent: Array<[string, unknown]>) =>
  sent.map(([channel]) => channel);

/** Forty telemetry frames a second, starting at `from` seconds in. */
const oneSecondOfTelemetry = (
  publishTelemetry: (frame: IHostTelemetry) => void,
  from: number,
) => {
  for (let tick = 0; tick < 40; tick += 1) {
    publishTelemetry(telemetry(from + tick * 0.025));
  }
};

it('sends everything to a window somebody can see', () => {
  const fake = fakeWindow();
  const { publish, publishTelemetry } = createDspHostPublisher(
    () => fake.window,
  );

  oneSecondOfTelemetry(publishTelemetry, 10);
  publish('dsp-host-analysis', { frame: 1 });

  expect(channelsOf(fake.sent)).toHaveLength(41);
});

it('sends a window hidden into the tray no analysis, and only the telemetry the player moves on', () => {
  const fake = fakeWindow();
  const { publish, publishTelemetry } = createDspHostPublisher(
    () => fake.window,
  );
  publishTelemetry(telemetry(10));
  fake.sent.length = 0;

  fake.hide();
  oneSecondOfTelemetry(publishTelemetry, 10.025);
  for (let frame = 0; frame < 23; frame += 1) {
    publish('dsp-host-analysis', { frame });
  }
  publishTelemetry(telemetry(11, DECK_ENDED));

  // A playhead crossing four quarter seconds, and the end of the track.
  expect(channelsOf(fake.sent)).toEqual(Array(5).fill('dsp-host-telemetry'));
  expect(fake.sent[4][1]).toMatchObject({ deckState: DECK_ENDED });
});

it('hands a window coming back from the tray the newest of what it missed, once', () => {
  const fake = fakeWindow();
  const { publish, publishTelemetry } = createDspHostPublisher(
    () => fake.window,
  );
  publishTelemetry(telemetry(10));
  fake.hide();
  publishTelemetry(telemetry(10.1));
  publish('dsp-host-analysis', { frame: 1 });
  publish('dsp-host-analysis', { frame: 2 });
  publish('dsp-host-diagnostic', { severity: 'info' });
  fake.sent.length = 0;

  fake.show();
  fake.show();

  expect(fake.sent).toEqual([
    ['dsp-host-analysis', { frame: 2 }],
    ['dsp-host-telemetry', telemetry(10.1)],
  ]);
});

it('treats a minimised window the same way, and waits for it to be restored', () => {
  const fake = fakeWindow();
  const { publish } = createDspHostPublisher(() => fake.window);
  fake.minimize();
  publish('dsp-host-analysis', { frame: 1 });
  fake.hide();
  // Shown from the tray while still minimised: not back yet.
  fake.show();
  expect(fake.sent).toEqual([]);

  fake.restore();
  expect(fake.sent).toEqual([['dsp-host-analysis', { frame: 1 }]]);
});

it('never sends what it held after something newer on the same channel', () => {
  const fake = fakeWindow();
  const { publish } = createDspHostPublisher(() => fake.window);
  fake.hide();
  publish('dsp-host-analysis', { frame: 1 });
  publish('dsp-host-state', 'ready');

  // Back by a way that raised no event: the next message carries the rest.
  (fake.window as unknown as { isVisible: () => boolean }).isVisible = () =>
    true;
  publish('dsp-host-analysis', { frame: 2 });

  expect(fake.sent).toEqual([
    ['dsp-host-state', 'ready'],
    ['dsp-host-analysis', { frame: 2 }],
  ]);
});
