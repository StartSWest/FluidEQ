/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  Fragment,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import '../styles/WhatsNew.scss';

interface IWhatsNewDialogProps {
  onClose: () => void;
  /**
   * How much of the file to show, decided by how the dialog was opened.
   *
   * `latest` for the one that opens itself after an update, where the question
   * is what changed in the version just installed. `all` when somebody went and
   * asked for it, where the history is what they came for.
   */
  scope: 'latest' | 'all';
}

/**
 * The release notes, rendered from CHANGELOG.md.
 *
 * Just enough Markdown to render that one file: headings, list items, bold
 * runs, inline code, and horizontal rules. A Markdown library would be a
 * dependency and a bundle's worth of parser for a document whose shape we
 * control and whose only reader is this component. If the changelog ever grows
 * a table or a nested list, that is the moment to reconsider — not before.
 */
const renderInline = (text: string, keyPrefix: string) => {
  // Split on the two things the changelog actually uses. Everything else is
  // left as written, which for prose is the right answer anyway.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
};

const renderChangelog = (markdown: string) => {
  const blocks: ReactElement[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];

  /**
   * A paragraph is every line up to the next blank one, joined.
   *
   * Each source line used to become its own `<p>`, which meant the file's
   * 80-column wrapping was drawn as if it were the layout: the text broke where
   * the editor had broken it, two thirds of the way across a much wider dialog,
   * and the gap between one paragraph and the next looked the same as the gap
   * between two lines of one. Joining first lets the text reflow to whatever
   * width it is given, which is what a paragraph is for. List items have always
   * been assembled this way; paragraphs were the omission.
   */
  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) {
      return;
    }
    const text = paragraph.join(' ');
    blocks.push(<p key={key}>{renderInline(text, key)}</p>);
    paragraph = [];
  };

  const flushList = (key: string) => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push(
      <ul key={key}>
        {listItems.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={`${key}-${index}`}>
            {renderInline(item, `${key}-${index}`)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  markdown.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    const key = `line-${index}`;

    // A list item can wrap onto the following lines; anything indented that is
    // not itself a bullet belongs to the item above it.
    if (/^[-*]\s+/.test(line)) {
      flushParagraph(key);
      listItems.push(line.replace(/^[-*]\s+/, ''));
      return;
    }
    if (line && listItems.length > 0 && /^\s/.test(rawLine)) {
      listItems[listItems.length - 1] += ` ${line}`;
      return;
    }

    flushList(key);

    if (!line || line === '---') {
      flushParagraph(key);
      return;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph(key);
      const level = heading[1].length;
      const content = renderInline(heading[2], key);
      if (level <= 1) {
        // The document title is the dialog's own title; rendering it again
        // would put the same words on screen twice.
        return;
      }
      if (level === 2) {
        blocks.push(<h3 key={key}>{content}</h3>);
      } else {
        blocks.push(<h4 key={key}>{content}</h4>);
      }
      return;
    }
    paragraph.push(line);
  });

  flushList('tail');
  flushParagraph('tail-paragraph');
  return blocks;
};

export default function WhatsNewDialog({
  onClose,
  scope,
}: IWhatsNewDialogProps) {
  const { t } = useTranslation();
  const [markdown, setMarkdown] = useState<string>();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    window.electron.ipcRenderer
      .getChangelog(scope)
      .then((text) => setMarkdown(text))
      .catch(() => setMarkdown(''));
  }, [scope]);

  return (
    <div
      className="whats-new-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="whats-new"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <div className="whats-new__header">
          <div>
            <span className="eyebrow">{t('whatsNew.eyebrow')}</span>
            <h2 id="whats-new-title">{t('whatsNew.title')}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="whats-new__close"
            aria-label={t('support.close')}
            onClick={onClose}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <div className="whats-new__body">
          {markdown === undefined && <p>{t('whatsNew.loading')}</p>}
          {markdown === '' && <p>{t('whatsNew.missing')}</p>}
          {markdown ? renderChangelog(markdown) : null}
        </div>
      </div>
    </div>
  );
}
