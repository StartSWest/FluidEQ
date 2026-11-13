/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the review stands with each of a maker's scenes, for the warning the
 * Studio keeps beside a refused scene until it is sent again (Ivan,
 * 2026-11-11: "make sure it is shown on the Studio somewhere until they
 * republish").
 */

import type { ISceneSubmission } from '../../../common/plusReview';
import {
  anyPending,
  sceneStandings,
} from '../../../common/sceneReviewStanding';

const sent = (over: Partial<ISceneSubmission>): ISceneSubmission => ({
  sceneId: 'lake',
  version: 3,
  category: 'water',
  names: { en: 'Lake' },
  swatch: ['#0a1020'],
  state: 'pending',
  submittedAt: '2026-11-10T10:00:00Z',
  ...over,
});

const refused = sent({
  state: 'rejected',
  reason: 'flashing',
  reasonNotes: { en: 'Slow the white flash down.' },
  decidedAt: '2026-11-11T09:00:00Z',
});

describe('where each scene stands', () => {
  it('holds a refusal with its reason, its note and its date', () => {
    expect(sceneStandings([refused])).toEqual({
      lake: {
        kind: 'rejected',
        version: 3,
        reason: 'flashing',
        reasonNotes: { en: 'Slow the white flash down.' },
        decidedAt: '2026-11-11T09:00:00Z',
      },
    });
  });

  it('turns a refusal into a wait once the scene is sent again', () => {
    const again = sent({ version: 4, submittedAt: '2026-11-11T12:00:00Z' });
    expect(sceneStandings([again, refused]).lake).toEqual({
      kind: 'pending',
      version: 4,
      submittedAt: '2026-11-11T12:00:00Z',
    });
    // The same version sent again after its refusal counts by its date.
    const sameAgain = sent({ submittedAt: '2026-11-11T12:00:00Z' });
    expect(sceneStandings([refused, sameAgain]).lake?.kind).toBe('pending');
  });

  it('says nothing of a scene whose newest version was approved', () => {
    const approved = sent({
      version: 4,
      state: 'approved',
      decidedAt: '2026-11-12T09:00:00Z',
    });
    expect(sceneStandings([refused, approved])).toEqual({});
  });

  it('keeps each scene to its own newest word', () => {
    const other = sent({ sceneId: 'ember', version: 1 });
    expect(Object.keys(sceneStandings([refused, other])).sort()).toEqual([
      'ember',
      'lake',
    ]);
  });

  it('reads nothing into an unread list', () => {
    expect(sceneStandings(undefined)).toEqual({});
  });
});

describe('whether anything waits for an answer', () => {
  it('is true only while something sent is unanswered', () => {
    expect(anyPending([sent({})])).toBe(true);
    expect(anyPending([refused])).toBe(false);
    expect(anyPending(undefined)).toBe(false);
  });
});
