/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IReviewItem, ISceneSubmission } from '../../../common/plusReview';
import {
  ANSWER_NEWS_DAYS,
  sceneReviewNotice,
  waitingKey,
  waitingKeys,
} from '../../../common/sceneReviewNotice';

const MEI = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const KIKO = '1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b';
const NOW = Date.parse('2026-09-19T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const waiting = (over: Partial<IReviewItem> = {}): IReviewItem => ({
  authorId: MEI,
  lookId: `member:${MEI}:neon-city`,
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  sceneId: 'neon-city',
  version: 1,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: true,
  sha256: 'a'.repeat(64),
  submittedAt: at(1),
  takenDown: false,
  authorBanned: false,
  openReports: 0,
  ...over,
});

const answer = (over: Partial<ISceneSubmission> = {}): ISceneSubmission => ({
  sceneId: 'lake',
  version: 2,
  category: 'water',
  names: { en: 'Lake' },
  swatch: ['#0a1020', '#ffb347'],
  state: 'approved',
  submittedAt: at(3),
  decidedAt: at(2),
  firstVersion: 2,
  ...over,
});

const none = new Set<string>();

describe('the admin told a scene waits', () => {
  it('counts everything waiting and names the newest arrival', () => {
    const older = waiting();
    const newer = waiting({
      authorId: KIKO,
      authorName: 'DJ Kiko',
      sceneId: 'ember',
      names: { en: 'Ember' },
      submittedAt: at(0.5),
      sha256: 'b'.repeat(64),
    });
    expect(
      sceneReviewNotice({ waiting: [older, newer], seen: none, now: NOW }),
    ).toEqual({
      kind: 'waiting',
      count: 2,
      newest: {
        names: { en: 'Ember' },
        authorName: 'DJ Kiko',
        swatch: newer.swatch,
      },
      keys: waitingKeys([older, newer]),
    });
  });

  it('is told once: everything it named, seen, is quiet', () => {
    const queue = [waiting(), waiting({ sceneId: 'aurora' })];
    expect(
      sceneReviewNotice({
        waiting: queue,
        seen: new Set(waitingKeys(queue)),
        now: NOW,
      }),
    ).toBeUndefined();
  });

  it('comes back for a new version of a scene already seen, naming that one', () => {
    const seenOne = waiting();
    const resent = waiting({
      version: 2,
      sha256: 'c'.repeat(64),
      submittedAt: at(0.1),
    });
    const other = waiting({ sceneId: 'aurora', names: { en: 'Aurora' } });
    const notice = sceneReviewNotice({
      waiting: [resent, other],
      seen: new Set([waitingKey(seenOne), waitingKey(other)]),
      now: NOW,
    });
    expect(notice).toMatchObject({
      kind: 'waiting',
      count: 2,
      newest: { names: { en: 'Neon City' } },
    });
  });

  it('counts the same version sent again with other bytes as new', () => {
    const first = waiting();
    const again = waiting({ sha256: 'd'.repeat(64) });
    expect(waitingKey(first)).not.toBe(waitingKey(again));
  });
});

describe('a maker told what became of their scene', () => {
  it('says a first version is in the gallery', () => {
    expect(
      sceneReviewNotice({ mine: [answer()], seen: none, now: NOW }),
    ).toMatchObject({
      kind: 'approved',
      sceneId: 'lake',
      version: 2,
      update: false,
    });
  });

  it('says an approved version above the first one is an update', () => {
    expect(
      sceneReviewNotice({
        mine: [answer({ version: 5, firstVersion: 2 })],
        seen: none,
        now: NOW,
      }),
    ).toMatchObject({ kind: 'approved', version: 5, update: true });
  });

  it('says why a version was not approved, the admin’s line, and what members keep', () => {
    expect(
      sceneReviewNotice({
        mine: [
          answer({
            state: 'rejected',
            version: 4,
            reason: 'flashing',
            reasonNote: 'The white flash at the drop is too strong',
            liveVersion: 3,
          }),
        ],
        seen: none,
        now: NOW,
      }),
    ).toMatchObject({
      kind: 'rejected',
      version: 4,
      reason: 'flashing',
      reasonNote: 'The white flash at the drop is too strong',
      liveVersion: 3,
    });
  });

  it('tells the newest answer first, and the next one once that is seen', () => {
    const older = answer({ sceneId: 'lake', decidedAt: at(5) });
    const newer = answer({
      sceneId: 'ember',
      state: 'rejected',
      reason: 'broken',
      decidedAt: at(1),
    });
    const first = sceneReviewNotice({
      mine: [older, newer],
      seen: none,
      now: NOW,
    });
    expect(first).toMatchObject({ kind: 'rejected', sceneId: 'ember' });
    const second = sceneReviewNotice({
      mine: [older, newer],
      seen: new Set(first?.keys),
      now: NOW,
    });
    expect(second).toMatchObject({ kind: 'approved', sceneId: 'lake' });
  });

  // The server asks only that the gallery's version be beaten, so a refused
  // version is fixed and sent again under the same number.
  it('tells a second refusal of the same version, which is news too', () => {
    const refused = answer({
      state: 'rejected',
      version: 4,
      reason: 'flashing',
      decidedAt: at(3),
    });
    const told = sceneReviewNotice({ mine: [refused], seen: none, now: NOW });
    const again = { ...refused, submittedAt: at(1), decidedAt: at(0.5) };
    expect(
      sceneReviewNotice({ mine: [again], seen: new Set(told?.keys), now: NOW }),
    ).toMatchObject({ kind: 'rejected', version: 4 });
  });

  it.each([
    ['still waiting', answer({ state: 'pending', decidedAt: undefined })],
    [
      `answered more than ${ANSWER_NEWS_DAYS} days ago`,
      answer({ decidedAt: at(ANSWER_NEWS_DAYS + 1) }),
    ],
  ])('says nothing about a scene %s', (_label, entry) => {
    expect(
      sceneReviewNotice({ mine: [entry], seen: none, now: NOW }),
    ).toBeUndefined();
  });

  it('says nothing about an answer already told', () => {
    const told = sceneReviewNotice({ mine: [answer()], seen: none, now: NOW });
    expect(
      sceneReviewNotice({
        mine: [answer()],
        seen: new Set(told?.keys),
        now: NOW,
      }),
    ).toBeUndefined();
  });
});

describe('the admin who is also a maker', () => {
  it('hears about the queue first, and about their own answers after it', () => {
    const queue = [waiting()];
    expect(
      sceneReviewNotice({
        waiting: queue,
        mine: [answer()],
        seen: none,
        now: NOW,
      }),
    ).toMatchObject({ kind: 'waiting' });
    expect(
      sceneReviewNotice({
        waiting: queue,
        mine: [answer()],
        seen: new Set(waitingKeys(queue)),
        now: NOW,
      }),
    ).toMatchObject({ kind: 'approved' });
  });
});
