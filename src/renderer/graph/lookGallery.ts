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
import { findGalleryScene } from '../plus/galleryStore';
import { useCustomLooks } from '../utils/customLooks';
import { getSelectableLooks, useGraphPalette } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import {
  useLockedMemberScenes,
  useUsableMemberScenes,
} from '../utils/memberScenes';
import { getScenePackSummary, useUsableScenes } from '../utils/scenePacks';
import {
  FAMILY_KEYS,
  memberSceneThumbnail,
  officialSceneThumbnail,
} from './lookPickerRows';
import type { ILookThumbnailRef } from './lookThumbnails';

/**
 * The graph's looks as a gallery (Ivan, 2026-11-19, round 3's "I"): the one
 * on the graph, the ones either side of it, and where it stands in the walk.
 *
 * The walk is `getSelectableLooks`, in its own order, which is the one the
 * arrows, Space and Ctrl+Space step through (`cycleGraphLook`), so a
 * neighbour pictured at an edge is exactly the look that edge puts on.
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
  const members = useUsableMemberScenes();
  const lockedMembers = useLockedMemberScenes();

  const looks = useMemo(
    () => getSelectableLooks(customLooks, palette, usable, members),
    [customLooks, palette, usable, members],
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
          }
        : undefined;
    };

    const count = looks.length;
    const index = looks.findIndex((look) => look.id === selectedLookId);
    const current = entryOf(looks[index]) ?? asideOf(selectedLookId);
    if (count < 2) {
      return { current, index, count };
    }
    // From the walk's first look when this one is out of it, and wrapping
    // with `+ count` before the remainder, both as `stepLook` does: an edge
    // pictures exactly the look its step puts on.
    const from = Math.max(0, index);
    const at = (step: number) => looks[(from + step + count) % count];
    return {
      previous: entryOf(at(-1)),
      current,
      next: entryOf(at(1)),
      index,
      count,
    };
  }, [looks, selectedLookId, usable, members, lockedMembers, locale, t]);
};
