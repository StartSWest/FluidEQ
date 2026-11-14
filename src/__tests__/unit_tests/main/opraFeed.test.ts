/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type { IOpraDatabaseManifest } from '../../../common/profileTypes';
import {
  IOpraFeedState,
  OPRA_CHECK_INTERVAL_MS,
  OPRA_MANIFEST_URL,
  parseOpraFeedState,
  rateLimitResetAt,
  readOpraManifest,
} from '../../../main/opraFeed';

const NOW = Date.parse('2026-11-13T19:50:33Z');
const HOUR = 60 * 60 * 1000;

const manifest = (contentHash: string): IOpraDatabaseManifest => ({
  version: 1,
  contentHash,
  vendorCount: 714,
  productCount: 12594,
  curveCount: 20000,
  generatedAt: '2026-11-05T06:23:00Z',
});

const OLD = manifest('old');
const NEW = manifest('new');

/** A fetch that answers once with `response` and records what it was sent. */
const answering = (response: Response) =>
  jest.fn(async (_url: string, _init: RequestInit) => response);

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

const sentHeaders = (request: jest.Mock) =>
  (request.mock.calls[0][1] as RequestInit).headers as Record<string, string>;

describe('asking for the OPRA manifest', () => {
  it('asks nobody within a day of the last answer', async () => {
    const request = answering(json(NEW));
    const state: IOpraFeedState = { checkedAt: NOW - HOUR, latest: OLD };
    const answer = await readOpraManifest(state, NOW, request);
    expect(request).not.toHaveBeenCalled();
    expect(answer.outcome).toBe('remembered');
    expect(answer.latest).toBe(OLD);
  });

  it('asks again once the day has passed, from the release download and not the API', async () => {
    const request = answering(json(NEW, { etag: '"v2"' }));
    const state: IOpraFeedState = {
      checkedAt: NOW - OPRA_CHECK_INTERVAL_MS - 1,
      latest: OLD,
    };
    const answer = await readOpraManifest(state, NOW, request);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(OPRA_MANIFEST_URL);
    expect(OPRA_MANIFEST_URL).toMatch(
      /^https:\/\/github\.com\/.*\/releases\/download\//,
    );
    expect(answer.outcome).toBe('read');
    expect(answer.latest).toEqual(NEW);
    expect(answer.state).toEqual({
      checkedAt: NOW,
      etag: '"v2"',
      lastModified: undefined,
      latest: NEW,
    });
  });

  it('asks on a first launch, without validators it has nothing to back', async () => {
    const request = answering(json(NEW));
    await readOpraManifest({ etag: '"stale"' }, NOW, request);
    expect(sentHeaders(request)['If-None-Match']).toBeUndefined();
  });

  it('keeps the current manifest on a 304, having sent its validators', async () => {
    const request = answering(new Response(null, { status: 304 }));
    const state: IOpraFeedState = {
      checkedAt: NOW - 2 * OPRA_CHECK_INTERVAL_MS,
      etag: '"v1"',
      lastModified: 'Wed, 05 Nov 2026 06:23:00 GMT',
      latest: OLD,
    };
    const answer = await readOpraManifest(state, NOW, request);
    expect(sentHeaders(request)['If-None-Match']).toBe('"v1"');
    expect(sentHeaders(request)['If-Modified-Since']).toBe(
      'Wed, 05 Nov 2026 06:23:00 GMT',
    );
    expect(answer.outcome).toBe('unchanged');
    expect(answer.latest).toBe(OLD);
    // The day starts again from this answer, validators kept.
    expect(answer.state).toMatchObject({ checkedAt: NOW, etag: '"v1"' });
  });

  it('takes a new manifest when the server has one (the control for the 304)', async () => {
    const request = answering(json(NEW, { etag: '"v2"' }));
    const state: IOpraFeedState = {
      checkedAt: NOW - 2 * OPRA_CHECK_INTERVAL_MS,
      etag: '"v1"',
      latest: OLD,
    };
    const answer = await readOpraManifest(state, NOW, request);
    expect(answer.latest).toEqual(NEW);
    expect(answer.state.etag).toBe('"v2"');
  });

  it('stays away until a 403 says the limit lifts, quietly', async () => {
    const resetSeconds = Math.floor(NOW / 1000) + 600;
    const request = answering(
      new Response('rate limited', {
        status: 403,
        headers: { 'x-ratelimit-reset': String(resetSeconds) },
      }),
    );
    const answer = await readOpraManifest({ latest: OLD }, NOW, request);
    expect(answer.outcome).toBe('rate-limited');
    expect(answer.latest).toBe(OLD);
    expect(answer.state.notBefore).toBe(resetSeconds * 1000);

    // Before the reset nothing is asked, however many launches there are.
    const again = answering(json(NEW));
    const later = await readOpraManifest(
      answer.state,
      NOW + 5 * 60 * 1000,
      again,
    );
    expect(again).not.toHaveBeenCalled();
    expect(later.outcome).toBe('rate-limited');

    // The control: once it has passed, the next launch asks.
    const after = answering(json(NEW));
    const lifted = await readOpraManifest(
      answer.state,
      resetSeconds * 1000 + 1,
      after,
    );
    expect(after).toHaveBeenCalledTimes(1);
    expect(lifted.outcome).toBe('read');
    expect(lifted.state.notBefore).toBeUndefined();
  });

  it('reads a 429’s Retry-After', async () => {
    const request = answering(
      new Response(null, { status: 429, headers: { 'retry-after': '120' } }),
    );
    const answer = await readOpraManifest({}, NOW, request);
    expect(answer.state.notBefore).toBe(NOW + 120 * 1000);
  });

  it('asks again tomorrow, not next launch, while nothing is published', async () => {
    const request = answering(new Response('Not Found', { status: 404 }));
    const answer = await readOpraManifest({}, NOW, request);
    expect(answer.outcome).toBe('missing');
    expect(answer.state.checkedAt).toBe(NOW);
  });

  it('fails loudly on anything else, so a real fault is still seen', async () => {
    await expect(
      readOpraManifest({}, NOW, answering(new Response('', { status: 500 }))),
    ).rejects.toThrow('HTTP 500');
    await expect(
      readOpraManifest({}, NOW, answering(json({ version: 2 }))),
    ).rejects.toThrow('not a manifest');
  });
});

describe('the reset a rate limit names', () => {
  it('falls back to an hour when the answer names none', () => {
    expect(rateLimitResetAt(new Headers(), NOW)).toBe(NOW + HOUR);
  });
});

describe('the remembered state', () => {
  it('keeps what it recognises and drops the rest', () => {
    expect(parseOpraFeedState(undefined)).toEqual({});
    expect(parseOpraFeedState('not json')).toEqual({});
    expect(
      parseOpraFeedState(
        JSON.stringify({ checkedAt: NOW, etag: 7, latest: { version: 9 } }),
      ),
    ).toEqual({
      checkedAt: NOW,
      notBefore: undefined,
      etag: undefined,
      lastModified: undefined,
      latest: undefined,
    });
    expect(parseOpraFeedState(JSON.stringify({ latest: OLD })).latest).toEqual(
      OLD,
    );
  });
});
