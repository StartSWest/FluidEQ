/**
 * @jest-environment node
 */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The animations' own chats are gone (Ivan, 2026-11-10: "remove that second
 * chat and make the root chat work on animations and all"): what they left
 * in the Studio chat's folder is taken away once, without following a link
 * out of it, their conversations kept from being offered as the scene's own
 * earlier chats, and a saved reply that started an animator still reads.
 */

jest.mock('electron', () => ({ ipcMain: {} }));

/* eslint-disable import/first -- the mock above must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readEntry } from '../../../main/studioChat/chatTranscript';
import removeAnimatorChats, {
  readRetiredSessions,
} from '../../../main/studioChat/oldAnimatorChats';
/* eslint-enable import/first */

let root: string;
let outside: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-chats-'));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-chats-out-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

describe("the old animators' chats", () => {
  it("are removed with their folders, the scene's own chat kept, and nothing behind a link touched", () => {
    const scene = path.join(root, 'project-1');
    const animator = path.join(
      root,
      encodeURIComponent('project-1#animator:whale-dive'),
    );
    fs.mkdirSync(scene);
    fs.writeFileSync(path.join(scene, 'chat.json'), '{}');
    fs.mkdirSync(animator);
    fs.writeFileSync(path.join(animator, 'chat.json'), '{}');
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'mine');
    fs.symlinkSync(outside, path.join(animator, 'linked'), 'junction');

    expect(removeAnimatorChats(root, () => 'session-whale')).toBe(1);
    expect(fs.existsSync(animator)).toBe(false);
    // The control: the scene's chat is as it was.
    expect(fs.readFileSync(path.join(scene, 'chat.json'), 'utf8')).toBe('{}');
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe(
      'mine',
    );
    expect(readRetiredSessions(root)).toEqual(['session-whale']);
  });

  it('leave nothing to do, and write nothing, where there were none', () => {
    fs.mkdirSync(path.join(root, 'project-1'));
    expect(removeAnimatorChats(root, () => 'never')).toBe(0);
    expect(fs.existsSync(path.join(root, 'retired-sessions.json'))).toBe(false);
  });
});

describe('a saved reply that started an animator', () => {
  const reply = (kind: string) =>
    readEntry({
      kind: 'claude',
      id: 'r1',
      text: 'Handed it on.',
      state: 'done',
      steps: [
        { id: 's1', kind: 'read', state: 'done' },
        { id: 's2', kind, state: 'done', file: 'whale-dive' },
      ],
    });

  it('still reads, the step shown as another kind, and an unknown kind is still left out', () => {
    const old = reply('animator');
    expect(
      old?.kind === 'claude' && old.steps.map((step) => step.kind),
    ).toEqual(['read', 'other']);
    const unknown = reply('teleport');
    expect(
      unknown?.kind === 'claude' && unknown.steps.map((step) => step.kind),
    ).toEqual(['read']);
  });
});
