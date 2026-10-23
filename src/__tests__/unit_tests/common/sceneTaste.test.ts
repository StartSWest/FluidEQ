/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the admin's scene readings take from the server (premium 0047), and
 * which look is which scene when the app counts time on screen. A list that
 * reads shorter than the server's would say a member never touched a scene
 * they did, so a row that does not read refuses the whole answer.
 */

import { memberLookId } from '../../../common/memberScenes';
import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import { premiumLookId } from '../../../common/scenePacks';
import {
  lookIdOfScene,
  parseAccountScenes,
  parseFavouriteScenes,
  sceneRefOfLook,
  secondsByCategory,
  type IFavouriteScene,
} from '../../../common/sceneTaste';

const MAKER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('the scene a look plays', () => {
  it('names FluidEQ scenes without an author and members’ scenes with one', () => {
    expect(sceneRefOfLook(premiumLookId('alpine'))).toEqual({
      sceneId: 'alpine',
    });
    expect(sceneRefOfLook(memberLookId(MAKER, 'lava-lamp'))).toEqual({
      authorId: MAKER,
      sceneId: 'lava-lamp',
    });
  });

  it('files a scene under the gallery’s reserved creator as FluidEQ’s own', () => {
    expect(sceneRefOfLook(memberLookId(FLUIDEQ_CREATOR_ID, 'aurora'))).toEqual({
      sceneId: 'aurora',
    });
  });

  it('counts nothing for a look that is not a scene', () => {
    expect(sceneRefOfLook('bars')).toBeUndefined();
    expect(sceneRefOfLook('custom:mine')).toBeUndefined();
    expect(sceneRefOfLook('premium:Not A Pack')).toBeUndefined();
  });

  it('turns back into the same look', () => {
    expect(lookIdOfScene({ sceneId: 'alpine' })).toBe(premiumLookId('alpine'));
    expect(lookIdOfScene({ authorId: MAKER, sceneId: 'lava-lamp' })).toBe(
      memberLookId(MAKER, 'lava-lamp'),
    );
  });
});

const accountRow = {
  author_id: null,
  scene_id: 'alpine',
  version: 3,
  names: { en: 'Alpine' },
  category: 'nature',
  author_name: null,
  added_at: '2026-10-01T10:00:00Z',
  liked_at: null,
  seconds: '900',
  days: 2,
  last_played: '2026-10-12',
};

describe('one account’s scenes', () => {
  it('reads every field, the bigint seconds as PostgREST sends them', () => {
    expect(parseAccountScenes([accountRow])).toEqual([
      {
        sceneId: 'alpine',
        version: 3,
        names: { en: 'Alpine' },
        category: 'nature',
        addedAt: Date.parse('2026-10-01T10:00:00Z'),
        seconds: 900,
        days: 2,
        lastPlayed: '2026-10-12',
      },
    ]);
  });

  it('keeps a member scene’s maker', () => {
    const [scene] =
      parseAccountScenes([
        {
          ...accountRow,
          author_id: MAKER,
          author_name: 'dpulse',
          last_played: null,
          seconds: 0,
          days: 0,
        },
      ]) ?? [];
    expect(scene).toMatchObject({ authorId: MAKER, authorName: 'dpulse' });
    expect(scene?.lastPlayed).toBeUndefined();
  });

  it('refuses the whole list when one row does not read', () => {
    expect(
      parseAccountScenes([accountRow, { ...accountRow, scene_id: 'Bad Id' }]),
    ).toBeUndefined();
    expect(
      parseAccountScenes([{ ...accountRow, added_at: 'yesterday' }]),
    ).toBeUndefined();
    expect(
      parseAccountScenes([{ ...accountRow, seconds: -1 }]),
    ).toBeUndefined();
    expect(parseAccountScenes({})).toBeUndefined();
  });
});

const favourite = (
  sceneId: string,
  seconds: number,
  category: string | null,
  category2: string | null = null,
) => ({
  author_id: null,
  scene_id: sceneId,
  version: 1,
  names: { en: sceneId },
  category,
  category2,
  author_name: null,
  players: 3,
  seconds,
  adds: 1,
  likes: 0,
});

describe('the favourites', () => {
  it('reads the server’s ranking as it is', () => {
    const scenes = parseFavouriteScenes([
      favourite('alpine', 600, 'nature'),
      favourite('aurora', 300, 'space'),
    ]);
    expect(scenes?.map((scene) => scene.sceneId)).toEqual(['alpine', 'aurora']);
    expect(scenes?.[0]).toMatchObject({ players: 3, seconds: 600, adds: 1 });
  });

  it('refuses the whole list when one row does not read', () => {
    expect(
      parseFavouriteScenes([
        favourite('alpine', 600, 'nature'),
        { ...favourite('aurora', 300, 'space'), players: 'many' },
      ]),
    ).toBeUndefined();
  });

  it('adds time up by kind, a scene with two kinds split between them', () => {
    const scenes = parseFavouriteScenes([
      favourite('alpine', 600, 'nature'),
      favourite('aurora', 300, 'space', 'nature'),
      favourite('lone', 100, null),
    ]) as IFavouriteScene[];
    expect(secondsByCategory(scenes)).toEqual([
      { category: 'nature', seconds: 750, scenes: 2 },
      { category: 'space', seconds: 150, scenes: 1 },
      { category: 'other', seconds: 100, scenes: 1 },
    ]);
  });
});
