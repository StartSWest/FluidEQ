/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseSubmissionRow } from '../../../common/plusReview';

const SHA = 'ab'.repeat(32);

/** A row of `my_scene_submissions` as PostgREST sends it. */
const submission = (over: Record<string, unknown> = {}) => ({
  scene_id: 'neon-city',
  version: 3,
  category: 'cities',
  category2: null,
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  state: 'pending',
  reason: null,
  reason_note: null,
  submitted_at: '2026-09-18T10:00:00.000Z',
  decided_at: null,
  live_version: 2,
  first_version: 1,
  ...over,
});

/** A row of `admin_scene_submissions` as PostgREST sends it. */
describe('what a maker sent for review', () => {
  it('reads a scene that waits, with the version members have now', () => {
    expect(parseSubmissionRow(submission())).toEqual({
      sceneId: 'neon-city',
      version: 3,
      category: 'cities',
      names: { en: 'Neon City' },
      swatch: ['#050a1a', '#00e5cf'],
      state: 'pending',
      submittedAt: '2026-09-18T10:00:00.000Z',
      liveVersion: 2,
      firstVersion: 1,
    });
  });

  it('reads a refusal with its reason and the admin’s line', () => {
    expect(
      parseSubmissionRow(
        submission({
          state: 'rejected',
          reason: 'flashing',
          reason_note: '  The white flash\tat the drop  ',
          decided_at: '2026-09-19T08:00:00.000Z',
        }),
      ),
    ).toMatchObject({
      state: 'rejected',
      reason: 'flashing',
      reasonNote: 'The white flash at the drop',
      decidedAt: '2026-09-19T08:00:00.000Z',
    });
  });

  it('names the folder its files wait in, when the server says, and nothing else', () => {
    expect(
      parseSubmissionRow(submission({ payload_sha256: SHA })),
    ).toMatchObject({ sha256: SHA });
    // A server from before migration 0038, or a value that is not a hash.
    [undefined, 'not-a-hash', SHA.toUpperCase()].forEach((payload) => {
      expect(
        parseSubmissionRow(submission({ payload_sha256: payload })),
      ).not.toHaveProperty('sha256');
    });
  });

  it('keeps a reason and a line only on a refusal', () => {
    const approved = parseSubmissionRow(
      submission({
        state: 'approved',
        reason: 'flashing',
        reason_note: 'left over',
        decided_at: '2026-09-19T08:00:00.000Z',
      }),
    );
    expect(approved).not.toHaveProperty('reason');
    expect(approved).not.toHaveProperty('reasonNote');
  });

  it.each([
    ['a refusal without its reason', { state: 'rejected', reason: null }],
    ['a reason the server never gives', { state: 'rejected', reason: 'ugly' }],
    ['a state it does not know', { state: 'maybe' }],
    ['a scene id that is a path', { scene_id: '../../etc' }],
    ['a category it does not know', { category: 'misc' }],
    ['a version that is not a count', { version: 'three' }],
    ['no names', { names: null }],
  ])('refuses %s', (_label, over) => {
    expect(parseSubmissionRow(submission(over))).toBeUndefined();
  });
});
