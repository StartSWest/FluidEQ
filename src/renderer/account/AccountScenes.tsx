/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { resolveSceneName } from 'common/scenePacks';
import { ScenePicture } from '../plus/GalleryParts';
import { openGalleryPage, openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { setGraphLook, useSelectedLookId } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useUsableScenes } from '../utils/scenePacks';
// The scene pictures are the gallery's own (`ScenePicture`).
import '../styles/Gallery.scss';

/** Tiles on the panel: one row of the newest; the gallery has the rest. */
const SHOWN = 4;

interface IOwnedTile {
  lookId: string;
  name: string;
  official: boolean;
  ref: {
    lookId: string;
    authorId: string;
    sceneId: string;
    version: number;
  };
}

interface IAccountScenesProps {
  /** The account's scenes as look ids, oldest got first (`my_store`). */
  owned: readonly string[];
  /** Leaving the panel for the gallery. */
  onLeave: () => void;
}

/**
 * The scenes the account got, newest first, each a press away from the
 * graph (Ivan, 2026-10-24, "go with A"). Only scenes already on this
 * computer are drawn: one still arriving has nothing to play yet, and shows
 * up here the next time the panel opens.
 */
export default function AccountScenes({ owned, onLeave }: IAccountScenesProps) {
  const { t, locale } = useTranslation();
  const selected = useSelectedLookId();
  const official = useUsableScenes();
  const members = useUsableMemberScenes();

  const tiles = [...owned].reverse().flatMap((lookId): IOwnedTile[] => {
    const own = official.find((scene) => scene.lookId === lookId);
    if (own) {
      return [
        {
          lookId,
          name: resolveSceneName(own, locale),
          official: true,
          ref: {
            lookId,
            authorId: FLUIDEQ_CREATOR_ID,
            sceneId: own.id,
            version: own.version,
          },
        },
      ];
    }
    const member = members.find((scene) => scene.lookId === lookId);
    return member
      ? [
          {
            lookId,
            name: resolveSceneName(member, locale),
            official: false,
            ref: {
              lookId,
              authorId: member.authorId,
              sceneId: member.packId,
              version: member.version,
            },
          },
        ]
      : [];
  });

  const openGallery = () => {
    openPlusPlace('visualizers');
    openGalleryPage({ kind: 'browse' });
    requestPlusTab();
    onLeave();
  };

  return (
    <section className="account-scenes" aria-labelledby="account-scenes-title">
      <div className="account-section__head">
        <span id="account-scenes-title" className="plus-card__eyebrow">
          {t('account.scenes.title')}
        </span>
        <button type="button" className="account-link" onClick={openGallery}>
          {t('account.scenes.openGallery')}
        </button>
      </div>
      {tiles.length === 0 ? (
        <p className="account-scenes__empty">{t('account.scenes.empty')}</p>
      ) : (
        <ul className="account-scenes__tiles">
          {tiles.slice(0, SHOWN).map((tile) => {
            const playing = tile.lookId === selected;
            return (
              <li key={tile.lookId}>
                <button
                  type="button"
                  className={`account-tile${playing ? ' is-playing' : ''}`}
                  aria-pressed={playing}
                  aria-label={t('account.scenes.play', { name: tile.name })}
                  onClick={() => setGraphLook(tile.lookId)}
                >
                  <span className="account-tile__art">
                    <ScenePicture
                      className="account-tile__picture"
                      scene={tile.ref}
                    />
                    {playing && (
                      <span className="account-tile__playing">
                        <svg viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M2 1.5v7l6-3.5z" />
                        </svg>
                        {t('account.scenes.playing')}
                      </span>
                    )}
                  </span>
                  <span className="account-tile__name">{tile.name}</span>
                  {tile.official && (
                    <span className="account-tile__by">
                      {t('plus.official.author')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
