/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type { IAccountConfig } from 'common/accountConfig';
import { mySubmissions } from 'main/plus/reviewApi';
import { fakeResponse } from '../../utils/memberSceneFixtures';

const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
} as IAccountConfig;
const submission = {
  scene_id: 'neon-lake',
  version: 2,
  category: 'water',
  names: { en: 'Neon Lake' },
  swatch: ['#112233', '#aabbcc'],
  state: 'pending',
  submitted_at: '2026-10-27T12:00:00Z',
  live_version: 1,
  payload_sha256: 'a'.repeat(64),
};
const auth = (status: number, body: unknown) => ({
  config,
  accessToken: 'test-token',
  fetchImpl: jest.fn(async () =>
    fakeResponse(status, body),
  ) as unknown as typeof fetch,
});

test('a pending update and a true empty queue are both successful, distinct responses', async () => {
  expect(await mySubmissions(auth(200, []))).toEqual({ ok: true, rows: [] });
  const result = await mySubmissions(auth(200, [submission]));
  expect(result.ok && result.rows[0]).toMatchObject({
    sceneId: 'neon-lake',
    version: 2,
    liveVersion: 1,
    state: 'pending',
  });
});

test('an unreadable submission is a retryable failure even alongside a valid scene', async () => {
  expect(
    await mySubmissions(auth(200, [submission, { state: 'pending' }])),
  ).toEqual({ ok: false, reason: 'server' });
  expect(await mySubmissions(auth(200, { submissions: [] }))).toEqual({
    ok: false,
    reason: 'server',
  });
});

test.each([
  [401, 'signed-out'],
  [403, 'forbidden'],
  [500, 'server'],
] as const)(
  'review status %s is never mistaken for an empty queue',
  async (status, reason) => {
    expect(await mySubmissions(auth(status, {}))).toEqual({
      ok: false,
      reason,
    });
  },
);
