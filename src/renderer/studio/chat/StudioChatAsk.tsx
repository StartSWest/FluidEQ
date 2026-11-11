/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment, useEffect, useId, useState } from 'react';
import type { TStudioChatAsk, TStudioChatCodex } from 'common/studioChat';
import { STUDIO_MAKERS, type TStudioMaker } from 'common/studioMakers';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import {
  answerStudioChat,
  answerStudioChatMaker,
  checkStudioChatCodex,
  signInToStudioChatCodex,
  useStudioChat,
} from './studioChatStore';
import '../../styles/StudioChatAsk.scss';

/** OpenAI's own page for the Codex app, on every platform it ships for. */
export const CODEX_APP_URL = 'https://developers.openai.com/codex/app';

/** Connecting ChatGPT: what Codex needs first, then the yes or no. */
function ConnectCard({
  ask,
  codex,
}: {
  ask: Extract<TStudioChatAsk, { kind: 'connect' }>;
  codex: TStudioChatCodex;
}) {
  const { t } = useTranslation();
  const { codexSigningIn } = useStudioChat();
  let lead;
  if (codex === 'missing') {
    lead = (
      <button
        type="button"
        className="button small"
        onClick={() => window.open(CODEX_APP_URL, '_blank', 'noopener')}
      >
        {t('studioChat.ask.getCodex')}
      </button>
    );
  } else if (codex === 'signed-out') {
    lead = (
      <button
        type="button"
        className={`button small${codexSigningIn ? ' is-running' : ''}`}
        disabled={codexSigningIn}
        onClick={() => {
          signInToStudioChatCodex().catch(() => undefined);
        }}
      >
        {t('studioChat.ask.signIn')}
      </button>
    );
  } else {
    lead = (
      <button
        type="button"
        className="button small"
        onClick={() => {
          answerStudioChat(ask.id, 'yes').catch(() => undefined);
        }}
      >
        {t('studioChat.ask.connect')}
      </button>
    );
  }
  return (
    <>
      <p className="studio-chat__ask-title">
        {t('studioChat.ask.connectTitle')}
      </p>
      <p className="studio-chat__ask-body">{t('studioChat.ask.connectBody')}</p>
      {codex !== 'ready' && (
        <p className="studio-chat__ask-need">
          {t(
            codex === 'missing'
              ? 'studioChat.ask.needsCodex'
              : 'studioChat.ask.codexSignedOut',
          )}
        </p>
      )}
      <div className="studio-chat__ask-actions">
        {lead}
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            answerStudioChat(ask.id, 'no').catch(() => undefined);
          }}
        >
          {t('studioChat.ask.notNow')}
        </button>
      </div>
    </>
  );
}

