/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * A publication's time as one log line (`publishTimeline.ts`; Ivan,
 * 2026-11-08: "add logs to that too and server timings"): each phase since
 * the one before, the server's own steps read from its Server-Timing header,
 * and nothing from a server that sends none.
 */

import type { IAuthorised } from '../../../main/plus/galleryApi';
import { createPublishTimeline } from '../../../main/plus/publishTimeline';

const clock = (...times: number[]) => {
  const left = [...times];
  return () => left.shift() ?? 0;
};

const answering = (timing: string | null): IAuthorised => ({
  config: {} as IAuthorised['config'],
  accessToken: 'token',
  // The test environment has no Response: an answer is what the timeline
  // reads of one, its headers and its body.
  fetchImpl: (async () => ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'server-timing' ? timing : null,
    },
    json: async () => ({}),
  })) as unknown as typeof fetch,
});

it('writes each phase since the one before, the total and how it ended', () => {
  // Started at 0; read at 80; versions at 400; publish at 5400; ended at 5500.
  const timeline = createPublishTimeline({
    now: clock(0, 80, 400, 5400, 5500),
  });
  timeline.name('alpine', 69, '3.2 MB');
  timeline.phase('read');
  timeline.phase('versions');
  timeline.phase('publish');
  expect(timeline.line('published')).toBe(
    'Studio publish alpine v69 (3.2 MB): read 80 ms, versions 320 ms, publish 5.0 s; total 5.5 s; published.',
  );
});

it('keeps each function’s own steps, named by the function', async () => {
  const timeline = createPublishTimeline({ now: clock(0, 10) });
  const auth = timeline.timed(
    answering('auth;dur=120, sign;dur=40.4, total;dur=1530'),
  );
  await auth.fetchImpl?.(
    'https://x.supabase.co/functions/v1/publish-member-scene',
    {},
  );
  expect(timeline.line('published')).toBe(
    'Studio publish (no scene read): ; total 10 ms; published. Server - publish-member-scene: auth 120 ms, sign 40 ms, total 1.5 s.',
  );
});

it('adds nothing for a server that sends no timings, and passes the answer on', async () => {
  const timeline = createPublishTimeline({ now: clock(0, 10) });
  const auth = timeline.timed(answering(null));
  const response = await auth.fetchImpl?.(
    'https://x.supabase.co/functions/v1/scene-preview-media',
    {},
  );
  expect(await response?.json()).toEqual({});
  expect(timeline.line('failed: offline')).not.toContain('Server');
});
