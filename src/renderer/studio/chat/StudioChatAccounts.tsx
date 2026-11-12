/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, type ReactNode, type Ref } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import StudioChatLimits from './StudioChatLimits';
import { CLAUDE_CODE_INSTALL_URL } from './StudioChatSetup';
import {
  checkStudioChat,
  signInToStudioChat,
  useStudioChat,
} from './studioChatStore';
import {
  checkStudioMakers,
  connectHiggsfield,
  useStudioMakers,
} from './studioMakersStore';
import '../../styles/StudioChatAccounts.scss';

/**
 * Plans by the names their makers sell them under. Claude Code reports a
 * plan as one lower-case word ("max", "prolite"); a plan this does
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

/** Higgsfield's own site, for a member who has not heard of it. */
const HIGGSFIELD_URL = 'https://higgsfield.ai';

/**
 * Higgsfield, the Studio's one maker of pictures, videos and 3D models, as
 * the member's own Claude Code has it (Ivan, 2026-11-11: "let's only use
 * Higgsfield for image gen, videos and everything Higgsfield can do").
 *
 * Asked again when this opens and whenever the window comes back, so a
 * sign-in finished in the browser shows without anything to press. Nothing
 * is drawn before the first answer. It is set up on the member's press
 * only: FluidEQ adds it to their Claude Code and opens Claude Code's own
 * sign-in to it, and never sees the sign-in. Which account it is cannot be
 * read from here, so none is named. One the member connected themselves as a
 * claude.ai connector counts the same.
 */
function HiggsfieldAccount() {
  const { t } = useTranslation();
  const { higgsfield, connecting } = useStudioMakers();

  useEffect(() => {
    const check = () => {
      checkStudioMakers().catch(() => undefined);
    };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  if (!higgsfield) {
    return null;
  }

  const connect = (another: boolean) => {
    connectHiggsfield(another).catch(() => undefined);
  };
  const running = connecting ? ' is-running' : '';
  const { state } = higgsfield;

  let note: string;
  let actions: ReactNode;
  if (state === 'ready') {
    note = t('studioChat.accounts.higgsfieldNote');
    actions = (
      <button
        type="button"
        className={`button small subtle${running}`}
        disabled={connecting}
        onClick={() => connect(true)}
      >
        {t('studioChat.accounts.switch')}
      </button>
    );
  } else if (state === 'unreachable') {
    note = t('studioChat.accounts.higgsfieldUnreachable');
    actions = (
      <button
        type="button"
        className="button small subtle"
        onClick={() => {
          checkStudioMakers().catch(() => undefined);
        }}
      >
        {t('studioChat.accounts.checkAgain')}
      </button>
    );
  } else {
    // A connector from claude.ai is set up as a server of the member's own,
    // the one thing the chat's Claude Code can reach (`common/studioMakers`).
    const setUp = state === 'missing' || state === 'connector';
    if (state === 'missing') {
      note = t('studioChat.accounts.higgsfieldMissing');
    } else if (state === 'connector') {
      note = t('studioChat.accounts.higgsfieldConnector');
    } else {
      note = t('studioChat.accounts.higgsfieldOut');
    }
    actions = (
      <>
        <button
          type="button"
          className={`button small${running}`}
          disabled={connecting}
          onClick={() => connect(false)}
        >
          {t(
            setUp
              ? 'studioChat.accounts.higgsfieldSetUp'
              : 'studioChat.accounts.higgsfieldSignIn',
          )}
        </button>
        {state === 'missing' && (
          <button
            type="button"
            className="button small subtle"
            onClick={() => window.open(HIGGSFIELD_URL, '_blank', 'noopener')}
          >
            {t('studioChat.accounts.higgsfieldAbout')}
          </button>
        )}
      </>
    );
  }

  return (
    <AccountCard
      service={t('studioChat.accounts.higgsfield')}
      lamp={state === 'ready' ? 'ready' : 'off'}
      detail={
        state === 'ready' ? t('studioChat.accounts.higgsfieldReady') : undefined
      }
      note={connecting ? t('studioChat.accounts.higgsfieldConnecting') : note}
    >
      {actions}
    </AccountCard>
  );
}

/**
 * Which accounts the chat runs on (Ivan, 2026-10-13: "I need to know in
 * studio which claude account … is logged in"): the Claude account Claude
 * Code is signed in to, with its plan and the way to sign in with another,
 * and Higgsfield, which makes the scene's pictures, videos and models. Both
 * are asked again whenever this opens, so it is never yesterday's answer.
 */
export default function StudioChatAccounts({
  closeRef,
  onClose,
}: {
  /** The ×, which the chat focuses when the pane opened from ⋯. */
  closeRef: Ref<HTMLButtonElement>;
  /** Back to the chat. */
  onClose: () => void;
}) {
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
    // Focusable, so a press on the cards' words keeps focus in the pane,
    // where its Escape is heard.
    <div className="studio-chat-accounts" tabIndex={-1}>
      <div className="studio-chat-accounts__head">
        <h3 className="studio-chat-past__heading">
          {t('studioChat.accounts.title')}
        </h3>
        <button
          ref={closeRef}
          type="button"
          className="studio-chat__icon"
          title={t('studioChat.backToChat')}
          aria-label={t('studioChat.backToChat')}
          onClick={onClose}
        >
          <Glyph name="close" />
        </button>
      </div>
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
      {/* Higgsfield lives in the member's Claude Code: none without it. */}
      {(claudeReady || availability.state === 'signed-out') && (
        <HiggsfieldAccount />
      )}
      <p className="studio-chat-accounts__fine">
        {t('studioChat.accounts.fine')}
      </p>
    </div>
  );
}
