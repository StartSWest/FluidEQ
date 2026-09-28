/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * In Ambient the window's light answers the beats of the picture playing. The
 * classic amp draws that picture in a deck of its own, or behind its
 * equalizer's curve when there is no room for a deck, and neither place
 * reported a beat: Ambient beside it had its colours and never its light.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import EqScreen from 'renderer/player/classic/EqScreen';
import VisDeck from 'renderer/player/classic/VisDeck';

const mockPreviews: { onDrawn?: unknown }[] = [];
const mockOnDrawn = jest.fn();
type TPlace = { current: Element | null };
const mockPulse = jest.fn<typeof mockOnDrawn, [boolean, TPlace]>(
  () => mockOnDrawn,
);

jest.mock('renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: (props: { onDrawn?: unknown }) => {
    mockPreviews.push(props);
    return null;
  },
}));
jest.mock('renderer/player/usePlayerScenePulse', () => ({
  __esModule: true,
  default: (isDrawing: boolean, place: TPlace) => mockPulse(isDrawing, place),
}));
jest.mock('renderer/player/useGraphScenePack', () => ({
  __esModule: true,
  default: () => ({
    state: 'ready',
    identity: 'scene',
    lookId: 'plus:scene',
    label: 'Scene',
    pack: {},
  }),
}));
// Everything around the picture that is not the question here.
jest.mock('renderer/graph/LookPicker', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/graph/GraphAutoCycle', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/graph/GraphWallpaperToggle', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/graph/LightingToggle', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/graph/SceneLikeButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/graph/SceneTintMenu', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/graph/LiveTraceCanvas', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/player/classic/SceneKeys', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/utils/autoEqRunning', () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock('renderer/player/usePlayerCurves', () => ({
  __esModule: true,
  default: () => [],
}));
jest.mock('renderer/player/eqCurvePaint', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('renderer/components/ActiveLayerChips', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('renderer/components/useActiveLayers', () => ({
  __esModule: true,
  default: () => ({
    layers: [],
    isBypassed: () => false,
    toggle: () => undefined,
  }),
}));
jest.mock('renderer/utils/memberScenes', () => ({
  ...jest.requireActual('renderer/utils/memberScenes'),
  useUsableMemberScenes: () => [],
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: {},
    isAutoPreAmpOn: false,
    isEnabled: true,
  }),
}));
jest.mock('renderer/player/classic/playerLayout', () => ({
  ...jest.requireActual('renderer/player/classic/playerLayout'),
  useIsVisInsideCurve: () => true,
  useIsPlayerVisOpen: () => true,
}));

/** Every observed box is 320 by 180 at once, as the window lays it out. */
type TObserved = (
  entries: { contentRect: { width: number; height: number } }[],
) => void;

class SizedObserver {
  private readonly callback: TObserved;

  constructor(callback: TObserved) {
    this.callback = callback;
  }

  observe() {
    this.callback([{ contentRect: { width: 320, height: 180 } }]);
  }

  disconnect() {
    return this;
  }
}

const originalObserver = globalThis.ResizeObserver;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: SizedObserver,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: originalObserver,
  });
});

afterEach(() => {
  mockPreviews.length = 0;
  jest.clearAllMocks();
});

const lastPreview = () => mockPreviews[mockPreviews.length - 1];

it('reports the beats of the picture in its own deck, from the deck', () => {
  const view = render(<VisDeck height={200} />);
  expect(lastPreview()?.onDrawn).toBe(mockOnDrawn);
  const [isDrawing, place] =
    mockPulse.mock.calls[mockPulse.mock.calls.length - 1];
  expect(isDrawing).toBe(true);
  expect(place).toEqual({
    current: view.container.querySelector('.player-vis__stage'),
  });
});

it('reports the beats of the picture behind the curve, from behind the curve', () => {
  const view = render(<EqScreen focus={undefined} />);
  expect(lastPreview()?.onDrawn).toBe(mockOnDrawn);
  const [isDrawing, place] =
    mockPulse.mock.calls[mockPulse.mock.calls.length - 1];
  expect(isDrawing).toBe(true);
  expect(place).toEqual({
    current: view.container.querySelector('.player-eq-screen__scene'),
  });
});
