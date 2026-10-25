/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What the account published and sent, read once for the gallery's Your
 * scenes and the Account panel (`plus/myScenes.ts`), and which admin pages
 * are offered while creators cannot be paid.
 */
import type { IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import { premiumLookId } from 'common/scenePacks';
import { publicationId, sentOnly } from 'renderer/plus/myScenes';
import {
  ADMIN_SECTIONS,
  ADMIN_SECTIONS_SHOWN,
} from 'renderer/plus/plusNavigation';

const published = (sceneId: string, official = false): IPublishedScene =>
  ({ sceneId, official }) as IPublishedScene;
const sent = (
  sceneId: string,
  state: ISceneSubmission['state'],
): ISceneSubmission => ({ sceneId, state }) as ISceneSubmission;

describe('what was sent and is not in the gallery', () => {
  it('keeps waiting and refused scenes, never one already published or approved', () => {
    expect(
      sentOnly(
        [published('lava')],
        [
          sent('lava', 'pending'),
          sent('nova', 'pending'),
          sent('reef', 'rejected'),
          sent('tide', 'approved'),
        ],
      ).map((entry) => entry.sceneId),
    ).toEqual(['nova', 'reef']);
  });

  it('does not let one of FluidEQ’s own hide a member scene of the same id', () => {
    expect(
      sentOnly([published('lava', true)], [sent('lava', 'pending')]).map(
        (entry) => entry.sceneId,
      ),
    ).toEqual(['lava']);
  });

  it('takes FluidEQ’s own down by its look and a member’s by its id', () => {
    expect(publicationId(published('ember', true))).toBe(
      premiumLookId('ember'),
    );
    expect(publicationId(published('lava'))).toBe('lava');
  });
});

describe('the admin’s pages while creators cannot be paid', () => {
  it('leave out Payouts and keep every other page in its place', () => {
    expect(ADMIN_SECTIONS_SHOWN).not.toContain('payouts');
    expect(ADMIN_SECTIONS_SHOWN).toEqual(
      ADMIN_SECTIONS.filter((section) => section !== 'payouts'),
    );
  });
});
