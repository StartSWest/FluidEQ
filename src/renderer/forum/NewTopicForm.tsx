import { useId, useState } from 'react';
import { REPOSITORY_URL } from 'common/branding';
import { FORUM_BODY_MAX, FORUM_TITLE_MAX } from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
import { boardGuidance, boardName } from './boardNames';
import ForumGlyph, { boardGlyph } from './ForumGlyph';
import { backToList, createTopic, type IForumState } from './forumStore';
import MarkdownEditor from './MarkdownEditor';

interface INewTopicFormProps {
  forum: IForumState;
}

/**
 * Starting a topic: which board, a title, and the post. It opens where the
 * list was, not in a dialog over it, and lands on the new thread when GitHub
 * has it.
 *
 * The board starts as the one being browsed when topics can be started
 * there, because that is almost always where the person meant to post.
 */
export default function NewTopicForm({ forum }: INewTopicFormProps) {
  const { t } = useTranslation();
  const titleId = useId();
  // What the person picked, or else the board being browsed. Derived rather
  // than seeded: the list of boards a topic can go in may still be on its way
  // when the form opens, and a seed taken then would stay empty.
  const [picked, setPicked] = useState<string>();
  const board =
    picked ?? (forum.canStartIn.includes(forum.board) ? forum.board : '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const guidance = board ? boardGuidance(board, t) : undefined;
  const ready =
    board !== '' &&
    title.trim() !== '' &&
    title.length <= FORUM_TITLE_MAX &&
    body.trim() !== '' &&
    body.length <= FORUM_BODY_MAX;
  const hasPolls = forum.boards.some((candidate) => candidate.slug === 'polls');

  const submit = async () => {
    if (!ready || posting) {
      return;
    }
    setPosting(true);
    // The form stays with what was typed if GitHub refuses; on success the
    // store moves the panel to the new thread and this form goes away.
    await createTopic(board, title.trim(), body.trim());
    setPosting(false);
  };

  return (
    <div className="forum__compose">
      <header className="forum__thread-bar">
        <button type="button" className="forum__back" onClick={backToList}>
          <ForumGlyph name="back" />
          {t('forum.backTo', {
            board: forum.board
              ? boardName(forum.board, forum.boards, t)
              : t('forum.allTopics'),
          })}
        </button>
      </header>
      <div className="forum__scroll forum__compose-body">
        <h2 className="forum__thread-title">{t('forum.compose.title')}</h2>

        <fieldset className="forum__field">
          <legend className="forum__label">{t('forum.compose.board')}</legend>
          <div className="forum__board-picker" role="radiogroup">
            {forum.canStartIn.map((slug) => (
              <button
                key={slug}
                type="button"
                role="radio"
                aria-checked={board === slug}
                className={`forum__board-choice${board === slug ? ' is-selected' : ''}`}
                onClick={() => setPicked(slug)}
                disabled={posting}
              >
                <ForumGlyph name={boardGlyph(slug)} />
                {boardName(slug, forum.boards, t)}
              </button>
            ))}
          </div>
          {hasPolls && (
            <a
              className="forum__aside"
              href={`${REPOSITORY_URL}/discussions/new?category=polls`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('forum.compose.pollsOnGithub')}
              <ForumGlyph name="external" />
            </a>
          )}
        </fieldset>

        <label className="forum__field" htmlFor={titleId}>
          <span className="forum__label">{t('forum.compose.titleLabel')}</span>
          <input
            id={titleId}
            value={title}
            maxLength={FORUM_TITLE_MAX}
            placeholder={t('forum.compose.titlePlaceholder')}
            disabled={posting}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <div className="forum__field">
          <span className="forum__label">{t('forum.compose.body')}</span>
          {guidance && <p className="forum__guidance">{guidance}</p>}
          <MarkdownEditor
            value={body}
            onChange={setBody}
            label={t('forum.compose.body')}
            placeholder={t('forum.compose.bodyPlaceholder')}
            disabled={posting}
            onSubmit={() => {
              submit().catch(() => undefined);
            }}
          />
        </div>

        <div className="forum__compose-foot">
          <span className="forum__aside">{t('forum.compose.public')}</span>
          <span className="forum-composer__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={backToList}
              disabled={posting}
            >
              {t('forum.cancel')}
            </button>
            <button
              type="button"
              className={`button small${posting ? ' is-running' : ''}`}
              disabled={!ready || posting}
              onClick={() => {
                submit().catch(() => undefined);
              }}
            >
              {posting
                ? t('forum.composer.posting')
                : t('forum.compose.submit')}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
