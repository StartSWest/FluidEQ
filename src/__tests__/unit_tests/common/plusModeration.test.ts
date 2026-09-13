/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import {
  isModerationAction,
  isModerationList,
  parseModerationStatus,
  parseReportedRow,
} from '../../../common/plusModeration';

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

/** A row of `admin_reported_scenes` as PostgREST sends it. */
const row = (over: Record<string, unknown> = {}) => ({
  author_id: AUTHOR,
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: 2,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  has_photo: false,
  likes: '12',
  likes_week: 3,
  adds: '40',
  updated_at: '2026-09-10T12:00:00.000Z',
  liked: false,
  added: false,
  author_banned: false,
  taken_down_at: null,
  reports: '7',
  rights: 2,
  flashing: '4',
  offensive: 0,
  broken: 1,
  first_reported_at: '2026-09-11T08:00:00.000Z',
  last_reported_at: '2026-09-12T21:14:00.000Z',
  ...over,
});

describe('whether this account is the admin', () => {
  it('reads the admin and the scenes waiting, counts sent as text included', () => {
    expect(parseModerationStatus({ admin: true, open: '3' })).toEqual({
      admin: true,
      open: 3,
    });
  });

  it.each([
    ['a member', { admin: false, open: 5 }],
    ['an answer that is not true but truthy', { admin: 'true', open: 5 }],
    ['nothing', null],
    ['a list', [{ admin: true }]],
  ])('answers not the admin, with nothing waiting, for %s', (_label, value) => {
    expect(parseModerationStatus(value)).toEqual({ admin: false, open: 0 });
  });

  it('keeps the admin with no count when the count is unreadable', () => {
    expect(parseModerationStatus({ admin: true, open: -1 })).toEqual({
      admin: true,
      open: 0,
    });
  });
});

describe('a reported scene', () => {
  it('reads the scene, its reports by reason, and when they came', () => {
    expect(parseReportedRow(row())).toEqual({
      scene: expect.objectContaining({
        lookId: `member:${AUTHOR}:neon-city`,
        names: { en: 'Neon City' },
      }),
      authorBanned: false,
      reports: 7,
      reasons: { rights: 2, flashing: 4, offensive: 0, broken: 1 },
      firstReportedAt: '2026-09-11T08:00:00.000Z',
      lastReportedAt: '2026-09-12T21:14:00.000Z',
    });
  });

  it('says when a scene was taken down and that its maker is banned', () => {
    expect(
      parseReportedRow(
        row({
          taken_down_at: '2026-09-12T22:00:00.000Z',
          author_banned: true,
        }),
      ),
    ).toMatchObject({
      takenDownAt: '2026-09-12T22:00:00.000Z',
      authorBanned: true,
    });
  });

  it.each([
    [
      'FluidEQ’s own scene, which cannot be reported',
      { official: true, author_id: FLUIDEQ_CREATOR_ID },
    ],
    ['a row without its report count', { reports: undefined }],
    ['a negative reason count', { broken: -1 }],
    ['a reason count that is not a number', { rights: 'many' }],
    ['a scene id that is not an id', { scene_id: '../../etc' }],
  ])('refuses %s', (_label, over) => {
    expect(parseReportedRow(row(over))).toBeUndefined();
  });
});

describe('what the admin may ask for', () => {
  it('knows the two lists and the three answers, and nothing else', () => {
    expect(['open', 'taken-down'].every(isModerationList)).toBe(true);
    expect(isModerationList('all')).toBe(false);
    expect(['take-down', 'dismiss', 'restore'].every(isModerationAction)).toBe(
      true,
    );
    expect(isModerationAction('ban')).toBe(false);
    expect(isModerationAction(undefined)).toBe(false);
  });
});
