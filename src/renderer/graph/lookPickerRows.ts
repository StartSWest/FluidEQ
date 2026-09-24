/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IResolvedLook } from 'common/customLooks';
import {
  GRAPH_STYLE_FAMILIES,
  graphStyleFamily,
  type TGraphStyleFamily,
} from 'common/graphStyleFamilies';
import type { LocaleCode, TranslationKey } from 'common/i18n';
import { isMemberLookId } from 'common/memberScenes';
import officialSceneCategory from 'common/officialSceneCategories';
import {
  FLUIDEQ_CREATOR_ID,
  PLUS_CATEGORIES,
  type IGalleryScene,
  type TPlusCategory,
} from 'common/plusGallery';
import {
  isPremiumLookId,
  premiumLookId,
  resolveSceneName,
} from 'common/scenePacks';
import foldForSearch from '../utils/foldForSearch';
import {
  loadMemberScene,
  type ILockedMemberScene,
  type IUsableMemberScene,
} from '../utils/memberScenes';
import {
  loadScenePack,
  type ILockedScene,
  type IUsableScene,
} from '../utils/scenePacks';
import type { ILookThumbnailRef } from './lookThumbnails';

/**
 * The graph picker's two columns as rows: the standard styles, filed by what
 * kind of drawing they are, and the Plus visualizers, filed by the categories
 * they are published under and by who made them.
 */

type TTranslate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

export type TStyleFilter = 'all' | TGraphStyleFamily | 'yours';
export type TPlusFilter = 'all' | TPlusCategory | 'mine' | 'members';
export type TPlusMaker = 'fluideq' | 'mine' | 'members';

export interface IStyleRow {
  id: string;
  name: string;
  look: IResolvedLook;
  family: TGraphStyleFamily;
  /** A look the member built in the designer. */
  yours: boolean;
  /**
   * This row is a saved variation of the row above it, so the list draws it
   * as a child. Read off the ORDER rather than stored on the look, because
   * the order is what `getSelectableLooks` already decides and two places
   * deciding the same thing is how they come to disagree.
   */
  nested: boolean;
  /** Everything the search box matches it by, folded. */
  search: string;
}

export interface IPlusRow {
  id: string;
  name: string;
  swatch: readonly string[];
  maker: TPlusMaker;
  /** Another member's name, for a scene they made. */
  author?: string;
  categories: readonly TPlusCategory[];
  /** Shown, never chosen: choosing it asks for Plus instead. */
  locked: boolean;
  /** How to picture it, when it can be pictured at all. */
  thumbnail?: ILookThumbnailRef;
  /** The version on this computer, for a look that can be played. */
  version?: number;
  /** What its maker wrote about that version, once the gallery has said. */
  versionNote?: string;
  search: string;
}

export const FAMILY_KEYS: Record<TGraphStyleFamily, TranslationKey> = {
  analysis: 'graph.family.analysis',
  lines: 'graph.family.lines',
  fills: 'graph.family.fills',
  bars: 'graph.family.bars',
  points: 'graph.family.points',
  scenes: 'graph.family.scenes',
};

export const categoryName = (t: TTranslate, category: TPlusCategory) =>
  t(`plus.category.${category}` as TranslationKey);

/** Whose it is, as the filter chip and the list heading both say it. */
export const makerName = (t: TTranslate, maker: TPlusMaker) => {
  if (maker === 'mine') {
    return t('graph.member.mine');
  }
  return maker === 'members'
    ? t('graph.member.theirs')
    : t('account.plus.eyebrow');
};

/** The gallery's own filing, when this session has seen the scene there. */
const galleryCategories = (scene: IGalleryScene | undefined) =>
  scene
    ? [scene.category, ...(scene.category2 ? [scene.category2] : [])]
    : undefined;

export const buildStyleRows = (
  looks: readonly IResolvedLook[],
  t: TTranslate,
): IStyleRow[] =>
  looks
    .filter((look) => !isPremiumLookId(look.id) && !isMemberLookId(look.id))
    .map((look, index, rows) => {
      const family = graphStyleFamily(look.style);
      const above = rows[index - 1];
      const nested = Boolean(
        look.isCustom && above && above.style === look.style,
      );
      const name = look.isCustom
        ? look.label
        : t(`graph.styleName.${look.style}` as TranslationKey);
      return {
        id: look.id,
        name,
        look,
        family,
        yours: look.isCustom,
        nested,
        search: foldForSearch(
          [
            name,
            t(FAMILY_KEYS[family]),
            look.isCustom ? t('graph.picker.yours') : '',
          ].join(' '),
        ),
      };
    });

interface IPlusSources {
  usable: readonly IUsableScene[];
  locked: readonly ILockedScene[];
  members: readonly IUsableMemberScene[];
  lockedMembers: readonly ILockedMemberScene[];
  locale: LocaleCode;
  t: TTranslate;
  findInGallery: (lookId: string) => IGalleryScene | undefined;
}

/**
 * FluidEQ's own first, then the member's own, then other members'; within
 * each, what can be played before what is locked.
 */
