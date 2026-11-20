/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The Tune tab's Window colours card (Ivan, 2026-11-14: "implement that",
 * the tuning mockup). A scene has one set of window colours, the day's
 * (58d70ea7e; 2026-11-19: "pick one colour for the scene ... and when it
 * darks, it simply darks"), kept at its day's point (`SCENE_COLOURS_STOP`):
 * who chose it, each colour written into the scene there when FluidEQ's
 * colour picker is accepted, Automatic, which looks at the scene by day and
 * writes the colours it finds there at every press (4800c9c65), Reset in
 * the head, and, as the publish dialog opens, the set left to the app
 * written in as the app works it out, so a published scene carries it.
 *
 * The cases for the night and the day edited apart, and for Automatic
 * giving a time back to the app, went with the points and the old
 * Automatic.
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
import type {
  ISceneWindowColours,
  ISceneWindowColourStops,
} from 'common/sceneWindowColours';
import StudioWindowColours from 'renderer/studio/StudioWindowColours';
import useStudioWindowColours from 'renderer/studio/useStudioWindowColours';
import { sceneColourCandidates } from 'renderer/utils/automaticColours';
import { SCENE_COLOURS_STOP } from 'renderer/utils/sceneDayColours';
import type { ISceneSky } from 'renderer/utils/sceneTint';
import { memberPack } from '../../utils/memberSceneFixtures';

const mockScan = jest.fn();

jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
// The scene is never drawn here: Automatic's look at it by day is stood in
// for, and nothing else measures.
jest.mock('renderer/graph/sceneSky', () => ({
  measureStudioSky: () => Promise.resolve(undefined),
  scanStudioSky: (...args: unknown[]) => mockScan(...args),
}));

const AI = { surface: '#1d2b4f', accent: '#5fd4ff', glow: '#7dffb0' };
const PALETTE = {
  id: 'colours',
  names: { en: 'Colours' },
  stops: ['#2a1650', '#3b1d70', '#4a2590', '#20d8ff'],
};
/** What Automatic finds by day: a violet scene with an amber in it. */
const SKY: ISceneSky = {
  lightness: 0.3,
  chroma: 0.08,
  hue: 300,
  share: 0.6,
  accent: { lightness: 0.75, chroma: 0.14, hue: 70, share: 0.05 },
  active: null,
};
const send = jest.fn();

beforeEach(() => {
  window.localStorage.clear();
  mockScan.mockReset().mockResolvedValue(SKY);
  send
    .mockReset()
    .mockResolvedValue({ written: 'written', lookUpdated: false });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { writeStudioSettings: send } },
  });
});

/**
 * A pack naming `stops` as a pack read from disk carries them: the points,
 * and the first one as the set an older FluidEQ reads.
 */
const named = (
  stops: ISceneWindowColourStops,
  over: Partial<IScenePack> = {},
): IScenePack => {
  const first = stops['0'] ?? stops[SCENE_COLOURS_STOP];
  return memberPack({
    ...(first ? { windowColours: first } : {}),
    windowColourStops: stops,
    palettes: [PALETTE],
    ...over,
  });
};

/** As the Studio's AI is told to write it: the same set at "0" and "100". */
const aiPack = () => named({ '0': AI, '100': AI });

const useCard = (pack: IScenePack, build?: string) =>
  useStudioWindowColours(pack, 'project-1', {}, build);

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
    ([written]: [
      { windowColourStops: Record<string, ISceneWindowColours | null> },
    ]) => written,
  );

it("shows the AI's colours and writes an accepted one into the scene, at its day's point", async () => {
  const { hook } = card(aiPack());
  expect(hook.result.current.editing).toBe(SCENE_COLOURS_STOP);
  expect(hook.result.current.sourceOf(SCENE_COLOURS_STOP)).toBe('ai');
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
  expect(sent()).toEqual([
    {
      windowColourStops: { [SCENE_COLOURS_STOP]: { ...AI, accent: '#ffd23f' } },
    },
  ]);
});

it('resets the member’s change to what the AI chose', async () => {
  const pack = aiPack();
  const { hook } = card(pack);
  // The AI's own: nothing to reset.
  expect(hook.result.current.canReset).toBe(false);
  // The scene rebuilt with the member's change.
  const mine = { ...AI, accent: '#ffd23f' };
  hook.rerender({
    at: { ...pack, windowColourStops: { '0': AI, '100': mine } },
  });
  expect(hook.result.current.sourceOf(SCENE_COLOURS_STOP)).toBe('member');
  expect(hook.result.current.colours).toEqual(mine);
  expect(hook.result.current.canReset).toBe(true);
  await act(async () => hook.result.current.reset());
  expect(sent()).toEqual([{ windowColourStops: { [SCENE_COLOURS_STOP]: AI } }]);
});

