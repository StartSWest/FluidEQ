/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Compact player's scene in the Backdrop is framed to its top panel the
 * moment the column appears, and to the panel as the page lays it out (Ivan,
 * 2026-10-27: "bug on restoring the one line to amp on the viz rendr").
 *
 * Unfolded from one line it was framed to the whole window instead — the
 * top third of the scene in the panel, a sun with no city — because the
 * stage read a ref to a panel not yet on the page and nothing measured
 * again; and measured during the column's opening, the panel's drawn box is
 * turned almost flat, a strip.
 */

import { render } from '@testing-library/react';
import { useState } from 'react';
import type { ISceneFrame } from 'renderer/graph/sceneGl';
import PlayerStage from 'renderer/player/PlayerStage';

let shapeFrame: ((frame: ISceneFrame) => ISceneFrame) | undefined;

jest.mock('renderer/plus/ScenePreview', () => ({
  __esModule: true,
  default: (props: { shapeFrame?: (frame: ISceneFrame) => ISceneFrame }) => {
    shapeFrame = props.shapeFrame;
    return null;
  },
}));

jest.mock('renderer/player/usePlayerScenePulse', () => ({
  __esModule: true,
  default: () => () => undefined,
}));

/** The layout jsdom does not do: each part's offset box, by class. */
interface IOffsets {
  parent: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
}

const LAYOUT: Record<string, IOffsets> = {
  'mini-player': { parent: null, left: 0, top: 0, width: 480, height: 880 },
  'player-stage': {
    parent: 'mini-player',
    left: 0,
    top: 0,
    width: 480,
    height: 880,
  },
  'player-top': {
    parent: 'mini-player',
    left: 0,
    top: 38,
    width: 480,
    height: 308,
  },
  'player-dock': {
    parent: 'player-top',
    left: 0,
    top: 200,
    width: 480,
    height: 80,
  },
};

const partOf = (element: Element) =>
  Object.keys(LAYOUT).find((name) => element.classList.contains(name));

const offset = (element: HTMLElement): IOffsets | undefined => {
  const part = partOf(element);
  return part ? LAYOUT[part] : undefined;
};

const descriptors = {
  offsetParent: {
    get(this: HTMLElement) {
      const parent = offset(this)?.parent;
      return parent ? document.querySelector(`.${parent}`) : null;
    },
  },
  offsetLeft: {
    get(this: HTMLElement) {
      return offset(this)?.left ?? 0;
    },
  },
  offsetTop: {
    get(this: HTMLElement) {
      return offset(this)?.top ?? 0;
    },
  },
  offsetWidth: {
    get(this: HTMLElement) {
      return offset(this)?.width ?? 0;
    },
  },
  offsetHeight: {
    get(this: HTMLElement) {
      return offset(this)?.height ?? 0;
    },
  },
};

const saved = Object.fromEntries(
  Object.keys(descriptors).map((name) => [
    name,
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
  ]),
);
const realObserver = globalThis.ResizeObserver;

beforeEach(() => {
  shapeFrame = undefined;
  Object.defineProperties(HTMLElement.prototype, {
    ...Object.fromEntries(
      Object.entries(descriptors).map(([name, d]) => [
        name,
        { ...d, configurable: true },
      ]),
    ),
  });
  globalThis.ResizeObserver = jest.fn(() => ({
    observe: () => undefined,
    unobserve: () => undefined,
    disconnect: () => undefined,
  })) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  Object.entries(saved).forEach(([name, descriptor]) => {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  });
  globalThis.ResizeObserver = realObserver;
});

const SCENE = {
  identity: 'neon-horizon',
  madeBy: 'FluidEQ',
  pack: {},
  label: 'Neon Horizon',
  tuning: {},
  wave: undefined,
} as unknown as Parameters<typeof PlayerStage>[0]['scene'];

/**
 * The amp in the Backdrop as `PlayerAmp` lays it out — the stage before the
 * panel on the page, the scene already loaded as it is on an unfold — with
 * the top panel turned flat by the opening.
 */
const Amp = () => {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  return (
    <div className="mini-player">
      <PlayerStage scene={SCENE} onTrouble={() => undefined} panel={panel} />
      <div
        className="player-top"
        ref={(element) => {
          setPanel(element);
          if (element) {
            // Drawn 25 px tall at the opening's first frame, laid out 308.
            element.getBoundingClientRect = () =>
              ({
                left: 0,
                top: 38,
                width: 480,
                height: 25,
                right: 480,
                bottom: 63,
              }) as DOMRect;
          }
        }}
      >
        <div className="player-dock" />
      </div>
    </div>
  );
};

describe("the Compact player's scene in the Backdrop", () => {
  it('is framed to the panel as laid out, not as the opening draws it', () => {
    const { container } = render(<Amp />);
    expect(shapeFrame).toBeDefined();
    const view = shapeFrame?.({} as ISceneFrame).view;
    expect(view?.[2]).toBeCloseTo(1);
    expect(view?.[3]).toBeCloseTo(308 / 880);
    expect(view?.[1]).toBeCloseTo(1 - 38 / 880 - 308 / 880);
    const stage = container.querySelector<HTMLElement>('.player-stage');
    expect(stage?.style.getPropertyValue('--player-panel-foot')).toBe('346px');
    expect(stage?.style.getPropertyValue('--player-frost-top')).toBe('238px');
  });
});
