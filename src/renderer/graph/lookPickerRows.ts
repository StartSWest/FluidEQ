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
import { isMemberLookId, parseMemberLookId } from 'common/memberScenes';
import officialSceneCategory from 'common/officialSceneCategories';
import {
  FLUIDEQ_CREATOR_ID,
  versionLineIn,
  type IGalleryScene,
  type TPlusCategory,
} from 'common/plusGallery';
import {
  isLockedLookId,
  isPremiumLookId,
  LOCKED_LOOK_PREFIX,
  premiumLookId,
  resolveSceneName,
} from 'common/scenePacks';
import { FLUIDEQ_MAKER, type IMakerRef } from '../plus/plusNavigation';
import foldForSearch from '../utils/foldForSearch';
import { searchMatcher } from '../../common/searchText';
import {
  loadMemberScene,
  withoutOfficialCopies,
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
  /**
   * One of this account's own scenes that is FluidEQ's as well, because the
   * account is one of FluidEQ's helper accounts (premium 0121): shown under
   * Yours and under FluidEQ.
   */
  alsoFluidEQ?: boolean;
  /**
   * The gallery page of whoever made it, which its "by ..." opens: FluidEQ's
   * for FluidEQ's own, the member's for another member's. None for the
   * member's own, whose caption says "Yours" and names nobody to visit.
   */
  makerPage?: IMakerRef;
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
  /**
   * FluidEQ's helper accounts (premium 0121), whose scenes are FluidEQ's own.
   * None where nothing is known of them (Help's drawing).
   */
  fluidEqHelpers?: readonly string[];
}

/**
 * FluidEQ's own first (its helper accounts' among them), then the member's
 * own, then other members'; within each, what can be played before what is
 * locked.
 */
export const buildPlusRows = ({
  usable,
  locked,
  members,
  lockedMembers,
  locale,
  t,
  findInGallery,
  fluidEqHelpers = [],
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
  // Another member's page, named as the gallery names them when this
  // session has seen the scene there. The author is in the look's own id,
  // so a scene locked with the membership (`locked:` ahead of that id)
  // still leads to its maker.
  const authorIdOf = (lookId: string) =>
    parseMemberLookId(
      isLockedLookId(lookId) ? lookId.slice(LOCKED_LOOK_PREFIX.length) : lookId,
    )?.authorId;
  const makerPageOf = (
    scene: { own: boolean; lookId: string; authorName?: string | null },
    gallery: IGalleryScene | undefined,
  ): { makerPage?: IMakerRef } => {
    const authorId = authorIdOf(scene.lookId);
    return scene.own || authorId === undefined
      ? {}
      : {
          makerPage: {
            authorId,
            name: gallery?.authorName ?? scene.authorName ?? null,
            handle: gallery?.authorHandle ?? null,
          },
        };
  };

  // Who made it. A helper account's scene is FluidEQ's (premium 0121): under
  // FluidEQ's mark and page for everybody, and to the helper itself still
  // its own as well, filed under both (`alsoFluidEQ`). Read from the store
  // the account keeps on disk, never from the gallery, so a row is filed once
  // and never moves when a gallery page comes in.
  const helpers = new Set(fluidEqHelpers);
  const makerOf = (
    scene: { own: boolean; lookId: string; authorName?: string | null },
    gallery: IGalleryScene | undefined,
  ): Pick<IPlusRow, 'maker' | 'author' | 'makerPage' | 'alsoFluidEQ'> => {
    const helper = helpers.has(authorIdOf(scene.lookId) ?? '');
    if (scene.own) {
      return { maker: 'mine', ...(helper ? { alsoFluidEQ: true } : {}) };
    }
    return helper
      ? { maker: 'fluideq', makerPage: FLUIDEQ_MAKER }
      : {
          maker: 'members',
          author: author(scene),
          ...makerPageOf(scene, gallery),
        };
  };

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
      makerPage: FLUIDEQ_MAKER,
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
      makerPage: FLUIDEQ_MAKER,
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
  // A publisher's own copy of one of FluidEQ's scenes is that scene again,
  // under FluidEQ's row (`withoutOfficialCopies`).
  const officialIds = new Set([
    ...usable.map((scene) => scene.id),
    ...locked.map((scene) => scene.id),
  ]);
  const memberRows = withoutOfficialCopies(members, officialIds).map(
    (scene) => {
      const gallery = findInGallery(scene.lookId);
      return row({
        id: scene.lookId,
        name: resolveSceneName(scene, locale),
        swatch: scene.swatch,
        ...makerOf(scene, gallery),
        categories: galleryCategories(gallery) ?? [],
        locked: false,
        version: scene.version,
        ...noteFor(gallery, scene.version),
        ...latestFor(gallery, scene.version),
        ...listingFor(gallery),
        thumbnail: memberSceneThumbnail(scene, gallery),
      });
    },
  );
  const memberLocked = withoutOfficialCopies(lockedMembers, officialIds).map(
    (scene) =>
      row({
        id: scene.lookId,
        name: resolveSceneName(scene, locale),
        swatch: scene.swatch,
        ...makerOf(scene, undefined),
        categories: [],
        locked: true,
      }),
  );
  const byMaker = (maker: TPlusMaker) =>
    [...memberRows, ...memberLocked].filter((entry) => entry.maker === maker);
  return [
    ...official,
    ...memberRows.filter((entry) => entry.maker === 'fluideq'),
    ...officialLocked,
    ...memberLocked.filter((entry) => entry.maker === 'fluideq'),
    ...byMaker('mine'),
    ...byMaker('members'),
  ];
};

/** Every word typed is somewhere in what the row is matched by. */
export const matchesSearch = (search: string, query: string) =>
  searchMatcher(query)(search);
