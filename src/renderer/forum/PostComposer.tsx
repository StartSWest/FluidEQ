import { useEffect, useState } from 'react';
import { FORUM_BODY_MAX } from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
import { clearDraft, readDraft, writeDraft } from './forumDrafts';
import ForumGlyph from './ForumGlyph';
import MarkdownEditor from './MarkdownEditor';

interface IPostComposerProps {
  label: string;
  placeholder: string;
  submitLabel: string;
  /** Resolves to whether GitHub took it; the box clears only then. */
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  initialBody?: string;
  /** A line over the box — who is being replied to. */
  context?: string;
  autoFocus?: boolean;
  /**
   * Where what is typed is kept while the box is closed (`forumDrafts.ts`).
   * Absent for an edit of something already posted, whose text is GitHub's.
   */
  draftKey?: string;
  /**
   * The thread on GitHub, for "Post on GitHub instead": what is typed is
   * copied and the thread opened there, where pictures and files can be
   * added to it.
   */
  githubUrl?: string;
}

/**
 * A reply, or an edit of something already posted: the editor and its
 * buttons. Posting is the recommended action and wears the loud style;
 * cancelling and posting on GitHub instead are the quiet ones.
 *
 * What was typed survives a failed post, and leaving the page: a reply lost
 * to a dropped connection or a wandering click is the one thing a forum must
 * never do.
 */
export default function PostComposer({
  label,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  initialBody = '',
  context,
  autoFocus = false,
  draftKey,
  githubUrl,
}: IPostComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState(
    () => (draftKey ? readDraft(draftKey) : '') || initialBody,
  );
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const ready =
    body.trim() !== '' && body.length <= FORUM_BODY_MAX && body !== initialBody;

  useEffect(() => {
    if (draftKey) {
      // The prefilled "@name " of a reply is not something written.
      writeDraft(draftKey, body === initialBody ? '' : body);
    }
  }, [draftKey, body, initialBody]);

  const submit = async () => {
    if (!ready || posting) {
      return;
    }
    setPosting(true);
    const posted = await onSubmit(body.trim());
    setPosting(false);
    if (posted) {
      if (draftKey) {
        clearDraft(draftKey);
      }
      setBody('');
      onCancel?.();
    }
  };

  const postOnGithub = async () => {
    if (!githubUrl) {
      return;
    }
    // GitHub's reply box cannot be filled from a link, so the words travel
    // by the clipboard; the draft stays here until it is posted somewhere.
    try {
      await navigator.clipboard.writeText(body.trim());
      setCopied(true);
    } catch {
      setCopied(false);
    }
    window.open(githubUrl, '_blank', 'noopener');
  };

  return (
    <div className="forum-composer">
      {context && <span className="forum-composer__context">{context}</span>}
      <MarkdownEditor
        value={body}
        onChange={(next) => {
          setBody(next);
          setCopied(false);
        }}
        label={label}
        placeholder={placeholder}
        onSubmit={() => {
          submit().catch(() => undefined);
        }}
        autoFocus={autoFocus}
        disabled={posting}
      />
      <div className="forum-composer__actions">
        {copied && (
          <span className="forum-composer__note" role="status">
            {t('forum.composer.copiedForGithub')}
          </span>
        )}
        {githubUrl && (
          <button
            type="button"
            className="button small subtle forum-composer__github"
            disabled={posting || body.trim() === ''}
            onClick={() => {
              postOnGithub().catch(() => undefined);
            }}
          >
            <ForumGlyph name="external" />
            {t('forum.composer.postOnGithub')}
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              // Cancel is a choice to drop it; leaving the page is not.
              if (draftKey) {
                clearDraft(draftKey);
              }
              onCancel();
            }}
            disabled={posting}
          >
            {t('forum.cancel')}
          </button>
        )}
        <button
          type="button"
          className={`button small${posting ? ' is-running' : ''}`}
          disabled={!ready || posting}
          onClick={() => {
            submit().catch(() => undefined);
          }}
        >
          {posting ? t('forum.composer.posting') : submitLabel}
        </button>
      </div>
    </div>
  );
}
