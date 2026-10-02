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

describe('the two switches', () => {
  it('tell the other computer what this one does, as they are and as they change', () => {
    const { announce, links, targets } = create();
    links.connected('host', 'GAMING', true);
    expect(announce).toHaveBeenLastCalledWith('host', {
      sends: true,
      plays: true,
    });
    links.choose('GAMING', { send: false, play: true });
    expect(announce).toHaveBeenLastCalledWith('host', {
      sends: false,
      plays: true,
    });
    expect(targets()).toEqual([]);
  });

  it('decide whether what arrives is played here', () => {
    const { links } = create();
    links.connected('host', 'GAMING', true);
    expect(links.plays('host')).toBe(true);
    links.choose('GAMING', { send: true, play: false });
    expect(links.plays('host')).toBe(false);
    expect(links.plays('stranger')).toBe(false);
  });

  it('are remembered by name, for the next link and the next launch', () => {
    const first = create();
    first.links.choose('GAMING', { send: false, play: true });
    const next = create();
    expect(next.links.switchesFor('GAMING')).toEqual({
      send: false,
      play: true,
    });
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
    expect(links.plays('host')).toBe(false);
    links.connected('spoke', 'YOGA', false);
    links.heard('spoke', { sends: true, plays: true });
    expect(announce).toHaveBeenLastCalledWith('spoke', {
      sends: false,
      plays: true,
    });
    expect(targets()).toEqual(['host']);
    expect(links.plays('spoke')).toBe(true);
  });
});
