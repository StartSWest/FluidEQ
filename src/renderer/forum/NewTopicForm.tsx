import { useEffect, useId, useState } from 'react';
import { REPOSITORY_URL } from 'common/branding';
import { FORUM_BODY_MAX, FORUM_TITLE_MAX } from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
import { boardGuidance, boardName } from './boardNames';
import ForumGlyph, { boardGlyph } from './ForumGlyph';
import {
  clearDraft,
  NEW_TOPIC_DRAFT,
  readDraft,
  writeDraft,
} from './forumDrafts';
import PresetShareCard from '../eq/ownPresets/share/PresetShareCard';
import { presetShareText } from '../eq/ownPresets/share/presetShareText';
import useSharedPreset from '../eq/ownPresets/share/useSharedPreset';
import {
  backToList,
  createTopic,
  signIn,
  type IForumState,
} from './forumStore';
import MarkdownEditor from './MarkdownEditor';
import {
  OPEN_FORUM_COMPOSE_EVENT,
  boardForTopic,
  readTopicPreset,
  type ITopicPreset,
} from './presetTopic';

interface INewTopicFormProps {
  forum: IForumState;
}

interface ITopicDraft {
  board?: string;
  title: string;
  body: string;
  /** A preset Share attached (`presetTopic.ts`). */
  preset?: ITopicPreset;
}

/** The topic being started, as it was left (`forumDrafts.ts`). */
const savedTopic = (): ITopicDraft => {
  try {
    const value: unknown = JSON.parse(readDraft(NEW_TOPIC_DRAFT) || '{}');
    const draft = (
      typeof value === 'object' && value !== null ? value : {}
    ) as Record<string, unknown>;
    const preset = readTopicPreset(draft.preset);
    return {
      ...(typeof draft.board === 'string' && draft.board
        ? { board: draft.board }
        : {}),
      title: typeof draft.title === 'string' ? draft.title : '',
      body: typeof draft.body === 'string' ? draft.body : '',
      ...(preset ? { preset } : {}),
    };
  } catch {
    return { title: '', body: '' };
  }
};

/**
 * GitHub's own new-discussion page, filled in as far as a link can carry: a
 * long post would make an address too long for some browsers, so past this
 * the words go by the clipboard alone.
 */
const LONGEST_BODY_IN_LINK = 4000;

/**
 * Starting a topic: which board, a title, and the post. It opens where the
 * list was, not in a dialog over it, and lands on the new thread when GitHub
 * has it.
 *
 * The board starts as the one being browsed when topics can be started
 * there, because that is almost always where the person meant to post.
 */
