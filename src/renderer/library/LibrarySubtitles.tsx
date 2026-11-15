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
  type DragEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { subtitleLanguage } from '../../common/library/subtitles';
import type { ILibraryTrack } from '../../common/library/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { readPersistedText, writePersistedText } from './libraryWorkspacePrefs';
import LibraryLyricsSynced from './LibraryLyricsSynced';
import LibrarySubtitlesFinder from './LibrarySubtitlesFinder';
import LibrarySubtitlesFoot from './LibrarySubtitlesFoot';
import { useSubtitlesImport } from './useSubtitlesImport';
import { useTrackSubtitles } from './useTrackSubtitles';

/** The language last picked, so the next film opens in it. */
const SUBTITLE_LANGUAGE_KEY = 'fluideq.library.subtitleLanguage';

/** `Movie.srt` as `Movie.es.srt` for a reader in Spanish. */
const languageExample = (lookedName: string, locale: string): string => {
  const dot = lookedName.lastIndexOf('.');
  const language = locale.split('-')[0];
  return dot < 0
    ? lookedName
    : `${lookedName.slice(0, dot)}.${language}${lookedName.slice(dot)}`;
};

/** The file picked for each video this session, so leaving the tab and
 * coming back keeps the language on screen. */
const pickedByVideo = new Map<string, string>();

/**
 * A video's Subtitles tab (Ivan, 2026-11-15: "when on video instead of
 * Letra it should say Subtitles and be prepared for subtitles instead of
 * lyrics"): the `.srt` or `.vtt` beside it, lit line by line as the film
 * plays and pressed to play from a line, exactly as a song's timed words
 * (`LibraryLyricsSynced`); a picker where there are several languages; and
 * where there are none, subtitle sites to search and a way to keep what was
 * downloaded (`LibrarySubtitlesFinder`).
 */
const LibrarySubtitles = ({ track }: { track: ILibraryTrack }) => {
  const { t, locale } = useTranslation();
  const [wanted, setWanted] = useState(() => pickedByVideo.get(track.id));
  const [isFinding, setIsFinding] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // The language picked last, then the app's own: read once per video, so
  // a pick here does not re-ask main for the file already on screen.
  const preferred = useMemo(() => {
    const remembered = readPersistedText(SUBTITLE_LANGUAGE_KEY);
    return remembered === undefined ? [locale] : [remembered, locale];
  }, [locale]);
  const read = useTrackSubtitles(track, wanted, preferred);
  const { reload } = read;

  const choose = useCallback(
    (fileName: string, tag: string | undefined) => {
      pickedByVideo.set(track.id, fileName);
      setWanted(fileName);
      writePersistedText(SUBTITLE_LANGUAGE_KEY, subtitleLanguage(tag));
    },
    [track.id],
  );

  const onSaved = useCallback(
    (fileName: string) => {
      pickedByVideo.set(track.id, fileName);
      setWanted(fileName);
      setIsFinding(false);
      reload();
    },
    [track.id, reload],
  );
  const subtitlesImport = useSubtitlesImport(track.id, onSaved);

  if (read.state === 'reading') {
    // Said only if the read is slow enough to notice (`_libraryLyrics.scss`).
    return (
      <p className="library-pane__empty library-lyrics__reading">
        {t('library.subtitles.reading')}
      </p>
    );
  }

  const { files, shown, looked } = read.answer;
  const { state } = subtitlesImport.status;
  // A file dropped on the lines that is refused brings up the controls the
  // refusal is said beside.
  const needsAnswer = state === 'refused' || state === 'failed';

  let mode: string;
  let content: ReactNode;
  if (files.length === 0 || shown === undefined) {
    mode = 'is-empty';
    content = (
      <>
        <div className="library-lyrics__empty-head">
          <p className="library-lyrics__none">{t('library.subtitles.none')}</p>
          {/* Nothing looked for is a folder that could not be read: no
              names to give, and no example built from none. */}
          {looked.length > 0 && (
            <>
              <p className="library-pane__note">
                {t('library.subtitles.looked', {
                  // The video's own name with the reader's language after
                  // it: the example is the very file they would bring.
                  example: languageExample(looked[0], locale),
                })}
              </p>
              <ul className="library-lyrics__looked">
                {looked.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <LibrarySubtitlesFinder
          track={track}
          subtitlesImport={subtitlesImport}
          isLead
        />
      </>
    );
  } else if (isFinding || needsAnswer) {
    mode = 'is-finding';
    content = (
      <>
        <button
          type="button"
          className="button small subtle library-lyrics__back"
          onClick={() => {
            subtitlesImport.dismiss();
            setIsFinding(false);
          }}
        >
          <MenuIcon name="back" />
          {t('library.subtitles.back')}
        </button>
        <LibrarySubtitlesFinder
          track={track}
          subtitlesImport={subtitlesImport}
          isLead={false}
        />
      </>
    );
  } else {
    mode = 'is-synced';
    const hasWords = shown.lines.some((line) => line.text !== '');
    content = (
      <>
        {hasWords ? (
          <LibraryLyricsSynced
            // A new language starts followed, at the film's own line.
            key={shown.fileName}
            lines={shown.lines}
            label={t('library.subtitles.listLabel')}
          />
        ) : (
          <p className="library-pane__empty">
            {t('library.subtitles.unreadable', { name: shown.fileName })}
          </p>
        )}
        <LibrarySubtitlesFoot
          files={files}
          shownFileName={shown.fileName}
          savedFileName={
            subtitlesImport.status.state === 'saved'
              ? subtitlesImport.status.fileName
              : undefined
          }
          onChoose={choose}
          onFind={() => setIsFinding(true)}
        />
      </>
    );
  }

  // A subtitle file dropped anywhere on the tab is kept beside the video.
  // Taken with `preventDefault`, never stopped: the Library card around the
  // tab reads that as "not a folder to add" (`LibraryWorkspaceView`).
  return (
    <div
      className={`library-lyrics ${mode}${isDragOver ? ' is-drop-target' : ''}`}
      onDragOver={(event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes('Files')) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
      }}
      onDragLeave={(event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(event: DragEvent<HTMLElement>) => {
        const [file] = Array.from(event.dataTransfer.files);
        if (file === undefined) {
          return;
        }
        event.preventDefault();
        setIsDragOver(false);
        subtitlesImport.importFile(file);
      }}
    >
      {content}
    </div>
  );
};

export default LibrarySubtitles;
