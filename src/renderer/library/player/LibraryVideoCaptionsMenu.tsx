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

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ISubtitleFile } from '../../../common/library/subtitles';
import type { ILibraryTrack } from '../../../common/library/types';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import subtitleLabels from '../subtitleLabels';
import { useSubtitleChoice } from '../subtitleChoice';
import { updateSubtitleStyle, useSubtitleStyle } from '../subtitleStyleStore';
import { useTrackSubtitles } from '../useTrackSubtitles';

/** One empty list, so the labels are not rebuilt on every render. */
const NO_FILES: readonly ISubtitleFile[] = [];

/** The tick a chosen row wears, the column chooser's own. */
const Tick = ({ isOn }: { isOn: boolean }) => (
  <span
    className={`library-columns-menu__tick${isOn ? ' is-on' : ''}`}
    aria-hidden="true"
  >
    <svg viewBox="0 0 16 16">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  </span>
);

/**
 * The captions' quick switch on a full-screen film, where the Subtitles tab
 * is out of sight: captions on or off, and which language. Everything else
 * about them — size, colour, background, place — is the tab's, which a
 * viewer sets once and does not reach for mid-film. Drawn only for a film
 * that has subtitles beside it.
 */
const CaptionsMenu = ({ track }: { track: ILibraryTrack }) => {
  const { t, locale } = useTranslation();
  const { wanted, preferred, choose } = useSubtitleChoice(track.id, locale);
  const read = useTrackSubtitles(track, wanted, preferred);
  const style = useSubtitleStyle();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const files = read.state === 'ready' ? read.answer.files : NO_FILES;
  const shownFile =
    read.state === 'ready' ? read.answer.shown?.fileName : undefined;
  const labels = useMemo(() => subtitleLabels(files, t), [files, t]);

  // A press elsewhere or Escape puts it away; the portalled menu is asked
  // about separately, or a press inside it would count as outside.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !anchorRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (files.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={`button small library-video-stage__tool${
          style.enabled ? ' is-on' : ''
        }`}
        aria-label={t('library.subtitles.menu')}
        title={t('library.subtitles.menu')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MenuIcon name="subtitles" />
      </button>
      <AnchoredMenu
        anchor={anchorRef.current}
        isOpen={isOpen}
        className="library-list__menu library-columns-menu library-video-stage__captions-menu"
        ariaLabel={t('library.subtitles.menu')}
      >
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={style.enabled}
          onClick={() => updateSubtitleStyle({ enabled: !style.enabled })}
        >
          <Tick isOn={style.enabled} />
          <span>{t('library.subtitles.show')}</span>
        </button>
        <div className="library-list__menu-rule" role="none" />
        {files.map((file) => {
          const isShown = file.fileName === shownFile;
          const label = labels.get(file.fileName) ?? '';
          return (
            <button
              key={file.fileName}
              type="button"
              role="menuitemradio"
              aria-checked={isShown}
              title={label}
              onClick={() => {
                choose(file.fileName, file.tag);
                // Picking a language is asking to read it.
                updateSubtitleStyle({ enabled: true });
                setIsOpen(false);
              }}
            >
              <Tick isOn={isShown} />
              <span>{label}</span>
            </button>
          );
        })}
      </AnchoredMenu>
    </>
  );
};

/** The quick switch for the film on the stage, once its entry is known. */
const LibraryVideoCaptionsMenu = ({
  track,
}: {
  track: ILibraryTrack | undefined;
}) =>
  track === undefined ? null : <CaptionsMenu key={track.id} track={track} />;

export default LibraryVideoCaptionsMenu;
