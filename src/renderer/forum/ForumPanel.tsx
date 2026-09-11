import { useEffect } from 'react';
import { useTranslation } from '../utils/I18nContext';
import failureMessage from './forumFailure';
import ForumGlyph from './ForumGlyph';
import ForumRail from './ForumRail';
import {
  clearForumError,
  closeForum,
  openForum,
  refreshForum,
  selectBoard,
  useForum,
} from './forumStore';
import NewTopicForm from './NewTopicForm';
import TopicList from './TopicList';
import TopicView from './TopicView';
import '../styles/CommunityRail.scss';
import '../styles/Community.scss';
import '../styles/Forum.scss';
import '../styles/ForumList.scss';
import '../styles/ForumThread.scss';
import '../styles/ForumPost.scss';
import '../styles/ForumProse.scss';
import '../styles/ForumComposer.scss';

/**
 * The Forum tab: the project's GitHub Discussions, inside the app.
 *
 * Every board down the left, the topics beside them, a thread in their place
 * when one is opened. Reading needs nothing at all; writing needs a GitHub
 * sign-in, which happens in the system browser and comes back here — no
 * FluidEQ account, no Plus, and no password typed into this window.
 *
 * Laid out on the Community tab's own grid and rail so the two neighbours in
 * the titlebar are recognisably one family.
 */
export default function ForumPanel() {
  const { t, locale } = useTranslation();
  const forum = useForum();

  useEffect(() => {
    openForum().catch(() => undefined);
    return () => closeForum();
  }, []);

  // Coming back to the window is when somebody expects the replies they were
  // waiting for to be there — including their own, posted on github.com.
  useEffect(() => {
    const onFocus = () => {
      refreshForum().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const message = forum.error ? failureMessage(forum.error, t, locale) : '';

  return (
    <div className="community forum">
      <ForumRail
        boards={forum.boards}
        board={forum.board}
        searching={forum.search !== ''}
        auth={forum.auth}
        onSelect={selectBoard}
      />
      <section className="community__main forum__main">
        {message && (
          <div className="forum__error" role="alert">
            <span>{message}</span>
            <span className="forum__error-actions">
              {forum.error?.failure === 'network' && (
                <button
                  type="button"
                  className="community__link"
                  onClick={() => {
                    clearForumError();
                    refreshForum().catch(() => undefined);
                  }}
                >
                  {t('forum.retry')}
                </button>
              )}
              <button
                type="button"
                className="forum__icon-button"
                aria-label={t('forum.error.dismiss')}
                title={t('forum.error.dismiss')}
                onClick={clearForumError}
              >
                <ForumGlyph name="close" />
              </button>
            </span>
          </div>
        )}
        {forum.view.kind === 'compose' && <NewTopicForm forum={forum} />}
        {forum.view.kind === 'topic' && <TopicView forum={forum} />}
        {forum.view.kind === 'list' && <TopicList forum={forum} />}
      </section>
    </div>
  );
}
