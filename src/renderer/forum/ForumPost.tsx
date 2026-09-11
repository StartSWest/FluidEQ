import { useState } from 'react';
import type { IForumPost, TForumPostKind } from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
import ForumAvatar from './ForumAvatar';
import ForumGlyph from './ForumGlyph';
import { deletePost, editPost, markAnswer, upvote } from './forumStore';
import { absoluteTime, relativeTime } from './forumTime';
import GithubHtml from './GithubHtml';
import PostComposer from './PostComposer';

interface IForumPostProps {
  post: IForumPost;
  /** What an edit of this post changes: the topic itself, or a comment. */
  kind: TForumPostKind;
  /** The person who started the topic, for the "Author" mark. */
  topicAuthor: string;
  isAnswer?: boolean;
  /** Present where replying makes sense and the topic is open for it. */
  onReply?: () => void;
  className?: string;
}

/**
 * One piece of writing in a thread, with what the reader may do to it.
 *
 * Every action is offered only when GitHub said this reader may take it —
 * the flags come with the post — so nothing here is a button that answers
 * "not allowed" when pressed. Read signed out there are no flags, and the
 * post is the words and the count and nothing to press but GitHub's link.
 */
export default function ForumPost({
  post,
  kind,
  topicAuthor,
  isAnswer = false,
  onReply,
  className,
}: IForumPostProps) {
  const { t, locale } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { viewer } = post;
  const count = new Intl.NumberFormat(locale);

  return (
    <article
      className={`forum-post${isAnswer ? ' is-answer' : ''}${className ? ` ${className}` : ''}`}
    >
      <header className="forum-post__head">
        <ForumAvatar person={post.author} className="forum-post__avatar" />
        <span className="forum-post__who">
          {post.author.url ? (
            <a
              className="forum-post__login"
              href={post.author.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              @{post.author.login}
            </a>
          ) : (
            <span className="forum-post__login">@{post.author.login}</span>
          )}
          {post.authorRole === 'maker' && (
            <span className="community__role community__role--admin">
              {t('forum.post.maker')}
            </span>
          )}
          {post.authorRole === 'maintainer' && (
            <span className="community__role">
              {t('forum.post.maintainer')}
            </span>
          )}
          {post.author.login === topicAuthor && kind === 'comment' && (
            <span className="forum-post__mark">{t('forum.post.author')}</span>
          )}
          <time
            className="forum-post__time"
            dateTime={post.createdAt}
            title={absoluteTime(post.createdAt, locale)}
          >
            {relativeTime(post.createdAt, locale)}
          </time>
          {post.editedAt && (
            <span
              className="forum-post__edited"
              title={absoluteTime(post.editedAt, locale)}
            >
              {t('forum.post.edited')}
            </span>
          )}
        </span>
        {isAnswer && (
          <span className="forum__chip forum__chip--answer">
            <ForumGlyph name="answer" />
            {t('forum.post.answer')}
          </span>
        )}
      </header>

      {editing && post.body !== undefined ? (
        <PostComposer
          label={t('forum.action.edit')}
          placeholder={t('forum.composer.replyPlaceholder')}
          submitLabel={t('forum.composer.saveEdit')}
          initialBody={post.body}
          autoFocus
          onSubmit={(body) => editPost(post.id, kind, body)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <PostBody
          html={post.bodyHtml}
          hidden={post.minimized && !revealed}
          onReveal={() => setRevealed(true)}
        />
      )}

      {!editing && (
        <footer className="forum-post__actions">
          {viewer?.canUpvote ? (
            <button
              type="button"
              className={`forum-post__upvote${viewer.hasUpvoted ? ' is-on' : ''}`}
              aria-pressed={viewer.hasUpvoted}
              aria-label={
                viewer.hasUpvoted
                  ? t('forum.action.removeUpvote')
                  : t('forum.action.upvote')
              }
              title={
                viewer.hasUpvoted
                  ? t('forum.action.removeUpvote')
                  : t('forum.action.upvote')
              }
              onClick={() => {
                upvote(post.id, !viewer.hasUpvoted).catch(() => undefined);
              }}
            >
              <ForumGlyph name="upvote" />
              {count.format(post.upvotes)}
            </button>
          ) : (
            <span
              className="forum-post__upvote is-static"
              aria-label={t('forum.topic.upvotes', { count: post.upvotes })}
            >
              <ForumGlyph name="upvote" />
              {count.format(post.upvotes)}
            </span>
          )}
          {onReply && (
            <button
              type="button"
              className="forum-post__action"
              onClick={onReply}
            >
              <ForumGlyph name="reply" />
              {t('forum.action.reply')}
            </button>
          )}
          {viewer?.canMarkAnswer && (
            <button
              type="button"
              className="forum-post__action forum-post__action--answer"
              onClick={() => {
                markAnswer(post.id, true).catch(() => undefined);
              }}
            >
              <ForumGlyph name="answer" />
              {t('forum.action.markAnswer')}
            </button>
          )}
          {viewer?.canUnmarkAnswer && (
            <button
              type="button"
              className="forum-post__action"
              onClick={() => {
                markAnswer(post.id, false).catch(() => undefined);
              }}
            >
              <ForumGlyph name="answer" />
              {t('forum.action.unmarkAnswer')}
            </button>
          )}
          {viewer?.canEdit && post.body !== undefined && (
            <button
              type="button"
              className="forum-post__action"
              onClick={() => setEditing(true)}
            >
              <ForumGlyph name="edit" />
              {t('forum.action.edit')}
            </button>
          )}
          {viewer?.canDelete && kind === 'comment' && !confirmingDelete && (
            <button
              type="button"
              className="forum-post__action forum-post__action--danger"
              onClick={() => setConfirmingDelete(true)}
            >
              <ForumGlyph name="delete" />
              {t('forum.action.delete')}
            </button>
          )}
          {confirmingDelete && (
            <span className="forum-post__confirm" role="group">
              <span>{t('forum.action.deleteQuestion')}</span>
              <button
                type="button"
                className="button small subtle"
                onClick={() => setConfirmingDelete(false)}
              >
                {t('forum.cancel')}
              </button>
              <button
                type="button"
                className="button small"
                onClick={() => {
                  setConfirmingDelete(false);
                  deletePost(post.id).catch(() => undefined);
                }}
              >
                {t('forum.action.deleteConfirm')}
              </button>
            </span>
          )}
          {post.url && (
            <a
              className="forum-post__action forum-post__action--end"
              href={post.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('forum.openOnGithub')}
              title={t('forum.openOnGithub')}
            >
              <ForumGlyph name="external" />
            </a>
          )}
        </footer>
      )}
    </article>
  );
}

interface IPostBodyProps {
  html: string;
  hidden: boolean;
  onReveal: () => void;
}

/** The words, or a fold over them when a moderator hid the post. */
function PostBody({ html, hidden, onReveal }: IPostBodyProps) {
  const { t } = useTranslation();
  if (hidden) {
    return (
      <p className="forum-post__hidden">
        {t('forum.post.hidden')}
        <button type="button" className="community__link" onClick={onReveal}>
          {t('forum.post.show')}
        </button>
      </p>
    );
  }
  return <GithubHtml html={html} className="forum-post__body" />;
}
