/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import useStudioAgent from '../../../renderer/studio/useStudioAgent';
import { useStudioAgentHold } from '../../../renderer/studio/studioAgentHold';

/**
 * When the member's AI looks at a project, the window puts it in front of
 * the member: the Studio switched to it and brought up, once per project —
 * and never while the member is in the middle of something in the Studio,
 * where a switch would send their Publish, their framing or their unsaved
 * typing to the project their AI happened to look at.
 */

const mockSelect = jest.fn(async (_id: string) => undefined);
let mockActive: string | undefined;
jest.mock('../../../renderer/studio/studioStore', () => ({
  selectStudioProject: (id: string) => mockSelect(id),
  studioActiveId: () => mockActive,
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

let show: ((projectId: string) => void) | undefined;
const ready = jest.fn(async () => undefined);

beforeEach(() => {
  show = undefined;
  mockActive = undefined;
  mockSelect.mockClear();
  mockPlusTab.mockClear();
  mockPlace.mockClear();
  ready.mockClear();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        onStudioAgentDraw: () => () => undefined,
        onStudioAgentShow: (listener: (projectId: string) => void) => {
          show = listener;
          return () => {
            show = undefined;
          };
        },
        studioAgentDrawn: async () => undefined,
        studioAgentReady: ready,
      },
    },
  });
});

function Window({ held = false }: { held?: boolean }) {
  useStudioAgent();
  useStudioAgentHold(held);
  return null;
}

const looked = (projectId: string) =>
  act(() => {
    show?.(projectId);
  });

test('the window says it can answer once its listeners are in place', () => {
  render(<Window />);
  expect(show).toBeDefined();
  expect(ready).toHaveBeenCalled();
});

test('a project the Studio is not on is switched to and brought up', () => {
  mockActive = 'lake';
  render(<Window />);
  looked('cat');
  expect(mockSelect).toHaveBeenCalledWith('cat');
  expect(mockPlusTab).toHaveBeenCalledTimes(1);
  expect(mockPlace).toHaveBeenCalledWith('studio');
});

test('the open project is brought up once, then left alone', () => {
  mockActive = 'cat';
  render(<Window />);
  looked('cat');
  looked('cat');
  looked('cat');
  expect(mockSelect).not.toHaveBeenCalled();
  expect(mockPlusTab).toHaveBeenCalledTimes(1);
});

test('nothing moves while the member is in the middle of something', () => {
  mockActive = 'lake';
  const { rerender } = render(<Window held />);
  looked('cat');
  expect(mockSelect).not.toHaveBeenCalled();
  expect(mockPlusTab).not.toHaveBeenCalled();

  // Let go, the next look does what the held one could not.
  rerender(<Window />);
  looked('cat');
  expect(mockSelect).toHaveBeenCalledWith('cat');
  expect(mockPlusTab).toHaveBeenCalledTimes(1);
});
