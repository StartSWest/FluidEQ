/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import {
  FILE_NAME_PRESETS,
  FILE_NAME_TOKENS,
  isFileNamePattern,
  type TFileNameToken,
} from '../../../common/library/fileNamePattern';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import { LibraryTagInput } from './LibraryTagField';
import type { IFileRename } from './tagFileNames';

const TOKEN_KEYS: Record<TFileNameToken, TranslationKey> = {
  track: 'library.tags.files.token.track',
  title: 'library.tags.files.token.title',
  artist: 'library.tags.files.token.artist',
  albumArtist: 'library.tags.files.token.albumArtist',
  album: 'library.tags.files.token.album',
  year: 'library.tags.files.token.year',
  disc: 'library.tags.files.token.disc',
};

const KEEP = 'keep';
const CUSTOM = 'custom';

interface ILibraryTagFileNamesProps {
  pattern: string | undefined;
  onPattern: (pattern: string | undefined) => void;
  renames: readonly IFileRename[];
  /** The first song's new name under each pattern, for the menu. */
  exampleOf: (pattern: string) => string | undefined;
}

/**
 * The songs' file names, on a line of their own under the songs' tools
 * (Ivan, 2026-11-17: "rename the files too to have better format"): keep
 * them, one of four patterns, or one typed with the tags as words. Each
 * song shows its new name under its row (`LibraryTagSheet`), the side
 * panel lists them, and Save renames after it writes the tags. A name two
 * songs would share holds Save back until it is told apart.
 */
const LibraryTagFileNames = ({
  pattern,
  onPattern,
  renames,
  exampleOf,
}: ILibraryTagFileNamesProps) => {
  const { t } = useTranslation();
  const [isCustom, setIsCustom] = useState(
    () => pattern !== undefined && !FILE_NAME_PRESETS.includes(pattern),
  );
  /** A pattern read with its tags as words: "{track} - {title}" is
   * "No. - Title". */
  const wordsOf = (text: string) =>
    text.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => {
      const token = FILE_NAME_TOKENS.find((candidate) => candidate === name);
      return token === undefined ? whole : t(TOKEN_KEYS[token]);
    });
  // Discard clears the pattern under a custom choice: that reads as Keep.
  const isTyping = isCustom && pattern !== undefined;
  let choice = KEEP;
  if (isTyping) {
    choice = CUSTOM;
  } else if (pattern !== undefined) {
    choice = pattern;
  }
  const clashes = renames.filter((rename) => rename.isClash).length;
  const isUnusable =
    isTyping && pattern !== '' && !isFileNamePattern(pattern ?? '');

  const option = (value: string, label: string, example?: string) => ({
    value,
    label,
    display: (
      <span className="library-tags-files__option">
        <span>{label}</span>
        {example !== undefined && <small>{example}</small>}
      </span>
    ),
  });

  let status = '';
  if (clashes > 0) {
    status =
      clashes === 1
        ? t('library.tags.files.clashOne')
        : t('library.tags.files.clash', { count: clashes });
  } else if (pattern !== undefined && isFileNamePattern(pattern)) {
    if (renames.length === 0) {
      status = t('library.tags.files.none');
    } else {
      status =
        renames.length === 1
          ? t('library.tags.files.countOne')
          : t('library.tags.files.count', { count: renames.length });
    }
  }

  return (
    <div className="library-tags-files">
      <span className="library-tags__group is-inline">
        {t('library.tags.files.title')}
      </span>
      <Dropdown
        name="library-tags-file-names"
        className="library-tags-files__pick"
        menuClassName="library-tags-files__menu"
        isDisabled={false}
        value={choice}
        options={[
          option(KEEP, t('library.tags.files.keep')),
          ...FILE_NAME_PRESETS.map((preset) =>
            option(preset, wordsOf(preset), exampleOf(preset)),
          ),
          option(CUSTOM, t('library.tags.files.custom')),
        ]}
        handleChange={(value) => {
          if (value === KEEP) {
            setIsCustom(false);
            onPattern(undefined);
          } else if (value === CUSTOM) {
            setIsCustom(true);
            onPattern(pattern ?? FILE_NAME_PRESETS[0]);
          } else {
            setIsCustom(false);
            onPattern(value);
          }
        }}
      />
      {isTyping && (
        <div className="library-tags-files__custom">
          <LibraryTagInput
            value={pattern ?? ''}
            onChange={(text) => onPattern(text)}
            isEdited={false}
            isInvalid={isUnusable}
            placeholder={t('library.tags.files.patternHint')}
            ariaLabel={t('library.tags.files.pattern')}
          />
          <span
            className="library-tags-files__tokens"
            role="group"
            aria-label={t('library.tags.files.addTag')}
          >
            {FILE_NAME_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                className="button small subtle"
                onClick={() => {
                  const current = pattern ?? '';
                  const joint = /(^|[\s\-_.([])$/.test(current) ? '' : ' - ';
                  onPattern(`${current}${joint}{${token}}`);
                }}
              >
                + {t(TOKEN_KEYS[token])}
              </button>
            ))}
          </span>
        </div>
      )}
      {status !== '' && (
        <span
          className={`library-tags-files__status${clashes > 0 ? ' is-clash' : ''}`}
          role={clashes > 0 ? 'alert' : 'status'}
        >
          {status}
        </span>
      )}
    </div>
  );
};

export default LibraryTagFileNames;