/** One picture: what it is for, what ChatGPT is asked to draw, its size. */
function PictureCard({
  ask,
}: {
  ask: Extract<TStudioChatAsk, { kind: 'picture' }>;
}) {
  const { t } = useTranslation();
  const answer = (choice: 'yes' | 'chat' | 'no') => {
    answerStudioChat(ask.id, choice).catch(() => undefined);
  };
  return (
    <>
      <p className="studio-chat__ask-title">
        {t('studioChat.ask.pictureTitle')}
      </p>
      <p className="studio-chat__ask-why">{ask.why}</p>
      <blockquote className="studio-chat__ask-prompt">{ask.prompt}</blockquote>
      <p className="studio-chat__ask-meta">
        <span>
          {t('studioChat.ask.pictureSize', {
            width: ask.width,
            height: ask.height,
          })}
        </span>
        {ask.transparent && <span>{t('studioChat.ask.transparent')}</span>}
        <span>{t('studioChat.ask.cost')}</span>
      </p>
      <div className="studio-chat__ask-actions">
        <button
          type="button"
          className="button small"
          onClick={() => answer('yes')}
        >
          {t('studioChat.ask.makeIt')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={() => answer('chat')}
        >
          {t('studioChat.ask.allowChat')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={() => answer('no')}
        >
          {t('studioChat.ask.notNow')}
        </button>
      </div>
    </>
  );
}

/**
 * One of the member's own Claude Code tools, which their settings do not
 * already allow: its name, what it is about to do, and the yes or no.
 * Allow is the loud press, the suggested one, since Claude asked because the
 * request needs it; the member can still say no, and that is final.
 */
function ToolCard({ ask }: { ask: Extract<TStudioChatAsk, { kind: 'tool' }> }) {
  const { t } = useTranslation();
  const answer = (choice: 'yes' | 'chat' | 'no') => {
    answerStudioChat(ask.id, choice).catch(() => undefined);
  };
  return (
    <>
      <p className="studio-chat__ask-title">
        {t('studioChat.ask.toolTitle', { tool: ask.tool })}
      </p>
      <p className="studio-chat__ask-body">{t('studioChat.ask.toolBody')}</p>
      {ask.foreign && (
        <p className="studio-chat__ask-need">{t('studioChat.ask.foreign')}</p>
      )}
      <pre className="studio-chat__ask-detail">{ask.detail}</pre>
      {/* Three answers on one row at the chat's narrowest (Ivan,
          2026-11-07: a fourth wrapped "Don't allow" onto a line of its
          own). Always is for this chat, never every scene's: "always allow
          is per chat not global". */}
      <div className="studio-chat__ask-actions">
        <button
          type="button"
          className="button small"
          onClick={() => answer('yes')}
        >
          {t('studioChat.ask.allow')}
        </button>
        {/* Nothing is allowed for always in a scene from outside FluidEQ. */}
        {!ask.foreign && (
          <button
            type="button"
            className="button small subtle"
            title={t('studioChat.ask.allowAlwaysHint', { tool: ask.tool })}
            onClick={() => answer('chat')}
          >
            {t('studioChat.ask.allowAlways')}
          </button>
        )}
        <button
          type="button"
          className="button small subtle"
          onClick={() => answer('no')}
        >
          {t('studioChat.ask.deny')}
        </button>
      </div>
    </>
  );
}

/**
 * Which of the member's own two makers makes this one thing (Ivan,
 * 2026-11-11: "que pida si quiere usar GPT o Higgsfield"): put up only
 * when both are connected and nothing is chosen. Each press stands beside
 * what it runs on, and both wear the loud style, since neither is the
 * suggested one. Ticked, the press is kept as the choice from then on; it is
 * changed in Accounts, which the tick's own words say.
 */
function MakerCard({
  ask,
}: {
  ask: Extract<TStudioChatAsk, { kind: 'maker' }>;
}) {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(false);
  const id = useId();
  const names: Record<TStudioMaker, string> = {
    gpt: t('studioChat.accounts.gpt'),
    higgsfield: t('studioChat.accounts.higgsfield'),
  };
  const runsOn: Record<TStudioMaker, string> = {
    gpt: t('studioChat.ask.makerGpt'),
    higgsfield: t('studioChat.ask.makerHiggsfield'),
  };
  return (
    <>
      <p className="studio-chat__ask-title">
        {t(
          ask.what === 'frames'
            ? 'studioChat.ask.makerFrames'
            : 'studioChat.ask.makerPicture',
        )}
      </p>
      <p className="studio-chat__ask-why">{ask.why}</p>
      <div className="studio-chat__ask-makers">
        {STUDIO_MAKERS.map((maker) => (
          <Fragment key={maker}>
            <button
              type="button"
              className="button small"
              aria-describedby={`${id}-${maker}`}
              onClick={() => {
                answerStudioChatMaker(ask.id, maker, remember).catch(
                  () => undefined,
                );
              }}
            >
              {names[maker]}
            </button>
            <span id={`${id}-${maker}`} className="studio-chat__ask-body">
              {runsOn[maker]}
            </span>
          </Fragment>
        ))}
      </div>
      <label className="studio-chat__ask-remember" htmlFor={`${id}-remember`}>
        <input
          id={`${id}-remember`}
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        {t('studioChat.ask.makerRemember')}
      </label>
      <div className="studio-chat__ask-actions">
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            answerStudioChat(ask.id, 'no').catch(() => undefined);
          }}
        >
          {t('studioChat.ask.notNow')}
        </button>
      </div>
    </>
  );
}

/**
 * The card Claude's use of ChatGPT waits on (Ivan, 2026-10-09: "it needs to
 * ask the user if you connect gpt codex … and also ask when it will use
 * it"), at the foot of the conversation where the reply stands waiting.
 * Codex's state is asked again while the card is up and whenever the window
 * comes back, so installing Codex or signing in elsewhere turns "Get Codex"
 * into "Connect" without anything to press.
 */
export default function StudioChatAsk({ ask }: { ask: TStudioChatAsk }) {
  const { t } = useTranslation();
  const { codex } = useStudioChat();
  const connecting = ask.kind === 'connect';

  useEffect(() => {
    if (!connecting) {
      return undefined;
    }
    checkStudioChatCodex().catch(() => undefined);
    const onFocus = () => {
      checkStudioChatCodex().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [connecting]);

  let label;
  let card;
  if (ask.kind === 'connect') {
    label = t('studioChat.ask.connectTitle');
    card = <ConnectCard ask={ask} codex={codex?.codex ?? ask.codex} />;
  } else if (ask.kind === 'picture') {
    label = t('studioChat.ask.pictureTitle');
    card = <PictureCard ask={ask} />;
  } else if (ask.kind === 'maker') {
    label = t(
      ask.what === 'frames'
        ? 'studioChat.ask.makerFrames'
        : 'studioChat.ask.makerPicture',
    );
    card = <MakerCard ask={ask} />;
  } else {
    label = t('studioChat.ask.toolTitle', { tool: ask.tool });
    card = <ToolCard ask={ask} />;
  }

  return (
    <section className="studio-chat__ask" aria-label={label}>
      <span className="studio-chat__ask-mark" aria-hidden="true">
        <Glyph name={ask.kind === 'tool' ? 'shield' : 'image'} />
      </span>
      <div className="studio-chat__ask-content">{card}</div>
    </section>
  );
}
