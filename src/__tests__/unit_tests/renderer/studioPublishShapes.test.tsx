/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The publish dialog plays the scene in the three views a listener meets it
 * in (Ivan, 2026-11-12: "show the 3 normal, ultra wide and amp ui models in
 * the publish screen ... we need them to test it first before publishing on
 * all modes"). Held here on the dialog's real stage, with the scene and the
 * clip mocked: each view frames the scene as the app does and lays its own
 * parts over it, the covers and the clip stay the Normal view's, a take
 * waits through the other views and carries on in Normal (Ivan, 2026-11-18:
 * "We need to keep the video displayed"), only a frame drawn as the Normal
 * view at the clip's size reaches the clip, the clip's tabs stand in every
 * view, and the view is never locked behind a take. The take itself is the
 * press's (Ivan, 2026-11-23): it starts only when the dialog asks for it, in
 * Normal, and the hour opens halfway. Each case beside the view, or the
 * phase, that must not.
 */

interface IPreviewProps {
  shapeFrame?: (frame: unknown) => { view?: unknown };
  onDrawn?: (frame: unknown, canvas?: unknown, report?: unknown) => void;
  onTrouble?: (problem: string) => void;
  captureSize?: unknown;
  captureFrames?: boolean;
}
let preview: IPreviewProps = {};
const video = {
  phase: 'idle' as string,
  frame: jest.fn(),
  input: jest.fn(),
  cancel: jest.fn(),
  record: jest.fn(),
  fail: jest.fn(),
};
/** Whether the demo song could not be started. */
const signal = { failed: false };

jest.mock('../../../renderer/plus/ScenePreview', () => {
  return function ScenePreview(props: IPreviewProps) {
    preview = props;
    return null;
  };
});
jest.mock('../../../renderer/studio/usePublishVideo', () => () => ({
  state: { phase: video.phase, elapsedMs: 0 },
  frame: video.frame,
  input: video.input,
  fail: video.fail,
  cancel: video.cancel,
  record: video.record,
}));
jest.mock('../../../renderer/studio/usePublishSignal', () => () => ({
  audio: {
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  },
  failed: signal.failed,
}));
jest.mock('../../../renderer/studio/StudioStagePlayer', () => () => (
  <div data-testid="player" />
));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import StudioPublishCamera from '../../../renderer/studio/StudioPublishCamera';
import { isTakeBusy } from '../../../renderer/studio/StudioPublishShapes';
import {
  PLAYER_PANEL_VIEW,
  ULTRA_WIDE_PANEL_VIEW,
} from '../../../renderer/studio/studioStageScreen';
/* eslint-enable import/first */

/** A frame that measures 480 by 966 the moment it is watched. */
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  function Measured(told: () => void) {
    return { observe: () => told(), disconnect: () => undefined };
  };
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get: () => 480,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get: () => 966,
});

const pack = {
  schema: 1,
  id: 'balloon-dawn',
  version: 1,
  contract: 1,
  names: { en: 'Balloon Dawn' },
  fallbackStyle: 'skyline',
  swatch: ['#000000', '#ffffff'],
  source: '',
  params: [],
} as unknown as IScenePack;

const recordRef: { current: (() => void) | undefined } = {
  current: undefined,
};
const onTake = jest.fn();

const camera = (sending = false) => (
  <StudioPublishCamera
    identity="balloon-dawn"
    pack={pack}
    name="Balloon Dawn"
    locked={false}
    sending={sending}
    tuning={{}}
    onCapture={jest.fn()}
    source="src"
    onPreview={jest.fn()}
    onTake={onTake}
    recordRef={recordRef}
    videoSlot={document.createElement('div')}
  />
);

const open = (phase = 'idle', sending = false) => {
  video.phase = phase;
  [
    video.frame,
    video.input,
    video.cancel,
    video.record,
    video.fail,
    onTake,
  ].forEach((mock) => mock.mockClear());
  return render(camera(sending));
};

beforeEach(() => {
  signal.failed = false;
});

const choose = (key: string) =>
  fireEvent.click(screen.getByRole('button', { name: key }));
const viewNow = () => preview.shapeFrame?.({ playing: true }).view;
const capture = () =>
  screen.getByRole('button', { name: /studio\.publish\.capture/ });

