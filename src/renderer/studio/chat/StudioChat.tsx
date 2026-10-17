/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioProject } from 'main/ipc/studioProjectTypes';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import StudioMaker from '../StudioMaker';
import StudioChatAccounts, { planName } from './StudioChatAccounts';
import StudioChatAsk from './StudioChatAsk';
import StudioChatComposer from './StudioChatComposer';
import StudioChatMenu from './StudioChatMenu';
import StudioChatPast from './StudioChatPast';
import StudioChatQueue from './StudioChatQueue';
import StudioChatSetup from './StudioChatSetup';
import StudioChatThread from './StudioChatThread';
import useChatZoomWheel from './useChatZoomWheel';
import {
  checkStudioChat,
  checkStudioChatCodex,
  loadStudioChat,
  newStudioChat,
  retryStudioChat,
  sendToStudioChat,
  useStudioChat,
} from './studioChatStore';
import '../../styles/StudioChat.scss';

interface IStudioChatProps {
  /** The open project; none before the first one. */
  project?: IStudioProject;
  /** The version the stage plays, so its card says it is playing. */
  version?: number;
  /** A picture of the stage as it is now; absent while nothing plays. */
  captureStage?: () => Promise<Uint8Array | undefined>;
  /** Folds the pane into its rail; absent where the chat is a tab. */
  onFold?: () => void;
}

/**
 * The Studio's chat with the member's own Claude Code (Ivan, 2026-10-09:
 * "a side pane instead for the chat"): the whole height of the bench beside
 * the stage, so the scene and the conversation that makes it are in view
 * together. Claude Code missing or signed out, it says how to fix that; and
 * "Use another AI" keeps the Studio's prompt for any assistant, which is how
 * every scene was made before the chat.
 */
