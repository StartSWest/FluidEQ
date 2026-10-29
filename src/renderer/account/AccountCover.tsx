/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { ScenePicture } from '../plus/GalleryParts';
import SceneBand from '../plus/SceneBand';
import { useSelectedLookId } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useUsableScenes } from '../utils/scenePacks';
// The scene pictures are the gallery's own (`ScenePicture`).
import '../styles/Gallery.scss';

/** The band fills the cover rather than taking its own heights. */
const FILL = {
  '--band-short': '100%',
  '--band-tall': '100%',
  '--band-tall-short': '100%',
} as CSSProperties;

/**
 * The picture over the account in its panel: the scene on the graph now,
 * named, when one is (Ivan, 2026-10-24, "go with A").
 *
 * A still of it, never a second copy running: the graph is already drawing
 * that scene, and a panel that drew it again would double the work on the
 * graphics card for a picture. Without a scene on the graph it is the band
 * the panel always had — the app's own scene for somebody with scenes, the
 * aurora for anybody else.
 */
export default function AccountCover({ ownsScenes }: { ownsScenes: boolean }) {
  const { t, locale } = useTranslation();
  const lookId = useSelectedLookId();
  const official = useUsableScenes().find((scene) => scene.lookId === lookId);
  const member = useUsableMemberScenes().find(
    (scene) => scene.lookId === lookId,
  );
  const playing = official
    ? {
        ref: {
          lookId,
          authorId: FLUIDEQ_CREATOR_ID,
          sceneId: official.id,
          version: official.version,
        },
        name: resolveSceneName(official, locale),
      }
    : member && {
        ref: {
          lookId,
          authorId: member.authorId,
          sceneId: member.packId,
          version: member.version,
        },
        name: resolveSceneName(member, locale),
      };

  if (!playing) {
    return <SceneBand playsScene={ownsScenes} style={FILL} />;
  }
  return (
    <div className="account-cover">
      <ScenePicture className="account-cover__picture" scene={playing.ref} />
      <span className="account-cover__playing">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1 8V4M4 10V2M7 9V3M10 7V5" />
        </svg>
        {t('account.cover.onGraph', { name: playing.name })}
      </span>
    </div>
  );
}
