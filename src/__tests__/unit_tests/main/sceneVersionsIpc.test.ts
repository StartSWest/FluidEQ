/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import { memberLookId } from '../../../common/memberScenes';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import { premiumLookId } from '../../../common/scenePacks';
import type { IVersionPins } from '../../../main/keptVersions';
import { registerSceneVersionsIpc } from '../../../main/ipc/sceneVersions';
/* eslint-enable import/first */

const MAKER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let owned: Set<string>;
let pinned: Map<string, number>;
let announcedOfficial: number;
let announcedMember: number;
let dispose: () => void;

const invoke = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no ${channel}`);
  }
  return handler({}, ...args);
};

beforeEach(() => {
  handlers.clear();
  owned = new Set([premiumLookId('alpine'), memberLookId(MAKER, 'lake')]);
  pinned = new Map();
  announcedOfficial = 0;
  announcedMember = 0;
  const pins: IVersionPins = {
    pinned: (lookId) => pinned.get(lookId),
    pin: (lookId, version) => {
      if (version === undefined) {
        pinned.delete(lookId);
      } else {
        pinned.set(lookId, version);
      }
    },
  };
  dispose = registerSceneVersionsIpc({
    pins,
    officialStore: { keptVersions: (id) => (id === 'alpine' ? [48, 47] : []) },
    memberStore: {
      keptVersions: (author, id) =>
        author === MAKER && id === 'lake' ? [2] : [],
    },
    ownership: { owns: (lookId) => owned.has(lookId) },
    announceOfficial: () => {
      announcedOfficial += 1;
    },
    announceMember: () => {
      announcedMember += 1;
    },
  });
});
afterEach(() => dispose());

describe("an owned scene's kept versions", () => {
  it('lists them, and which plays while one is pinned', () => {
    expect(invoke('scene-versions-kept', FLUIDEQ_CREATOR_ID, 'alpine')).toEqual(
      {
        versions: [48, 47],
      },
    );
    pinned.set(premiumLookId('alpine'), 47);
    expect(invoke('scene-versions-kept', FLUIDEQ_CREATOR_ID, 'alpine')).toEqual(
      {
        versions: [48, 47],
        playing: 47,
      },
    );
    expect(invoke('scene-versions-kept', MAKER, 'lake')).toEqual({
      versions: [2],
    });
  });

  it('plays a kept version and goes back to the newest, telling the right list', () => {
    expect(
      invoke('scene-versions-play', FLUIDEQ_CREATOR_ID, 'alpine', 47),
    ).toBe(true);
    expect(pinned.get(premiumLookId('alpine'))).toBe(47);
    expect(announcedOfficial).toBe(1);
    expect(
      invoke('scene-versions-play', FLUIDEQ_CREATOR_ID, 'alpine', null),
    ).toBe(true);
    expect(pinned.has(premiumLookId('alpine'))).toBe(false);
    expect(invoke('scene-versions-play', MAKER, 'lake', 2)).toBe(true);
    expect(announcedMember).toBe(1);
    expect(announcedOfficial).toBe(2);
  });

  it('refuses a version this computer did not keep, or one that is not a number', () => {
    expect(
      invoke('scene-versions-play', FLUIDEQ_CREATOR_ID, 'alpine', 40),
    ).toBe(false);
    expect(
      invoke('scene-versions-play', FLUIDEQ_CREATOR_ID, 'alpine', '47'),
    ).toBe(false);
    expect(pinned.size).toBe(0);
    expect(announcedOfficial).toBe(0);
  });
});

describe('a scene this account does not own', () => {
  it('has no versions to show and none to play', () => {
    owned.clear();
    expect(invoke('scene-versions-kept', FLUIDEQ_CREATOR_ID, 'alpine')).toEqual(
      {
        versions: [],
      },
    );
    expect(
      invoke('scene-versions-play', FLUIDEQ_CREATOR_ID, 'alpine', 47),
    ).toBe(false);
    expect(pinned.size).toBe(0);
  });

  it('ignores a pin an earlier owner left behind', () => {
    pinned.set(premiumLookId('alpine'), 47);
    owned.clear();
    expect(invoke('scene-versions-kept', FLUIDEQ_CREATOR_ID, 'alpine')).toEqual(
      {
        versions: [],
      },
    );
  });

  it('refuses a malformed scene reference', () => {
    expect(invoke('scene-versions-kept', 42, 'alpine')).toEqual({
      versions: [],
    });
    expect(invoke('scene-versions-play', MAKER, '../lake', 2)).toBe(false);
  });
});