export default function StudioChat({
  project,
  version,
  captureStage,
  onFold,
}: IStudioChatProps) {
  const { t, locale } = useTranslation();
  const { availability, chat, ask, codex, zoom } = useStudioChat();
  const pane = useRef<HTMLElement>(null);
  useChatZoomWheel(pane);
  // What the pane shows: the chat, the prompt for another AI, or the
  // earlier chats.
  const [view, setView] = useState<'chat' | 'other' | 'past' | 'accounts'>(
    'chat',
  );
  const otherAi = view === 'other';
  // Held here, so an idea chosen in the thread lands in the message box.
  const [draft, setDraft] = useState('');
  const projectId = project?.id;

  useEffect(() => {
    checkStudioChat().catch(() => undefined);
    checkStudioChatCodex().catch(() => undefined);
    // Back in the window after installing or signing in elsewhere: asked
    // again, so the pane does not go on saying it is missing.
    const onFocus = () => {
      checkStudioChat().catch(() => undefined);
      checkStudioChatCodex().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    loadStudioChat().catch(() => undefined);
  }, [projectId]);

  const ready = availability.state === 'ready';
  const canChat = ready && project !== undefined && !project.official;
  const plan = ready && availability.plan ? planName(availability.plan) : '';
  // A project that already holds a scene is named by it: its chat starts on
  // what to change, not on what to make.
  const sceneName = project?.names
    ? resolveSceneName({ names: project.names }, locale)
    : undefined;

  let body;
  if (view === 'accounts') {
    body = <StudioChatAccounts />;
  } else if (view === 'past' && canChat) {
    body = <StudioChatPast onOpened={() => setView('chat')} />;
  } else if (otherAi) {
    body = (
      <div className="studio-chat__other">
        <StudioMaker key={projectId ?? 'draft'} project={project} />
      </div>
    );
  } else if (!ready) {
    body = <StudioChatSetup availability={availability} />;
  } else if (!project || project.official) {
    body = (
      <p className="studio-chat__note">
        {t(project ? 'studioChat.inspect' : 'studioChat.noProject')}
      </p>
    );
  } else {
    body = (
      <>
        <StudioChatThread
          chat={chat}
          sceneName={sceneName}
          version={version}
          onIdea={setDraft}
          onCarryOn={() => {
            sendToStudioChat(
              t('studioChat.carryOnMessage'),
              project.path,
            ).catch(() => undefined);
          }}
          onRetry={() => {
            retryStudioChat(project.path).catch(() => undefined);
          }}
        />
        {ask && ask.projectId === chat?.projectId && (
          <StudioChatAsk ask={ask} />
        )}
        <StudioChatQueue queued={chat?.queued ?? []} />
        <StudioChatComposer
          draft={draft}
          onDraft={setDraft}
          busy={chat?.busy ?? false}
          first={(chat?.entries.length ?? 0) === 0 && !sceneName}
          folder={project.path}
          captureStage={captureStage}
        />
      </>
    );
  }

  return (
    <section
      ref={pane}
      className="studio-chat"
      aria-label={t('studioChat.label')}
      style={{ '--chat-zoom': zoom } as CSSProperties}
    >
      <header className="studio-chat__head">
        <span
          className={`studio-chat__lamp is-${availability.state}`}
          aria-hidden="true"
        />
        <span className="studio-chat__who">
          <span className="studio-chat__name">{t('studioChat.title')}</span>
          {/* Whose plan the chat runs on is a press away (`StudioChatAccounts`):
              the line naming it opens the accounts, and closes them again. */}
          <button
            type="button"
            className="studio-chat__where"
            aria-pressed={view === 'accounts'}
            title={t('studioChat.accounts.open')}
            onClick={() =>
              setView((shown) => (shown === 'accounts' ? 'chat' : 'accounts'))
            }
          >
            {plan ? t('studioChat.wherePlan', { plan }) : t('studioChat.where')}
            {/* ChatGPT's pictures on: a glyph beside the plan, never words,
                which broke the head into three lines in a pane 320px wide.
                The words and the way to turn them off are behind ⋯. */}
            {codex?.connected && (
              <span
                className="studio-chat__gpt-on"
                title={t('studioChat.chatgptOn')}
              >
                <Glyph name="image" />
              </span>
            )}
          </button>
        </span>
        {canChat && !otherAi && (
          <button
            type="button"
            className="studio-chat__icon"
            title={t('studioChat.past.title')}
            aria-label={t('studioChat.past.title')}
            aria-pressed={view === 'past'}
            onClick={() =>
              setView((shown) => (shown === 'past' ? 'chat' : 'past'))
            }
          >
            <Glyph name="history" />
          </button>
        )}
        {canChat && view === 'chat' && (chat?.entries.length ?? 0) > 0 && (
          <button
            type="button"
            className="studio-chat__icon"
            title={t('studioChat.new')}
            aria-label={t('studioChat.new')}
            disabled={chat?.busy}
            onClick={() => {
              newStudioChat().catch(() => undefined);
            }}
          >
            <Glyph name="plus" />
          </button>
        )}
        {/* "Use another AI" is behind ⋯; while it is open, the way back to
            the chat is here, where the member is looking. */}
        {otherAi && (
          <button
            type="button"
            className="studio-chat__switch"
            aria-pressed
            title={t('studioChat.backToChat')}
            onClick={() => setView('chat')}
          >
            {/* The words give way to the glyph in a narrow pane, where the
                head's buttons pushed the plan's name onto two lines; the
                title keeps them. */}
            <Glyph name="link" />
            <span>{t('studioChat.backToChat')}</span>
          </button>
        )}
        <StudioChatMenu
          onAccounts={() => setView('accounts')}
          otherAi={otherAi}
          onOtherAi={() =>
            setView((shown) => (shown === 'other' ? 'chat' : 'other'))
          }
        />
        {onFold && (
          <button
            type="button"
            className="studio-chat__icon"
            title={t('studioChat.fold')}
            aria-label={t('studioChat.fold')}
            onClick={onFold}
          >
            <Glyph name="rail-collapse" />
          </button>
        )}
      </header>
      {body}
    </section>
  );
}
