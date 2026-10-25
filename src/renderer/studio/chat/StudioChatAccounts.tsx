/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, type ReactNode } from 'react';
import { CHATGPT_PICTURES_OPEN } from 'common/studioChatPictures';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { CODEX_APP_URL } from './StudioChatAsk';
import StudioChatLimits from './StudioChatLimits';
import { CLAUDE_CODE_INSTALL_URL } from './StudioChatSetup';
import {
  checkStudioChat,
  checkStudioChatCodex,
  disconnectStudioChatCodex,
  signInToStudioChat,
  signInToStudioChatCodex,
  useStudioChat,
} from './studioChatStore';
import '../../styles/StudioChatAccounts.scss';

/**
 * Plans by the names their makers sell them under. Claude Code and Codex
 * report a plan as one lower-case word ("max", "prolite"); a plan this does
 * not know is shown with a capital, which is right for most of them.
 */
const PLAN_NAMES: Record<string, string> = {
  prolite: 'Pro Lite',
};
export const planName = (plan: string) =>
  PLAN_NAMES[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);

/** One account: which service, whose it is, and what can be done about it. */
function AccountCard({
  service,
  lamp,
  email,
  detail,
  note,
  usage,
  children,
}: {
  service: string;
  lamp: 'ready' | 'off';
  email?: string | undefined;
  detail?: string | undefined;
  note?: string | undefined;
  /** What the account's plan has left, under who it is. */
  usage?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="studio-chat-accounts__card" aria-label={service}>
      <p className="studio-chat-accounts__service">
        <span className={`studio-chat__lamp is-${lamp}`} aria-hidden="true" />
        {service}
      </p>
      {email && <p className="studio-chat-accounts__email">{email}</p>}
      {detail && <p className="studio-chat-accounts__detail">{detail}</p>}
      {note && <p className="studio-chat-accounts__note">{note}</p>}
      {usage}
      {children && (
        <div className="studio-chat-accounts__actions">{children}</div>
      )}
    </section>
  );
}

/** The ChatGPT account the member's Codex is signed in to, for pictures. */
function ChatGptAccount() {
  const { t } = useTranslation();
  const { codex, codexSigningIn } = useStudioChat();

  useEffect(() => {
    checkStudioChatCodex().catch(() => undefined);
  }, []);

  const gptReady = codex?.codex === 'ready';
  let gptNote: string | undefined;
  if (codex?.codex === 'missing') {
    gptNote = t('studioChat.accounts.codexMissing');
  } else if (codex?.codex === 'signed-out') {
    gptNote = t('studioChat.accounts.codexOut');
  } else if (gptReady) {
    gptNote = t(
      codex.connected
        ? 'studioChat.accounts.picturesOn'
        : 'studioChat.accounts.picturesOff',
    );
  }

  return (
    <AccountCard
      service={t('studioChat.accounts.chatgpt')}
      lamp={gptReady ? 'ready' : 'off'}
      email={
        gptReady ? (codex.email ?? t('studioChat.accounts.unknown')) : undefined
      }
      detail={
        gptReady && codex.plan
          ? t('studioChat.accounts.codexPlan', { plan: planName(codex.plan) })
          : undefined
      }
      note={gptNote}
    >
      {codex?.codex === 'missing' ? (
        <button
          type="button"
          className="button small"
          onClick={() => window.open(CODEX_APP_URL, '_blank', 'noopener')}
        >
          {t('studioChat.ask.getCodex')}
        </button>
      ) : (
        <button
          type="button"
          className={`button small${gptReady ? ' subtle' : ''}${codexSigningIn ? ' is-running' : ''}`}
          disabled={codexSigningIn || !codex}
          onClick={() => {
            signInToStudioChatCodex().catch(() => undefined);
          }}
        >
          {t(gptReady ? 'studioChat.accounts.switch' : 'studioChat.ask.signIn')}
        </button>
      )}
      {gptReady && codex.connected && (
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            disconnectStudioChatCodex().catch(() => undefined);
          }}
        >
          <Glyph name="image" />
          {t('studioChat.accounts.picturesOffButton')}
        </button>
      )}
    </AccountCard>
  );
}

/**
 * Which accounts the chat runs on (Ivan, 2026-10-13: "I need to know in
 * studio which claude account and gpt account is logged in"): the Claude
 * account Claude Code is signed in to, and the ChatGPT account the member's
 * Codex is, with their plans, and the way to sign in with another. Both are
 * asked again whenever this opens, so it is never yesterday's answer. The
 * ChatGPT row only while ChatGPT pictures are open (`studioChatPictures.ts`):
 * closed, nothing here asks Codex anything.
 */
export default function StudioChatAccounts() {
  const { t } = useTranslation();
  const { availability, signingIn } = useStudioChat();

  useEffect(() => {
    checkStudioChat().catch(() => undefined);
  }, []);

  const claudeReady = availability.state === 'ready';
  const claudeDetail =
    claudeReady && availability.plan
      ? t('studioChat.wherePlan', { plan: planName(availability.plan) })
      : undefined;

  let claudeNote: string | undefined;
  let claudeAction: ReactNode;
  if (availability.state === 'missing') {
    claudeNote = t('studioChat.accounts.claudeMissing');
    claudeAction = (
      <button
        type="button"
        className="button small"
        onClick={() =>
          window.open(CLAUDE_CODE_INSTALL_URL, '_blank', 'noopener')
        }
      >
        {t('studioChat.install')}
      </button>
    );
  } else {
    if (availability.state === 'signed-out') {
      claudeNote = t('studioChat.accounts.claudeOut');
    }
    claudeAction = (
      <button
        type="button"
        className={`button small${claudeReady ? ' subtle' : ''}${signingIn ? ' is-running' : ''}`}
        disabled={signingIn || availability.state === 'checking'}
        onClick={() => {
          signInToStudioChat().catch(() => undefined);
        }}
      >
        {t(claudeReady ? 'studioChat.accounts.switch' : 'studioChat.signIn')}
      </button>
    );
  }

  return (
    <div className="studio-chat-accounts">
      <h3 className="studio-chat-past__heading">
        {t('studioChat.accounts.title')}
      </h3>
      <AccountCard
        service={t('studioChat.accounts.claude')}
        lamp={claudeReady ? 'ready' : 'off'}
        email={
          claudeReady
            ? (availability.email ?? t('studioChat.accounts.unknown'))
            : undefined
        }
        detail={claudeDetail}
        note={claudeNote}
        usage={claudeReady ? <StudioChatLimits /> : undefined}
      >
        {claudeAction}
      </AccountCard>
      {CHATGPT_PICTURES_OPEN && <ChatGptAccount />}
      <p className="studio-chat-accounts__fine">
        {t('studioChat.accounts.fine')}
      </p>
    </div>
  );
}
