/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Edit mode on the stage, as the member sees it.
 *
 * Switching the stage's view used to take Edit mode's panels away (Ivan,
 * 2026-11-11: "if I select ultra-wide it hides the editor panes"): every
 * view is switched here with something picked, and the panels, the pick and
 * the strip are still there in each. And Solo says which rows it shows,
 * inside a group too, on the group as well.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import StudioStage from '../../../renderer/studio/StudioStage';
import type { TStagePreview } from '../../../renderer/studio/studioStageScreen';

jest.mock('../../../renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({ claim: () => undefined, capture: undefined }),
}));
jest.mock('../../../renderer/audio/SceneAudioContext', () => ({
  useSceneAudio: () => ({
    points: [],
    waveform: [],
    isPaused: false,
    readFrame: () => undefined,
  }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/graph/useSceneRunner', () => ({
  __esModule: true,
  default: jest.fn(() => ({ current: null })),
}));

const pack = {
  names: { en: 'Lake' },
  params: [],
  world: normalizeSceneWorld(
    {
      camera: { position: [0, 2, 10], target: [0, 0, 0] },
      materials: { paint: { kind: 'standard', colour: '#ff0000' } },
      nodes: [
        {
          type: 'mesh',
          name: 'Moon',
          geometry: { kind: 'sphere' },
          material: 'paint',
        },
        {
          type: 'group',
          name: 'Boat',
          children: [
            {
              type: 'mesh',
              name: 'Hull',
              geometry: { kind: 'box' },
              material: 'paint',
            },
          ],
        },
      ],
    },
    [],
  ),
} as unknown as IScenePack;

const stage = (preview: TStagePreview, isGridShown = false) => (
  <StudioStage
    identity="one"
    pack={pack}
    serial={1}
    signal="live"
    demo={false}
    size="graph"
    preview={preview}
    motion="music"
    onToggleMotion={jest.fn()}
    wave={{ height: 1, position: 0 }}
    isGridShown={isGridShown}
    readingRef={{ current: null }}
    onTrouble={jest.fn()}
    onDrawn={jest.fn()}
    onExitFullscreen={jest.fn()}
    onToggleFullscreen={jest.fn()}
  />
);

/** One stage box, as the layout would measure it. */
let observers: Array<() => void> = [];

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
    height: 700,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 700,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  observers = [];
  // Calls back when the test says the layout measured, as a real one would
  // once the stage has a box.
  Object.assign(globalThis, {
    ResizeObserver: class {
      private readonly changed: () => void;

      constructor(changed: () => void) {
        this.changed = changed;
      }

      observe() {
        observers.push(this.changed);
      }

      disconnect() {
        observers = observers.filter((changed) => changed !== this.changed);
      }

      unobserve() {
        this.disconnect();
      }
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The row of the list that names `name`. */
const row = (name: string) => {
  const button = screen.getByRole('button', { name: new RegExp(`^${name}`) });
  const item = button.closest('li');
  if (!item) {
    throw new Error(`no row for ${name}`);
  }
  return item;
};

const openEdit = () => {
  // A stage tall enough for the list to open with Edit mode.
  act(() => {
    observers.forEach((changed) => changed());
  });
  fireEvent.click(screen.getByRole('button', { name: /studio\.edit\.switch/ }));
};

it('keeps Edit mode, its panels and its pick through every change of view', () => {
  const { rerender } = render(stage('stage'));
  openEdit();
  fireEvent.click(screen.getByRole('button', { name: /^Moon/ }));
  const views: Array<[TStagePreview, boolean]> = [
    ['ultraWide', false],
    ['player', false],
    ['stage', true],
    ['ultraWide', true],
    ['stage', false],
  ];
  views.forEach(([preview, grid]) => {
    act(() => {
      rerender(stage(preview, grid));
    });
    expect(
      screen.getByRole('heading', { name: 'studio.edit.list.title' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Moon/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The strip of what can be done to it is there too.
    expect(
      screen.getByRole('button', { name: 'studio.edit.ask' }),
    ).toBeInTheDocument();
  });
});

it('starts every thing locked, unlocked in one press from the list', () => {
  render(stage('stage'));
  openEdit();
  const lock = within(row('Moon')).getByRole('button', {
    name: 'studio.edit.lockShort: Moon',
  });
  expect(lock).toHaveAttribute('aria-pressed', 'true');
  expect(
    within(row('Hull')).getByRole('button', {
      name: 'studio.edit.lockShort: Hull',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(lock);
  expect(lock).toHaveAttribute('aria-pressed', 'false');
  // Only that thing: the boat beside it is still locked.
  expect(
    within(row('Boat')).getByRole('button', {
      name: 'studio.edit.lockShort: Boat',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
});

it('marks a soloed thing inside a group, and the group that holds it', () => {
  render(stage('stage'));
  openEdit();
  const soloOf = (name: string) =>
    within(row(name)).getByRole('button', {
      name: `studio.edit.solo: ${name}`,
    });
  fireEvent.click(soloOf('Hull'));
  expect(soloOf('Hull')).toHaveAttribute('aria-pressed', 'true');
  expect(soloOf('Boat')).toHaveClass('is-inside');
  expect(soloOf('Boat')).toHaveAttribute('aria-pressed', 'false');
  // The control: the moon, beside the group, says nothing.
  expect(soloOf('Moon')).not.toHaveClass('is-inside');
  expect(soloOf('Moon')).toHaveAttribute('aria-pressed', 'false');
  // Pressed again, Solo ends and every mark goes.
  fireEvent.click(soloOf('Hull'));
  expect(soloOf('Hull')).toHaveAttribute('aria-pressed', 'false');
  expect(soloOf('Boat')).not.toHaveClass('is-inside');
});
