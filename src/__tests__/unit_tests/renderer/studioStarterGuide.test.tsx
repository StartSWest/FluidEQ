/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A new project's guide (Ivan, 2026-10-21, after the mockup: "lets use that
 * plan mockup like it so proceed"): it starts while the scene is the
 * starter's untouched text, its steps tick from what the member does, and it
 * ends for good on a publication the store confirms - never on the moment
 * before the store has answered, which counted a Plus member's own scene as
 * playable and closed every guide as it opened.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import STUDIO_STARTER_SOURCE from '../../../common/studioStarterSource';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { useSceneStore } from '../../../renderer/plus/sceneStore';
import StudioStartHere from '../../../renderer/studio/StudioStartHere';
import {
  closeStarterGuide,
  markStarterStep,
  resetStarterGuides,
  useStarterGuide,
} from '../../../renderer/studio/studioStarterGuide';
import useStudioStarter from '../../../renderer/studio/useStudioStarter';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: jest.fn(() => ({ owner: 'me', loading: true })),
}));

const PROJECT = 'project-1';
const PACK = 'my-first-scene';

const storeSays = (published: string[] | undefined) =>
  jest.mocked(useSceneStore).mockReturnValue({
    owner: 'me',
    loading: published === undefined,
    ...(published
      ? {
          store: {
            balance: 0,
            starterClaimed: true,
            owned: [],
            packs: [],
            published,
          } as never,
        }
      : {}),
  });

const frame = (level: number) =>
  ({ playing: true, level }) as unknown as ISceneFrame;

beforeEach(() => {
  resetStarterGuides();
  storeSays(undefined);
});

describe('the guide', () => {
  const starter = (source: string | undefined) =>
    renderHook(
      ({ text }) => {
        useStudioStarter(PROJECT, PACK, text);
        return useStarterGuide(PROJECT);
      },
      { initialProps: { text: source } },
    );

  it('starts on the untouched starter, and not on any other scene', () => {
    expect(starter(STUDIO_STARTER_SOURCE).result.current).toEqual({
      steps: [],
      closed: false,
    });
    resetStarterGuides();
    // The control: a member's own scene gets no guide.
    expect(
      starter('vec4 sceneColour(vec2 uv) { return vec4(1.0); }').result.current,
    ).toBeUndefined();
  });

  it('ticks "ask your AI" the moment the starter text changes', () => {
    const hook = starter(STUDIO_STARTER_SOURCE);
    hook.rerender({ text: `${STUDIO_STARTER_SOURCE}// changed\n` });
    expect(hook.result.current?.steps).toEqual(['asked']);
  });

  it('stays open while the store has not answered, and ends on a publication it confirms', () => {
    const hook = starter(STUDIO_STARTER_SOURCE);
    // Loading: a Plus member's own scene reads as playable then, which once
    // closed the guide; it must not.
    expect(hook.result.current).toBeDefined();
    storeSays(['another-scene']);
    hook.rerender({ text: STUDIO_STARTER_SOURCE });
    expect(hook.result.current).toBeDefined();
    storeSays([PACK]);
    hook.rerender({ text: STUDIO_STARTER_SOURCE });
    expect(hook.result.current).toBeUndefined();
  });

  it('ticks "play a song" on the first frame with music in it', () => {
    const { result } = renderHook(() => {
      const starterParts = useStudioStarter(
        PROJECT,
        PACK,
        STUDIO_STARTER_SOURCE,
      );
      return { starterParts, guide: useStarterGuide(PROJECT) };
    });
    const hear = result.current.starterParts.hear.current;
    // A quiet room is not a song.
    act(() => hear?.(frame(0.01), frame(0.01), 0));
    expect(result.current.guide?.steps).toEqual([]);
    act(() => hear?.(frame(0.3), frame(0.3), 0));
    expect(result.current.guide?.steps).toEqual(['heard']);
  });

  it('never opens again once closed', () => {
    starter(STUDIO_STARTER_SOURCE);
    act(() => closeStarterGuide(PROJECT));
    expect(starter(STUDIO_STARTER_SOURCE).result.current).toBeUndefined();
  });
});

describe('Start here', () => {
  it('ticks the steps done, says how to do the next, and offers ideas until a change is asked for', async () => {
    const onIdea = jest.fn();
    const { rerender } = renderHook(() =>
      useStudioStarter(PROJECT, PACK, STUDIO_STARTER_SOURCE),
    );
    rerender();
    render(<StudioStartHere projectId={PROJECT} onIdea={onIdea} />);
    expect(screen.getByText('studioStarter.count 0 4')).toBeInTheDocument();
    // The next step says how.
    expect(
      screen.getByText('studioStarter.step.heardHint'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'studioStarter.idea.planet' }),
    );
    expect(onIdea).toHaveBeenCalledWith('studioStarter.idea.planet');

    act(() => {
      markStarterStep(PROJECT, 'heard');
      markStarterStep(PROJECT, 'dial');
    });
    expect(screen.getByText('studioStarter.count 2 4')).toBeInTheDocument();
    expect(
      screen.getByText('studioStarter.step.askedHint'),
    ).toBeInTheDocument();

    act(() => markStarterStep(PROJECT, 'asked'));
    expect(
      screen.queryByRole('group', { name: 'studioStarter.ideas' }),
    ).toBeNull();
  });

  it('offers no ideas where there is no chat to take them', () => {
    renderHook(() => useStudioStarter(PROJECT, PACK, STUDIO_STARTER_SOURCE));
    render(<StudioStartHere projectId={PROJECT} />);
    expect(screen.getByText('studioStarter.title')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'studioStarter.ideas' }),
    ).toBeNull();
  });

  it('closes for good with its close button', async () => {
    renderHook(() => useStudioStarter(PROJECT, PACK, STUDIO_STARTER_SOURCE));
    render(<StudioStartHere projectId={PROJECT} onIdea={jest.fn()} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'studioStarter.close' }),
    );
    expect(screen.queryByText('studioStarter.title')).toBeNull();
  });
});
