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

import { useCallback } from 'react';
import type { TranslationKey } from '../../common/i18n';
import type { TSubtitleImportRefusal } from '../../common/library/subtitleImport';
import {
  SUBTITLE_SITES,
  subtitleSearchQuery,
} from '../../common/library/subtitleSites';
import type { ILibraryTrack } from '../../common/library/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { ISubtitlesImport } from './useSubtitlesImport';

const REFUSAL_KEYS: Record<TSubtitleImportRefusal, TranslationKey> = {
  empty: 'library.subtitles.import.empty',
  tooBig: 'library.subtitles.import.tooBig',
  notText: 'library.subtitles.import.notText',
  notSubtitles: 'library.subtitles.import.notSubtitles',
};

const COVERS_KEYS = {
  moviesAndTv: 'library.subtitles.find.moviesAndTv',
  tv: 'library.subtitles.find.tv',
} as const;

/** Saving, or why the file was not kept; a kept file is said where the
 * subtitles are shown. */
const ImportStatus = ({ status }: { status: ISubtitlesImport['status'] }) => {
  const { t } = useTranslation();
  // Said at the foot of a column that scrolls: brought into the pane, or a
  // refusal at a short height is said below the fold.
  const reveal = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView({ block: 'nearest' });
  }, []);
  if (status.state === 'busy') {
    return (
      <p
        key="busy"
        ref={reveal}
        className="library-lyrics-status"
        role="status"
      >
        {t('library.subtitles.import.busy')}
      </p>
    );
  }
  if (status.state === 'refused' || status.state === 'failed') {
    return (
      <p
        key={status.state}
        ref={reveal}
        className="library-lyrics-status is-problem"
        role="alert"
      >
        <MenuIcon name="alert" />
        <span>
          {t(
            status.state === 'failed'
              ? 'library.subtitles.import.failed'
              : REFUSAL_KEYS[status.reason],
          )}
        </span>
      </p>
    );
  }
  return null;
};

/**
 * Where to get a video's subtitles and how to keep them with it: a search
 * for the video on subtitle sites, opened in the viewer's own browser, and
 * the two ways to bring a file in — the dialog, or a drop on the tab. The
 * Lyrics tab's finder, for a video (`LibraryLyricsFinder`), in its classes.
 *
 * `isLead` is the empty state, where importing is the next thing to do and
 * wears the accent; reached from subtitles already shown, it is quiet.
 */
const LibrarySubtitlesFinder = ({
  track,
  subtitlesImport,
  isLead,
}: {
  track: ILibraryTrack;
  subtitlesImport: ISubtitlesImport;
  isLead: boolean;
}) => {
  const { t } = useTranslation();
  const query = subtitleSearchQuery(track);
  const isBusy = subtitlesImport.status.state === 'busy';

  return (
    <div className="library-lyrics-finder">
      {query !== undefined && (
        <section className="library-lyrics-finder__group">
          <h3 className="library-pane__heading">
            {t('library.subtitles.find.heading')}
          </h3>
          <ul className="library-lyrics-finder__sites">
            {SUBTITLE_SITES.map((site) => (
              <li key={site.id}>
                <button
                  type="button"
                  className="library-lyrics-finder__site"
                  title={t('library.subtitles.find.open', { site: site.name })}
                  // The window's own opener hands an http(s) address to the
                  // browser and refuses anything else (`openExternalIfSafe`).
                  onClick={() => {
                    window.open(site.searchUrl(query), '_blank', 'noopener');
                  }}
                >
                  <span className="library-lyrics-finder__site-name">
                    {site.name}
                  </span>
                  <span className="library-lyrics-finder__site-note">
                    {t(COVERS_KEYS[site.covers])}
                  </span>
                  <MenuIcon
                    name="external"
                    className="menu-icon library-lyrics-finder__site-icon"
                  />
                </button>
              </li>
            ))}
          </ul>
          <p className="library-pane__note library-lyrics-finder__query">
            {t('library.subtitles.find.searches', { query })}
          </p>
        </section>
      )}

      <section className="library-lyrics-finder__group">
        <h3 className="library-pane__heading">
          {t('library.subtitles.import.heading')}
        </h3>
        <div className="library-lyrics-finder__actions">
          <button
            type="button"
            className={`button small${isLead ? '' : ' subtle'}`}
            disabled={isBusy}
            onClick={subtitlesImport.pickFile}
          >
            <MenuIcon name="import" />
            {t('library.subtitles.import.file')}
          </button>
        </div>
        <p className="library-pane__note library-lyrics-finder__drop">
          {t('library.subtitles.import.drop')}
        </p>
        <ImportStatus status={subtitlesImport.status} />
      </section>
    </div>
  );
};

export default LibrarySubtitlesFinder;
