/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the admin's scene readings take from the server (premium 0047, 0071):
 * the scenes members add and like, and nothing about watching. A list that
 * reads shorter than the server's would say a member never touched a scene
 * they did, so a row that does not read refuses the whole answer.
 */

import { memberLookId } from '../../../common/memberScenes';
import { premiumLookId } from '../../../common/scenePacks';
import {
  addsByCategory,
  lookIdOfScene,
  parseAccountScenes,
  parseFavouriteScenes,
  type IFavouriteScene,
} from '../../../common/sceneTaste';

const MAKER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('the look a scene plays as', () => {
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
};

describe('one account’s scenes', () => {
  it('reads every field', () => {
    expect(parseAccountScenes([accountRow])).toEqual([
      {
        sceneId: 'alpine',
        version: 3,
        names: { en: 'Alpine' },
        category: 'nature',
        addedAt: Date.parse('2026-10-01T10:00:00Z'),
      },
    ]);
  });

  it('keeps a member scene’s maker, and nothing about watching', () => {
    const [scene] =
      parseAccountScenes([
        {
          ...accountRow,
          author_id: MAKER,
          author_name: 'dpulse',
          // What a server before 0071 still sends is not read.
          seconds: '900',
          days: 2,
        },
      ]) ?? [];
    expect(scene).toMatchObject({ authorId: MAKER, authorName: 'dpulse' });
    expect(Object.keys(scene ?? {})).not.toEqual(
      expect.arrayContaining(['seconds']),
    );
    expect(Object.keys(scene ?? {})).not.toEqual(
      expect.arrayContaining(['days']),
    );
  });

  it('refuses the whole list when one row does not read', () => {
    expect(
      parseAccountScenes([accountRow, { ...accountRow, scene_id: 'Bad Id' }]),
    ).toBeUndefined();
    expect(
      parseAccountScenes([{ ...accountRow, added_at: 'yesterday' }]),
    ).toBeUndefined();
    expect(parseAccountScenes({})).toBeUndefined();
  });
});

const favourite = (
  sceneId: string,
  adds: number,
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
  adds,
  likes: 1,
});

describe('the favourites', () => {
  it('reads the server’s ranking as it is', () => {
    const scenes = parseFavouriteScenes([
      favourite('alpine', 6, 'nature'),
      favourite('aurora', 3, 'space'),
    ]);
    expect(scenes?.map((scene) => scene.sceneId)).toEqual(['alpine', 'aurora']);
    expect(scenes?.[0]).toEqual({
      sceneId: 'alpine',
      version: 1,
      names: { en: 'alpine' },
      category: 'nature',
      adds: 6,
      likes: 1,
    });
  });

  it('refuses the whole list when one row does not read', () => {
    expect(
      parseFavouriteScenes([
        favourite('alpine', 6, 'nature'),
        { ...favourite('aurora', 3, 'space'), adds: 'many' },
      ]),
    ).toBeUndefined();
  });

  it('adds the adds up by kind, a scene with two kinds split between them', () => {
    const scenes = parseFavouriteScenes([
      favourite('alpine', 6, 'nature'),
      favourite('aurora', 4, 'space', 'nature'),
      favourite('lone', 1, null),
    ]) as IFavouriteScene[];
    expect(addsByCategory(scenes)).toEqual([
      { category: 'nature', adds: 8, scenes: 2 },
      { category: 'space', adds: 2, scenes: 1 },
      { category: 'other', adds: 1, scenes: 1 },
    ]);
  });
});
