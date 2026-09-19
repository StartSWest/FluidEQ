/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isRejectReason,
  parseReviewRow,
  parseSubmissionRow,
  readReviewAnswer,
  REJECT_REASONS,
} from '../../../common/plusReview';
import { MAX_VERSION_NOTE } from '../../../common/sceneVersionNote';

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
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
const queued = (over: Record<string, unknown> = {}) => ({
  author_id: AUTHOR.toUpperCase(),
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: '3',
  category: 'cities',
  category2: 'water',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  has_photo: true,
  payload_sha256: SHA,
  note: 'The rain\nfalls behind the signs now',
  submitted_at: '2026-09-18T10:00:00.000Z',
  live_version: 2,
  taken_down: false,
  author_banned: false,
  open_reports: '1',
  ...over,
});

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

describe('what waits for the admin', () => {
  it('reads the row as the answer will name it', () => {
    expect(parseReviewRow(queued())).toEqual({
      authorId: AUTHOR,
      lookId: `member:${AUTHOR}:neon-city`,
      authorName: 'Mei Tanaka',
      authorHandle: 'mei',
      sceneId: 'neon-city',
      version: 3,
      category: 'cities',
      category2: 'water',
      names: { en: 'Neon City' },
      swatch: ['#050a1a', '#00e5cf'],
      hasPhoto: true,
      sha256: SHA,
      note: 'The rain falls behind the signs now',
      submittedAt: '2026-09-18T10:00:00.000Z',
      liveVersion: 2,
      takenDown: false,
      authorBanned: false,
      openReports: 1,
    });
  });

  it('reads a scene new to the gallery, with nothing said about it', () => {
    const row = parseReviewRow(queued({ live_version: null, note: null }));
    expect(row).not.toHaveProperty('liveVersion');
    expect(row).not.toHaveProperty('note');
  });

  it.each([
    ['bytes it cannot name', { payload_sha256: 'not-a-hash' }],
    [
      'a hash in capitals, which is not the one the server keeps',
      { payload_sha256: SHA.toUpperCase() },
    ],
    ['no count of reports', { open_reports: undefined }],
    ['an author that is not an id', { author_id: 'mei' }],
    ['a scene id that is a path', { scene_id: '../etc' }],
  ])('refuses a row with %s', (_label, over) => {
    expect(parseReviewRow(queued(over))).toBeUndefined();
  });
});

describe('the admin’s answer, as it crosses from the window', () => {
  it('knows the five reasons the server accepts, and nothing else', () => {
    expect(REJECT_REASONS.every(isRejectReason)).toBe(true);
    expect(isRejectReason('ugly')).toBe(false);
    expect(isRejectReason(undefined)).toBe(false);
  });

  it('reads an approval, whatever else came with it', () => {
    expect(readReviewAnswer({ action: 'approve', reason: 'rights' })).toEqual({
      action: 'approve',
    });
  });

  it('reads a refusal with its reason and its line, cleaned', () => {
    expect(
      readReviewAnswer({
        action: 'reject',
        reason: 'rights',
        note: 'Not\nyours to share',
      }),
    ).toEqual({
      action: 'reject',
      reason: 'rights',
      note: 'Not yours to share',
    });
    expect(readReviewAnswer({ action: 'reject', reason: 'other' })).toEqual({
      action: 'reject',
      reason: 'other',
    });
  });

  it.each([
    ['nothing', undefined],
    ['an action it does not know', { action: 'delete' }],
    ['a refusal without a reason', { action: 'reject' }],
    [
      'a refusal for a reason it does not know',
      { action: 'reject', reason: 'ugly' },
    ],
    [
      'a line longer than a note may be',
      {
        action: 'reject',
        reason: 'other',
        note: 'x'.repeat(MAX_VERSION_NOTE + 1),
      },
    ],
    ['a line that is not text', { action: 'reject', reason: 'other', note: 5 }],
  ])('refuses %s', (_label, value) => {
    expect(readReviewAnswer(value)).toBeUndefined();
  });
});
