/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * Who this computer sends its sound to, and whose it plays — main's side of
 * Share Audio both ways, where the switches act from the first packet.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRemoteAudioLinks } from 'main/remoteAudioLinks';

let userDataDir = '';
beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-links-'));
});
afterEach(() => fs.rmSync(userDataDir, { recursive: true, force: true }));

const create = (bothWays = true) => {
  const announce = jest.fn();
  const targetsChanged = jest.fn();
  const links = createRemoteAudioLinks({
    announce,
    targetsChanged,
    bothWays,
    userDataDir,
  });
  const targets = () =>
    targetsChanged.mock.calls[targetsChanged.mock.calls.length - 1]?.[0] ?? [];
  return { announce, links, targets, targetsChanged };
};

describe('who this computer sends to', () => {
  it('sends to the computer it joined at once, which always played', () => {
    const { links, targets } = create();
    links.connected('host', 'GAMING', true);
    expect(targets()).toEqual(['host']);
  });

  it('sends to a computer that joined it only once that one says it plays', () => {
    // An older FluidEQ that joined never says, and never plays anything back.
    const { links, targets, targetsChanged } = create();
    links.connected('spoke', 'YOGA', false);
    expect(targetsChanged).not.toHaveBeenCalled();
    links.heard('spoke', { sends: true, plays: true });
    expect(targets()).toEqual(['spoke']);
    links.heard('spoke', { sends: true, plays: false });
    expect(targets()).toEqual([]);
  });

  it('stops sending to a computer that goes, and to everyone on a reset', () => {
    const { links, targets } = create();
    links.connected('a', 'A', true);
    links.connected('b', 'B', false);
    links.heard('b', { sends: true, plays: true });
    expect(targets()).toEqual(['a', 'b']);
    links.disconnected('a');
    expect(targets()).toEqual(['b']);
    links.reset();
    expect(targets()).toEqual([]);
  });
});

/** What the window sends: both switches, the pause and the link's volume. */
const ON = { send: true, play: true, paused: false, volume: 1 };

describe('group identity and local source', () => {
  it('lists an introduced computer without playing it until Receive is enabled', () => {
    const { links } = create();
    links.connected('new', 'New PC', false, 'new-id', true);
    expect(links.hears('new')).toBe(false);
    links.choose('id:new-id', ON);
    expect(links.hears('new')).toBe(true);
  });
  it('mutes one received mix, preserves its level and keeps it muted after reconnect', () => {
    const { links } = create();
    links.connected('a', 'A', true, 'first');
    links.connected('b', 'B', true, 'second');
    links.choose('id:first', { ...ON, volume: 0.4, muted: true });
    expect(links.volume('a')).toBe(0);
    expect(links.volume('b')).toBe(1);
    expect(links.switchesFor('id:first').volume).toBe(0.4);
    const restarted = create();
    restarted.links.connected('new', 'Renamed', true, 'first');
    expect(restarted.links.volume('new')).toBe(0);
    restarted.links.choose('id:first', { ...ON, volume: 0.4, muted: false });
    expect(restarted.links.volume('new')).toBe(0.4);
  });
  it('keeps identically named computers independent across renames and reconnects', () => {
    const { links, targets } = create();
    links.connected('a', 'DESKTOP', true, 'first');
    links.connected('b', 'DESKTOP', true, 'second');
    links.choose('id:first', { ...ON, send: false, volume: 0.25 });
    expect(targets()).toEqual(['b']);
    expect(links.volume('a')).toBe(0.25);
    expect(links.volume('b')).toBe(1);
    links.disconnected('a');
    links.connected('a-new', 'RENAMED', true, 'first');
    expect(links.volume('a-new')).toBe(0.25);
    expect(targets()).toEqual(['b']);
  });
  it('migrates a legacy name once without assigning its settings to a second same-name computer', () => {
    const { links } = create();
    links.choose('DESKTOP', { ...ON, volume: 0.4 });
    links.connected('a', 'DESKTOP', true, 'first');
    links.connected('b', 'DESKTOP', true, 'second');
    expect(links.volume('a')).toBe(0.4);
    expect(links.volume('b')).toBe(1);
    expect(create().links.switchesFor('id:first').volume).toBe(0.4);
  });
  it('stops all outgoing sound while preserving receiving and each Send choice, including new links', () => {
    const { links, targets } = create();
    links.connected('a', 'A', true);
    links.connected('b', 'B', true);
    links.choose('B', { ...ON, send: false });
    links.choose('@source', { ...ON, send: false });
    expect(targets()).toEqual([]);
    expect(links.hears('a')).toBe(true);
    links.connected('c', 'C', true);
    expect(targets()).toEqual([]);
    links.choose('@source', ON);
    expect(targets()).toEqual(['a', 'c']);
    expect(links.switchesFor('B').send).toBe(false);
    const restarted = create();
    expect(restarted.links.switchesFor('B').send).toBe(false);
  });
});

describe('the two switches', () => {
  it('tell the other computer what this one does, as they are and as they change', () => {
    const { announce, links, targets } = create();
    links.connected('host', 'GAMING', true);
    expect(announce).toHaveBeenLastCalledWith('host', {
      sends: true,
      plays: true,
    });
    links.choose('GAMING', { ...ON, send: false });
    expect(announce).toHaveBeenLastCalledWith('host', {
      sends: false,
      plays: true,
    });
    expect(targets()).toEqual([]);
  });

  it('decide whether what arrives is played here', () => {
    const { links } = create();
    links.connected('host', 'GAMING', true);
    expect(links.hears('host')).toBe(true);
    links.choose('GAMING', { ...ON, play: false });
    expect(links.hears('host')).toBe(false);
    expect(links.hears('stranger')).toBe(false);
  });

  it('are remembered by name, for the next link and the next launch', () => {
    const first = create();
    first.links.choose('GAMING', { ...ON, send: false });
    const next = create();
    expect(next.links.switchesFor('GAMING')).toEqual({ ...ON, send: false });
    next.links.connected('new-peer-id', 'GAMING', true);
    expect(next.targets()).toEqual([]);
  });

  it('refuse anything but two yes-or-noes and a sensible name', () => {
    const { links } = create();
    expect(() => links.choose('GAMING', { send: 'yes' })).toThrow();
    expect(() => links.choose('', { send: true, play: true })).toThrow();
    expect(() =>
      links.choose('x'.repeat(129), { send: true, play: true }),
    ).toThrow();
  });
});

describe('a computer that cannot do both', () => {
  it('only sends to the computer it joined and only plays the one that joined it', () => {
    const { announce, links, targets } = create(false);
    links.connected('host', 'GAMING', true);
    expect(announce).toHaveBeenLastCalledWith('host', {
      sends: true,
      plays: false,
    });
    expect(links.hears('host')).toBe(false);
    links.connected('spoke', 'YOGA', false);
    links.heard('spoke', { sends: true, plays: true });
    expect(announce).toHaveBeenLastCalledWith('spoke', {
      sends: false,
      plays: true,
    });
    expect(targets()).toEqual(['host']);
    expect(links.hears('spoke')).toBe(true);
  });
});
