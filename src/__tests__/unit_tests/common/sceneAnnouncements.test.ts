/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Announcements of new scenes (premium 0050): what a member's app takes from
 * the server, and which one a member is shown.
 */

import {
  nextAnnouncement,
  parseAnnouncements,
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
