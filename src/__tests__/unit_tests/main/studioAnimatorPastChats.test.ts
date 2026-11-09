/**
 * The animators run in their project's folder, so Claude Code keeps their
 * conversations beside the scene chat's; the scene chat's earlier chats
 * (`pastChats.ts`) must not offer them as its own.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));
const mockKnown: Set<string>[] = [];
jest.mock('../../../main/studioChat/claudeHistory', () => ({
  listClaudeHistory: async (_folder: string, known: Set<string>) => {
    mockKnown.push(known);
    return [];
  },
  loadClaudeHistory: jest.fn(),
  titleOf: () => 'title',
}));

/* eslint-disable import/first -- the mocks must be installed first */
import { animatorChatKey } from '../../../common/studioChat';
import { createTranscripts } from '../../../main/studioChat/chatTranscript';
import { createPastChats } from '../../../main/studioChat/pastChats';
/* eslint-enable import/first */

const PROJECT = '0f8a7c2e-1b2c-4d5e-8f90-123456789abc';
const OTHER = '9a8b7c6d-1b2c-4d5e-8f90-123456789abc';
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-past-'));
  mockKnown.length = 0;
  handlers.clear();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it("counts the project's animators' conversations as known, and no other project's", async () => {
  const transcripts = createTranscripts(root);
  transcripts.write(PROJECT, { sessionId: 'scene-session-1', entries: [] });
  transcripts.write(animatorChatKey(PROJECT, 'wolf-walk'), {
    sessionId: 'wolf-session-1',
    entries: [],
  });
  transcripts.write(animatorChatKey(OTHER, 'fox-trot'), {
    sessionId: 'other-session-1',
    entries: [],
  });
  const past = createPastChats({
    root,
    transcripts,
    agentProject: () => ({ ok: true, id: PROJECT, folder: root }) as never,
    fromWindow: () => true,
    isBusy: () => false,
    letGo: jest.fn(),
    activeChat: () => undefined,
  });
  await handlers.get('studio-chat-past')?.({});
  expect([...mockKnown[0]].sort()).toEqual([
    'scene-session-1',
    'wolf-session-1',
  ]);
  past.dispose();
});