export default function NewTopicForm({ forum }: INewTopicFormProps) {
  const { t, locale } = useTranslation();
  const titleId = useId();
  // What the person picked, or else the board being browsed. Derived rather
  // than seeded: the list of boards a topic can go in may still be on its way
  // when the form opens, and a seed taken then would stay empty.
  const [saved] = useState(savedTopic);
  const [picked, setPicked] = useState<string | undefined>(saved.board);
  const board =
    boardForTopic(picked, forum.canStartIn) ??
    (forum.canStartIn.includes(forum.board) ? forum.board : '');
  const [title, setTitle] = useState(saved.title);
  const [body, setBody] = useState(saved.body);
  const [preset, setPreset] = useState(saved.preset);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const shared = useSharedPreset(preset?.code ?? '');
  const signedIn = forum.auth.status === 'signed-in';

  // Share pressed while this form is already open: the topic it wrote
  // replaces the one on screen (`startPresetTopic`).
  useEffect(() => {
    const reopen = () => {
      const next = savedTopic();
      setPicked(next.board);
      setTitle(next.title);
      setBody(next.body);
      setPreset(next.preset);
      setCopied(false);
    };
    window.addEventListener(OPEN_FORUM_COMPOSE_EVENT, reopen);
    return () => window.removeEventListener(OPEN_FORUM_COMPOSE_EVENT, reopen);
  }, []);

  // Kept while it is being written, so leaving the page loses nothing.
  useEffect(() => {
    writeDraft(
      NEW_TOPIC_DRAFT,
      title.trim() || body.trim() || preset
        ? JSON.stringify({ board: picked, title, body, preset })
        : '',
    );
  }, [picked, title, body, preset]);
  const guidance = board ? boardGuidance(board, t) : undefined;
  // The words, then the preset as text GitHub shows and FluidEQ reads back:
  // its name, the link that opens it and its code (`presetShareText`).
  const presetBlock =
    preset && shared?.ok
      ? presetShareText(
          { ...shared.preset, name: preset.name, code: preset.code },
          'markdown',
          true,
          t,
        )
      : '';
  const fullBody = [body.trim(), presetBlock].filter(Boolean).join('\n\n');
  const ready =
    board !== '' &&
    title.trim() !== '' &&
    title.length <= FORUM_TITLE_MAX &&
    fullBody !== '' &&
    fullBody.length <= FORUM_BODY_MAX &&
    // A preset still being read, or one that cannot be, is not posted
    // half-attached.
    (!preset || shared?.ok === true);
  const hasPolls = forum.boards.some((candidate) => candidate.slug === 'polls');

  const submit = async () => {
    if (!ready || posting) {
      return;
    }
    setPosting(true);
    // The form stays with what was typed if GitHub refuses; on success the
    // store moves the panel to the new thread and this form goes away.
    const posted = await createTopic(board, title.trim(), fullBody);
    setPosting(false);
    if (posted) {
      clearDraft(NEW_TOPIC_DRAFT);
    }
  };

  const postOnGithub = async () => {
    const text = fullBody;
    const address = new URL(`${REPOSITORY_URL}/discussions/new`);
    if (board) {
      address.searchParams.set('category', board);
    }
    if (title.trim()) {
      address.searchParams.set('title', title.trim());
    }
    if (text.length <= LONGEST_BODY_IN_LINK) {
      address.searchParams.set('body', text);
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    window.open(address.toString(), '_blank', 'noopener');
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
            onChange={(event) => {
              setTitle(event.target.value);
              setCopied(false);
            }}
          />
        </label>

        <div className="forum__field">
          <span className="forum__label">{t('forum.compose.body')}</span>
          {guidance && <p className="forum__guidance">{guidance}</p>}
          <MarkdownEditor
            value={body}
            onChange={(next) => {
              setBody(next);
              setCopied(false);
            }}
            label={t('forum.compose.body')}
            placeholder={t('forum.compose.bodyPlaceholder')}
            disabled={posting}
            onSubmit={() => {
              submit().catch(() => undefined);
            }}
          />
        </div>

        {preset && (
          <div className="forum__field">
            <span className="forum__label">
              {t('presetShare.forum.attached')}
            </span>
            {shared?.ok ? (
              <PresetShareCard
                name={preset.name}
                settings={shared.preset.settings}
                curve={shared.preset.curve}
                aside={
                  <button
                    type="button"
                    className="forum__icon-button preset-share-card__remove"
                    aria-label={t('presetShare.forum.remove')}
                    title={t('presetShare.forum.remove')}
                    disabled={posting}
                    onClick={() => setPreset(undefined)}
                  >
                    <ForumGlyph name="close" />
                  </button>
                }
              />
            ) : (
              shared &&
              shared.problem !== 'reading' && (
                <p className="preset-share-card__problem">
                  {t('presetShare.import.damaged')}
                </p>
              )
            )}
          </div>
        )}

        <div className="forum__compose-foot">
          <span className="forum__aside">{t('forum.compose.public')}</span>
          <span className="forum-composer__actions">
            {copied && (
              <span className="forum-composer__note" role="status">
                {t('forum.composer.copiedForGithub')}
              </span>
            )}
            <button
              type="button"
              className="button small subtle forum-composer__github"
              disabled={posting || (title.trim() === '' && body.trim() === '')}
              onClick={() => {
                postOnGithub().catch(() => undefined);
              }}
            >
              <ForumGlyph name="external" />
              {t('forum.composer.postOnGithub')}
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                // Cancel is a choice to drop it; leaving the page is not.
                clearDraft(NEW_TOPIC_DRAFT);
                backToList();
              }}
              disabled={posting}
            >
              {t('forum.cancel')}
            </button>
            {signedIn ? (
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
            ) : (
              // Share opens this form for anybody; posting needs GitHub,
              // and what was written waits here through the sign-in.
              <button
                type="button"
                className="button small"
                disabled={forum.auth.status === 'signing-in'}
                onClick={() => {
                  signIn(locale).catch(() => undefined);
                }}
              >
                {t('forum.signInToPost')}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
