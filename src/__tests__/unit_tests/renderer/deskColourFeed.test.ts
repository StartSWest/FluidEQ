/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The desk's colours come from the scene playing, or from wherever the page
 * is told to take its frames: Help draws the Dynamic lighting page lit by a
 * still, and that picture must neither follow the reader's scene nor stay
 * subscribed to it once it is closed.
 */

import { FORM_OF_KIND } from 'common/lighting/deviceForms';
import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
import {
  DEFAULT_LIGHTING_SETTINGS,
  type ILightingDevice,
  type ILightingFrame,
  type TLightingKind,
} from 'common/lighting/lightingModel';
import {
  createDeskColourFeed,
  type IDeskColours,
  type TDeskFrameSource,
} from 'renderer/plus/lighting/deskColours';

const stopPreview = jest.fn();
const subscribeLightingPreview = jest.fn((_receive: unknown) => stopPreview);
jest.mock('renderer/lighting/lightingPreview', () => ({
  subscribeLightingPreview: (receive: unknown) =>
    subscribeLightingPreview(receive),
}));

const device = (kind: TLightingKind, muted = false): ILightingDevice => ({
  key: `test:${kind}`,
  name: kind,
  kind,
  form: FORM_OF_KIND[kind],
  route: 'windows',
  lamps: KIND_PREVIEW_LAMPS[kind],
  channel: 'windows',
  muted,
});

const DEVICES = [device('keyboard'), device('mouse', true)];

/** A whole frame of one bright green, loud and long after the last. */
const FRAME: ILightingFrame = {
  width: 4,
  height: 2,
  rgb: Uint8Array.from({ length: 4 * 2 * 3 }, (_, index) =>
    index % 3 === 1 ? 220 : 30,
  ),
  level: 0.8,
  beat: 0.4,
  bass: 0.6,
  mid: 0.5,
  treble: 0.4,
  deltaMs: 5000,
  sceneId: 'test-scene',
};

beforeEach(() => {
  stopPreview.mockClear();
  subscribeLightingPreview.mockClear();
});

describe('createDeskColourFeed', () => {
  it('follows the scene playing when told nothing else', () => {
    const feed = createDeskColourFeed();
    expect(subscribeLightingPreview).toHaveBeenCalledTimes(1);
    feed.close();
    expect(stopPreview).toHaveBeenCalledTimes(1);
  });

  it('lights the desk from the frames it is given, and from nothing else', () => {
    let receive: Parameters<TDeskFrameSource>[0] | undefined;
    const stop = jest.fn();
    const feed = createDeskColourFeed((given) => {
      receive = given;
      return stop;
    });
    expect(subscribeLightingPreview).not.toHaveBeenCalled();

    feed.update(DEVICES, { ...DEFAULT_LIGHTING_SETTINGS, enabled: true });
    const heard: IDeskColours[] = [];
    feed.subscribe((colours) => heard.push(colours));
    receive?.(FRAME, undefined);

    const last = heard[heard.length - 1];
    expect(last.frame).toBe(FRAME);
    // The keyboard is lit green from the frame; the muted mouse is not lit.
    const keyboard = last.colours.get('test:keyboard');
    expect(keyboard?.some((value) => value > 0)).toBe(true);
    expect(last.colours.has('test:mouse')).toBe(false);

    feed.close();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stopPreview).not.toHaveBeenCalled();
  });
});
