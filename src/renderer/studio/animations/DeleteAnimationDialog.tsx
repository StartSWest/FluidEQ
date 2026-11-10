/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ANIMATIONS_DIR } from 'common/studioAnimation';
import DialogFrame from '../../components/DialogFrame';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import useModalKeys from '../../utils/useModalKeys';
import { showSceneChat } from '../chat/askSceneChat';
import { sendToStudioChat } from '../chat/studioChatStore';
import { markRemovalAsked } from './animationActions';
import '../../styles/StudioDialogs.scss';

/**
 * Delete on an animation the scene may be playing (Ivan, 2026-11-10: "si
 * dice se está usando, ask agent to delete it and fix holes"): one question,
 * and on yes the scene's chat is SENT the request - remove the animation and
 * fix every place the scene uses it - and brought into view to do it; the
 * card says it is being handled until its files go. An animation whose use
 * is not known takes this way too: unknown is not unused.
 */
export default function DeleteAnimationDialog({
  projectId,
  name,
  onClose,
}: {
  projectId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalKeys(surfaceRef, cancelRef, { busy: false, onCancel: onClose });

  const ask = () => {
    sendToStudioChat(
      t('studio.animation.deleteRequest', {
        name,
        file: `${ANIMATIONS_DIR}/${name}.json`,
      }),
    ).catch(() => undefined);
    markRemovalAsked(projectId, name);
    showSceneChat();
    onClose();
  };

  return createPortal(
    <div
      className="studio-share-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogFrame
        ref={surfaceRef}
        className="studio-new"
        icon={<MenuIcon name="trash" />}
        title={t('studio.animation.deleteTitle', { name })}
        titleId={titleId}
        closeLabel={t('support.close')}
        onClose={onClose}
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={cancelRef}
              type="button"
              className="button small subtle"
              onClick={onClose}
            >
              {t('studio.new.cancel')}
            </button>
            <button type="button" className="button small" onClick={ask}>
              {t('studio.animation.deleteAsk')}
            </button>
          </div>
        }
      >
        <p className="studio-pictures__lead">
          {t('studio.animation.deleteLead')}
        </p>
      </DialogFrame>
    </div>,
    document.body,
  );
}
