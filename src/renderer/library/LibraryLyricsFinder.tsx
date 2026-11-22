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

import { useEffect, useRef, useState } from 'react';
import {
  LYRICS_SITES,
  lyricsSearchQuery,
  lyricsSearchUrl,
} from '../../common/library/lyricsSites';
import type { ILibraryTrack } from '../../common/library/types';
import PasteButton from '../components/PasteButton';
import MenuIcon from '../icons/MenuIcon';
import { readClipboardText } from '../utils/clipboardText';
import { useTranslation } from '../utils/I18nContext';
import LibraryLyricsImportStatus from './LibraryLyricsImportStatus';
import type { ILyricsImport } from './useLyricsImport';

/**
 * Where to get a song's lyrics and how to bring them in: a search for the
 * song on three lyrics sites, opened in the listener's own browser — FluidEQ
 * never fetches a lyrics page itself, the words being somebody's copyright —
 * and the three ways to keep what they found with the song: a file from the
 * dialog, a file dropped on the tab, or words pasted here.
 *
 * `isLead` is the empty state, where importing is the next thing to do and
 * wears the accent; reached from a song that has words, every control here
 * is the quiet one.
 */
const LibraryLyricsFinder = ({
  track,
  lyricsImport,
  isLead,
}: {
  track: ILibraryTrack;
  lyricsImport: ILyricsImport;
  isLead: boolean;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const query = lyricsSearchQuery(track);
  const isBusy = lyricsImport.status.state === 'busy';
  const isPasting = draft !== undefined;
  const pasteRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Opened by a press that asked to type: the caret goes into the box, and
  // the box with its Save scrolls into the pane rather than opening below
  // its fold.
  useEffect(() => {
    if (isPasting) {
      pasteRef.current?.scrollIntoView({ block: 'nearest' });
      boxRef.current?.focus({ preventScroll: true });
    }
  }, [isPasting]);

  // Paste pastes (Ivan, 2026-11-22: "let's add a paste button to actually
  // paste"): it used to open an empty box and leave the pasting to the
  // keyboard. The box opens holding the clipboard's text; with none on it
  // it opens empty and its own Paste says why, and a clipboard that could
  // not be read leaves an empty box to type or paste into.
  const openWithClipboard = () => {
    lyricsImport.dismiss();
    readClipboardText()
      .then((text) => {
        setDraft(text);
        return text;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- the one trace of a clipboard main could not read; the box still opens, empty
        console.error('The clipboard could not be read for the lyrics', error);
        setDraft('');
      });
  };

  const save = () => {
    if (draft !== undefined && draft.trim() !== '') {
      lyricsImport.importText(draft);
    }
  };

  return (
    <div className="library-lyrics-finder">
      {query !== undefined && (
        <section className="library-lyrics-finder__group">
          <h3 className="library-pane__heading">
            {t('library.lyrics.find.heading')}
          </h3>
          <ul className="library-lyrics-finder__sites">
            {LYRICS_SITES.map((site) => {
              const url = lyricsSearchUrl(site, track);
              return (
                <li key={site.id}>
                  <button
                    type="button"
                    className="library-lyrics-finder__site"
                    title={t('library.lyrics.find.open', { site: site.name })}
                    // The window's own opener hands an http(s) address to
                    // the browser and refuses anything else
                    // (`openExternalIfSafe` via `setWindowOpenHandler`).
                    onClick={() => {
                      if (url !== undefined) {
                        window.open(url, '_blank', 'noopener');
                      }
                    }}
                  >
                    <span className="library-lyrics-finder__site-name">
                      {site.name}
                    </span>
                    <span className="library-lyrics-finder__site-note">
                      {t(
                        site.isFreeSynced
                          ? 'library.lyrics.find.free'
                          : 'library.lyrics.find.licensed',
                      )}
                    </span>
                    <MenuIcon
                      name="external"
                      className="menu-icon library-lyrics-finder__site-icon"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="library-pane__note library-lyrics-finder__query">
            {t('library.lyrics.find.searches', { query })}
          </p>
        </section>
      )}

      <section className="library-lyrics-finder__group">
        <h3 className="library-pane__heading">
          {t('library.lyrics.import.heading')}
        </h3>
        {!isPasting ? (
          <div className="library-lyrics-finder__actions">
            <button
              type="button"
              className={`button small${isLead ? '' : ' subtle'}`}
              disabled={isBusy}
              onClick={lyricsImport.pickFile}
            >
              <MenuIcon name="import" />
              {t('library.lyrics.import.file')}
            </button>
            <button
              type="button"
              className="button small subtle"
              disabled={isBusy}
              onClick={openWithClipboard}
            >
              <MenuIcon name="copyText" />
              {t('library.lyrics.import.paste')}
            </button>
          </div>
        ) : (
          <div className="library-lyrics-finder__paste" ref={pasteRef}>
            <textarea
              ref={boxRef}
              className="library-lyrics-finder__paste-box"
              value={draft}
              rows={6}
              spellCheck={false}
              aria-label={t('library.lyrics.import.pasteLabel')}
              placeholder={t('library.lyrics.import.pastePlaceholder')}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="library-lyrics-finder__actions">
              <button
                type="button"
                className="button small"
                disabled={isBusy || draft.trim() === ''}
                onClick={save}
              >
                {t('library.lyrics.import.save')}
              </button>
              <button
                type="button"
                className="button small subtle"
                disabled={isBusy}
                onClick={() => {
                  lyricsImport.dismiss();
                  setDraft(undefined);
                }}
              >
                {t('library.lyrics.import.cancel')}
              </button>
              <PasteButton target={boxRef} disabled={isBusy} />
            </div>
          </div>
        )}
        <p className="library-pane__note library-lyrics-finder__drop">
          {t('library.lyrics.import.drop')}
        </p>
        <LibraryLyricsImportStatus lyricsImport={lyricsImport} />
      </section>
    </div>
  );
};

export default LibraryLyricsFinder;
