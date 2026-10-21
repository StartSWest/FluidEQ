/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Announcements of new scenes (premium 0050): what a member's app takes from
 * the server, what the admin's composer may send, and which one a member is
 * shown. The limits repeat the server's, so the composer says what is wrong
 * before anything is sent.
 */

import {
  MAX_ANNOUNCEMENT_SCENES,
  nextAnnouncement,
  parseAdminAnnouncements,
  parseAnnouncements,
  readAnnouncementDraft,
  trialEndsByDay,
  type IAnnouncement,
} from '../../../common/sceneAnnouncements';

const scene = (id: string, version = 1) => ({
  scene: id,
  version,
  names: { en: id.replace('-', ' ') },
});

const row = {
  id: 7,
  title: 'Night Drive',
  body: 'Six new scenes.',
  scenes: [scene('night-market', 2), scene('lantern-lake')],
  starts_at: '2026-10-14T10:00:00Z',
  trial_ends_at: null,
};

describe('what a member’s app reads', () => {
  it('reads an announcement with its scenes in order', () => {
    expect(parseAnnouncements([row])).toEqual([
      {
        id: 7,
        title: 'Night Drive',
        body: 'Six new scenes.',
        scenes: [
          {
            sceneId: 'night-market',
            version: 2,
            names: { en: 'night market' },
          },
          {
            sceneId: 'lantern-lake',
            version: 1,
            names: { en: 'lantern lake' },
          },
        ],
        startsAt: Date.parse('2026-10-14T10:00:00Z'),
      },
    ]);
  });

  // The card's line about a trial ending offered Plus, which is not sold any
  // more: a row that still carries the end reads as one without it.
  it('reads past the trial end a row still carries', () => {
    const [read] = parseAnnouncements([
      { ...row, trial_ends_at: '2026-10-15T08:00:00Z' },
    ]);
    expect(read).toBeDefined();
    expect(read && 'trialEndsAt' in read).toBe(false);
  });

  it('passes over a row that does not read and keeps the rest', () => {
    expect(
      parseAnnouncements([
        { ...row, id: 'x' },
        { ...row, id: 8 },
      ]).map((entry) => entry.id),
    ).toEqual([8]);
  });

  it('drops a scene that does not read, and an announcement left with none', () => {
    const [read] = parseAnnouncements([
      { ...row, scenes: [scene('Bad Id'), scene('alpine')] },
    ]);
    expect(read?.scenes.map((entry) => entry.sceneId)).toEqual(['alpine']);
    expect(parseAnnouncements([{ ...row, scenes: [scene('Bad Id')] }])).toEqual(
      [],
    );
  });

  it('cleans the title of characters that hide what it says', () => {
    const [read] = parseAnnouncements([{ ...row, title: 'Night​ Drive‮' }]);
    expect(read?.title).toBe('Night Drive');
  });
});

describe('what the admin’s page reads', () => {
  it('needs every row to read, with its audience', () => {
    const admin = { ...row, audience: 'members', created_at: row.starts_at };
    expect(parseAdminAnnouncements([admin])?.[0]?.audience).toBe('members');
    expect(
      parseAdminAnnouncements([admin, { ...admin, audience: 'nobody' }]),
    ).toBeUndefined();
  });
});

describe('what the composer may send', () => {
  const draft = {
    title: 'Night Drive',
    body: '',
    scenes: ['night-market', 'lantern-lake'],
    startsAt: Date.parse('2026-10-14T10:00:00Z'),
    audience: 'everyone',
  };

  it('takes a new one and a change to one not yet out', () => {
    expect(readAnnouncementDraft(draft)).toEqual(draft);
    expect(readAnnouncementDraft({ ...draft, id: 4 })?.id).toBe(4);
  });

  it('refuses what the server would refuse', () => {
    expect(readAnnouncementDraft({ ...draft, title: '   ' })).toBeUndefined();
    expect(
      readAnnouncementDraft({ ...draft, title: 'x'.repeat(81) }),
    ).toBeUndefined();
    expect(readAnnouncementDraft({ ...draft, scenes: [] })).toBeUndefined();
    expect(
      readAnnouncementDraft({
        ...draft,
        scenes: Array.from(
          { length: MAX_ANNOUNCEMENT_SCENES + 1 },
          (_, index) => `scene-${index}`,
        ),
      }),
    ).toBeUndefined();
    expect(
      readAnnouncementDraft({ ...draft, scenes: ['alpine', 'alpine'] }),
    ).toBeUndefined();
    expect(
      readAnnouncementDraft({ ...draft, audience: 'nobody' }),
    ).toBeUndefined();
    expect(
      readAnnouncementDraft({ ...draft, startsAt: Number.NaN }),
    ).toBeUndefined();
  });
});

describe('which one a member is shown', () => {
  const at = (id: number): IAnnouncement => ({
    id,
    title: 't',
    body: '',
    scenes: [],
    startsAt: 0,
  });

  it('is the newest not yet seen', () => {
    expect(nextAnnouncement([at(3), at(2), at(1)], new Set([3]))?.id).toBe(2);
    expect(nextAnnouncement([at(3)], new Set([3]))).toBeUndefined();
  });
});

describe('trial ends by the admin’s own day', () => {
  it('counts each end under its local calendar day', () => {
    const morning = new Date(2026, 9, 15, 9).getTime();
    const evening = new Date(2026, 9, 15, 21).getTime();
    const next = new Date(2026, 9, 16, 1).getTime();
    expect(trialEndsByDay([morning, evening, next])).toEqual(
      new Map([
        ['2026-10-15', 2],
        ['2026-10-16', 1],
      ]),
    );
  });
});
