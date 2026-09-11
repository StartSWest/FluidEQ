import { useState } from 'react';
import { FORUM_BODY_MAX } from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
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
}

/**
 * A reply, or an edit of something already posted: the editor and the two
 * buttons. Posting is the recommended action and wears the loud style;
 * cancelling is the quiet one.
 *
 * What was typed survives a failed post. A reply lost to a dropped
 * connection is the one thing a forum must never do.
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
}: IPostComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState(initialBody);
  const [posting, setPosting] = useState(false);
  const ready =
    body.trim() !== '' && body.length <= FORUM_BODY_MAX && body !== initialBody;

  const submit = async () => {
    if (!ready || posting) {
      return;
    }
    setPosting(true);
    const posted = await onSubmit(body.trim());
    setPosting(false);
    if (posted) {
      setBody('');
      onCancel?.();
    }
  };

  return (
    <div className="forum-composer">
      {context && <span className="forum-composer__context">{context}</span>}
      <MarkdownEditor
        value={body}
        onChange={setBody}
        label={label}
        placeholder={placeholder}
        onSubmit={() => {
          submit().catch(() => undefined);
        }}
        autoFocus={autoFocus}
        disabled={posting}
      />
      <div className="forum-composer__actions">
        {onCancel && (
          <button
            type="button"
            className="button small subtle"
            onClick={onCancel}
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
