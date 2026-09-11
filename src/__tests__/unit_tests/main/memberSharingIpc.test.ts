/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
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
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import type { IEntitlementStatus } from '../../../main/account/entitlement';
import {
  registerMemberSharingIpc,
  type TExportOutcome,
  type TImportOutcome,
} from '../../../main/ipc/memberSharing';
import { writeStarterProject } from '../../../main/memberScenes/project';
import {
  createMemberSceneStore,
  memberSceneFingerprint,
  type IMemberSceneStore,
} from '../../../main/memberScenes/store';
import {
  fakeResponse,
  ME,
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config: IAccountConfig = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '$5',
};

const invoke = <T>(channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`no handler for ${channel}`);
  }
  return handler({}, ...args) as T;
};

const json = (body: unknown, status = 200) => fakeResponse(status, body);

let root: string;
let status: IEntitlementStatus;
let saveTarget: string | undefined;
let openTarget: string | undefined;
let blockList: string[];
let calls: string[];
let store: IMemberSceneStore;
let announced: number;
let folder: string | undefined;

/** The server: signs whatever pack arrives, as the author it is told. */
const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push(url.replace(/\?.*$/, ''));
  if (url.endsWith('/sign-member-scene')) {
    const { pack } = JSON.parse(String(init?.body));
    return json({
      envelope: signedEnvelope(
        memberPayload({ author: ME, name: 'Ivan', pack }),
      ),
    });
  }
  if (url.includes('/rest/v1/blocked_scenes')) {
    return json(blockList.map((fingerprint) => ({ fingerprint })));
  }
  if (url.endsWith('/rpc/scene_like_status')) {
    return json([{ likes: '4', liked: true }]);
  }
  return json(null);
}) as unknown as typeof fetch;

const setup = () => {
  store = createMemberSceneStore({
    userDataDir: path.join(root, 'userData'),
    appVersion: '1.0.0',
  });
  return registerMemberSharingIpc({
    getMainWindow: () => null,
    userDataDir: path.join(root, 'userData'),
    config,
    session: {
      state: () => ({ status: 'signed-in', identity: { id: ME } }),
      accessToken: async () => 'token',
    } as never,
    entitlement: {
      status: () => status,
      subscribe: () => () => undefined,
    } as never,
    store,
    linkedFolder: () => folder,
    announce: () => {
      announced += 1;
    },
    dialogImpl: {
      showSaveDialog: (async () => {
        calls.push('save-dialog');
        return saveTarget
          ? { canceled: false, filePath: saveTarget }
          : { canceled: true, filePath: undefined };
      }) as never,
      showOpenDialog: (async () =>
        openTarget
          ? { canceled: false, filePaths: [openTarget] }
          : { canceled: true, filePaths: [] }) as never,
    },
    fetchImpl,
  });
};

