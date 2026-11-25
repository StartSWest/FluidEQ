/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Publish asks to be pressed only once the project's chat is done (Ivan,
 * 2026-11-25, with Publish lit up beside "Thinking...": "only when there are
 * new changes not in the gallery AND the chat is fully done - not
 * interrupted, not limit reached"). Every state the chat can be in, each
 * against the same bench, so a quiet Publish is the chat's doing and a loud
 * one is the bench's.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type {
  IStudioChat,
  TStudioChatEntry,
  TStudioChatFailure,
} from '../../../common/studioChat';
import studioChatAtRest from '../../../renderer/studio/chat/chatAtRest';
import type { TStudioChatWork } from '../../../renderer/studio/chat/studioChatStore';
import StudioShipCard from '../../../renderer/studio/StudioShipCard';
import {
  benchPublishCall,
  type IVersionLine,
  type TPublishCall,
} from '../../../renderer/studio/versionLine';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const PROJECT = 'neon-city';

const me = (id: string): TStudioChatEntry => ({
  kind: 'me',
  id,
  text: 'make the bars taller',
});
const reply = (
  id: string,
  state: 'working' | 'done' | 'stopped' | 'failed',
  failure?: TStudioChatFailure,
): TStudioChatEntry => ({
  kind: 'claude',
  id,
  text: 'Taller bars.',
  steps: [],
  state,
  ...(failure ? { failure } : {}),
});
const chatOf = (
  entries: TStudioChatEntry[],
  over: Partial<IStudioChat> = {},
): IStudioChat => ({ projectId: PROJECT, entries, busy: false, ...over });

/** A bench with changes the gallery does not have. */
const changed: IVersionLine = {
  key: 'studio.line.changed',
  vars: { version: 21 },
  mark: 'changed',
  seeWhy: false,
  publish: 'changes',
};
/** A scene never published. */
const unpublished: IVersionLine = { ...changed, publish: 'ready' };

const NO_WORK: Record<string, TStudioChatWork> = {};

interface ICase {
  name: string;
  chat: IStudioChat | undefined;
  work?: Record<string, TStudioChatWork>;
  atRest: boolean;
}

const cases: ICase[] = [
  // At rest: nothing pending.
  { name: 'no chat at all', chat: undefined, atRest: true },
  { name: 'a chat that has said nothing yet', chat: chatOf([]), atRest: true },
  {
    name: 'a turn that finished',
    chat: chatOf([me('1'), reply('2', 'done')]),
    atRest: true,
  },
  {
    name: 'a turn that finished after an earlier one failed',
    chat: chatOf([
      me('1'),
      reply('2', 'failed', 'network'),
      me('3'),
      reply('4', 'done'),
    ]),
    atRest: true,
  },
  {
    // Another project's chat is what this window last loaded; this one's
    // last turn is not known, and nothing says it is answering.
    name: 'a project whose chat is not loaded here',
    chat: {
      ...chatOf([me('1'), reply('2', 'failed', 'limit')]),
      projectId: 'other',
    },
    atRest: true,
  },
  // Not at rest: the AI is working, or its last turn did not end well.
  {
    name: 'a reply being written ("Thinking...")',
    chat: chatOf([me('1'), reply('2', 'working')], { busy: true }),
    atRest: false,
  },
  {
    // Main says busy before the new turn's entries reach the window.
    name: 'a new turn begun whose entries have not arrived yet',
    chat: chatOf([me('1'), reply('2', 'done')], { busy: true }),
    atRest: false,
  },
  {
    name: 'a message sent and no reply begun yet',
    chat: chatOf([me('1')], { busy: true }),
    atRest: false,
  },
  {
    name: 'a card of its waiting on the member',
    chat: chatOf([me('1'), reply('2', 'working')], { busy: true }),
    work: { [PROJECT]: 'waiting' },
    atRest: false,
  },
  {
    name: 'a turn the member stopped',
    chat: chatOf([me('1'), reply('2', 'stopped')]),
    atRest: false,
  },
  ...(
    [
      'limit',
      'fable-limit',
      'signed-out',
      'network',
      'server',
      'crashed',
    ] as const
  ).map((failure): ICase => ({
    name: `a turn that failed (${failure})`,
    chat: chatOf([me('1'), reply('2', 'failed', failure)]),
    atRest: false,
  })),
  {
    name: 'a message of the member with no reply after it',
    chat: chatOf([me('1'), reply('2', 'done'), me('3')]),
    atRest: false,
  },
  {
    // Its pane folded while another project was opened: the work map still
    // says it is answering.
    name: 'a project not loaded here that is answering',
    chat: { ...chatOf([]), projectId: 'other' },
    work: { [PROJECT]: 'working' },
    atRest: false,
  },
];

describe.each(cases)('with $name', ({ chat, work, atRest }) => {
  // What the bench computes from the chat, never the case's own answer.
  const rest = () => studioChatAtRest(chat, work ?? NO_WORK, PROJECT);

  it(`is ${atRest ? 'at rest' : 'not at rest'}`, () => {
    expect(rest()).toBe(atRest);
  });

  it(`makes Publish ${atRest ? 'loud with its light' : 'quiet'} over changes`, () => {
    const call = benchPublishCall(changed, rest());
    render(
      <StudioShipCard
        unfit={false}
        onAdd={jest.fn()}
        onPlay={jest.fn()}
        publishing={false}
        onPublish={jest.fn()}
        exporting={false}
        onExport={jest.fn()}
        onSetDesktop={jest.fn()}
        settingDesktop={false}
        unfitReason={undefined}
        onShowProblems={jest.fn()}
        publishCall={call}
      />,
    );
    const publish = screen.getByRole('button', {
      name: 'studio.action.publish',
    });
    expect(publish.classList.contains('subtle')).toBe(!atRest);
    expect(publish.classList.contains('is-beckoning')).toBe(atRest);
    // Quiet is never off: the member can still publish on purpose.
    expect(publish).toBeEnabled();
  });

  it(`makes Publish ${atRest ? 'loud' : 'quiet'} for a scene never published`, () => {
    expect(benchPublishCall(unpublished, rest())).toBe<TPublishCall>(
      atRest ? 'ready' : 'quiet',
    );
  });
});

it('keeps Publish quiet while the gallery is still asked, or there is no line, however done the chat is', () => {
  expect(benchPublishCall('asking', true)).toBe('quiet');
  expect(benchPublishCall(undefined, true)).toBe('quiet');
  // The control: the same done chat over a line with changes asks.
  expect(benchPublishCall(changed, true)).toBe('changes');
  // Nothing to publish stays quiet whatever the chat does.
  expect(benchPublishCall({ ...changed, publish: 'quiet' }, true)).toBe(
    'quiet',
  );
});

it('counts every project at rest while none is open', () => {
  expect(
    studioChatAtRest(
      chatOf([reply('2', 'working')], { busy: true }),
      NO_WORK,
      undefined,
    ),
  ).toBe(true);
});