export const buildPlusRows = ({
  usable,
  locked,
  members,
  lockedMembers,
  locale,
  t,
  findInGallery,
}: IPlusSources): IPlusRow[] => {
  const row = (base: Omit<IPlusRow, 'search'>): IPlusRow => ({
    ...base,
    search: foldForSearch(
      [
        base.name,
        base.author ?? '',
        makerName(t, base.maker),
        ...base.categories.map((category) => categoryName(t, category)),
      ].join(' '),
    ),
  });
  const author = (scene: { own: boolean; authorName?: string | null }) =>
    scene.own ? undefined : scene.authorName || t('graph.member.anonymous');

  // The maker's note belongs to one version: shown only beside that one.
  const noteFor = (
    gallery: ReturnType<IPlusSources['findInGallery']>,
    version: number,
  ) =>
    gallery?.version === version && gallery.versionNote
      ? { versionNote: gallery.versionNote }
      : {};

  const official = usable.map((scene) => {
    const gallery = findInGallery(scene.lookId);
    return row({
      id: scene.lookId,
      name: resolveSceneName(scene, locale),
      swatch: scene.swatch,
      maker: 'fluideq',
      categories: galleryCategories(gallery) ?? [
        officialSceneCategory(scene.id),
      ],
      locked: false,
      version: scene.version,
      ...noteFor(gallery, scene.version),
      thumbnail: {
        lookId: scene.lookId,
        version: scene.revision ?? String(scene.version),
        published: {
          authorId: FLUIDEQ_CREATOR_ID,
          sceneId: scene.id,
          version: scene.version,
        },
        load: () => loadScenePack(scene.id),
      },
    });
  });
  // A locked pack is not on this computer and its catalogue entry carries no
  // version, so it can only be pictured once the gallery has named one.
  const officialLocked = locked.map((scene) => {
    const gallery = findInGallery(premiumLookId(scene.id));
    return row({
      id: scene.lookId,
      name: resolveSceneName(scene, locale),
      swatch: scene.swatch,
      maker: 'fluideq',
      categories: galleryCategories(gallery) ?? [
        officialSceneCategory(scene.id),
      ],
      locked: true,
      thumbnail: gallery && {
        lookId: scene.lookId,
        version: String(gallery.version),
        published: {
          authorId: FLUIDEQ_CREATOR_ID,
          sceneId: scene.id,
          version: gallery.version,
        },
      },
    });
  });
  const memberRows = members.map((scene) => {
    const gallery = findInGallery(scene.lookId);
    return row({
      id: scene.lookId,
      name: resolveSceneName(scene, locale),
      swatch: scene.swatch,
      maker: scene.own ? 'mine' : 'members',
      author: author(scene),
      categories: galleryCategories(gallery) ?? [],
      locked: false,
      version: scene.version,
      ...noteFor(gallery, scene.version),
      thumbnail: {
        lookId: scene.lookId,
        version: scene.revision ?? String(scene.version),
        published: gallery && {
          authorId: gallery.authorId,
          sceneId: gallery.sceneId,
          version: gallery.version,
          revision: gallery.updatedAt,
        },
        load: () => loadMemberScene(scene.lookId),
      },
    });
  });
  const memberLocked = lockedMembers.map((scene) =>
    row({
      id: scene.lookId,
      name: resolveSceneName(scene, locale),
      swatch: scene.swatch,
      maker: scene.own ? 'mine' : 'members',
      author: author(scene),
      categories: [],
      locked: true,
    }),
  );
  const byMaker = (maker: TPlusMaker) =>
    [...memberRows, ...memberLocked].filter((entry) => entry.maker === maker);
  return [
    ...official,
    ...officialLocked,
    ...byMaker('mine'),
    ...byMaker('members'),
  ];
};

/** Every word typed is somewhere in what the row is matched by. */
export const matchesSearch = (search: string, query: string) =>
  foldForSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => search.includes(word));

/**
 * Only the families something is filed under.
 *
 * A chip that empties the column is a dead end — the same rule `plusFilters`
 * has always had, and one this list needed the moment the twenty plain forms
 * went: Lines, Fills, Bars and Points were still offered with nothing left
 * to show under any of them.
 */
export const styleFilters = (rows: readonly IStyleRow[]): TStyleFilter[] => [
  'all',
  ...GRAPH_STYLE_FAMILIES.filter((family) =>
    rows.some((row) => row.family === family),
  ),
  ...(rows.some((row) => row.yours) ? (['yours'] as const) : []),
];

/**
 * Only the categories something is filed under: a chip that empties the
 * column is a dead end, and the collection grows into the rest.
 */
export const plusFilters = (rows: readonly IPlusRow[]): TPlusFilter[] => [
  'all',
  ...PLUS_CATEGORIES.filter((category) =>
    rows.some((row) => row.categories.includes(category)),
  ),
  ...(rows.some((row) => row.maker === 'mine') ? (['mine'] as const) : []),
  ...(rows.some((row) => row.maker === 'members')
    ? (['members'] as const)
    : []),
];

export const keepStyle = (row: IStyleRow, filter: TStyleFilter) =>
  filter === 'all' || (filter === 'yours' ? row.yours : row.family === filter);

export const keepPlus = (row: IPlusRow, filter: TPlusFilter) => {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'mine' || filter === 'members') {
    return row.maker === filter;
  }
  return row.categories.includes(filter);
};
