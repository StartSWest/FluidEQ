/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IResolvedLook } from 'common/customLooks';
import {
  graphStyleFamily,
  type TGraphStyleFamily,
} from 'common/graphStyleFamilies';
import type { LocaleCode, TranslationKey } from 'common/i18n';
import { isMemberLookId } from 'common/memberScenes';
import officialSceneCategory from 'common/officialSceneCategories';
import {
  FLUIDEQ_CREATOR_ID,
  versionLineIn,
  type IGalleryScene,
  type TPlusCategory,
} from 'common/plusGallery';
import {
  isPremiumLookId,
  premiumLookId,
  resolveSceneName,
} from 'common/scenePacks';
import foldForSearch from '../utils/foldForSearch';
import { searchMatcher } from '../../common/searchText';
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

export type TPlusMaker = 'fluideq' | 'mine' | 'members';

export interface IStyleRow {
  id: string;
  name: string;
  look: IResolvedLook;
  family: TGraphStyleFamily;
  /** A look the member built in the designer. */
  yours: boolean;
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
  /** A newer approved version the gallery has, past the one on this computer. */
  latest?: number;
  /**
   * When the gallery first published it, when its newest version went up and
   * how many members have added it - read from the gallery's own listing,
   * so absent for a scene this session's gallery has not described. The
   * picker's sorts put those last (`lookPickerFilter.ts`).
   */
  publishedAt?: string;
  updatedAt?: string;
  adds?: number;
  search: string;
}

export const FAMILY_KEYS: Record<TGraphStyleFamily, TranslationKey> = {
  analysis: 'graph.family.analysis',
  lines: 'graph.family.lines',
  fills: 'graph.family.fills',
  bars: 'graph.family.bars',
  points: 'graph.family.points',
  // Animated in the picker, so "Scenes" names only the scene packs (Ivan,
  // 2026-11-19: "go with Animated").
  scenes: 'graph.family.animated',
};

export const categoryName = (t: TTranslate, category: TPlusCategory) =>
  t(`plus.category.${category}` as TranslationKey);

/** Whose it is, as the From tabs and a tile's caption say it. */
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
    .map((look) => {
      const family = graphStyleFamily(look.style);
      const name = look.isCustom
        ? look.label
        : t(`graph.styleName.${look.style}` as TranslationKey);
      return {
        id: look.id,
        name,
        look,
        family,
        yours: look.isCustom,
        search: foldForSearch(
          [
            name,
            t(FAMILY_KEYS[family]),
            look.isCustom ? t('graph.picker.yours') : '',
          ].join(' '),
        ),
      };
    });

/**
 * How to picture one of FluidEQ's own scenes that this computer can play: the
 * picker's row and the graph's gallery (`lookGallery.ts`) ask the same way.
 */
export const officialSceneThumbnail = (
  scene: IUsableScene,
  gallery: IGalleryScene | undefined,
): ILookThumbnailRef => ({
  lookId: scene.lookId,
  version: scene.revision ?? String(scene.version),
  // The copy the gallery names, when a list has it, as member rows do:
  // its date is what lets the picture be read back from disk.
  published: gallery
    ? {
        authorId: FLUIDEQ_CREATOR_ID,
        sceneId: scene.id,
        version: gallery.version,
        revision: gallery.updatedAt,
      }
    : {
        authorId: FLUIDEQ_CREATOR_ID,
        sceneId: scene.id,
        version: scene.version,
      },
  load: () => loadScenePack(scene.id),
});

/** How to picture a member's scene that this computer can play. */
export const memberSceneThumbnail = (
  scene: IUsableMemberScene,
  gallery: IGalleryScene | undefined,
): ILookThumbnailRef => ({
  lookId: scene.lookId,
  version: scene.revision ?? String(scene.version),
  published: gallery && {
    authorId: gallery.authorId,
    sceneId: gallery.sceneId,
    version: gallery.version,
    revision: gallery.updatedAt,
  },
  load: () => loadMemberScene(scene.lookId),
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

  // A newer version than the one here, when a gallery list has seen it: the
  // member keeps theirs until they update it, by design.
  // What the gallery's listing says of it, for the picker's sorts.
  const listingFor = (gallery: ReturnType<IPlusSources['findInGallery']>) =>
    gallery
      ? {
          updatedAt: gallery.updatedAt,
          adds: gallery.adds,
          ...(gallery.firstPublishedAt
            ? { publishedAt: gallery.firstPublishedAt }
            : {}),
        }
      : {};

  const latestFor = (
    gallery: ReturnType<IPlusSources['findInGallery']>,
    version: number,
  ) =>
    gallery && gallery.version > version ? { latest: gallery.version } : {};

  // The maker's note belongs to one version: shown only beside that one.
  const noteFor = (
    gallery: ReturnType<IPlusSources['findInGallery']>,
    version: number,
  ) => {
    const line =
      gallery?.version === version
        ? versionLineIn(gallery.versionNote, gallery.versionNotes, locale)
        : undefined;
    return line ? { versionNote: line } : {};
  };

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
      ...latestFor(gallery, scene.version),
      ...listingFor(gallery),
      thumbnail: officialSceneThumbnail(scene, gallery),
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
      ...listingFor(gallery),
      thumbnail: gallery && {
        lookId: scene.lookId,
        version: String(gallery.version),
        published: {
          authorId: FLUIDEQ_CREATOR_ID,
          sceneId: scene.id,
          version: gallery.version,
          revision: gallery.updatedAt,
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
      ...latestFor(gallery, scene.version),
      ...listingFor(gallery),
      thumbnail: memberSceneThumbnail(scene, gallery),
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
  searchMatcher(query)(search);
