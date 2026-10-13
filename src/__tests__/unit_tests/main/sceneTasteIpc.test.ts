/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the app sends about the scenes a member watches and the engine they
 * run (premium 0047, 0049), and above all what it does NOT: nothing is kept
 * or sent for an account that has not been shown terms 10, because revision
 * 9 promised nothing else about the screen was kept.
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
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IAccountConfig } from '../../../common/accountConfig';
import type { TAudioEngine } from '../../../common/audioEngine';
import { memberLookId } from '../../../common/memberScenes';
import { premiumLookId } from '../../../common/scenePacks';
import {
  registerSceneTasteIpc,
  SCENE_PLAYS_SEND_AFTER_MS,
} from '../../../main/ipc/sceneTaste';
import type { IGalleryAccess } from '../../../main/plus/galleryAccess';
import { fakeResponse, ME, SOMEONE } from '../../utils/memberSceneFixtures';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://project.supabase.co/functions/v1',
} as IAccountConfig;

interface ICall {
  rpc: string;
  body: Record<string, unknown>;
}

let calls: ICall[];
let told: boolean;
let entitled: boolean;
let engine: TAudioEngine | null;
let dir: string;
let registration: ReturnType<typeof registerSceneTasteIpc>;

const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
  calls.push({
    rpc: String(input).split('/rpc/')[1] ?? '',
    body: JSON.parse(String(init?.body ?? '{}')),
  });
  return fakeResponse(204, '');
}) as unknown as typeof fetch;

const access: IGalleryAccess = {
  accountId: () => ME,
  entitled: () => entitled,
  auth: async () => ({ config, accessToken: 'token', fetchImpl }),
};

const accrue = (lookId: string, seconds: number) => {
  const handler = handlers.get('scene-play-accrue');
  if (!handler) {
    throw new Error('no handler');
  }
  return handler({}, lookId, seconds);
};

beforeEach(() => {
  handlers.clear();
  calls = [];
  told = true;
  entitled = true;
  engine = 'fluid';
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-taste-'));
  registration = registerSceneTasteIpc({
    userDataDir: dir,
    access,
    toldOf: (version) => told && version === 10,
    getEngine: () => engine,
    // A clock that never moves: seconds arriving never send by themselves
    // (that waits five minutes), so each case sends exactly when it says.
    now: () => 0,
  });
});

afterEach(() => {
  registration.dispose();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('scene time and the engine', () => {
  it('sends the engine and the day’s scenes once the member was told', async () => {
    await accrue(premiumLookId('alpine'), 90);
    await accrue(memberLookId(SOMEONE, 'lava-lamp'), 30);
    await registration.uploadIfDue('a test');
    const rpcs = calls.map((call) => call.rpc);
    expect(rpcs).toContain('report_audio_engine');
    expect(rpcs).toContain('record_scene_plays');
    const plays = calls.find((call) => call.rpc === 'record_scene_plays');
    expect(plays?.body.p_plays).toEqual([
      { author: null, scene: 'alpine', seconds: 90 },
      { author: SOMEONE, scene: 'lava-lamp', seconds: 30 },
    ]);
    expect(
      calls.find((call) => call.rpc === 'report_audio_engine')?.body,
    ).toEqual({ p_engine: 'fluid' });
  });

  it('keeps and sends nothing for a member not yet shown terms 10', async () => {
    told = false;
    await accrue(premiumLookId('alpine'), 90);
    await registration.uploadIfDue('a test');
    expect(calls).toEqual([]);
    // Told later, the seconds from before are still not there to send.
    told = true;
    await registration.uploadIfDue('a test');
    expect(calls.map((call) => call.rpc)).toEqual(['report_audio_engine']);
  });

  it('keeps nothing without Plus', async () => {
    entitled = false;
    await accrue(premiumLookId('alpine'), 90);
    await registration.uploadIfDue('a test');
    expect(calls).toEqual([]);
  });

  it('sends the engine again only when it changes', async () => {
    await registration.uploadIfDue('a test');
    await registration.uploadIfDue('a test');
    engine = 'apo';
    await registration.uploadIfDue('a test');
    expect(
      calls
        .filter((call) => call.rpc === 'report_audio_engine')
        .map((call) => call.body.p_engine),
    ).toEqual(['fluid', 'apo']);
  });

  // Ivan, 2026-10-12: a scene put on the graph read "Not played" on the
  // account for most of an hour, the old wait between sends.
  it('sends a playing scene’s seconds by themselves, five minutes after the last send', async () => {
    registration.dispose();
    let clock = SCENE_PLAYS_SEND_AFTER_MS;
    // A send starts by asking for the engine before anything is awaited, so
    // the asks say whether seconds arriving started one.
    const getEngine = jest.fn(() => engine);
    registration = registerSceneTasteIpc({
      userDataDir: dir,
      access,
      toldOf: (version) => told && version === 10,
      getEngine,
      now: () => clock,
    });
    // Joins the send the seconds started, so it lands before the next step.
    const settle = () => registration.uploadIfDue('settled');
    // The account shows a scene within minutes of it going on the graph.
    expect(SCENE_PLAYS_SEND_AFTER_MS).toBeLessThanOrEqual(5 * 60 * 1000);

    // Nothing sent yet: the first minute of a scene goes out at once.
    accrue(premiumLookId('alpine'), 60);
    expect(getEngine).toHaveBeenCalledTimes(1);
    await settle();

    clock += SCENE_PLAYS_SEND_AFTER_MS - 1;
    accrue(premiumLookId('alpine'), 60);
    expect(getEngine).toHaveBeenCalledTimes(1);

    clock += 1;
    accrue(premiumLookId('alpine'), 60);
    expect(getEngine).toHaveBeenCalledTimes(2);
    await settle();
    expect(
      calls
        .filter((call) => call.rpc === 'record_scene_plays')
        .map((call) => call.body.p_plays),
    ).toEqual([
      [{ author: null, scene: 'alpine', seconds: 60 }],
      [{ author: null, scene: 'alpine', seconds: 120 }],
    ]);
  });

  it('counts nothing for a look that is not a scene, and caps one report', async () => {
    await accrue('bars', 90);
    await accrue(premiumLookId('alpine'), 10_000);
    await registration.uploadIfDue('a test');
    const plays = calls.find((call) => call.rpc === 'record_scene_plays');
    expect(plays?.body.p_plays).toEqual([
      { author: null, scene: 'alpine', seconds: 120 },
    ]);
  });
});
