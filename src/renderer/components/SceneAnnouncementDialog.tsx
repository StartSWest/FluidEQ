/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { premiumLookId, resolveSceneName } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import MenuIcon from '../icons/MenuIcon';
import { ScenePicture } from '../plus/GalleryParts';
import { requestGraphShow } from '../plus/graphShowRequest';
import { openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useOwnsLook } from '../plus/sceneStore';
import {
  putAnnouncementAway,
  useShownAnnouncement,
  type IShownAnnouncement,
} from '../plus/sceneAnnouncementStore';
import holdFocusReturn from '../utils/focusReturn';
import { setGraphLook } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import { reportError } from '../utils/logger';
import { moveTabStop } from '../utils/useModalKeys';
import DialogFrame from './DialogFrame';
import '../styles/SceneAnnouncement.scss';

/**
 * New scenes, announced big, once (premium migration 0050): the set's
 * pictures in frames like the Plus page before signing in, what it is, and a
 * way to play the first one now. A member whose trial ends within two days
 * is also told so, with the way to keep Plus beside it.
 *
 * It waits its turn like the corner notices — never over another dialog, the
 * terms notice or full screen — and once up it stays until it is put away,
 * which records it as seen for this account on this computer. The admin's
 * preview from the composer is the same card and records nothing.
 */
export default function SceneAnnouncementDialog() {
  const shown = useShownAnnouncement();
  // Waits for the screen before it shows, and holds it after: the card is a
  // dialog itself, and its own `aria-modal` would otherwise send it away.
  const [isUp, setIsUp] = useState<number>();
  const id = shown?.announcement.id;
  const mayShow = useNoticeTurn(
    'sceneAnnouncement',
    shown !== null && isUp !== id,
  );
  useEffect(() => {
    if (mayShow && id !== undefined) {
      setIsUp(id);
    }
  }, [mayShow, id]);
  if (!shown || (isUp !== id && !mayShow && !shown.preview)) {
    return null;
  }
  return <Announcement key={shown.announcement.id} shown={shown} />;
}

function Announcement({ shown }: { shown: IShownAnnouncement }) {
  const { t, locale } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const tryRef = useRef<HTMLButtonElement>(null);
  const { announcement } = shown;
  const [lead, ...rest] = announcement.scenes;
  const ownsLead = useOwnsLook(lead ? premiumLookId(lead.sceneId) : '');

  const close = useCallback(() => {
    putAnnouncementAway(shown).catch((error: unknown) =>
      reportError('recording a scene announcement as seen', error),
    );
  }, [shown]);

  // Over whatever was open, so its keys are taken in the capture phase, as
  // the welcome to Plus does: Escape closes this alone and Tab stays inside.
  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    tryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        event.stopPropagation();
        moveTabStop(surfaceRef.current, event);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      giveFocusBack();
    };
  }, [close]);

  // Somebody who has the first scene plays it on the graph at once; anybody
  // else meets the set where they can watch it and get it, in Visualizers.
  const tryThem = () => {
    close();
    if (ownsLead && lead) {
      setGraphLook(premiumLookId(lead.sceneId));
      requestGraphShow();
    } else {
      openPlusPlace('visualizers');
      requestPlusTab();
    }
  };

  const ref = (scene: (typeof announcement.scenes)[number]) => ({
    lookId: premiumLookId(scene.sceneId),
    authorId: FLUIDEQ_CREATOR_ID,
    sceneId: scene.sceneId,
    version: scene.version,
  });

  return (
    <div className="scene-announcement-backdrop" role="presentation">
      <DialogFrame
        ref={surfaceRef}
        className="scene-announcement"
        icon={<MenuIcon name="plusTab" />}
        eyebrow={t('announce.eyebrow', {
          count: String(announcement.scenes.length),
        })}
        title={announcement.title}
        titleId="scene-announcement-title"
        description={announcement.body}
        rail={
          <>
            {/* The lead scene fills the rail behind the words, as the
                welcome to Plus plays its scene there. */}
            {lead && (
              <ScenePicture scene={ref(lead)} className="dialog-frame__scene" />
            )}
          </>
        }
        closeLabel={t('support.close')}
        onClose={close}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={close}
            >
              {t('announce.later')}
            </button>
            <button
              ref={tryRef}
              type="button"
              className="button small"
              onClick={tryThem}
            >
              <Glyph name="looks" />
              {t('announce.try')}
            </button>
          </div>
        }
      >
        <div
          className={`scene-announcement__frames is-${announcement.scenes.length}`}
        >
          {/* The lead's own light on the wall behind the frames, as the Plus
              page before signing in does with its first picture. */}
          {lead && (
            <ScenePicture
              scene={ref(lead)}
              className="scene-announcement__glow"
            />
          )}
          {lead && (
            <figure className="scene-announcement__frame is-lead">
              <ScenePicture scene={ref(lead)} />
              <figcaption>{resolveSceneName(lead, locale)}</figcaption>
            </figure>
          )}
          {rest.map((scene) => (
            <figure key={scene.sceneId} className="scene-announcement__frame">
              <ScenePicture scene={ref(scene)} />
              <figcaption>{resolveSceneName(scene, locale)}</figcaption>
            </figure>
          ))}
        </div>
        {shown.preview && (
          <p className="gallery-fine scene-announcement__preview">
            {t('announce.previewNote')}
          </p>
        )}
      </DialogFrame>
    </div>
  );
}
