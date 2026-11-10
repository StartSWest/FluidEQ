/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The import dialog (Ivan, 2026-11-09: "import all animation styles"):
 * files it cannot take said plainly with a way to choose others; a file of
 * several animations offering each, named apart from the scene's; a name
 * that is no name, or one taken, holding Add back; Add handing over what
 * was chosen and closing, or saying what failed. Each rule beside its
 * control. Decoding and laying out need a canvas, which jsdom has not:
 * they stand in here, and are held by their own tests.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IChosenFile } from '../../../renderer/studio/animations/import/importFiles';
import StudioAnimationImport from '../../../renderer/studio/animations/import/StudioAnimationImport';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

const mockDecode = jest.fn();
jest.mock('../../../renderer/studio/animations/import/importDecode', () => ({
  ...jest.requireActual(
    '../../../renderer/studio/animations/import/importDecode',
  ),
  decodeImport: (kind: unknown) => mockDecode(kind),
}));
jest.mock('../../../renderer/studio/animations/import/importSheet', () => ({
  composeSheet: () => undefined,
  sheetPng: async () => undefined,
}));
const mockAdd = jest.fn();
jest.mock('../../../renderer/studio/animations/import/importAdd', () => ({
  addImport: (...args: unknown[]) => mockAdd(...args),
}));

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 64, 0, 0, 0, 32, 8, 6, 0, 0, 0, 0, 0, 0, 0,
]);
const JSON_FILE: IChosenFile = {
  name: 'hero.json',
  bytes: new Uint8Array(Buffer.from('{"frames":{}}')),
};
const frame = {
  sx: 0,
  sy: 0,
  sw: 8,
  sh: 8,
  rotated: false,
  placed: { x: 0, y: 0, w: 8, h: 8 },
  source: { w: 8, h: 8 },
};
const twoClips = {
  image: { width: 16, height: 8 },
  frames: [frame, frame],
  clips: [
    { name: 'walk', order: [0] },
    { name: 'jump', order: [1] },
  ],
  width: 8,
  height: 8,
  close: jest.fn(),
};

const open = async (
  files: IChosenFile[],
  taken: ReadonlySet<string> = new Set(),
) => {
  const onClose = jest.fn();
  const onChooseAgain = jest.fn();
  const onAdded = jest.fn();
  render(
    <StudioAnimationImport
      files={files}
      taken={taken}
      onClose={onClose}
      onChooseAgain={onChooseAgain}
      onAdded={onAdded}
    />,
  );
  await act(async () => undefined);
  return { onClose, onChooseAgain, onAdded };
};
const atlas = () => [{ name: 'hero.png', bytes: PNG }, JSON_FILE];
const addButton = () =>
  screen.getByRole('button', { name: /studio\.animationImport\.add/ });
const nameBox = () =>
  screen.getByRole('textbox', { name: 'studio.animationImport.name' });

beforeEach(() => {
  mockDecode.mockReset();
  mockAdd.mockReset();
  mockDecode.mockResolvedValue(twoClips);
});

describe('the import dialog', () => {
  it('says plainly what it cannot take, and offers other files', async () => {
    const { onChooseAgain } = await open([
      JSON_FILE,
      { name: 'a.png', bytes: PNG },
      { name: 'b.png', bytes: PNG },
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animationImport.refused.mixed',
    );
    expect(mockDecode).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'studio.animationImport.again' }),
    );
    expect(onChooseAgain).toHaveBeenCalled();
  });

  it('says why a file it read had nothing to take', async () => {
    mockDecode.mockResolvedValue({ refused: 'no-frames', file: 'hero.json' });
    await open(atlas());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animationImport.refused.noFrames {"file":"hero.json"}',
    );
  });

  it('offers each animation of the file, named apart from the scene’s', async () => {
    await open(atlas(), new Set(['hero-walk']));
    expect(
      screen.getByRole('button', { name: 'hero-walk-2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'hero-jump' }),
    ).toBeInTheDocument();
    expect(addButton()).toHaveTextContent(
      'studio.animationImport.addCount {"count":2}',
    );
  });

  it('names a sequence after its frames, without their number', async () => {
    mockDecode.mockResolvedValue({
      ...twoClips,
      clips: [{ name: '', order: [0, 1] }],
    });
    await open([
      { name: 'pulse_2.png', bytes: PNG },
      { name: 'pulse_1.png', bytes: PNG },
    ]);
    expect(nameBox()).toHaveValue('pulse');
  });

  it('control: one picture keeps its name whole', async () => {
    mockDecode.mockResolvedValue({
      ...twoClips,
      clips: [{ name: '', order: [0, 1] }],
    });
    await open([{ name: 'walk_2.png', bytes: PNG }]);
    expect(nameBox()).toHaveValue('walk-2');
  });

  it('adds one fewer once one is left out', async () => {
    await open(atlas());
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'studio.animationImport.include' }),
    );
    expect(addButton()).toHaveTextContent(/^studio\.animationImport\.add$/);
  });

  it('holds Add back for a name that is no name, or one taken', async () => {
    await open(atlas(), new Set(['run']));
    fireEvent.change(nameBox(), { target: { value: '9 lives' } });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animationImport.nameRule',
    );
    expect(addButton()).toBeDisabled();
    fireEvent.change(nameBox(), { target: { value: 'run' } });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animationImport.nameTaken {"name":"run"}',
    );
    expect(addButton()).toBeDisabled();
  });

  it('control: a free name lets it be added', async () => {
    await open(atlas(), new Set(['run']));
    fireEvent.change(nameBox(), { target: { value: 'sprint' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(addButton()).toBeEnabled();
  });

  it('holds Add back past the animations a scene holds', async () => {
    const full = new Set(Array.from({ length: 31 }, (_, at) => `a${at}`));
    await open(atlas(), full);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animationImport.failed.full {"most":32}',
    );
    expect(addButton()).toBeDisabled();
  });

  it('hands over what was chosen, and says what is now in the scene', async () => {
    mockAdd.mockResolvedValue({ ok: true, added: ['hero-walk', 'hero-jump'] });
    const { onAdded } = await open(atlas());
    await act(async () => {
      fireEvent.click(addButton());
    });
    expect(mockAdd).toHaveBeenCalledWith(
      twoClips,
      expect.arrayContaining([
        expect.objectContaining({ name: 'hero-walk', include: true }),
        expect.objectContaining({ name: 'hero-jump', include: true }),
      ]),
    );
    expect(onAdded).toHaveBeenCalledWith(['hero-walk', 'hero-jump']);
  });

  it('says which failed and stays, those added no longer offered', async () => {
    mockAdd.mockResolvedValue({
      ok: false,
      added: ['hero-walk'],
      name: 'hero-jump',
      reason: 'failed',
    });
    const { onClose, onAdded } = await open(atlas());
    await act(async () => {
      fireEvent.click(addButton());
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studio.animationImport.failed.write {"name":"hero-jump","most":32}',
    );
    expect(addButton()).toHaveTextContent(/^studio\.animationImport\.add$/);
  });
});
