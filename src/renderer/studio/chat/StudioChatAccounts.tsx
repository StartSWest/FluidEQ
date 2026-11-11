/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, type ReactNode, type Ref } from 'react';
import { CHATGPT_PICTURES_OPEN } from 'common/studioChatPictures';
import { connectedMakers, type TStudioMakerChoice } from 'common/studioMakers';
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
import {
  checkStudioMakers,
  connectHiggsfield,
  setStudioMakerChoice,
  useStudioMakers,
} from './studioMakersStore';
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

/** Higgsfield's own site, for a member who has not heard of it. */
const HIGGSFIELD_URL = 'https://higgsfield.ai';

/**
 * The member's own two makers of pictures, as their Claude Code has them
 * (Ivan, 2026-11-11: "quiero que Fluid esté preparado para usar Higgsfield.
 * Y que pida si quiere usar GPT o Higgsfield"): their GPT plugin, Higgsfield,
 * and which of the two is used while both are connected.
 *
 * Asked again when this opens and whenever the window comes back, so a
 * plugin added in Claude Code or a sign-in finished in the browser shows
 * without anything to press. Nothing is drawn before the first answer.
 * Higgsfield is set up on the member's press only: FluidEQ adds it to their
 * Claude Code and opens Claude Code's own sign-in to it, and never sees the
 * sign-in. Which account it is cannot be read from here, so none is named.
 */
function MakerAccounts() {
  const { t } = useTranslation();
  const { makers, connecting: higgsfieldConnecting } = useStudioMakers();

  useEffect(() => {
    const check = () => {
      checkStudioMakers().catch(() => undefined);
    };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  if (!makers) {
    return null;
  }

  const connect = (another: boolean) => {
    connectHiggsfield(another).catch(() => undefined);
  };
  const running = higgsfieldConnecting ? ' is-running' : '';
  const { state } = makers.higgsfield;

  let higgsfieldNote: string;
  let higgsfieldActions: ReactNode;
  if (state === 'ready') {
    higgsfieldNote = t('studioChat.accounts.higgsfieldNote');
    higgsfieldActions = (
      <button
        type="button"
        className={`button small subtle${running}`}
        disabled={higgsfieldConnecting}
        onClick={() => connect(true)}
      >
        {t('studioChat.accounts.switch')}
      </button>
    );
  } else if (state === 'unreachable') {
    higgsfieldNote = t('studioChat.accounts.higgsfieldUnreachable');
    higgsfieldActions = (
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
    higgsfieldNote = t(
      state === 'missing'
        ? 'studioChat.accounts.higgsfieldMissing'
        : 'studioChat.accounts.higgsfieldOut',
    );
    higgsfieldActions = (
      <>
        <button
          type="button"
          className={`button small${running}`}
          disabled={higgsfieldConnecting}
          onClick={() => connect(false)}
        >
          {t(
            state === 'missing'
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

  const choices: [TStudioMakerChoice, string][] = [
    ['ask', t('studioChat.accounts.makeWithAsk')],
    ['gpt', t('studioChat.accounts.gpt')],
    ['higgsfield', t('studioChat.accounts.higgsfield')],
  ];

  return (
    <>
      <AccountCard
        service={t('studioChat.accounts.gpt')}
        lamp={makers.gpt.found ? 'ready' : 'off'}
        detail={
          makers.gpt.found
            ? t('studioChat.accounts.gptFound', {
                name: makers.gpt.name?.split('@')[0] ?? 'GPT',
              })
            : undefined
        }
        note={t(
          makers.gpt.found
            ? 'studioChat.accounts.gptNote'
            : 'studioChat.accounts.gptMissing',
        )}
      />
      <AccountCard
        service={t('studioChat.accounts.higgsfield')}
        lamp={state === 'ready' ? 'ready' : 'off'}
        detail={
          state === 'ready'
            ? t('studioChat.accounts.higgsfieldReady')
            : undefined
        }
        note={
          higgsfieldConnecting
            ? t('studioChat.accounts.higgsfieldConnecting')
            : higgsfieldNote
        }
      >
        {higgsfieldActions}
      </AccountCard>
      {connectedMakers(makers).length > 1 && (
        <section
          className="studio-chat-accounts__card"
          aria-label={t('studioChat.accounts.makeWith')}
        >
          <p className="studio-chat-accounts__service">
            {t('studioChat.accounts.makeWith')}
          </p>
          <p className="studio-chat-accounts__note">
            {t('studioChat.accounts.makeWithNote')}
          </p>
          <div className="studio-chat-accounts__actions">
            {choices.map(([choice, name]) => (
              <button
                key={choice}
                type="button"
                className={`button small${makers.choice === choice ? '' : ' subtle'}`}
                aria-pressed={makers.choice === choice}
                onClick={() => {
                  setStudioMakerChoice(choice).catch(() => undefined);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
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
      {CHATGPT_PICTURES_OPEN && <ChatGptAccount />}
      {/* The member's own makers live in their Claude Code: none without it. */}
      {(claudeReady || availability.state === 'signed-out') && (
        <MakerAccounts />
      )}
      <p className="studio-chat-accounts__fine">
        {t('studioChat.accounts.fine')}
      </p>
    </div>
  );
}