describe('the publish dialog’s views', () => {
  it('opens on Normal: the clip’s canvas, the scene framed whole, the clip’s tabs', () => {
    open();
    expect(viewNow()).toBeUndefined();
    expect(preview.captureSize).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'studio.publish.viewLive' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.studio-ultra-frame')).toBeNull();
  });

  it('Ultra wide: the whole window, the scene framed to the graph, the band outlined', () => {
    open();
    choose('studio.publish.shapeUltra');
    expect(viewNow()).toEqual(ULTRA_WIDE_PANEL_VIEW);
    expect(document.querySelector('.studio-ultra-frame__band')).not.toBeNull();
    // Drawn at its own shape, never at the clip's size.
    expect(preview.captureSize).toBeUndefined();
    // The clip's tabs stand on the bar over the frame, not on the picture,
    // so they are there in every view and cover no band.
    expect(
      screen
        .getByRole('button', { name: 'studio.publish.viewLive' })
        .closest('.studio-publish__stage-bar'),
    ).not.toBeNull();
  });

  it('Amp: the player’s column, framed to its panel, the player over it', () => {
    open();
    choose('studio.publish.shapeAmp');
    expect(viewNow()).toEqual(PLAYER_PANEL_VIEW);
    expect(screen.getByTestId('player')).toBeInTheDocument();
    expect(document.querySelector('.studio-ultra-frame')).toBeNull();
  });

  it('takes covers and the clip from Normal alone', () => {
    open();
    expect(capture()).toBeEnabled();
    preview.shapeFrame?.({ playing: true });
    expect(video.input).toHaveBeenLastCalledWith(true);
    choose('studio.publish.shapeUltra');
    preview.shapeFrame?.({ playing: true });
    expect(video.input).toHaveBeenLastCalledWith(false);
    expect(capture()).toBeDisabled();
  });
});

