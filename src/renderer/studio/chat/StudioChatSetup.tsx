/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStudioChatAvailability } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import {
  checkStudioChat,
  signInToStudioChat,
  useStudioChat,
} from './studioChatStore';

/** Anthropic's own page for installing Claude Code. */
export const CLAUDE_CODE_INSTALL_URL = 'https://code.claude.com/docs/en/setup';

/**
 * What the chat needs before it can be used: Claude Code installed, and
 * signed in. Signing in is Claude Code's own, on Anthropic's page in the
 * browser; FluidEQ only asks afterwards whether it worked.
 */
export default function StudioChatSetup({
  availability,
}: {
  availability: Exclude<TStudioChatAvailability, { state: 'ready' }>;
}) {
  const { t } = useTranslation();
  const { signingIn } = useStudioChat();
  const check = () => {
    checkStudioChat().catch(() => undefined);
  };

  if (availability.state === 'checking') {
    return (
      <div className="studio-chat__setup" role="status" aria-busy="true">
        <span className="studio-chat__spinner" aria-hidden="true" />
        <p>{t('studioChat.checking')}</p>
      </div>
    );
  }

  const missing = availability.state === 'missing';
  return (
    <div className="studio-chat__setup">
      <span className="studio-chat__setup-mark" aria-hidden="true">
        <Glyph name="studio" />
      </span>
      <h3>
        {t(missing ? 'studioChat.missingTitle' : 'studioChat.signInTitle')}
      </h3>
      <p>{t(missing ? 'studioChat.missingBody' : 'studioChat.signInBody')}</p>
      <div className="studio-chat__setup-actions">
        {missing ? (
          <button
            type="button"
            className="button small"
            onClick={() =>
              window.open(CLAUDE_CODE_INSTALL_URL, '_blank', 'noopener')
            }
          >
            {t('studioChat.install')}
          </button>
        ) : (
          <button
            type="button"
            className={`button small${signingIn ? ' is-running' : ''}`}
            disabled={signingIn}
            aria-busy={signingIn}
            onClick={() => {
              signInToStudioChat().catch(() => undefined);
            }}
          >
            {t(signingIn ? 'studioChat.signingIn' : 'studioChat.signIn')}
          </button>
        )}
        <button type="button" className="button small subtle" onClick={check}>
          {t('studioChat.checkAgain')}
        </button>
      </div>
      <p className="studio-chat__fine">
        {t('studioChat.plans')} {t('studioChat.otherAiNote')}
      </p>
    </div>
  );
}
