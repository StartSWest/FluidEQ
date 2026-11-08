/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import type { IStudioAgentDrawAsk } from '../../../common/studioAgent';
import useStudioAgent from '../../../renderer/studio/useStudioAgent';

/**
 * When the member's AI looks at a project, the window draws it off screen
 * and answers — and moves nothing (Ivan, 2026-11-07: "when an agent take pic
 * it should not jump into that scene ... so I can work on multiple scenes at
 * the same time"). It used to switch the Studio to the project looked at and
 * bring the Studio up, which pulled the member off the scene they were on
 * every time another scene's chat took a picture.
 */

const mockSelect = jest.fn(async (_id: string) => undefined);
jest.mock('../../../renderer/studio/studioStore', () => ({
  selectStudioProject: (id: string) => mockSelect(id),
  studioActiveId: () => 'lake',
}));
const mockPlusTab = jest.fn();
jest.mock('../../../renderer/plus/plusTabRequest', () => ({
  requestPlusTab: () => mockPlusTab(),
}));
const mockPlace = jest.fn();
jest.mock('../../../renderer/plus/plusNavigation', () => ({
  openPlusPlace: (place: string) => mockPlace(place),
}));
jest.mock('../../../renderer/studio/studioAgentDraw', () => ({
  drawForAgent: async () => ({ ok: false, reason: 'unavailable' }),
}));

let draw: ((ask: IStudioAgentDrawAsk) => void) | undefined;
const drawn = jest.fn(async (_id: number, _answer: unknown) => undefined);
const ready = jest.fn(async () => undefined);

beforeEach(() => {
  draw = undefined;
  mockSelect.mockClear();
  mockPlusTab.mockClear();
  mockPlace.mockClear();
  drawn.mockClear();
  ready.mockClear();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        onStudioAgentDraw: (listener: (ask: IStudioAgentDrawAsk) => void) => {
          draw = listener;
          return () => {
            draw = undefined;
          };
        },
        studioAgentDrawn: drawn,
        studioAgentReady: ready,
      },
    },
  });
});

function Window() {
  useStudioAgent();
  return null;
}

test('the window says it can answer once its listeners are in place', () => {
  render(<Window />);
  expect(draw).toBeDefined();
  expect(ready).toHaveBeenCalled();
});

test('a picture of another project is drawn and answered, and the Studio stays where it is', async () => {
  render(<Window />);
  await act(async () => {
    draw?.({ id: 7 } as IStudioAgentDrawAsk);
  });
  // The positive control: the ask was answered, so the window did hear it.
  expect(drawn).toHaveBeenCalledWith(7, {
    ok: false,
    reason: 'unavailable',
  });
  expect(mockSelect).not.toHaveBeenCalled();
  expect(mockPlusTab).not.toHaveBeenCalled();
  expect(mockPlace).not.toHaveBeenCalled();
});
