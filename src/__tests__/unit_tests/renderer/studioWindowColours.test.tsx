/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The Tune tab's Window colours card (Ivan, 2026-11-14: "implement that",
 * the tuning mockup): who chose the colours, each one written into the
 * scene when the picker settles, "Choose them from the palette" for the
 * colours FluidEQ works out by itself, and "Undo my changes" back to the
 * scene as it was opened.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import StudioWindowColours from 'renderer/studio/StudioWindowColours';
import useStudioWindowColours from 'renderer/studio/useStudioWindowColours';
import { memberPack } from '../../utils/memberSceneFixtures';

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const AI = { surface: '#1d2b4f', accent: '#5fd4ff', glow: '#7dffb0' };
const PALETTE = {
  id: 'colours',
  names: { en: 'Colours' },
  stops: ['#2a1650', '#3b1d70', '#4a2590', '#20d8ff'],
};
const send = jest.fn();

beforeEach(() => {
  send
    .mockReset()
    .mockResolvedValue({ written: 'written', lookUpdated: false });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { writeStudioSettings: send } },
  });
});

function Card({ pack }: { pack: IScenePack }) {
  return (
    <StudioWindowColours
      state={useStudioWindowColours(pack, 'project-1', {})}
      idle={false}
    />
  );
}

const card = (pack: IScenePack) => {
  const hook = renderHook(
    ({ at }) => useStudioWindowColours(at, 'project-1', {}),
    { initialProps: { at: pack } },
  );
  const view = render(<Card pack={pack} />);
  return { hook, view };
};

it("shows the AI's colours and writes a changed one into the scene", async () => {
  const { hook } = card(memberPack({ windowColours: AI, palettes: [PALETTE] }));
  expect(hook.result.current.source).toBe('ai');
  expect(screen.getByText('studio.windowColours.byAi')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'studio.windowColours.undo' }),
  ).toBeDisabled();
  const accent = screen.getByLabelText(
    'graph.sceneColours.pick:graph.sceneColours.accent',
  ) as HTMLInputElement;
  fireEvent.input(accent, { target: { value: '#ffd23f' } });
  // The card follows the picker as it moves, before anything is written.
  expect(screen.getByText('#FFD23F')).toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
  await act(async () => {
    accent.dispatchEvent(new Event('change'));
  });
  expect(send).toHaveBeenCalledWith({
    windowColours: { ...AI, accent: '#ffd23f' },
  });
});

it('chooses them from the palette, and undoes back to what the AI chose', async () => {
  const pack = memberPack({ windowColours: AI, palettes: [PALETTE] });
  const { hook } = card(pack);
  await act(async () => hook.result.current.choosePalette());
  const [[sent]] = send.mock.calls as [
    [{ windowColours: ISceneWindowColours }],
  ];
  expect(sent.windowColours).not.toEqual(AI);
  expect(sent.windowColours.surface).toMatch(/^#[0-9a-f]{6}$/);
  // The scene rebuilt with what was written: now the member's, and undoable.
  hook.rerender({ at: { ...pack, windowColours: sent.windowColours } });
  expect(hook.result.current.source).toBe('member');
  expect(hook.result.current.canUndo).toBe(true);
  await act(async () => hook.result.current.undo());
  expect(send).toHaveBeenLastCalledWith({ windowColours: AI });
});

it("plays a scene that names none in its palette's colours, and says so", () => {
  const { hook } = card(memberPack({ palettes: [PALETTE] }));
  expect(hook.result.current.source).toBe('palette');
  expect(hook.result.current.colours).toBeDefined();
  expect(
    screen.getByText('studio.windowColours.byPalette'),
  ).toBeInTheDocument();
  // Nothing to choose: the palette's colours are already what it plays in.
  expect(
    screen.getByRole('button', { name: 'studio.windowColours.fromPalette' }),
  ).toBeDisabled();
});
