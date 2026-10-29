/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memberLookId } from 'common/memberScenes';
import { FLUIDEQ_CREATOR_ID, type IPublishedScene } from 'common/plusGallery';
import type { ISceneSubmission } from 'common/plusReview';
import { premiumLookId, resolveSceneName } from 'common/scenePacks';
import { ScenePicture } from '../plus/GalleryParts';
import { publicationId, sentOnly, type TMine } from '../plus/myScenes';
import { openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { ReviewState } from '../plus/SubmittedSceneRow';
import { useTranslation } from '../utils/I18nContext';
// The scene pictures are the gallery's own (`ScenePicture`).
import '../styles/Gallery.scss';

/** Rows on the panel; the gallery's Your scenes page lists every one. */
const SHOWN = 3;

interface IAccountPublishedProps {
  me: string;
  mine: TMine;
  /** Leaving the panel for the Studio. */
  onLeave: () => void;
}

const sceneRef = (me: string, scene: IPublishedScene) => ({
  lookId: scene.official
    ? premiumLookId(scene.sceneId)
    : memberLookId(me, scene.sceneId),
  authorId: scene.official ? FLUIDEQ_CREATOR_ID : me,
  sceneId: scene.sceneId,
  version: scene.version,
  updatedAt: scene.updatedAt,
});

const submissionRef = (me: string, submission: ISceneSubmission) => ({
  lookId: memberLookId(me, submission.sceneId),
  authorId: me,
  sceneId: submission.sceneId,
  version: submission.version,
});

function Heart({ count }: { count: string }) {
  return (
    <span className="account-published__likes">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 14s-5.5-3.4-5.5-7.4A3 3 0 0 1 8 4.5a3 3 0 0 1 5.5 2.1C13.5 10.6 8 14 8 14z" />
      </svg>
      {count}
    </span>
  );
}

/**
 * What the account made: each published scene with where it stands and how
 * it is liked, and what is still waiting to be read (Ivan, 2026-10-24, "go
 * with A"). Nothing at all is drawn for an account that has published
 * nothing and sent nothing, or while the list is still coming — an empty
 * heading is a promise of something that is not there.
 */
export default function AccountPublished({
  me,
  mine,
  onLeave,
}: IAccountPublishedProps) {
  const { t, locale } = useTranslation();
  if (mine.state !== 'ready') {
    return null;
  }
  const numbers = new Intl.NumberFormat(locale, { notation: 'compact' });
  const waiting = sentOnly(mine.scenes, mine.sent);
  const rows = [
    ...mine.scenes.map((scene) => ({ kind: 'published' as const, scene })),
    ...waiting.map((submission) => ({ kind: 'sent' as const, submission })),
  ];
  if (rows.length === 0) {
    return null;
  }

  const openStudio = () => {
    openPlusPlace('studio');
    requestPlusTab();
    onLeave();
  };

  return (
    <section
      className="account-published"
      aria-labelledby="account-published-title"
    >
      <div className="account-section__head">
        <span id="account-published-title" className="plus-card__eyebrow">
          {t('account.published.title')}
        </span>
        <button type="button" className="account-link" onClick={openStudio}>
          {t('plus.mine.openStudio')}
        </button>
      </div>
      <ul className="account-published__rows">
        {rows.slice(0, SHOWN).map((row) =>
          row.kind === 'published' ? (
            <li
              key={publicationId(row.scene)}
              className="account-published__row"
            >
              <ScenePicture
                className="account-published__picture"
                scene={sceneRef(me, row.scene)}
              />
              <span className="account-published__text">
                <span className="account-published__name">
                  {resolveSceneName(row.scene, locale)}
                </span>
                <span className="account-published__meta">
                  {t('plus.scene.adds')} {numbers.format(row.scene.adds)}
                </span>
              </span>
              {row.scene.blocked ? (
                <span className="account-published__state is-blocked">
                  {t('plus.mine.blocked')}
                </span>
              ) : (
                <span className="account-published__state is-live">
                  {t('account.published.live')}
                </span>
              )}
              <Heart count={numbers.format(row.scene.likes)} />
            </li>
          ) : (
            <li
              key={`sent:${row.submission.sceneId}`}
              className="account-published__row"
            >
              <ScenePicture
                className="account-published__picture"
                scene={submissionRef(me, row.submission)}
              />
              <span className="account-published__text">
                <span className="account-published__name">
                  {resolveSceneName(row.submission, locale)}
                </span>
                <ReviewState submission={row.submission} />
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
