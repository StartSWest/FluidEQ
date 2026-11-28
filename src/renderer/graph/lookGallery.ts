/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { IResolvedLook } from 'common/customLooks';
import { graphStyleFamily } from 'common/graphStyleFamilies';
import type { TranslationKey } from 'common/i18n';
import { isMemberLookId } from 'common/memberScenes';
import {
  isPremiumLookId,
  packIdOfLook,
  resolveSceneName,
} from 'common/scenePacks';
import { findGalleryScene, useGalleryFinder } from '../plus/galleryStore';
import { useCustomLooks } from '../utils/customLooks';
import { getLookWalk, useGraphPalette } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { stepAlong, useLookSorts } from '../utils/lookOrder';
import {
  listedLookOf,
  useLockedMemberScenes,
  useUsableMemberScenes,
} from '../utils/memberScenes';
import {
  getScenePackSummary,
  useAwayScenes,
  useUsableScenes,
} from '../utils/scenePacks';
import {
  FAMILY_KEYS,
  memberSceneThumbnail,
  officialSceneThumbnail,
} from './lookPickerRows';
import type { ILookThumbnailRef } from './lookThumbnails';
import type { ILikedScene } from './SceneLikeButton';

/**
 * The graph's looks as a gallery (Ivan, 2026-11-19, round 3's "I"): the one
 * on the graph, the ones either side of it, and where it stands in the walk.
 *
 * The walk is `getLookWalk`, the picker's own order, which is the one the
 * arrows, Space and Ctrl+Space step through (`cycleGraphLook`), and the
 * neighbours are found by the step's own `stepAlong`, so a neighbour
 * pictured at an edge is exactly the look that edge puts on.
 */

export interface IGalleryEntry {
  id: string;
  name: string;
  /** Who made it, or for a drawing FluidEQ ships, what kind of drawing. */
  byline: string;
  /** A standard or a member's own look, for its glyph. */
  look?: IResolvedLook;
  /** A scene's colours, for its glyph while its picture is not in. */
  swatch?: readonly string[];
  /** How to picture a scene. */
  thumbnail?: ILookThumbnailRef;
  /** The scene's version on this computer, for its "new version" mark. */
  version?: number;
  /**
   * Who a like on it thanks: a scene's alone, FluidEQ's own or a member's,
   * never a standard look (Ivan, 2026-11-19: "solo las plus").
   */
  liked?: ILikedScene;
}

export interface ILookGallery {
  previous?: IGalleryEntry;
  current?: IGalleryEntry;
  next?: IGalleryEntry;
  /** Zero-based place of the current look in the walk, or -1 for none. */
  index: number;
  count: number;
}

export const useLookGallery = (selectedLookId: string): ILookGallery => {
  const { t, locale } = useTranslation();
  const customLooks = useCustomLooks();
  const palette = useGraphPalette();
  const usable = useUsableScenes();
  const away = useAwayScenes();
  const members = useUsableMemberScenes();
  const lockedMembers = useLockedMemberScenes();
  const { catalogue: sort } = useLookSorts();
  // Drawn again when a gallery list comes in: the orders by date and by
  // adds read it.
  const findInGallery = useGalleryFinder();

  const looks = useMemo(
    () =>
      getLookWalk({
        customLooks,
        palette,
        scenes: usable,
        memberScenes: members,
        away,
        sort,
        locale,
        findInGallery,
      }),
    [customLooks, palette, usable, members, away, sort, locale, findInGallery],
  );

  return useMemo(() => {
    const entryOf = (look: IResolvedLook | undefined) => {
      if (!look) {
        return undefined;
      }
      if (isPremiumLookId(look.id)) {
        const scene = usable.find((each) => each.lookId === look.id);
        if (!scene) {
          return undefined;
        }
        return {
          id: look.id,
          name: resolveSceneName(scene, locale),
          byline: t('account.plus.eyebrow'),
          swatch: scene.swatch,
          thumbnail: officialSceneThumbnail(scene, findGalleryScene(look.id)),
          version: scene.version,
          liked: {
            lookId: look.id,
            names: scene.names,
            own: false,
            authorName: t('account.plus.eyebrow'),
          },
        } satisfies IGalleryEntry;
      }
      if (isMemberLookId(look.id)) {
        const scene = members.find((each) => each.lookId === look.id);
        if (!scene) {
          return undefined;
        }
        return {
          id: look.id,
          name: resolveSceneName(scene, locale),
          byline: scene.own
            ? t('graph.member.mine')
            : scene.authorName || t('graph.member.anonymous'),
          swatch: scene.swatch,
          thumbnail: memberSceneThumbnail(scene, findGalleryScene(look.id)),
          version: scene.version,
          liked: scene,
        } satisfies IGalleryEntry;
      }
      return {
        id: look.id,
        name: look.isCustom
          ? look.label
          : t(`graph.styleName.${look.style}` as TranslationKey),
        byline: look.isCustom
          ? t('graph.picker.yours')
          : t(FAMILY_KEYS[graphStyleFamily(look.style)]),
        look,
      } satisfies IGalleryEntry;
    };

    // A scene chosen but out of the walk — set aside this session because
    // this computer could not draw it, or no longer this account's — still
    // has its name on the credit, beside the card that says why.
    const asideOf = (lookId: string): IGalleryEntry | undefined => {
      const pack = isPremiumLookId(lookId)
        ? getScenePackSummary(packIdOfLook(lookId))
        : lockedMembers.find((each) => each.lookId === lookId);
      return pack
        ? {
            id: lookId,
            name: resolveSceneName(pack, locale),
            byline: isPremiumLookId(lookId)
              ? t('account.plus.eyebrow')
              : t('graph.member.theirs'),
            swatch: pack.swatch,
            // FluidEQ's own is still this account's to thank, drawn here or
            // not; a member's set aside is not this account's any more.
            ...(isPremiumLookId(lookId)
              ? {
                  liked: {
                    lookId,
                    names: pack.names,
                    own: false,
                    authorName: t('account.plus.eyebrow'),
                  },
                }
              : {}),
          }
        : undefined;
    };

    const count = looks.length;
    // As the walk finds it: a publisher's own copy of one of FluidEQ's
    // scenes is that scene's row (`listedLookOf`), there as in the picker.
    const shown = listedLookOf(selectedLookId, members, usable);
    const index = looks.findIndex((look) => look.id === shown);
    const current = entryOf(looks[index]) ?? asideOf(selectedLookId);
    if (count < 2) {
      return { current, index, count };
    }
    const ids = looks.map((look) => look.id);
    const lookOf = (id: string | undefined) =>
      looks.find((look) => look.id === id);
    return {
      previous: entryOf(lookOf(stepAlong(ids, shown, -1))),
      current,
      next: entryOf(lookOf(stepAlong(ids, shown, 1))),
      index,
      count,
    };
  }, [looks, selectedLookId, usable, members, lockedMembers, locale, t]);
};