it('looks at the scene by day at every press of Automatic, and writes another of its colours each time', async () => {
  const pack = aiPack();
  const hook = renderHook(({ at }) => useCard(at, 'build-1'), {
    initialProps: { at: pack },
  });
  expect(hook.result.current.finder.canFind).toBe(true);
  await act(async () => hook.result.current.finder.find());
  expect(mockScan).toHaveBeenCalledWith('build-1', pack, SCENE_COLOURS_STOP);
  const candidates = sceneColourCandidates(SKY, SCENE_COLOURS_STOP);
  // CONTROL: the scene gives more than one set, so a second press can move.
  expect(candidates.length).toBeGreaterThan(1);
  expect(sent()).toEqual([
    { windowColourStops: { [SCENE_COLOURS_STOP]: candidates[0] } },
  ]);
  // The scene rebuilt with it: the next press lands on the next one.
  hook.rerender({
    at: { ...pack, windowColourStops: { '0': AI, '100': candidates[0] } },
  });
  await act(async () => hook.result.current.finder.find());
  expect(sent()[1]).toEqual({
    windowColourStops: { [SCENE_COLOURS_STOP]: candidates[1] },
  });
});

it('cannot look for colours before the scene has a build to draw', () => {
  card(aiPack());
  expect(
    screen.getByRole('button', { name: 'graph.sceneColours.find' }),
  ).toBeDisabled();
});

it("plays a scene that names none in its palette's colours, and says so", () => {
  const { hook } = card(memberPack({ palettes: [PALETTE] }));
  expect(hook.result.current.sourceOf(SCENE_COLOURS_STOP)).toBe('palette');
  expect(hook.result.current.colours).toBeDefined();
  expect(
    screen.getByText('graph.sceneColours.sourcePalette'),
  ).toBeInTheDocument();
});

describe('the colours publishing writes in', () => {
  it('writes the set the scene names nothing for, at its day’s point, as the app works it out', async () => {
    const { hook } = card(memberPack({ palettes: [PALETTE] }));
    const automatic = hook.result.current.colours;
    expect(automatic).toBeDefined();
    await act(async () => hook.result.current.fillAutomatic());
    expect(sent()).toEqual([
      { windowColourStops: { [SCENE_COLOURS_STOP]: automatic } },
    ]);
  });

  it('writes nothing for a scene that names its day’s set', async () => {
    const { hook } = card(named({ [SCENE_COLOURS_STOP]: AI }));
    await act(async () => hook.result.current.fillAutomatic());
    expect(send).not.toHaveBeenCalled();
  });

  // A project naming only its "0" - written before the points, or by an AI
  // that set only `windowColours` - wears those as its one set: publishing
  // wrote the app's own at "100", which then won, and the card called the
  // AI's colours the palette (2026-11-20).
  it('keeps the set of a scene that names only its night, and calls it the AI’s', async () => {
    const { hook } = card(named({ '0': AI }));
    expect(hook.result.current.sourceOf(SCENE_COLOURS_STOP)).toBe('ai');
    await act(async () => hook.result.current.fillAutomatic());
    expect(send).not.toHaveBeenCalled();
    // CONTROL: the same scene naming nothing is filled at its day's point.
    send.mockClear();
    const empty = card(memberPack({ palettes: [PALETTE] }));
    await act(async () => empty.hook.result.current.fillAutomatic());
    expect(send).toHaveBeenCalledTimes(1);
  });

  // Colours written that way are still the app's on the card, never the
  // AI's or the member's.
  it('calls colours written in by publishing automatic', () => {
    const { hook } = card(memberPack({ palettes: [PALETTE] }));
    const automatic = hook.result.current.colours;
    if (!automatic) {
      throw new Error('no automatic colours');
    }
    hook.rerender({ at: named({ [SCENE_COLOURS_STOP]: automatic }) });
    expect(hook.result.current.sourceOf(SCENE_COLOURS_STOP)).toBe('palette');
    // CONTROL: a set unlike the app's, named, is somebody's.
    hook.rerender({ at: aiPack() });
    expect(hook.result.current.sourceOf(SCENE_COLOURS_STOP)).not.toBe(
      'palette',
    );
  });
});
