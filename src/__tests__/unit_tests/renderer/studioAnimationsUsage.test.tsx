/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the scene plays an animation, and what Delete does about it (Ivan,
 * 2026-11-10: "si no se está usando se borra; si dice se está usando, ask
 * agent to delete it and fix holes"): read from main's record of which
 * picture each artwork piece was packed from, unknown never taken for
 * unused. Each rule beside its control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readStudioAnimation } from '../../../common/studioAnimation';
import { resetRemovalsAsked } from '../../../renderer/studio/animations/animationActions';
import { usageOf } from '../../../renderer/studio/animations/animationUsage';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

describe('whether the scene plays an animation', () => {
  const swallow = 'art/swallow-flight.png';

  it('is used when a piece of the artwork came from its sheet', () => {
    expect(
      usageOf(swallow, { sources: { swallow }, regions: ['swallow'] }),
    ).toBe('used');
  });

  it('is unused when every piece is accounted for and none came from it', () => {
    expect(
      usageOf('art/fox.png', { sources: { swallow }, regions: ['swallow'] }),
    ).toBe('unused');
    // A scene with no artwork plays no animation.
    expect(usageOf('art/fox.png', { sources: {}, regions: [] })).toBe('unused');
  });

  it('control: is unknown where a piece has no record, or there is no answer', () => {
    // Packed before the record: pieces with no source.
    expect(usageOf('art/fox.png', { sources: {}, regions: ['bird'] })).toBe(
      'unknown',
    );
    expect(usageOf('art/fox.png', undefined)).toBe('unknown');
  });

  it('reads a region named in camel case against the record’s lower case', () => {
    expect(
      usageOf('art/fox.png', {
        sources: { boatsloop: 'art/boat.png' },
        regions: ['boatSloop'],
      }),
    ).toBe('unused');
  });
});

const viewed = (name: string): IViewedAnimation => {
  const animation = readStudioAnimation(name, {
    sheet: `art/${name}.png`,
    count: 4,
    columns: 4,
    fps: 8,
  });
  if (!animation) {
    throw new Error('the animation did not read');
  }
  return {
    animation,
    aspect: 1,
    bitmap: {
      width: 64,
      height: 16,
      close: jest.fn(),
    } as unknown as ImageBitmap,
  };
};

let regions: string[];
const historyCall = jest.fn(async (_request: unknown): Promise<unknown> => ({
  ok: true,
  history: undefined,
}));
const send = jest.fn(async (_message: unknown) => undefined);

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  regions = ['swallow'];
  historyCall.mockClear();
  send.mockClear();
  resetRemovalsAsked();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioAnimationHistory: historyCall,
        studioChatSend: send,
        readStudioArtworkSources: async () => ({
          ok: true,
          sources: { swallow: 'art/swallow.png' },
        }),
        readStudioPictures: async () => ({
          kind: 'atlas',
          width: 64,
          height: 64,
          pictures: [],
          regions: regions.map((id) => ({
            id,
            x: 0,
            y: 0,
            width: 8,
            height: 8,
            rotated: false,
          })),
        }),
      },
    },
  });
});

const renderTab = async () => {
  render(
    <StudioAnimations
      projectId="p1"
      animations={[viewed('swallow'), viewed('fox')]}
    />,
  );
  // Main's two answers, read when the tab reads its animations.
  await act(async () => undefined);
};

const deleteFrom = async (name: string) => {
  fireEvent.click(
    screen.getByRole('button', {
      name: `studio.animation.menu {"name":"${name}"}`,
    }),
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'studio.animation.menuDelete' }),
    );
  });
};

const requests = () => historyCall.mock.calls.map(([request]) => request);

describe('the tab', () => {
  it('tags the one animation the scene does not play', async () => {
    await renderTab();
    expect(screen.getAllByText('studio.animation.unused')).toHaveLength(1);
    const card = screen.getByText('fox').closest('li');
    expect(card).toHaveTextContent('studio.animation.unused');
  });

  it('control: tags none while a piece of the artwork has no record', async () => {
    regions = ['swallow', 'bird'];
    await renderTab();
    expect(screen.queryByText('studio.animation.unused')).toBeNull();
  });
});

describe('Delete', () => {
  it('deletes an unused animation at once, through its history, and undoes it', async () => {
    await renderTab();
    await deleteFrom('fox');
    expect(requests()).toEqual([{ action: 'delete', name: 'fox' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      'studio.animation.deleted {"name":"fox"}',
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'studio.animation.undo' }),
      );
    });
    expect(requests()).toEqual([
      { action: 'delete', name: 'fox' },
      { action: 'undelete', name: 'fox' },
    ]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('control: asks first, and deletes nothing, for one the scene plays', async () => {
    await renderTab();
    await deleteFrom('swallow');
    expect(
      screen.getByText('studio.animation.deleteLeadUsed'),
    ).toBeInTheDocument();
    expect(requests()).toEqual([]);
  });

  it('control: asks first for one whose use is not known', async () => {
    regions = ['swallow', 'bird'];
    await renderTab();
    await deleteFrom('fox');
    expect(screen.getByText('studio.animation.deleteLead')).toBeInTheDocument();
    expect(requests()).toEqual([]);
  });
});
