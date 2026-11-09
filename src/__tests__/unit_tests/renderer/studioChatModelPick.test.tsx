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
  setStudioChatModel,
  useStudioChat,
} from '../../../renderer/studio/chat/studioChatStore';
import { setup } from '../../utils/userEventUtils';

/**
 * The Studio chat's model picker, named as Claude Code names its models in
 * this run of the app (Ivan, 2026-11-09: "make sure model list gets updated
 * when app is restarted"): a line the member's plan lacks is in the list,
 * said to be unavailable, and cannot be chosen; a saved choice of one falls
 * back to Default and says so.
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
beforeEach(() => {
  window.localStorage.clear();
  resetStudioChatModelsForTesting();
  answer = Promise.resolve(NO_HAIKU);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { studioChatModels: () => answer } },
  });
  setStudioChatModel('default');
});

/** Shows which model the store holds, beside the picker. */
function Chosen() {
  const { model } = useStudioChat();
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

  it('shows a line the plan lacks as unavailable, and never takes it', async () => {
    const { user } = await open();
    const haiku = row('Haiku');
    expect(haiku).toHaveAttribute('aria-disabled', 'true');
    expect(
      within(haiku).getByText('studioChat.modelUnavailable'),
    ).toBeInTheDocument();
    await user.click(haiku);
    expect(screen.getByRole('status')).toHaveTextContent('default');
    // Nothing happened, so the list is still open. The control: an offered
    // line is taken.
    await user.click(row('Sonnet 5.5'));
    expect(screen.getByRole('status')).toHaveTextContent('sonnet');
  });

  it('falls back to Default for a saved line the plan lacks, and says so', async () => {
    setStudioChatModel('haiku');
    await open();
    expect(
      within(row('Haiku')).getByText('studioChat.modelUnavailableChosen'),
    ).toBeInTheDocument();
    expect(row('studioChat.modelDefault')).toHaveClass('selected');
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

  it('offers every line under its bare name before Claude Code ever answered', async () => {
    answer = Promise.resolve({ checked: false, lines: [] });
    await open();
    ['Fable', 'Opus', 'Sonnet', 'Haiku'].forEach((name) =>
      expect(row(name)).not.toHaveAttribute('aria-disabled'),
    );
  });
});
