/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { trustStudioProject } from '../studioStore';
import '../../styles/StudioChatAsk.scss';

/**
 * Over the chat of a scene whose files came from outside FluidEQ, or changed
 * outside its chat: the AI asks before every command there, whatever the
 * member's own Claude Code allows, because a line in somebody else's file
 * can tell it to run one. The member can say the scene is theirs, here and
 * only here - in two presses, so it is never said by accident, and never by
 * the AI, which has no way to this.
 *
 * The quiet button, both times: keeping the questions is the safe choice,
 * and the one this notice recommends by saying nothing more.
 */
export default function StudioChatOutside({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  // Another project's notice starts from its first step.
  useEffect(() => setConfirming(false), [projectId]);

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
        <p className="studio-chat__ask-body">
          {t(
            confirming
              ? 'studioChat.outside.confirm'
              : 'studioChat.outside.body',
          )}
        </p>
        <div className="studio-chat__ask-actions">
          {confirming ? (
            <>
              <button
                type="button"
                className="button small"
                onClick={() => setConfirming(false)}
              >
                {t('studioChat.outside.keep')}
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  trustStudioProject(projectId).catch(() => undefined);
                }}
              >
                {t('studioChat.outside.trustYes')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button small subtle"
              onClick={() => setConfirming(true)}
            >
              {t('studioChat.outside.trust')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
