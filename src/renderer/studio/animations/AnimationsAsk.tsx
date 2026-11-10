/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { askSceneChat } from '../chat/askSceneChat';
import '../../styles/StudioAsk.scss';

/**
 * Where a new animation comes from: the scene's own chat (Ivan, 2026-11-10:
 * "make the root chat work on animations and all"), which animates a picture
 * from the scene or lays out frames the member brings. The ask is written
 * into that chat's box and the chat brought into view; the member reads it,
 * finishes it and sends it.
 */
const useAsk = (projectId: string) => {
  const { t } = useTranslation();
  return () => {
    askSceneChat(projectId, t('studio.animation.askDraft')).catch(
      () => undefined,
    );
  };
};

/** All the tab holds before the scene has an animation. */
export function AnimationsEmpty({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const ask = useAsk(projectId);
  return (
    <div className="studio-ask studio-animations__empty">
      <span className="studio-ask__title">
        {t('studio.animation.emptyTitle')}
      </span>
      <span className="studio-ask__text">
        {t('studio.animation.emptyText')}
      </span>
      <span>
        <button type="button" className="button small" onClick={ask}>
          <Glyph name="studio" />
          {t('studio.animation.askChat')}
        </button>
      </span>
    </div>
  );
}

/** One line under the head once there are animations: how to get another. */
export function AnimationsHint({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const ask = useAsk(projectId);
  return (
    <p className="studio-animations__hint">
      <span>{t('studio.animation.hint')}</span>
      <button type="button" className="button small subtle" onClick={ask}>
        <Glyph name="studio" />
        {t('studio.animation.askChat')}
      </button>
    </p>
  );
}
