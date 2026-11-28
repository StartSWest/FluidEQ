/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, screen, within } from '@testing-library/react';
import type { IStudioChatModels } from '../../../common/studioChat';
import StudioChatModelPick from '../../../renderer/studio/chat/StudioChatModelPick';
import { resetStudioChatModelsForTesting } from '../../../renderer/studio/chat/studioChatModels';
import {
  resetChatPicksForTesting,
  setChatModel,
  useChatPicks,
} from '../../../renderer/studio/chat/chatPicks';
import { setup } from '../../utils/userEventUtils';

/**
 * The Studio chat's model picker, named as Claude Code names its models in
 * this run of the app (Ivan, 2026-11-09: "make sure model list gets updated
 * when app is restarted"), with the other versions it lists under their own
 * heading. A model Claude Code refused is in the list, said to be
 * unavailable, and cannot be chosen; a saved choice of one falls back to
 * Default and says so. A line its list did not name is still offered: on a
 * Max account the list named Fable only by its exact model, and the chat
 * called Fable "not on your Claude plan" (2026-11-25).
 */

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const NO_HAIKU: IStudioChatModels = {
  checked: true,
  lines: [
    { id: 'opus', name: 'Opus 5.5' },
    { id: 'fable', name: 'Fable 5.2' },
    { id: 'sonnet', name: 'Sonnet 5.5' },
  ],
  defaultName: 'Opus 5.5',
};

let answer: Promise<IStudioChatModels>;
/** Main telling the window Claude Code's list changed. */
let tell: ((models: IStudioChatModels) => void) | undefined;
beforeEach(() => {
  window.localStorage.clear();
  resetStudioChatModelsForTesting();
  answer = Promise.resolve(NO_HAIKU);
  tell = undefined;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioChatModels: () => answer,
        onStudioChatModels: (listener: (models: IStudioChatModels) => void) => {
          tell = listener;
          return () => undefined;
        },
      },
    },
  });
  resetChatPicksForTesting();
  setChatModel(undefined, 'default');
});

/** Shows which model the store holds, beside the picker. */
function Chosen() {
  const { model } = useChatPicks(undefined);
  return <output>{model}</output>;
}

const open = async () => {
  const view = setup(
    <>
      <StudioChatModelPick disabled={false} />
      <Chosen />
    </>,
  );
  // The answer arrives after the first paint.
  await act(async () => {
    await answer;
  });
  await view.user.click(screen.getByLabelText('studioChat.model'));
  return view;
};

const row = (name: string) => screen.getByRole('menuitem', { name });

