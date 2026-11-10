/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Animations tab's import, from the tab's side (Ivan, 2026-11-09: "so
 * we can import animation sheets also"): files dropped anywhere on the tab
 * start one as chosen ones do, the import is told the scene's names, and
 * an animation added opens as soon as the tab has read it. The dialog
 * stands in here; it is held by its own tests. Each rule beside its
 * control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readStudioAnimation } from '../../../common/studioAnimation';
import StudioAnimations from '../../../renderer/studio/animations/StudioAnimations';
import type { IViewedAnimation } from '../../../renderer/studio/animations/useStudioAnimations';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const mockDialog = jest.fn();
jest.mock(
  '../../../renderer/studio/animations/import/StudioAnimationImport',
  () => ({
    __esModule: true,
    default: (props: {
      files: Array<{ name: string }>;
      taken: ReadonlySet<string>;
      onAdded: (names: string[]) => void;
    }) => {
      mockDialog(props);
      return (
        <div role="dialog" aria-label="import">
          <button type="button" onClick={() => props.onAdded(['whale-dive'])}>
            add
          </button>
        </div>
      );
    },
  }),
);

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

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  // jsdom's File has no arrayBuffer; Chromium's has.
  Object.defineProperty(File.prototype, 'arrayBuffer', {
    configurable: true,
    value(this: File) {
      return new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(this);
      });
    },
  });
});

beforeEach(() => {
  mockDialog.mockClear();
});

const tab = () =>
  screen.getByRole('region', { name: 'studio.animation.title' });
const drop = async (files: File[], types = ['Files']) => {
  await act(async () => {
    fireEvent.drop(tab(), { dataTransfer: { files, types } });
  });
};

describe('the Animations tab’s import', () => {
  it('starts from files dropped anywhere on the tab, told the scene’s names', async () => {
    render(
      <StudioAnimations projectId="p1" animations={[viewed('fox-trot')]} />,
    );
    await drop([new File([new Uint8Array([1, 2])], 'walk.gif')]);
    // Once the files are read, which the reader does in its own time.
    expect(
      await screen.findByRole('dialog', { name: 'import' }),
    ).toBeInTheDocument();
    const props = mockDialog.mock.calls[0][0];
    expect(props.files.map(({ name }: { name: string }) => name)).toEqual([
      'walk.gif',
    ]);
    expect([...props.taken]).toEqual(['fox-trot']);
  });

  it('control: a drop with no files starts nothing', async () => {
    render(
      <StudioAnimations projectId="p1" animations={[viewed('fox-trot')]} />,
    );
    await drop([], ['text/plain']);
    // Given the reader's time to answer, had there been anything to read.
    await drop([new File([new Uint8Array([1])], 'later.png')]);
    await screen.findByRole('dialog', { name: 'import' });
    expect(mockDialog.mock.calls[0][0].files).toHaveLength(1);
  });

  it('opens an animation added, once the tab has read it', async () => {
    const view = render(
      <StudioAnimations projectId="p1" animations={[viewed('fox-trot')]} />,
    );
    await drop([new File([new Uint8Array([1])], 'whale-dive.png')]);
    fireEvent.click(await screen.findByRole('button', { name: 'add' }));
    // Not read yet: the cards stay, and nothing pretends to be open.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tab()).toBeInTheDocument();
    view.rerender(
      <StudioAnimations
        projectId="p1"
        animations={[viewed('fox-trot'), viewed('whale-dive')]}
      />,
    );
    expect(
      screen.getByRole('region', { name: 'whale-dive' }),
    ).toBeInTheDocument();
  });
});
