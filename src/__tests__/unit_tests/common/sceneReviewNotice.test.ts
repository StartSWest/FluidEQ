/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneSubmission } from '../../../common/plusReview';
import {
  ANSWER_NEWS_DAYS,
  sceneReviewNotice,
} from '../../../common/sceneReviewNotice';

const NOW = Date.parse('2026-09-19T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

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
