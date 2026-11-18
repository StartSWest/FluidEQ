/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The Tune tab's Window colours card (Ivan, 2026-11-14: "implement that",
 * the tuning mockup; 2026-11-18, the night and day editing mockup): who
 * chose each time's colours, each one written into the scene when FluidEQ's
 * colour picker is accepted, "Automatic" and "Reset" in the head for the
 * open time, and, as the publish dialog opens, every time left to the app
 * written in as the app works it out, so a published scene carries both.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
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
const AI_DAY = { surface: '#2b4f6d', accent: '#3fa4d0', glow: '#5fdf90' };
const PALETTE = {
  id: 'colours',
  names: { en: 'Colours' },
  stops: ['#2a1650', '#3b1d70', '#4a2590', '#20d8ff'],
};
const send = jest.fn();

beforeEach(() => {
  window.localStorage.clear();
  send
    .mockReset()
    .mockResolvedValue({ written: 'written', lookUpdated: false });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { writeStudioSettings: send } },
  });
});

const useCard = (pack: IScenePack) =>
  useStudioWindowColours(pack, 'project-1', {}, undefined);

function Card({ pack }: { pack: IScenePack }) {
  return <StudioWindowColours state={useCard(pack)} idle={false} />;
}

const card = (pack: IScenePack) => {
  const hook = renderHook(({ at }) => useCard(at), {
    initialProps: { at: pack },
  });
  const view = render(<Card pack={pack} />);
  return { hook, view };
};

const sent = () =>
  send.mock.calls.map(
    ([written]: [Record<string, ISceneWindowColours | null>]) => written,
  );

it("shows the AI's colours and writes an accepted one into the scene", async () => {
  const { hook } = card(memberPack({ windowColours: AI, palettes: [PALETTE] }));
  expect(hook.result.current.sourceOf('night')).toBe('ai');
  expect(
    screen.getByRole('button', { name: 'studio.settings.reset' }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', {
      name: 'graph.sceneColours.pick:graph.sceneColours.accent',
    }),
  );
  const picker = screen.getByRole('dialog', {
    name: 'graph.sceneColours.accent',
  });
  fireEvent.change(within(picker).getByLabelText('graph.sceneColours.hex'), {
    target: { value: '#ffd23f' },
  });
  // The card follows the picker as it moves, before anything is written.
  expect(screen.getAllByText('#FFD23F').length).toBeGreaterThan(0);
  expect(send).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(
      within(picker).getByRole('button', { name: 'graph.sceneColours.accept' }),
    );
  });
  expect(sent()).toEqual([{ windowColours: { ...AI, accent: '#ffd23f' } }]);
});

it('gives a time back to the app with Automatic, and resets it to what the AI chose', async () => {
  const pack = memberPack({ windowColours: AI, palettes: [PALETTE] });
  const { hook } = card(pack);
  // The AI's own: nothing to reset, and Automatic would take them away.
  expect(hook.result.current.canReset).toBe(false);
  expect(hook.result.current.canAutomatic).toBe(true);
  // The scene rebuilt with the member's change.
  const mine = { ...AI, accent: '#ffd23f' };
  hook.rerender({ at: { ...pack, windowColours: mine } });
  expect(hook.result.current.sourceOf('night')).toBe('member');
  expect(hook.result.current.canReset).toBe(true);
  await act(async () => hook.result.current.reset());
  expect(sent()).toEqual([{ windowColours: AI }]);
  await act(async () => hook.result.current.automatic());
  expect(sent()[1]).toEqual({ windowColours: null });
  // Neither touches the day, which is its own (Ivan: "any changes I do on
  // night or in day separated").
  sent().forEach((written) =>
    expect(written).not.toHaveProperty('windowColoursDay'),
  );
});

it("plays a scene that names none in its palette's colours, and says so", () => {
  const { hook } = card(memberPack({ palettes: [PALETTE] }));
  expect(hook.result.current.sourceOf('night')).toBe('palette');
  expect(hook.result.current.sourceOf('day')).toBe('palette');
  expect(hook.result.current.colours).toBeDefined();
  // Already the app's: nothing for Automatic to give back.
  expect(
    screen.getByRole('button', { name: 'studio.windowColours.automatic' }),
  ).toBeDisabled();
});

describe('the colours publishing writes in', () => {
  it('writes every time the scene names nothing for, as the app works it out', async () => {
    const { hook } = card(memberPack({ palettes: [PALETTE] }));
    const automatic = hook.result.current.colours;
    await act(async () => hook.result.current.fillAutomatic());
    expect(sent()).toEqual([
      { windowColours: automatic, windowColoursDay: automatic },
    ]);
  });

  it('writes only the time left to the app', async () => {
    const { hook } = card(
      memberPack({ windowColours: AI, palettes: [PALETTE] }),
    );
    await act(async () => hook.result.current.fillAutomatic());
    expect(sent()).toHaveLength(1);
    expect(Object.keys(sent()[0])).toEqual(['windowColoursDay']);
  });

  it('writes nothing for a scene that names both', async () => {
    const { hook } = card(
      memberPack({
        windowColours: AI,
        windowColoursDay: AI_DAY,
        palettes: [PALETTE],
      }),
    );
    await act(async () => hook.result.current.fillAutomatic());
    expect(send).not.toHaveBeenCalled();
  });

  // Colours written that way are still the app's on the card, never the
  // AI's or the member's.
  it('calls colours written in by publishing automatic', () => {
    const { hook } = card(memberPack({ palettes: [PALETTE] }));
    const automatic = hook.result.current.colours;
    if (!automatic) {
      throw new Error('no automatic colours');
    }
    hook.rerender({
      at: memberPack({
        windowColours: automatic,
        windowColoursDay: automatic,
        palettes: [PALETTE],
      }),
    });
    expect(hook.result.current.sourceOf('night')).toBe('palette');
    // CONTROL: a set unlike the app's, named, is somebody's.
    hook.rerender({
      at: memberPack({ windowColours: AI, palettes: [PALETTE] }),
    });
    expect(hook.result.current.sourceOf('night')).not.toBe('palette');
  });
});
