import { useEffect, useState, type CSSProperties } from 'react';
import { animatorChatKey } from 'common/studioChat';
import { useTranslation } from '../../utils/I18nContext';
import StudioChatAsk from '../chat/StudioChatAsk';
import StudioChatComposer from '../chat/StudioChatComposer';
import StudioChatQueue from '../chat/StudioChatQueue';
import StudioChatSetup from '../chat/StudioChatSetup';
import StudioChatThread from '../chat/StudioChatThread';
import {
  loadAnimatorChat,
  restoreAnimatorVersion,
  retryAnimator,
  sendNowToAnimator,
  sendToAnimator,
  stopAnimator,
  unqueueAnimator,
  useAnimatorChats,
} from '../chat/animatorChatStore';
import { useStudioChat } from '../chat/studioChatStore';
import '../../styles/StudioChat.scss';

interface IAnimatorChatProps {
  projectId: string;
  name: string;
}

/**
 * An animation's animator, beside it (Ivan, 2026-11-09: "that opened
 * animation will have the agent too ... when I open it I will be able to see
 * it working and chat with it too to train it"): a chat of its own, the
 * scene's chat's parts on the animator's channels, so what it is doing - and
 * a task the scene's chat handed it - shows here while it works.
 */
export default function AnimatorChat({ projectId, name }: IAnimatorChatProps) {
  const { t } = useTranslation();
  const { availability, zoom } = useStudioChat();
  const { chats, busy, asks } = useAnimatorChats();
  const key = animatorChatKey(projectId, name);
  const chat = chats[key];
  const working = chat?.busy ?? busy[key] ?? false;
  const ask = asks[key];
  // The message being written, kept while the animation stays open.
  const [draft, setDraft] = useState('');
  const [stage, setStage] = useState<Uint8Array>();

  useEffect(() => {
    loadAnimatorChat(name).catch(() => undefined);
  }, [projectId, name]);

  return (
    <section
      className="studio-chat studio-animator"
      aria-label={t('studio.animator.title')}
      style={{ '--chat-zoom': zoom } as CSSProperties}
    >
      <header className="studio-chat__head">
        <span
          className={`studio-chat__lamp is-${availability.state}${working ? ' is-checking' : ''}`}
          aria-hidden="true"
        />
        <span className="studio-chat__who">
          <span className="studio-chat__name">
            {t('studio.animator.title')}
          </span>
          <span className="studio-animator__about" aria-live="polite">
            {t(working ? 'studio.animator.working' : 'studio.animator.on', {
              name,
            })}
          </span>
        </span>
      </header>
      {availability.state === 'ready' ? (
        <>
          <StudioChatThread
            chat={chat}
            onIdea={setDraft}
            onCarryOn={() => {
              sendToAnimator(name, t('studioChat.carryOnMessage')).catch(
                () => undefined,
              );
            }}
            onRetry={() => {
              retryAnimator(name).catch(() => undefined);
            }}
            onRestore={(entryId) => restoreAnimatorVersion(name, entryId)}
            onAttachPicture={setStage}
            welcome={
              <>
                <h3>{t('studio.animator.welcomeTitle', { name })}</h3>
                <p>{t('studio.animator.welcomeBody')}</p>
              </>
            }
          />
          {ask && <StudioChatAsk ask={ask} />}
          <StudioChatQueue
            queued={chat?.queued ?? []}
            onSendNow={() => sendNowToAnimator(name)}
            onUnqueue={(id) => unqueueAnimator(name, id)}
          />
          <StudioChatComposer
            draft={draft}
            onDraft={setDraft}
            stage={stage}
            onStage={setStage}
            busy={working}
            placeholder={t('studio.animator.placeholder')}
            onSend={(text, picture) => sendToAnimator(name, text, picture)}
            onStop={() => stopAnimator(name)}
          />
        </>
      ) : (
        <StudioChatSetup availability={availability} />
      )}
    </section>
  );
}
