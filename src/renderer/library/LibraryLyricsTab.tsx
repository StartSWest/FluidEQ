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

import { type DragEvent, type ReactNode, useCallback, useState } from 'react';
import type { ILibraryLyrics } from '../../common/library/lyrics';
import type { ILibraryTrack } from '../../common/library/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import LibraryLyricsActions from './LibraryLyricsActions';
import LibraryLyricsFinder from './LibraryLyricsFinder';
import LibraryLyricsSynced from './LibraryLyricsSynced';
import { type TLyricsImportState, useLyricsImport } from './useLyricsImport';
import { useTrackLyrics } from './useTrackLyrics';

type TSaved = Extract<TLyricsImportState, { state: 'saved' }>;

/** Whether the words on show are the ones just kept, or others the reader
 * puts first (timed words in the song's tags over a plain file, say). */
const showsSaved = (lyrics: ILibraryLyrics, saved: TSaved): boolean =>
  saved.place === 'store'
    ? lyrics.kept === true
    : lyrics.kept !== true && lyrics.fileName === saved.fileName;

/** Where the words came from — or, right after an import, where they were
 * kept — said once at the foot, with what can be done with them under it. */
const SourceFoot = ({
  track,
  lyrics,
  saved,
  onFind,
  onRemoved,
}: {
  track: ILibraryTrack;
  lyrics: ILibraryLyrics;
  saved: TSaved | undefined;
  onFind: () => void;
  onRemoved: () => void;
}) => {
  const { t } = useTranslation();
  let source: string;
  if (saved !== undefined && !showsSaved(lyrics, saved)) {
    source =
      saved.place === 'store'
        ? t('library.lyrics.import.shadowedKept')
        : t('library.lyrics.import.shadowed', { name: saved.fileName });
  } else if (saved?.place === 'beside') {
    source = t('library.lyrics.import.savedBeside', { name: saved.fileName });
  } else if (lyrics.kept === true) {
    source = t(
      saved === undefined
        ? 'library.lyrics.fromKept'
        : 'library.lyrics.import.savedKept',
    );
  } else if (lyrics.fileName === undefined) {
    source = t('library.lyrics.fromTags');
  } else {
    source = t('library.lyrics.fromFile', { name: lyrics.fileName });
  }
  return (
    <div className="library-lyrics__foot">
      <LibraryLyricsActions
        track={track}
        lyrics={lyrics}
        onFind={onFind}
        onRemoved={onRemoved}
        source={
          <p
            className={`library-lyrics__source${
              saved === undefined && lyrics.kept !== true ? '' : ' is-notice'
            }${saved === undefined ? '' : ' is-saved'}`}
            title={source}
            role={saved === undefined ? undefined : 'status'}
          >
            {saved !== undefined && <MenuIcon name="check" />}
            <span>{source}</span>
          </p>
        }
      />
    </div>
  );
};

/** The playing song's words, once main has read them. */
const TrackLyrics = ({ track }: { track: ILibraryTrack }) => {
  const { t } = useTranslation();
  const read = useTrackLyrics(track);
  const { reload } = read;
  const [isFinding, setIsFinding] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const onSaved = useCallback(() => {
    setIsFinding(false);
    reload();
  }, [reload]);
  const lyricsImport = useLyricsImport(track.id, onSaved);
  const { dismiss: dismissImport } = lyricsImport;
  // What is left is read again; a "saved" line about the file just removed
  // would otherwise stay under the words that replace it.
  const onRemoved = useCallback(() => {
    dismissImport();
    reload();
  }, [dismissImport, reload]);

  if (read.state === 'reading') {
    // Says so only if the read is slow enough to notice (a fade with a delay
    // in the stylesheet); a quick one shows nothing before the words.
    return (
      <p className="library-pane__empty library-lyrics__reading">
        {t('library.lyrics.reading')}
      </p>
    );
  }

  const { lyrics, looked } = read.answer;
  // A file dropped on the words that needs a question or a refusal answered
  // brings up the import controls it is answered beside.
  const { state } = lyricsImport.status;
  const needsAnswer =
    state === 'confirm' || state === 'refused' || state === 'failed';

  let mode: string;
  let content: ReactNode;
  if (lyrics === undefined) {
    mode = 'is-empty';
    content = (
      <>
        <div className="library-lyrics__empty-head">
          <p className="library-lyrics__none">{t('library.lyrics.none')}</p>
          <p className="library-pane__note">{t('library.lyrics.looked')}</p>
          {looked.length > 0 && (
            <ul className="library-lyrics__looked">
              {looked.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </div>
        <LibraryLyricsFinder track={track} lyricsImport={lyricsImport} isLead />
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
            lyricsImport.dismiss();
            setIsFinding(false);
          }}
        >
          <MenuIcon name="back" />
          {t('library.lyrics.back')}
        </button>
        <LibraryLyricsFinder
          track={track}
          lyricsImport={lyricsImport}
          isLead={false}
        />
      </>
    );
  } else {
    mode = `is-${lyrics.kind}`;
    content = (
      <>
        {lyrics.kind === 'synced' ? (
          <LibraryLyricsSynced lines={lyrics.lines} />
        ) : (
          <div className="library-lyrics__plain">{lyrics.text}</div>
        )}
        <SourceFoot
          track={track}
          lyrics={lyrics}
          saved={
            lyricsImport.status.state === 'saved'
              ? lyricsImport.status
              : undefined
          }
          onFind={() => setIsFinding(true)}
          onRemoved={onRemoved}
        />
      </>
    );
  }

  // A lyrics file dropped anywhere on the tab is kept with the song. Taken
  // with `preventDefault`, never stopped: the Library card around the tab
  // reads that as "not a folder to add" and puts its own edge out, which it
  // could not do for an event it never heard (`LibraryWorkspaceView`).
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
        lyricsImport.importFile(file);
      }}
    >
      {content}
    </div>
  );
};

/**
 * The right pane's Lyrics tab: the playing song's words, from its tags or a
 * lyrics file of its own name beside it (`libraryLyrics.ts` in main). Timed
 * words follow the song; plain ones are there to read. A song with none says
 * where FluidEQ looked, and where the listener can find its words and bring
 * them in to stay with it (`LibraryLyricsFinder`).
 */
const LibraryLyricsTab = ({ track }: { track: ILibraryTrack | undefined }) => {
  const { t } = useTranslation();
  if (track === undefined) {
    return <p className="library-pane__empty">{t('library.lyrics.nothing')}</p>;
  }
  // Keyed by song: a new song starts at its own first line, followed.
  return <TrackLyrics key={track.id} track={track} />;
};

export default LibraryLyricsTab;
