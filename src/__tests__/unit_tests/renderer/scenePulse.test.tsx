/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window glowing with the scene: which beats it answers, from where, in
 * which colour, and that the scene's own box is left out of the light.
 *
 * jsdom lays nothing out and runs no animation, so the scene's box is given
 * and `animate` is recorded; how the glow costs nothing to draw is held
 * against the compiled stylesheet at the end.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import {
  BEATS_PER_PULSE,
  reportSceneBeat,
  resetScenePulse,
  subscribeScenePulse,
  type IScenePulse,
  type IScenePulseFrame,
} from '../../../renderer/utils/scenePulse';
import {
  setSceneTintMode,
  setStudioTintMode,
  setStudioTintSource,
} from '../../../renderer/utils/sceneTintStore';
import ScenePulse from '../../../renderer/components/ScenePulse';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

let mockLookId = 'premium:bloom';
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));

const beat = (
  level = 0.42,
  bands: [number, number, number] = [0.6, 0.2, 0.1],
) => ({ beat: 1, level, bands }) satisfies IScenePulseFrame;
const quiet = {
  beat: 0,
  level: 0,
  bands: [0, 0, 0],
} satisfies IScenePulseFrame;

/** A scene of `width`×`height` at `left`,`top`. */
const sceneAt = (left: number, top: number, width: number, height: number) => {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return element;
};

/** `count` beats, each one fallen away again before the next. */
const beats = (count: number, frame: IScenePulseFrame, scene?: Element) => {
  for (let index = 0; index < count; index += 1) {
    reportSceneBeat('graph', frame, scene);
    reportSceneBeat('graph', quiet, scene);
  }
};

beforeEach(() => {
  resetScenePulse();
  mockLookId = 'premium:bloom';
  setStudioTintSource(undefined);
  setSceneTintMode('pulse');
  setStudioTintMode('off');
});

describe('which beats the window answers', () => {
  it('answers the first beat and then one in four, told apart by the beat falling away', () => {
    const heard: IScenePulse[] = [];
    subscribeScenePulse((pulse) => heard.push(pulse));
    beats(BEATS_PER_PULSE * 2 + 1, beat());
    expect(heard).toHaveLength(3);
    // A beat held high is one beat, not a beat per frame.
    reportSceneBeat('graph', beat(), undefined);
    reportSceneBeat('graph', beat(), undefined);
    reportSceneBeat('graph', beat(), undefined);
    expect(heard).toHaveLength(3);
  });

  it('is as bright as the music is loud, never below a faint glow nor above full', () => {
    const heard: IScenePulse[] = [];
    subscribeScenePulse((pulse) => heard.push(pulse));
    beats(1, beat(0.05));
    resetScenePulse();
    subscribeScenePulse((pulse) => heard.push(pulse));
    beats(1, beat(0.9));
    expect(heard.map((pulse) => pulse.strength)).toEqual([0.35, 1]);
  });

  it('takes its colour from the part of the music carrying the beat', () => {
    const voices: string[] = [];
    subscribeScenePulse((pulse) => voices.push(pulse.voice));
    [
      [0.6, 0.2, 0.1],
      [0.1, 0.7, 0.2],
      [0.1, 0.2, 0.8],
    ].forEach((bands) => {
      resetScenePulse();
      subscribeScenePulse((pulse) => voices.push(pulse.voice));
      beats(1, beat(0.4, bands as [number, number, number]));
    });
    expect(voices).toEqual(['bass', 'mid', 'treble']);
  });

  it('measures where the scene stands only when somebody is listening, and not a box with no size', () => {
    const scene = sceneAt(100, 50, 400, 200);
    const measure = jest.spyOn(scene, 'getBoundingClientRect');
    beats(1, beat(), scene);
    expect(measure).not.toHaveBeenCalled();

    resetScenePulse();
    const origins: Array<DOMRect | undefined> = [];
    subscribeScenePulse((pulse) => origins.push(pulse.origin));
    beats(1, beat(), scene);
    beats(BEATS_PER_PULSE, beat(), sceneAt(0, 0, 0, 0));
    expect(origins[0]?.width).toBe(400);
    expect(origins[1]).toBeUndefined();
  });
});

describe('the glow in the window', () => {
  let animations: Array<{ element: Element; frames: Keyframe[] }>;

  beforeEach(() => {
    animations = [];
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value(this: HTMLElement, frames: Keyframe[]) {
        animations.push({ element: this, frames });
        return {} as Animation;
      },
    });
  });

  it('is not in the page unless its mode is chosen, or on a look that is not a scene', () => {
    setSceneTintMode('tint');
    const { rerender } = render(<ScenePulse />);
    expect(document.querySelector('.scene-pulse')).toBeNull();
    act(() => setSceneTintMode('pulse'));
    mockLookId = 'look:signal';
    rerender(<ScenePulse />);
    expect(document.querySelector('.scene-pulse')).toBeNull();
  });

  it('swells from the middle of the scene in the beat’s colour, with the scene’s own box cut out of it', () => {
    render(<ScenePulse />);
    const layer = document.querySelector('.scene-pulse') as HTMLElement;
    expect(layer.querySelectorAll('.scene-pulse__glow')).toHaveLength(3);

    act(() =>
      beats(1, beat(0.42, [0.1, 0.2, 0.9]), sceneAt(100, 60, 400, 180)),
    );
    expect(animations).toHaveLength(1);
    const [{ element, frames }] = animations;
    expect(element).toHaveClass('scene-pulse__glow--treble');
    expect(String(frames[0].transform)).toContain('translate(300px, 150px)');
    expect(frames[1].opacity).toBe(1);
    expect(frames[2].opacity).toBe(0);
    expect(layer.style.clipPath).toMatch(
      /^path\(evenodd, 'M0 0H\d+V\d+H0Z M112 60 /,
    );
  });

  it('follows the Studio’s mode while a project owns the window, not the graph’s', () => {
    setStudioTintSource({ project: 'mine' });
    setStudioTintMode('tint');
    render(<ScenePulse />);
    expect(document.querySelector('.scene-pulse')).toBeNull();
    act(() => setStudioTintMode('pulse'));
    act(() => {
      reportSceneBeat('graph', beat(), undefined);
      reportSceneBeat('studio', beat(), undefined);
    });
    expect(animations).toHaveLength(1);
  });
});

describe('how the glow is drawn', () => {
  const rules = styleRules(compileStylesheet('ScenePulse.scss'));
  // Ends with, not equals: the licence comments compile in front of the
  // first rule and arrive as part of its selector text.
  const rule = (selector: string) =>
    rules.find(({ selectors }) =>
      selectors.some(
        (each) =>
          each === selector ||
          each.endsWith(`*/ ${selector}`) ||
          each.endsWith(`*/${selector}`),
      ),
    );

  it('lifts the window by its colour rather than laying a haze over it, taking no pointer', () => {
    const layer = rule('.scene-pulse')?.declarations;
    expect(layer?.get('mix-blend-mode')).toBe('screen');
    expect(layer?.get('pointer-events')).toBe('none');
  });

  it('keeps each glow on a layer of its own between swells, so a swell repaints nothing', () => {
    const glow = rule('.scene-pulse__glow')?.declarations;
    expect(glow?.get('will-change')).toBe('transform, opacity');
    expect(glow?.get('opacity')).toBe('0');
  });

  it('holds a pale colour to a mid-tone, so a pastel scene does not glow grey-white', () => {
    expect(rule('.scene-pulse__glow')?.declarations.get('--glow')).toBe(
      'oklch(from var(--glow-colour) min(l, 0.6) c h)',
    );
  });
});
