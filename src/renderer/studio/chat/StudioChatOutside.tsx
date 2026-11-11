/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { trustStudioProject } from '../studioStore';
import '../../styles/StudioChatAsk.scss';

/**
 * Over the chat of a scene in a folder FluidEQ did not make
 * (`projectOrigin.ts`): the AI asks before every command there, because a
 * line in somebody else's file can tell it to run one. One press says the
 * scene is the member's, and it is then one of their own for good (Ivan,
 * 2026-11-10: "make sure they can allow all"). Only here, in the Studio:
 * the AI has no way to this.
 *
 * A scene the member made here never shows this.
 */
export default function StudioChatOutside({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="studio-chat__ask"
      aria-label={t('studioChat.outside.title')}
    >
      <span className="studio-chat__ask-mark" aria-hidden="true">
        <Glyph name="shield" />
      </span>
      <div className="studio-chat__ask-content">
        <p className="studio-chat__ask-title">
          {t('studioChat.outside.title')}
        </p>
        <p className="studio-chat__ask-body">{t('studioChat.outside.body')}</p>
        <div className="studio-chat__ask-actions">
          <button
            type="button"
            className="button small"
            onClick={() => {
              trustStudioProject(projectId).catch(() => undefined);
            }}
          >
            {t('studioChat.outside.trust')}
          </button>
        </div>
      </div>
    </section>
  );
}
