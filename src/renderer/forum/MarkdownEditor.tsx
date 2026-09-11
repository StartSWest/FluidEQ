import { useLayoutEffect, useRef, useState } from 'react';
import type { IForumFailure } from 'common/forum/forumTypes';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import failureMessage from './forumFailure';
import ForumGlyph, { type TForumGlyph } from './ForumGlyph';
import { previewMarkdown } from './forumStore';
import GithubHtml from './GithubHtml';

/**
 * A box for writing a post: the markdown itself, six buttons for the marks
 * people reach for, and a preview GitHub renders — so what is previewed is
 * exactly what will be published, tables and emoji included.
 *
 * The buttons edit the text rather than the display. Markdown is what GitHub
 * stores and what the person will see if they edit the post on github.com
 * later; a rich-text box here would be a second format to disagree with it.
 */

type TFormat = 'bold' | 'italic' | 'code' | 'link' | 'quote' | 'list';

const FORMATS: Array<{
  format: TFormat;
  glyph: TForumGlyph;
  label: TranslationKey;
}> = [
  { format: 'bold', glyph: 'bold', label: 'forum.format.bold' },
  { format: 'italic', glyph: 'italic', label: 'forum.format.italic' },
  { format: 'code', glyph: 'code', label: 'forum.format.code' },
  { format: 'link', glyph: 'link', label: 'forum.format.link' },
  { format: 'quote', glyph: 'quote', label: 'forum.format.quote' },
  { format: 'list', glyph: 'list', label: 'forum.format.list' },
];

export interface IEdit {
  value: string;
  start: number;
  end: number;
}

const wrap = (edit: IEdit, before: string, after: string): IEdit => {
  const selected = edit.value.slice(edit.start, edit.end);
  return {
    value: `${edit.value.slice(0, edit.start)}${before}${selected}${after}${edit.value.slice(edit.end)}`,
    start: edit.start + before.length,
    end: edit.end + before.length,
  };
};

/**
 * Every line the selection touches, each given the same prefix. With nothing
 * selected the caret simply moves past the new prefix and the person keeps
 * typing; a selection stays selected, prefixes and all.
 */
const prefixLines = (edit: IEdit, prefix: string): IEdit => {
  const lineStart = edit.value.lastIndexOf('\n', edit.start - 1) + 1;
  const block = edit.value.slice(lineStart, edit.end);
  const prefixed = block
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
  const value = `${edit.value.slice(0, lineStart)}${prefixed}${edit.value.slice(edit.end)}`;
  if (edit.start === edit.end) {
    const caret = edit.start + prefix.length;
    return { value, start: caret, end: caret };
  }
  return { value, start: lineStart, end: lineStart + prefixed.length };
};

export const applyFormat = (edit: IEdit, format: TFormat): IEdit => {
  const selected = edit.value.slice(edit.start, edit.end);
  switch (format) {
    case 'bold':
      return wrap(edit, '**', '**');
    case 'italic':
      return wrap(edit, '_', '_');
    case 'code':
      return selected.includes('\n')
        ? wrap(edit, '```\n', '\n```')
        : wrap(edit, '`', '`');
    case 'link': {
      // The address is what is left to type, so it is what ends up selected.
      const text = selected || 'link';
      const inserted = `[${text}](https://)`;
      const at = edit.start + text.length + 3;
      return {
        value: `${edit.value.slice(0, edit.start)}${inserted}${edit.value.slice(edit.end)}`,
        start: at,
        end: at + 'https://'.length,
      };
    }
    case 'quote':
      return prefixLines(edit, '> ');
    default:
      return prefixLines(edit, '- ');
  }
};

interface IMarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder: string;
  /** Ctrl+Enter (Cmd+Enter on a Mac). */
  onSubmit?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

export default function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  onSubmit,
  autoFocus = false,
  disabled = false,
}: IMarkdownEditorProps) {
  const { t, locale } = useTranslation();
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [preview, setPreview] = useState<{
    html?: string;
    loading: boolean;
    failure?: IForumFailure;
  }>({ loading: false });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | undefined>(
    undefined,
  );
  const previewTicket = useRef(0);

  // A formatting button changes the text and then wants the caret where the
  // person continues typing. The new text is only in the textarea after React
  // has committed it, so the selection is placed then — not guessed later.
  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    const element = textarea.current;
    if (selection && element) {
      element.focus();
      element.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = undefined;
    }
  }, [value]);

  const format = (kind: TFormat) => {
    const element = textarea.current;
    if (!element) {
      return;
    }
    const next = applyFormat(
      { value, start: element.selectionStart, end: element.selectionEnd },
      kind,
    );
    pendingSelection.current = { start: next.start, end: next.end };
    onChange(next.value);
  };

  // Rendered by GitHub, so it can arrive after the person has switched back
  // and typed more; only the answer to the latest request is shown.
  const showPreview = async () => {
    setMode('preview');
    if (!value.trim()) {
      setPreview({ loading: false, html: undefined });
      return;
    }
    previewTicket.current += 1;
    const ticket = previewTicket.current;
    setPreview((current) => ({ html: current.html, loading: true }));
    const result = await previewMarkdown(value);
    if (ticket === previewTicket.current) {
      setPreview(
        result.ok
          ? { loading: false, html: result.value }
          : { loading: false, failure: result },
      );
    }
  };

  const note = (() => {
    if (preview.loading) {
      return t('forum.loading');
    }
    if (preview.failure) {
      return failureMessage(preview.failure, t, locale);
    }
    return preview.html ? undefined : t('forum.composer.previewEmpty');
  })();

  return (
    <div className={`forum-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="forum-editor__bar">
        <div className="segmented forum-editor__modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'write'}
            className={`segmented__option${mode === 'write' ? ' is-selected' : ''}`}
            onClick={() => setMode('write')}
          >
            {t('forum.composer.write')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            className={`segmented__option${mode === 'preview' ? ' is-selected' : ''}`}
            onClick={() => {
              showPreview().catch(() =>
                setPreview({ loading: false, failure: { failure: 'network' } }),
              );
            }}
          >
            {t('forum.composer.preview')}
          </button>
        </div>
        {mode === 'write' && (
          <div className="forum-editor__tools">
            {FORMATS.map((tool) => (
              <button
                key={tool.format}
                type="button"
                className="forum-editor__tool"
                aria-label={t(tool.label)}
                title={t(tool.label)}
                disabled={disabled}
                onClick={() => format(tool.format)}
              >
                <ForumGlyph name={tool.glyph} />
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === 'write' ? (
        <textarea
          ref={textarea}
          className="forum-editor__input"
          value={value}
          aria-label={label}
          placeholder={placeholder}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the person pressing Reply, so the focus goes where they are about to type.
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onSubmit?.();
            }
          }}
        />
      ) : (
        <div className="forum-editor__preview" aria-busy={preview.loading}>
          {note ? (
            <span className="forum-editor__preview-note">{note}</span>
          ) : (
            preview.html && <GithubHtml html={preview.html} />
          )}
        </div>
      )}
      <div className="forum-editor__foot">
        <span>
          {t('forum.composer.hint', {
            keys:
              window.electron?.platform === 'darwin' ? '⌘ Enter' : 'Ctrl+Enter',
          })}
        </span>
        <span>{t('forum.composer.imagesHint')}</span>
      </div>
    </div>
  );
}
