import { useRef, useState } from 'react';
import {
  FORUM_TITLE_MAX,
  type IForumComment,
  type IForumTopic,
} from 'common/forum/forumTypes';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { boardName } from './boardNames';
import ForumGlyph, { boardGlyph } from './ForumGlyph';
import ForumPost from './ForumPost';
import {
  backToList,
  editTitle,
  type IForumState,
  loadMoreComments,
  openTopic,
  refreshForum,
  reply,
  signIn,
} from './forumStore';
import PostComposer from './PostComposer';

interface ITopicViewProps {
  forum: IForumState;
}

/** Who a reply is going to: the thread it files under, and the row it opened from. */
interface IReplyTarget {
  row: string;
  threadId: string;
  login?: string;
}

/**
 * One topic: the opening post, the conversation under it, and the box to
 * join it — all on the surface where the thread is read, never behind a
 * dialog.
 */
export default function TopicView({ forum }: ITopicViewProps) {
  const { t, locale } = useTranslation();
  const [replyingTo, setReplyingTo] = useState<IReplyTarget | undefined>();
  const [editingTitle, setEditingTitle] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const { topic } = forum;
  const signedIn = forum.auth.status === 'signed-in';

  const listLabel = (() => {
    if (forum.search) {
      return `“${forum.search}”`;
    }
    return forum.board
      ? boardName(forum.board, forum.boards, t)
      : t('forum.allTopics');
  })();

  const bar = (
    <header className="forum__thread-bar">
      <button type="button" className="forum__back" onClick={backToList}>
        <ForumGlyph name="back" />
        {t('forum.backTo', { board: listLabel })}
      </button>
      <span className="forum__head-actions">
        <button
          type="button"
          className={`forum__icon-button${forum.topicStatus === 'loading' ? ' is-busy' : ''}`}
          aria-label={t('forum.refresh')}
          title={t('forum.refresh')}
          onClick={() => {
            refreshForum().catch(() => undefined);
          }}
        >
          <ForumGlyph name="refresh" />
        </button>
        {topic?.url && (
          <a
            className="button small subtle forum__github-link"
            href={topic.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <ForumGlyph name="external" />
            {t('forum.openOnGithub')}
          </a>
        )}
      </span>
    </header>
  );

  if (!topic) {
    const failed = forum.topicStatus === 'error';
    return (
      <div className="forum__thread-view">
        {bar}
        <div className="community__empty">
          <span className="community__empty-mark" aria-hidden="true">
            <ForumGlyph name="threads" />
          </span>
          <p className="community__empty-title">
            {failed ? t('forum.error.not_found') : t('forum.loading')}
          </p>
          {failed && forum.view.kind === 'topic' && (
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                if (forum.view.kind === 'topic') {
                  openTopic(forum.view.number);
                }
              }}
            >
              {t('forum.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const canReply = signedIn && !topic.locked;
  const answer = topic.comments.find((comment) => comment.isAnswer);
  const replyTo = (target: IReplyTarget) => () => setReplyingTo(target);

  return (
    <div className="forum__thread-view">
      {bar}
      <div className="forum__scroll forum__thread">
        <div className="forum__thread-head">
          <div className="forum__thread-chips">
            <span className="forum__chip">
              <ForumGlyph name={boardGlyph(topic.board)} />
              {boardName(topic.board, forum.boards, t)}
            </span>
            {answer && (
              <button
                type="button"
                className="forum__chip forum__chip--answer"
                onClick={() =>
                  document
                    .getElementById(`forum-comment-${answer.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              >
                <ForumGlyph name="answer" />
                {t('forum.topic.answered')}
              </button>
            )}
            {topic.locked && (
              <span className="forum__chip forum__chip--quiet">
                <Glyph name="lock" />
                {t('forum.topic.locked')}
              </span>
            )}
          </div>
          {editingTitle ? (
            <TitleEditor topic={topic} onDone={() => setEditingTitle(false)} />
          ) : (
            <h2 className="forum__thread-title">
              {topic.title}
              {topic.canEditTitle && (
                <button
                  type="button"
                  className="forum__icon-button forum__title-edit"
                  aria-label={t('forum.thread.editTitle')}
                  title={t('forum.thread.editTitle')}
                  onClick={() => setEditingTitle(true)}
                >
                  <ForumGlyph name="edit" />
                </button>
              )}
            </h2>
          )}
        </div>

        <ForumPost
          post={topic.post}
          kind={topic.postKind}
          topicAuthor={topic.author.login}
          className="forum-post--opening"
          onReply={
            canReply
              ? () => {
                  bottom.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                  });
                  bottom.current?.querySelector('textarea')?.focus();
                }
              : undefined
          }
        />

        <div className="forum__replies-head">
          <span>{t('forum.thread.replies')}</span>
          <span className="forum__count">
            {new Intl.NumberFormat(locale).format(topic.commentTotal)}
          </span>
        </div>

        {topic.comments.length === 0 ? (
          <div className="forum__no-replies">
            <p className="community__empty-title">
              {t('forum.thread.noReplies')}
            </p>
            <p className="community__empty-hint">
              {t('forum.thread.noRepliesHint')}
            </p>
          </div>
        ) : (
          <ol className="forum__comments">
            {topic.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                topic={topic}
                comment={comment}
                replyingTo={
                  replyingTo?.row === comment.id ? replyingTo : undefined
                }
                onReply={canReply ? replyTo : undefined}
                onCloseReply={() => setReplyingTo(undefined)}
              />
            ))}
          </ol>
        )}

        {topic.commentsCursor && (
          <button
            type="button"
            className="button small subtle forum__more"
            disabled={forum.topicStatus === 'more'}
            onClick={loadMoreComments}
          >
            {forum.topicStatus === 'more'
              ? t('forum.loading')
              : t('forum.thread.loadMore')}
          </button>
        )}
        {!topic.commentsCursor &&
          topic.commentTotal > topic.comments.length && (
            <a
              className="forum__to-github"
              href={topic.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('forum.thread.moreOnGithub')}
              <ForumGlyph name="external" />
            </a>
          )}

        <div className="forum__thread-foot" ref={bottom}>
          {topic.locked && (
            <p className="forum__notice forum__notice--locked">
              <Glyph name="lock" />
              {t('forum.thread.locked')}
            </p>
          )}
          {canReply && (
            <PostComposer
              label={t('forum.action.reply')}
              placeholder={t('forum.composer.replyPlaceholder')}
              submitLabel={t('forum.composer.postReply')}
              onSubmit={(body) => reply(topic.id, body)}
            />
          )}
          {!signedIn &&
            !topic.locked &&
            forum.auth.status !== 'unconfigured' && (
              <div className="forum__sign-in-prompt">
                <span>{t('forum.thread.signInToReply')}</span>
                <button
                  type="button"
                  className="button small"
                  disabled={forum.auth.status === 'signing-in'}
                  onClick={() => {
                    signIn(locale).catch(() => undefined);
                  }}
                >
                  {t('forum.signIn')}
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

interface ICommentItemProps {
  topic: IForumTopic;
  comment: IForumComment;
  replyingTo?: IReplyTarget;
  onReply?: (target: IReplyTarget) => () => void;
  onCloseReply: () => void;
}

function CommentItem({
  topic,
  comment,
  replyingTo,
  onReply,
  onCloseReply,
}: ICommentItemProps) {
  const { t } = useTranslation();
  return (
    <li className="forum__comment" id={`forum-comment-${comment.id}`}>
      <ForumPost
        post={comment}
        kind="comment"
        topicAuthor={topic.author.login}
        isAnswer={comment.isAnswer}
        onReply={onReply?.({ row: comment.id, threadId: comment.threadId })}
      />
      {comment.replies.length > 0 && (
        <ol className="forum__replies">
          {comment.replies.map((nested) => (
            <li key={nested.id}>
              <ForumPost
                post={nested}
                kind="comment"
                topicAuthor={topic.author.login}
                className="forum-post--reply"
                // GitHub nests one level: answering a reply is answering the
                // comment it hangs from, addressed to its author by name.
                onReply={onReply?.({
                  row: comment.id,
                  threadId: comment.threadId,
                  login: nested.author.login,
                })}
              />
            </li>
          ))}
        </ol>
      )}
      {comment.replyTotal > comment.replies.length && (
        <a
          className="forum__to-github forum__to-github--nested"
          href={comment.url || topic.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('forum.thread.moreRepliesOnGithub')}
          <ForumGlyph name="external" />
        </a>
      )}
      {replyingTo && (
        <div className="forum__reply-box">
          <PostComposer
            label={t('forum.action.reply')}
            placeholder={t('forum.composer.replyPlaceholder')}
            submitLabel={t('forum.composer.postReply')}
            context={t('forum.composer.replyingTo', {
              login: replyingTo.login ?? comment.author.login,
            })}
            initialBody={replyingTo.login ? `@${replyingTo.login} ` : ''}
            autoFocus
            onSubmit={(body) => reply(topic.id, body, replyingTo.threadId)}
            onCancel={onCloseReply}
          />
        </div>
      )}
    </li>
  );
}

function TitleEditor({
  topic,
  onDone,
}: {
  topic: IForumTopic;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(topic.title);
  const [saving, setSaving] = useState(false);
  const ready = title.trim() !== '' && title.trim() !== topic.title;
  const save = async () => {
    if (!ready || saving) {
      return;
    }
    setSaving(true);
    const saved = await editTitle(topic.id, title.trim());
    setSaving(false);
    if (saved) {
      onDone();
    }
  };
  return (
    <form
      className="forum__title-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save().catch(() => undefined);
      }}
    >
      <input
        value={title}
        maxLength={FORUM_TITLE_MAX}
        aria-label={t('forum.compose.titleLabel')}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by pressing the pencil beside the title, so typing goes where the person just pointed.
        autoFocus
        disabled={saving}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button
        type="button"
        className="button small subtle"
        onClick={onDone}
        disabled={saving}
      >
        {t('forum.cancel')}
      </button>
      <button
        type="submit"
        className="button small"
        disabled={!ready || saving}
      >
        {t('forum.save')}
      </button>
    </form>
  );
}