beforeEach(async () => {
  handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-sharing-ipc-'));
  status = { state: 'active' };
  saveTarget = undefined;
  openTarget = undefined;
  blockList = [];
  calls = [];
  announced = 0;
  folder = path.join(root, 'my-scene');
  fs.mkdirSync(folder);
  await writeStarterProject(folder);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('exporting a scene', () => {
  // The control: agreed, signed, written where the member chose.
  it('asks where, then signs, then writes the file', async () => {
    const registration = setup();
    saveTarget = path.join(root, 'northern-lake.json');
    const outcome = await invoke<Promise<TExportOutcome>>('studio-export', 3);
    expect(outcome).toEqual({
      ok: true,
      fileName: 'northern-lake.fluideq-scene.json',
    });
    // Where it goes is asked before anything is signed.
    expect(calls.filter((call) => !call.includes('blocked_scenes'))).toEqual([
      'save-dialog',
      `${config.apiUrl}/sign-member-scene`,
    ]);
    const written = JSON.parse(
      fs.readFileSync(
        path.join(root, 'northern-lake.fluideq-scene.json'),
        'utf8',
      ),
    );
    expect(written).toMatchObject({ schema: 1, algorithm: 'ed25519' });
    // The agreement is remembered, so the next export does not ask again.
    expect(await invoke('studio-terms-agreed')).toBe(3);
    registration.dispose();
  });

  it('signs nothing when the member closes the save dialog', async () => {
    const registration = setup();
    const outcome = await invoke<Promise<TExportOutcome>>('studio-export', 3);
    expect(outcome).toEqual({ ok: false, reason: 'cancelled' });
    expect(calls).not.toContain(`${config.apiUrl}/sign-member-scene`);
    expect(await invoke('studio-terms-agreed')).toBe(0);
    registration.dispose();
  });

  it('refuses without Plus, and without a scene that builds', async () => {
    const registration = setup();
    saveTarget = path.join(root, 'x.json');
    status = { state: 'none' };
    expect(await invoke('studio-export', 3)).toEqual({
      ok: false,
      reason: 'not-entitled',
    });
    status = { state: 'active' };
    folder = undefined;
    expect(await invoke('studio-export', 3)).toEqual({
      ok: false,
      reason: 'no-build',
    });
    expect(calls).not.toContain('save-dialog');
    registration.dispose();
  });
});

describe('opening a scene file', () => {
  const sent = (author: string, name: string | null = 'Mei Tanaka') => {
    const file = path.join(root, `${author}.fluideq-scene.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(signedEnvelope(memberPayload({ author, name }))),
    );
    return file;
  };

  // The control.
  it("keeps another member's scene as theirs, with their name", async () => {
    const registration = setup();
    openTarget = sent(SOMEONE);
    const outcome = await invoke<Promise<TImportOutcome>>(
      'member-scenes-import',
    );
    expect(outcome).toEqual({
      ok: true,
      names: memberPack().names,
      authorName: 'Mei Tanaka',
      own: false,
    });
    expect(store.list()).toMatchObject([
      { authorId: SOMEONE, own: false, authorName: 'Mei Tanaka' },
    ]);
    expect(announced).toBeGreaterThan(0);
    registration.dispose();
  });

  it('gives a member their own scene back as their own', async () => {
    const registration = setup();
    openTarget = sent(ME, 'Ivan');
    const outcome = await invoke<Promise<TImportOutcome>>(
      'member-scenes-import',
    );
    expect(outcome).toMatchObject({ ok: true, own: true });
    expect(store.list()).toMatchObject([{ authorId: ME, own: true }]);
    registration.dispose();
  });

  it('asks the block list afresh and keeps a blocked scene out', async () => {
    const registration = setup();
    blockList = [memberSceneFingerprint(SOMEONE, 'neon-city')];
    openTarget = sent(SOMEONE);
    expect(await invoke('member-scenes-import')).toEqual({
      ok: false,
      reason: 'blocked',
    });
    expect(store.list()).toEqual([]);
    registration.dispose();
  });

  it('refuses without Plus and before the dialog opens', async () => {
    const registration = setup();
    status = { state: 'none' };
    openTarget = sent(SOMEONE);
    expect(await invoke('member-scenes-import')).toEqual({
      ok: false,
      reason: 'not-entitled',
    });
    expect(store.list()).toEqual([]);
    registration.dispose();
  });
});

describe('likes over IPC', () => {
  it("likes another member's scene and answers the server's count", async () => {
    const registration = setup();
    const status = await invoke<Promise<unknown>>(
      'member-scenes-like',
      `member:${SOMEONE}:neon-city`,
      true,
    );
    expect(status).toEqual({ likes: 4, liked: true });
    expect(calls).toContain(
      'https://project.supabase.co/rest/v1/rpc/like_scene',
    );
    registration.dispose();
  });

  it('never sends a like for the member’s own scene, or for nonsense', async () => {
    const registration = setup();
    expect(
      await invoke('member-scenes-like', `member:${ME}:neon-city`, true),
    ).toBeUndefined();
    expect(
      await invoke('member-scenes-like', '../../etc', true),
    ).toBeUndefined();
    expect(
      await invoke('member-scenes-like', `member:${SOMEONE}:neon-city`, 'yes'),
    ).toBeUndefined();
    expect(calls.filter((call) => call.endsWith('/rpc/like_scene'))).toEqual(
      [],
    );
    registration.dispose();
  });
});