describe("the chat's model picker", () => {
  it('names each line as Claude Code does, and what Default starts', async () => {
    await open();
    expect(row('Fable 5.2')).toBeInTheDocument();
    expect(row('Sonnet 5.5')).toBeInTheDocument();
    expect(
      within(row('studioChat.modelDefault')).getByText(
        'studioChat.modelHintDefaultNamed:Opus 5.5',
      ),
    ).toBeInTheDocument();
  });

  it('offers a known line the list did not name, under its bare name, and takes it', async () => {
    const { user } = await open();
    const haiku = row('Haiku');
    expect(haiku).not.toHaveAttribute('aria-disabled');
    expect(
      within(haiku).queryByText('studioChat.modelUnavailable'),
    ).not.toBeInTheDocument();
    await user.click(haiku);
    expect(screen.getByRole('status')).toHaveTextContent('haiku');
  });

  it('names a line Claude Code listed by its exact model as that model, and starts it by its name', async () => {
    answer = Promise.resolve({
      checked: true,
      lines: [
        { id: 'opus', name: 'Opus 5.5' },
        { id: 'fable', name: 'Fable 5.2' },
      ],
    });
    const { user } = await open();
    const fable = row('Fable 5.2');
    expect(fable).not.toHaveAttribute('aria-disabled');
    expect(
      within(fable).getByText('studioChat.modelHintFable'),
    ).toBeInTheDocument();
    await user.click(fable);
    expect(screen.getByRole('status')).toHaveTextContent('fable');
  });

  it('shows a model Claude Code refused as unavailable, and never takes it', async () => {
    answer = Promise.resolve({ ...NO_HAIKU, refused: ['fable'] });
    const { user } = await open();
    const fable = row('Fable 5.2');
    expect(fable).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(fable).getByText('studioChat.modelUnavailable'),
    ).toBeInTheDocument();
    await user.click(fable);
    expect(screen.getByRole('status')).toHaveTextContent('default');
    // Nothing happened, so the list is still open. The control: an offered
    // line is taken.
    await user.click(row('Sonnet 5.5'));
    expect(screen.getByRole('status')).toHaveTextContent('sonnet');
  });

  it('falls back to Default for a saved model Claude Code refused, and says so', async () => {
    answer = Promise.resolve({ ...NO_HAIKU, refused: ['fable'] });
    setChatModel(undefined, 'fable');
    await open();
    expect(
      within(row('Fable 5.2')).getByText('studioChat.modelUnavailableChosen'),
    ).toBeInTheDocument();
    expect(row('studioChat.modelDefault')).toHaveClass('selected');
  });

  it('keeps a saved line it did not refuse, though the list did not name it', async () => {
    setChatModel(undefined, 'haiku');
    await open();
    expect(row('Haiku')).toHaveClass('selected');
  });

  // Ivan, 2026-11-25: "the other models ... in every version".
  it('lists the other versions under their own heading, and takes one', async () => {
    answer = Promise.resolve({
      ...NO_HAIKU,
      others: [
        { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
        { id: 'claude-opus-5-1', name: 'Opus 5.1' },
      ],
    });
    const { user } = await open();
    expect(screen.getByText('studioChat.modelOthers')).toBeInTheDocument();
    const names = screen
      .getAllByRole('menuitem')
      .map((item) => item.textContent ?? '');
    // Under the lines, in Claude Code's order.
    expect(names.findIndex((name) => name.startsWith('Haiku 4.5'))).toBe(
      names.length - 2,
    );
    expect(names[names.length - 1]).toMatch(/^Opus 5\.1/);
    await user.click(row('Haiku 4.5'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'claude-haiku-4-5-20251001',
    );
  });

  // Ivan, 2026-11-09: "claude can launch new models and we want to pick up
  // smartly automatically".
  it("offers a family Anthropic added after this app, in Claude Code's words, and takes it", async () => {
    answer = Promise.resolve({
      ...NO_HAIKU,
      lines: [
        ...NO_HAIKU.lines,
        {
          id: 'mythos',
          name: 'Mythos 1',
          description: 'For the longest creative work',
        },
      ],
    });
    const { user } = await open();
    const mythos = row('Mythos 1');
    expect(
      within(mythos).getByText('For the longest creative work'),
    ).toBeInTheDocument();
    await user.click(mythos);
    expect(screen.getByRole('status')).toHaveTextContent('mythos');
  });

  // 2026-11-27: Claude Code 2.1.332 listed Fable only as
  // `claude-fable-5-2[1m]`, which the picker showed as a second Fable under
  // the other versions, and a chat had chosen it there.
  it("shows a chat that chose the id Claude Code listed Fable by on Fable's row, and keeps Fable", async () => {
    const STAND_IN = 'claude-fable-5-2[1m]';
    answer = Promise.resolve({
      ...NO_HAIKU,
      standIns: [{ id: STAND_IN, line: 'fable' }],
    });
    setChatModel(undefined, STAND_IN);
    await open();
    expect(row('Fable 5.2')).toHaveClass('selected');
    expect(screen.getAllByRole('menuitem', { name: /^Fable/ })).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(/^fable$/);
  });

  // The control: the same choice, with nothing saying what it stands for,
  // is a model no longer offered.
  it('falls back to Default for an id nothing says stands for a line', async () => {
    setChatModel(undefined, 'claude-fable-5-2[1m]');
    await open();
    expect(row('studioChat.modelDefault')).toHaveClass('selected');
    expect(screen.getByRole('status')).toHaveTextContent(
      'claude-fable-5-2[1m]',
    );
  });

  it("shows Claude Code's new list in a picker already open, with no restart", async () => {
    await open();
    expect(screen.queryByRole('menuitem', { name: /Opus 5\.6/ })).toBeNull();
    act(() => {
      tell?.({
        ...NO_HAIKU,
        lines: [{ id: 'opus', name: 'Opus 5.6' }, ...NO_HAIKU.lines.slice(1)],
        defaultName: 'Opus 5.6',
      });
    });
    expect(row('Opus 5.6')).toBeInTheDocument();
    expect(
      within(row('studioChat.modelDefault')).getByText(
        'studioChat.modelHintDefaultNamed:Opus 5.6',
      ),
    ).toBeInTheDocument();
  });

  it('offers every line under its bare name before Claude Code ever answered', async () => {
    answer = Promise.resolve({ checked: false, lines: [] });
    await open();
    ['Fable', 'Opus', 'Sonnet', 'Haiku'].forEach((name) =>
      expect(row(name)).not.toHaveAttribute('aria-disabled'),
    );
  });
});
