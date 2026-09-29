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
  type ReactElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import renderInline from '../utils/inlineMarkup';
import MenuIcon from '../icons/MenuIcon';
import DialogFrame from './DialogFrame';
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
 * One version's notes, under its number; the file's own preface, before the
 * first version, has no heading.
 */
interface IChangelogSection {
  key: string;
  blocks: ReactElement[];
}

/**
 * The release notes, rendered from CHANGELOG.md.
 *
 * Just enough Markdown to render that one file: headings, list items, bold
 * runs and inline code (`renderInline`), and horizontal rules. A Markdown
 * library would be a dependency and a bundle's worth of parser for a document
 * whose shape we control and whose only reader is this component. If the
 * changelog ever grows a table or a nested list, that is the moment to
 * reconsider — not before.
 */
const renderChangelog = (markdown: string) => {
  const preface: IChangelogSection = { key: 'preface', blocks: [] };
  const sections = [preface];
  let { blocks } = preface;
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
          // eslint-disable-next-line react/no-array-index-key -- the notes are rebuilt whole from the changelog on every render and never reordered
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
        const version: IChangelogSection = {
          key,
          blocks: [
            <h3 key={key} className="whats-new__version">
              {content}
            </h3>,
          ],
        };
        sections.push(version);
        blocks = version.blocks;
      } else {
        blocks.push(
          <h4 key={key} className="dialog-frame__section-title">
            {content}
          </h4>,
        );
      }
      return;
    }
    paragraph.push(line);
  });

  flushList('tail');
  flushParagraph('tail-paragraph');
  // Each version a part of the page, parted from the next by the frame's
  // hairline: they used to run on as one column of boxes, the version number
  // the only thing telling one release from the next.
  return sections
    .filter((section) => section.blocks.length > 0)
    .map((section) => (
      <section key={section.key} className="dialog-frame__section">
        {section.blocks}
      </section>
    ));
};

export default function WhatsNewDialog({
  onClose,
  scope,
}: IWhatsNewDialogProps) {
  const { t } = useTranslation();
  const [markdown, setMarkdown] = useState<string>();
  // Focus lands on OK rather than the corner ✕: both close the dialog, but OK
  // is the one a reader is looking at when they have finished reading, and it
  // makes Enter dismiss the notes without hunting for anything.
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape reads whichever `onClose` is current, and focus is placed once. Both
  // used to re-run with `onClose`, which the window hands over new on every
  // render of its own — several times a second while anything plays — so a
  // reader scrolling the notes had focus yanked back to OK, where the next
  // Space closed them.
  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  });

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => closeOnEscape(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
      {/* No version badge here, unlike About: `scope` can ask for the whole
          changelog, and one number on a panel covering several releases would
          name the wrong one. */}
      <DialogFrame
        className="whats-new"
        icon={<MenuIcon name="gift" />}
        eyebrow={t('whatsNew.eyebrow')}
        title={t('whatsNew.title')}
        titleId="whats-new-title"
        closeLabel={t('support.close')}
        onClose={onClose}
        // Outside the scrolling body, so the notes never have to be scrolled
        // to the bottom to find the way out a reader's eye ends on.
        footer={
          <div className="dialog-frame__actions">
            <button
              ref={confirmRef}
              type="button"
              className="button small"
              onClick={onClose}
            >
              {t('whatsNew.ok')}
            </button>
          </div>
        }
      >
        {markdown === undefined && <p>{t('whatsNew.loading')}</p>}
        {markdown === '' && <p>{t('whatsNew.missing')}</p>}
        {markdown ? renderChangelog(markdown) : null}
      </DialogFrame>
    </div>
  );
}
