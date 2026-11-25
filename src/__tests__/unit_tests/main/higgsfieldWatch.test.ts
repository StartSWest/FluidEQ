/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Higgsfield as FluidEQ last heard of it (Ivan, 2026-11-25: "I see accounts
 * don't show up ... it showed after a while and after asking the agent to
 * use it"): the last answer kept across runs and handed over at once, a
 * check that asks for the member's own server alone, and a chat's own report
 * changing the answer the moment it arrives.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { THiggsfieldAccount } from '../../../common/studioMakers';
import { createHiggsfieldWatch } from '../../../main/studioChat/higgsfieldWatch';
import type { IHiggsfieldServer } from '../../../main/studioChat/studioMakers';

const server = (
  state: IHiggsfieldServer['account']['state'],
  name = 'higgsfield',
): IHiggsfieldServer => ({ name, account: { state } });

/** A promise and the hand that settles it. */
const deferred = <T>() => {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

let dir: string;
let file: string;
let list: jest.Mock<Promise<IHiggsfieldServer[]>, []>;
let named: jest.Mock<Promise<IHiggsfieldServer | undefined>, [string]>;
let told: THiggsfieldAccount[];

const watch = () =>
  createHiggsfieldWatch({
    file,
    list,
    named,
    changed: (account) => told.push(account),
  });

const keep = (servers: { name: string; state: string }[]) =>
  fs.writeFileSync(file, JSON.stringify({ servers }));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-higgsfield-watch-'));
  file = path.join(dir, 'higgsfield.json');
  list = jest.fn(async () => []);
  named = jest.fn(async (_name: string) => undefined);
  told = [];
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('the answer the card opens on', () => {
  it('is the one kept on disk, with no Claude Code started for it', () => {
    keep([{ name: 'higgsfield', state: 'ready' }]);
    expect(watch().known()).toEqual({ state: 'ready' });
    expect(list).not.toHaveBeenCalled();
    expect(named).not.toHaveBeenCalled();
  });

  it('is nothing on a computer never checked, not "missing"', () => {
    expect(watch().known()).toBeUndefined();
    // The control: checked once and found nowhere is missing.
    keep([]);
    expect(watch().known()).toEqual({ state: 'missing' });
  });

  it('is nothing when what is kept is not what FluidEQ writes', () => {
    fs.writeFileSync(
      file,
      '{"servers":[{"name":"higgsfield","state":"hacked"}]}',
    );
    expect(watch().known()).toBeUndefined();
    fs.writeFileSync(file, 'not json');
    expect(watch().known()).toBeUndefined();
  });
});

describe('a check', () => {
  it('replaces the kept answer, and keeps the new one for the next run', async () => {
    keep([{ name: 'higgsfield', state: 'signed-out' }]);
    named.mockResolvedValue(server('ready'));
    const higgsfield = watch();
    expect(higgsfield.known()).toEqual({ state: 'signed-out' });
    await expect(higgsfield.refresh()).resolves.toEqual({ state: 'ready' });
    expect(higgsfield.known()).toEqual({ state: 'ready' });
    expect(told).toEqual([{ state: 'ready' }]);
    // The next run of the app opens on it.
    expect(watch().known()).toEqual({ state: 'ready' });
  });

  it('asks for a known server of the member’s own alone, never the whole list', async () => {
    keep([{ name: 'higgsfield', state: 'ready' }]);
    named.mockResolvedValue(server('ready'));
    await watch().refresh();
    expect(named).toHaveBeenCalledWith('higgsfield');
    expect(list).not.toHaveBeenCalled();
  });

  it('takes the whole list where that server is gone or not Higgsfield any more', async () => {
    keep([{ name: 'higgsfield', state: 'ready' }]);
    named.mockResolvedValue(undefined);
    list.mockResolvedValue([server('signed-out', 'my higgs')]);
    await expect(watch().refresh()).resolves.toEqual({ state: 'signed-out' });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('takes the whole list where nothing is known, or only a claude.ai connector', async () => {
    list.mockResolvedValue([server('ready')]);
    await expect(watch().refresh()).resolves.toEqual({ state: 'ready' });
    keep([{ name: 'claude.ai Higgsfield', state: 'ready' }]);
    await watch().refresh();
    expect(list).toHaveBeenCalledTimes(2);
    expect(named).not.toHaveBeenCalled();
  });

  it('calls the member’s own server ready on the list’s word, with no chat turn yet', async () => {
    list.mockResolvedValue([server('ready')]);
    await expect(watch().refresh()).resolves.toEqual({ state: 'ready' });
  });

  it('is shared by every ask made while it runs', async () => {
    const answer = deferred<IHiggsfieldServer[]>();
    list.mockReturnValue(answer.promise);
    const higgsfield = watch();
    const first = higgsfield.refresh();
    const second = higgsfield.refresh();
    answer.settle([server('ready')]);
    await expect(Promise.all([first, second])).resolves.toEqual([
      { state: 'ready' },
      { state: 'ready' },
    ]);
    expect(list).toHaveBeenCalledTimes(1);
    // The control: once it has ended, the next ask checks again.
    await higgsfield.refresh();
    expect(named).toHaveBeenCalledTimes(1);
  });

  it('started before a sign-in never puts back what the sign-in changed', async () => {
    const slow = deferred<IHiggsfieldServer | undefined>();
    keep([{ name: 'higgsfield', state: 'signed-out' }]);
    named.mockReturnValue(slow.promise);
    list.mockResolvedValue([server('ready')]);
    const higgsfield = watch();
    const behind = higgsfield.refresh();
    await higgsfield.listNow();
    slow.settle(server('signed-out'));
    await expect(behind).resolves.toEqual({ state: 'ready' });
    expect(higgsfield.known()).toEqual({ state: 'ready' });
  });
});

describe('a chat’s own report', () => {
  it('outranks the list, and the window is told at once', () => {
    keep([{ name: 'higgsfield', state: 'ready' }]);
    const higgsfield = watch();
    higgsfield.noteServers(new Map([['higgsfield', 'needs-auth']]));
    expect(higgsfield.known()).toEqual({ state: 'signed-out' });
    expect(told).toEqual([{ state: 'signed-out' }]);
    expect(list).not.toHaveBeenCalled();
  });

  it('makes a claude.ai connector ready only when the chat has it connected', () => {
    keep([{ name: 'claude.ai Higgsfield', state: 'ready' }]);
    const higgsfield = watch();
    expect(higgsfield.known()).toEqual({ state: 'connector' });
    higgsfield.noteServers(new Map([['claude.ai Higgsfield', 'connected']]));
    expect(higgsfield.known()).toEqual({ state: 'ready' });
  });

  it('shows a Higgsfield the list has not seen, before any list has answered', () => {
    const higgsfield = watch();
    higgsfield.noteServers(
      new Map([
        ['claude.ai Linear', 'needs-auth'],
        ['higgsfield', 'connected'],
      ]),
    );
    expect(higgsfield.known()).toEqual({ state: 'ready' });
    expect(told).toEqual([{ state: 'ready' }]);
  });

  it('says missing when the chat has no Higgsfield and nothing was listed', () => {
    const higgsfield = watch();
    higgsfield.noteServers(new Map([['claude.ai Linear', 'needs-auth']]));
    expect(higgsfield.known()).toEqual({ state: 'missing' });
  });

  it('tells the window each change once, not every turn', () => {
    keep([{ name: 'higgsfield', state: 'ready' }]);
    const higgsfield = watch();
    higgsfield.noteServers(new Map([['higgsfield', 'connected']]));
    higgsfield.noteServers(new Map([['higgsfield', 'connected']]));
    expect(told).toEqual([{ state: 'ready' }]);
  });

  it('is forgotten once the member’s servers are changed here', () => {
    keep([{ name: 'higgsfield', state: 'ready' }]);
    const higgsfield = watch();
    higgsfield.noteServers(new Map([['higgsfield', 'needs-auth']]));
    higgsfield.forgetSeen();
    expect(higgsfield.known()).toEqual({ state: 'ready' });
  });
});
