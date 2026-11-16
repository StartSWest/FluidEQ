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

import { useState } from 'react';
import {
  type IFixLine,
  type IFixRules,
  readFileNamePattern,
  type TCapitals,
} from '../../../common/library/tagFix';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import Switch from '../../widgets/Switch';
import { LibraryTagInput } from './LibraryTagField';
import { CloseGlyph } from './LibraryTagSongPanel';

const TOKENS = ['%track%', '%title%', '%artist%', '%album%', '%year%'];

interface ILibraryTagFixRulesProps {
  rules: IFixRules;
  onRules: (rules: IFixRules) => void;
  sheets: readonly ITrackTagSheet[];
  /** The spellings this album's proposals unify, offered to keep. */
  spellingLines: readonly IFixLine[];
}

/**
 * The rules the proposals follow, changed in place and remembered: how a
 * file name reads (with a preview on one of the album's own files), what to
 * take out of titles, which capitals, and spellings to keep using.
 */
const LibraryTagFixRules = ({
  rules,
  onRules,
  sheets,
  spellingLines,
}: ILibraryTagFixRulesProps) => {
  const { t } = useTranslation();
  const [stripText, setStripText] = useState('');
  const sample = sheets.find((sheet) =>
    readFileNamePattern(sheet.fileName, rules.pattern),
  );
  const read = sample
    ? readFileNamePattern(sample.fileName, rules.pattern)
    : undefined;
  let preview = t('library.tags.fix.rules.previewNone');
  if (!rules.pattern.includes('%title%')) {
    preview = t('library.tags.fix.rules.patternNeedsTitle');
  } else if (sample && read?.title) {
    preview = read.track
      ? t('library.tags.fix.rules.preview', {
          file: sample.fileName,
          track: Number(read.track),
          title: read.title,
        })
      : t('library.tags.fix.rules.previewTitle', {
          file: sample.fileName,
          title: read.title,
        });
  }
  const capitals: Array<[TCapitals, string]> = [
    ['released', t('library.tags.fix.rules.capsReleased')],
    ['title', t('library.tags.fix.rules.capsTitle')],
    ['sentence', t('library.tags.fix.rules.capsSentence')],
  ];
  const kept = (from: string, to: string) =>
    rules.spellings.some((entry) => entry.from === from && entry.to === to);
  const offered = spellingLines.filter(
    (line, index, all) =>
      all.findIndex(
        (other) => other.before === line.before && other.after === line.after,
      ) === index,
  );

  return (
    <div className="library-tags-fix__rules">
      <section className="library-tags-fix__rule">
        <p className="library-tags__group">
          {t('library.tags.fix.rules.fileNames')}
        </p>
        <LibraryTagInput
          value={rules.pattern}
          onChange={(pattern) => onRules({ ...rules, pattern })}
          isEdited={false}
          isInvalid={!rules.pattern.includes('%title%')}
          ariaLabel={t('library.tags.fix.rules.fileNames')}
        />
        <div className="library-tags-fix__tokens">
          {TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              className="library-tags-fix__token"
              onClick={() =>
                onRules({
                  ...rules,
                  pattern: `${rules.pattern} ${token}`.trim(),
                })
              }
            >
              {token}
            </button>
          ))}
        </div>
        <p
          className={`library-tags__note${rules.pattern.includes('%title%') ? '' : ' is-warning'}`}
        >
          {preview}
        </p>
      </section>

      <section className="library-tags-fix__rule">
        <p className="library-tags__group">
          {t('library.tags.fix.rules.strip')}
        </p>
        <div className="library-tags-fix__chips">
          {rules.strip.map((piece) => (
            <span
              key={piece}
              className="library-tags__chip library-tags-fix__chip"
            >
              {piece}
              <button
                type="button"
                aria-label={t('library.tags.fix.rules.stripRemove', {
                  text: piece,
                })}
                onClick={() =>
                  onRules({
                    ...rules,
                    strip: rules.strip.filter((p) => p !== piece),
                  })
                }
              >
                <CloseGlyph />
              </button>
            </span>
          ))}
        </div>
        <div className="library-tags-fix__strip-add">
          <LibraryTagInput
            value={stripText}
            onChange={setStripText}
            isEdited={false}
            placeholder={t('library.tags.fix.rules.stripPlaceholder')}
            ariaLabel={t('library.tags.fix.rules.stripPlaceholder')}
          />
          <button
            type="button"
            className="button small subtle"
            disabled={
              stripText.trim() === '' || rules.strip.includes(stripText.trim())
            }
            onClick={() => {
              onRules({ ...rules, strip: [...rules.strip, stripText.trim()] });
              setStripText('');
            }}
          >
            {t('library.tags.fix.rules.stripAdd')}
          </button>
        </div>
      </section>

      <section className="library-tags-fix__rule">
        <p className="library-tags__group">
          {t('library.tags.fix.rules.capitals')}
        </p>
        <span className="segmented library-tags__segmented" role="radiogroup">
          {capitals.map(([choice, label]) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={rules.capitals === choice}
              className={`segmented__option${rules.capitals === choice ? ' is-selected' : ''}`}
              onClick={() => onRules({ ...rules, capitals: choice })}
            >
              {label}
            </button>
          ))}
        </span>
        <p className="library-tags__note">
          {t('library.tags.fix.rules.capsNote')}
        </p>
      </section>

      <section className="library-tags-fix__rule">
        <p className="library-tags__group">
          {t('library.tags.fix.rules.spellings')}
        </p>
        {offered.length === 0 && rules.spellings.length === 0 && (
          <p className="library-tags__note">
            {t('library.tags.fix.rules.spellingsNone')}
          </p>
        )}
        {[
          ...offered.map((line) => ({ from: line.before, to: line.after })),
          ...rules.spellings,
        ]
          .filter(
            (entry, index, all) =>
              all.findIndex(
                (other) => other.from === entry.from && other.to === entry.to,
              ) === index,
          )
          .map((entry, index) => (
            <div
              key={`${entry.from}|${entry.to}`}
              className="library-tags-fix__spelling"
            >
              <span>
                <s>{entry.from}</s>
                {' → '}
                {entry.to}
              </span>
              <Switch
                id={`fix-spelling-${index}`}
                isOn={kept(entry.from, entry.to)}
                isDisabled={false}
                ariaLabel={t('library.tags.fix.rules.keepSpelling', entry)}
                handleToggle={() =>
                  onRules({
                    ...rules,
                    spellings: kept(entry.from, entry.to)
                      ? rules.spellings.filter(
                          (s) => !(s.from === entry.from && s.to === entry.to),
                        )
                      : [...rules.spellings, entry],
                  })
                }
              />
            </div>
          ))}
        {(offered.length > 0 || rules.spellings.length > 0) && (
          <p className="library-tags__note">
            {t('library.tags.fix.rules.spellingsNote')}
          </p>
        )}
      </section>
    </div>
  );
};

export default LibraryTagFixRules;