describe('the cover’s row', () => {
  // It opened on the window's own hour, so anybody working after dark shot
  // night covers by default (Ivan, 2026-11-23: "it will start at 50%").
  it('opens halfway from night to day', () => {
    open();
    expect(screen.getByText('studio.settings.percent:50')).toBeInTheDocument();
  });

  it('has no music to choose: the scene hears the demo song alone', () => {
    open();
    expect(
      screen.queryByRole('group', { name: 'studio.publish.hears' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studio.publish.yourMusic' }),
    ).not.toBeInTheDocument();
  });

  it('rests the shutter while the press records, and frees it after', () => {
    const { rerender } = open('recording', true);
    expect(capture()).toBeDisabled();
    video.phase = 'ready';
    rerender(camera(false));
    // Ready shows the clip's tab, over which nothing is caught; Live again
    // frees the shutter.
    choose('studio.publish.viewLive');
    expect(capture()).toBeEnabled();
  });
});

describe('a take of the preview clip', () => {
  // Leaving Normal used to cancel a take under way and take it again from
  // nothing on the way back, so a look at Amp mid-take threw the recording
  // away (2026-11-18). It now waits there as through a quiet moment.
  it('holding the canvas waits in the other views and carries on in Normal', () => {
    open('recording');
    expect(preview.captureFrames).toBe(true);
    preview.shapeFrame?.({ playing: true });
    expect(video.input).toHaveBeenLastCalledWith(true);

    choose('studio.publish.shapeAmp');
    preview.shapeFrame?.({ playing: true });
    // Told nothing plays, and the canvas let rest: the take waits.
    expect(video.input).toHaveBeenLastCalledWith(false);
    expect(preview.captureFrames).toBe(false);

    choose('studio.publish.shapeNormal');
    preview.shapeFrame?.({ playing: true });
    expect(video.input).toHaveBeenLastCalledWith(true);
    expect(preview.captureFrames).toBe(true);
    // Never thrown away, never begun again.
    expect(video.cancel).not.toHaveBeenCalled();
    expect(video.record).not.toHaveBeenCalled();
  });

  // On the way back from another view the first frames are still that
  // view's, at its size: one of them kept would be a squashed frame in the
  // clip. Only a frame drawn as the Normal view, at the clip's size, is fed.
  it('is fed only frames drawn as the Normal view at the clip’s size', () => {
    open('recording');
    const size = preview.captureSize;
    if (
      typeof size !== 'object' ||
      size === null ||
      !('width' in size) ||
      !('height' in size)
    ) {
      throw new Error('Normal draws at the clip’s size');
    }
    const canvas = document.createElement('canvas');
    const atClipSize = { outputWidth: size.width, outputHeight: size.height };
    const drawn = (view?: unknown) => ({
      fade: 1,
      level: 0.5,
      deltaMs: 16,
      view,
      spectrum: new Float32Array(8),
      waveform: new Float32Array(8),
    });

    act(() => preview.onDrawn?.(drawn(), canvas, atClipSize));
    expect(video.frame).toHaveBeenCalledTimes(1);
    expect(video.frame).toHaveBeenLastCalledWith(canvas);

    // Back in Normal, a frame still drawn as Amp, and one at Amp's size.
    act(() => preview.onDrawn?.(drawn(PLAYER_PANEL_VIEW), canvas, atClipSize));
    act(() =>
      preview.onDrawn?.(drawn(), canvas, {
        outputWidth: 480,
        outputHeight: 966,
      }),
    );
    expect(video.frame).toHaveBeenCalledTimes(1);

    // In Amp, nothing at all.
    choose('studio.publish.shapeAmp');
    act(() => preview.onDrawn?.(drawn(), canvas, atClipSize));
    expect(video.frame).toHaveBeenCalledTimes(1);
  });

  it('never locks the views', () => {
    open('waiting');
    ['shapeNormal', 'shapeUltra', 'shapeAmp'].forEach((key) =>
      expect(
        screen.getByRole('button', { name: `studio.publish.${key}` }),
      ).toBeEnabled(),
    );
  });
});

// The clip used to start itself the moment the dialog opened, on whatever
// was playing (Ivan, 2026-11-23). It is the press's now.
describe('the take the press asks for', () => {
  it('is never started by the camera on its own', () => {
    open();
    act(() =>
      preview.onDrawn?.({
        fade: 1,
        level: 0.5,
        deltaMs: 16,
        spectrum: new Float32Array(8),
        waveform: new Float32Array(8),
      }),
    );
    expect(video.record).not.toHaveBeenCalled();
  });

  it('starts in the Normal view, live, from any view', () => {
    open();
    choose('studio.publish.shapeAmp');
    act(() => recordRef.current?.());
    expect(video.record).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'studio.publish.shapeNormal' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(viewNow()).toBeUndefined();
  });

  // A take on a scene at rest would wait for sound for good.
  it('fails at once when the demo song could not start', () => {
    signal.failed = true;
    open();
    act(() => recordRef.current?.());
    expect(video.fail).toHaveBeenCalledTimes(1);
    expect(video.record).not.toHaveBeenCalled();
  });

  it('fails when the demo song gives out mid-take, and not before one', () => {
    const { rerender } = open('idle');
    signal.failed = true;
    rerender(camera());
    expect(video.fail).not.toHaveBeenCalled();
    signal.failed = false;
    const recording = open('recording');
    signal.failed = true;
    recording.rerender(camera(true));
    expect(video.fail).toHaveBeenCalledTimes(1);
  });

  // The clip's part used to read "could not be recorded" over a scene that
  // could not play, before anybody had asked for a clip.
  it('lets a scene that cannot play fail only a take under way', () => {
    open('idle');
    act(() => preview.onTrouble?.('heavy'));
    expect(video.fail).not.toHaveBeenCalled();
    expect(screen.getByText('studio.publish.stageHeavy')).toBeInTheDocument();
    open('recording');
    act(() => preview.onTrouble?.('heavy'));
    expect(video.fail).toHaveBeenCalledTimes(1);
  });

  it('reports every phase to the dialog', () => {
    open('checking');
    expect(onTake).toHaveBeenLastCalledWith('checking');
  });
});

// Send says "Recording the preview…" and waits while a take the press asked
// for is under way, from its first second; nothing else holds it.
describe('which phases hold Send', () => {
  it.each([
    'waiting',
    'preparing',
    'recording',
    'paused',
    'encoding',
    'checking',
  ])('a take that is %s is under way', (phase) => {
    expect(isTakeBusy(phase)).toBe(true);
  });

  it.each(['idle', 'ready', 'failed', 'cancelled'])(
    'a take that is %s is not',
    (phase) => {
      expect(isTakeBusy(phase)).toBe(false);
    },
  );
});
