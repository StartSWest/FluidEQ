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

import { useEffect, useId, useState } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import { useLibrary } from '../LibraryContext';
import { countText } from '../libraryFormat';
import { LibraryTagInput } from './LibraryTagField';

interface IGenreCount {
  name: string;
  count: number;
}

/** The suggestions shown at once: the most used that match what is typed. */
const SHOWN = 6;

/** The Library's genres with how many songs each has, read once per store
 * version while a genre field is in use. */
const useLibraryGenres = (isWanted: boolean): IGenreCount[] => {
  const { summary } = useLibrary();
  const [genres, setGenres] = useState<IGenreCount[]>([]);
  useEffect(() => {
    if (!isWanted) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .queryLibrary({
        type: 'page',
        query: { shelf: 'genres', scope: { kind: 'audio' }, direction: 'asc' },
        offset: 0,
        limit: 500,
      })
      .then((page) => {
        if (isCurrent) {
          setGenres(
            page.items
              .flatMap((item) =>
                item.kind === 'genre' && item.name !== ''
                  ? [{ name: item.name, count: item.trackCount }]
                  : [],
              )
              .sort((left, right) => right.count - left.count),
          );
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [isWanted, summary.version]);
  return genres;
};

interface ILibraryTagGenreFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  isEdited: boolean;
  onChange: (value: string) => void;
  onPutBack?: () => void;
}

/**
 * The genre, with the spellings the Library already uses offered under it
 * while it has the caret — "Pop Latino" once, not three ways.
 */
const LibraryTagGenreField = ({
  label,
  value,
  placeholder,
  isEdited,
  onChange,
  onPutBack,
}: ILibraryTagGenreFieldProps) => {
  const { t } = useTranslation();
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const genres = useLibraryGenres(isOpen);
  const typed = value.trim().toLocaleLowerCase();
  const shown = genres
    .filter(
      (genre) =>
        genre.name.toLocaleLowerCase() !== typed &&
        (typed === '' || genre.name.toLocaleLowerCase().includes(typed)),
    )
    .slice(0, SHOWN);

  return (
    <div className={`library-tags__row${isEdited ? ' is-edited' : ''}`}>
      <label className="library-tags__label" htmlFor={id}>
        {label}
      </label>
      <div className="library-tags__suggest">
        <LibraryTagInput
          id={id}
          value={value}
          placeholder={placeholder}
          isEdited={isEdited}
          onChange={onChange}
          onPutBack={onPutBack}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
        />
        {isOpen && shown.length > 0 && (
          // Pressing an item must not take the caret first, or the blur
          // closes the list before the press lands.
          <div
            className="library-tags__suggestions"
            role="listbox"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
          >
            <p className="library-tags__suggestions-label">
              {t('library.tags.genre.inLibrary')}
            </p>
            {shown.map((genre) => (
              <button
                key={genre.name}
                type="button"
                role="option"
                aria-selected={false}
                className="library-tags__suggestion"
                onClick={() => {
                  onChange(genre.name);
                  setIsOpen(false);
                }}
              >
                <span>{genre.name}</span>
                <span className="library-tags__suggestion-count">
                  {countText(t, 'library.trackCount', genre.count)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryTagGenreField;
