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

import { type DragEvent, useCallback, useState } from 'react';
import { subtitleFilesOf } from '../../common/library/subtitles';
import type { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import LibrarySubtitleFiles from './LibrarySubtitleFiles';
import LibrarySubtitleSettings from './LibrarySubtitleSettings';
import LibrarySubtitlesFinder from './LibrarySubtitlesFinder';
import {
  chooseSubtitle,
  forgetSubtitleChoice,
  useSubtitleChoice,
} from './subtitleChoice';
import { useSubtitleRemove } from './useSubtitleRemove';
import { useSubtitlesImport } from './useSubtitlesImport';
import { useTrackSubtitles } from './useTrackSubtitles';

/** `Movie.srt` as `Movie.es.srt` for a reader in Spanish. */
const languageExample = (lookedName: string, locale: string): string => {
  const dot = lookedName.lastIndexOf('.');
  const language = locale.split('-')[0];
  return dot < 0
    ? lookedName
    : `${lookedName.slice(0, dot)}.${language}${lookedName.slice(dot)}`;
};

/**
 * A video's Subtitles tab (Ivan, 2026-11-15: "so there we just show the
 * list of imported subs and the settings instead of the actual subs"): the
 * subtitle files beside it, named by language, the one in use marked and a
 * press putting another in use; the captions' style; and subtitle sites to
 * search with a way to keep what was downloaded (`LibrarySubtitlesFinder`).
 * The captions themselves are drawn over the film (`LibraryVideoCaptions`),
 * which reads the same pick (`subtitleChoice`) and the same style.
 */
const LibrarySubtitles = ({ track }: { track: ILibraryTrack }) => {
  const { t, locale } = useTranslation();
  const { wanted, preferred, choose } = useSubtitleChoice(track.id, locale);
  const [isDragOver, setIsDragOver] = useState(false);
  const read = useTrackSubtitles(track, wanted, preferred);
  const { reload } = read;

  // The file just kept is put in use: it is what the viewer went to fetch.
  // Its language, read from its name beside the video's, becomes the one
  // the next film opens in, as any pick's does.
  const onSaved = useCallback(
    (fileName: string) => {
      const videoName = track.path.split(/[\\/]/).pop() ?? '';
      const [kept] = subtitleFilesOf(videoName, [fileName]);
      chooseSubtitle(track.id, fileName, kept?.tag);
      reload();
    },
    [track.id, track.path, reload],
  );
  const subtitlesImport = useSubtitlesImport(track.id, onSaved);

  // A file gone from beside the video. Taken from the one in use, the next
  // in the list goes in use (the one before it, for the last), or nothing
  // is chosen when it was the only one, and main then picks again.
  const answer = read.state === 'ready' ? read.answer : undefined;
  const onGone = useCallback(
    (fileName: string) => {
      const files = answer?.files ?? [];
      if (answer?.shown?.fileName === fileName) {
        const at = files.findIndex((file) => file.fileName === fileName);
        const next = files[at + 1] ?? files[at - 1];
        if (next === undefined || next.fileName === fileName) {
          forgetSubtitleChoice(track.id);
        } else {
          chooseSubtitle(track.id, next.fileName, next.tag);
        }
      }
      reload();
    },
    [answer, track.id, reload],
  );
  const remove = useSubtitleRemove(track.id, onGone);

  if (read.state === 'reading') {
    // Said only if the read is slow enough to notice (`_libraryLyrics.scss`).
    return (
      <p className="library-pane__empty library-lyrics__reading">
        {t('library.subtitles.reading')}
      </p>
    );
  }

  const { files, shown, looked } = read.answer;
  const hasFiles = files.length > 0;

  // A subtitle file dropped anywhere on the tab is kept beside the video.
  // Taken with `preventDefault`, never stopped: the Library card around the
  // tab reads that as "not a folder to add" (`LibraryWorkspaceView`).
  return (
    <div
      className={`library-lyrics ${hasFiles ? 'is-subtitles' : 'is-empty'}${
        isDragOver ? ' is-drop-target' : ''
      }`}
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
      {hasFiles ? (
        <>
          <LibrarySubtitleFiles
            files={files}
            shownFileName={shown?.fileName}
            isShownEmpty={shown !== undefined && shown.cues.length === 0}
            savedFileName={
              subtitlesImport.status.state === 'saved'
                ? subtitlesImport.status.fileName
                : undefined
            }
            onChoose={choose}
            remove={remove}
          />
          <LibrarySubtitleSettings />
        </>
      ) : (
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
      )}
      <LibrarySubtitlesFinder
        track={track}
        subtitlesImport={subtitlesImport}
        isLead={!hasFiles}
      />
    </div>
  );
};

export default LibrarySubtitles;
