/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render } from '@testing-library/react';
import type {
  IAmbientElement,
  IAmbientParam,
  TAmbientField,
} from 'common/sceneAmbient';
import StudioAmbientIcon from 'renderer/studio/StudioAmbientIcon';

jest.mock('renderer/ambient/ambientSprites', () => ({
  ambientSprite: ({ colour, size }: { colour: string; size: number }) => ({
    image: { colour },
    extent: size,
  }),
}));

/**
 * Beside each "elements in the window" slider, what it moves (Ivan,
 * 2026-09-28: "show on each slider the element icon so they know what it is
 * about"): the scene's own elements drawn as the window draws them, a few of
 * one or one of each, and what the slider does to them told by how they are
 * drawn — as they are for a count, a smear for a speed, faded across for how
 * much they show.
 */

interface IDrawn {
  image: unknown;
  alpha: number;
}

/** A 2D context that remembers what was drawn and how strongly. */
const recordingContext = () => {
  const drawn: IDrawn[] = [];
  const context = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
    drawImage: jest.fn((image: unknown) => {
      drawn.push({ image, alpha: context.globalAlpha });
    }),
  };
  return { context, drawn };
};

const flake = (id: string, colours: string[]): IAmbientElement =>
  ({ id, shape: 'snow', colours }) as unknown as IAmbientElement;

const setting = (
  targets: [element: string, field: TAmbientField][],
): IAmbientParam => ({
  id: 'ambient_amount',
  names: { en: 'Things in the window' },
  value: 0.5,
  targets: targets.map(([element, field]) => ({
    element,
    field,
    min: 0,
    max: 1,
  })) as IAmbientParam['targets'],
});

let recording: ReturnType<typeof recordingContext>;

beforeEach(() => {
  recording = recordingContext();
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(recording.context as unknown as CanvasRenderingContext2D);
  window.matchMedia = jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => jest.restoreAllMocks());

describe('the icon beside an element slider', () => {
  it('draws a few of the one element a slider moves, in its colours', () => {
    render(
      <StudioAmbientIcon
        param={setting([['snow', 'count']])}
        elements={[flake('snow', ['#ffffff', '#cfe8ff'])]}
        pictures={new Map()}
      />,
    );
    expect(recording.drawn.map(({ image }) => image)).toEqual([
      { colour: '#ffffff' },
      { colour: '#cfe8ff' },
      { colour: '#ffffff' },
    ]);
    expect(recording.drawn.every(({ alpha }) => alpha === 1)).toBe(true);
  });

  it('draws one of each for a slider over several', () => {
    render(
      <StudioAmbientIcon
        param={setting([
          ['snow', 'count'],
          ['stars', 'count'],
        ])}
        elements={[flake('snow', ['#ffffff']), flake('stars', ['#ffe08a'])]}
        pictures={new Map()}
      />,
    );
    expect(recording.drawn.map(({ image }) => image)).toEqual([
      { colour: '#ffffff' },
      { colour: '#ffe08a' },
    ]);
  });

  it('leaves each a faint smear behind it for a speed', () => {
    render(
      <StudioAmbientIcon
        param={setting([['snow', 'speed']])}
        elements={[flake('snow', ['#ffffff'])]}
        pictures={new Map()}
      />,
    );
    // Three shapes, each drawn three times fainter behind and once whole.
    expect(recording.drawn.map(({ alpha }) => alpha)).toEqual(
      Array.from({ length: 3 }, () => [0.1, 0.22, 0.42, 1]).flat(),
    );
  });

  it('fades them across for how much they show', () => {
    render(
      <StudioAmbientIcon
        param={setting([['snow', 'opacity']])}
        elements={[flake('snow', ['#ffffff'])]}
        pictures={new Map()}
      />,
    );
    expect(recording.context.createLinearGradient).toHaveBeenCalled();
    expect(recording.context.fillRect).toHaveBeenCalled();
    // Left as it found it for whatever draws next.
    expect(recording.context.globalCompositeOperation).toBe('source-over');
  });

  it('draws nothing for an element the scene does not have', () => {
    render(
      <StudioAmbientIcon
        param={setting([['ghosts', 'count']])}
        elements={[flake('snow', ['#ffffff'])]}
        pictures={new Map()}
      />,
    );
    expect(recording.drawn).toEqual([]);
  });

  it('stands on the scene’s own night', () => {
    const { container } = render(
      <StudioAmbientIcon
        param={setting([['snow', 'count']])}
        elements={[flake('snow', ['#ffffff'])]}
        pictures={new Map()}
        sky="#050a1a"
      />,
    );
    const tile = container.querySelector<HTMLElement>('.studio-ambient-icon');
    expect(tile?.style.getPropertyValue('--sky')).toBe('#050a1a');
  });
});
