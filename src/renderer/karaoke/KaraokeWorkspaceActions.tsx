/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { hasKaraokeStageArt } from './KaraokeStageMedia';
import MenuIcon from '../icons/MenuIcon';
import {
  writePitchGuideVisibility,
  writeStageArtVisibility,
} from './karaokeWorkspacePrefs';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { KaraokeLiveValue } from './karaokeLiveValue';
import { KaraokeMicrophoneSettings } from './KaraokeMicrophone';
import { type IKaraokePlaylistItem } from '../../common/karaoke/files';
import { type useKaraokeSession } from './useKaraokeSession';
import { type useKaraokeMicrophoneInput } from './useKaraokeMicrophone';
import { type IKaraokeSong } from '../../common/karaoke/types';
import { useTranslation } from '../utils/I18nContext';

interface IKaraokeWorkspaceActionsProps {
  song: IKaraokeSong | undefined;
  isStageArtVisible: boolean;
  isFullScreen: boolean;
  isChromeIdle: boolean;
  playlist: IKaraokePlaylistItem[];
  clearPlaylist: () => void;
  folderInputRef: RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  cancelCountIn: () => void;
  session: ReturnType<typeof useKaraokeSession>;
  setRestoreMakerDraft: Dispatch<SetStateAction<boolean>>;
  setIsMakerOpen: Dispatch<SetStateAction<boolean>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isPitchGuideVisible: boolean;
  setIsPitchGuideVisible: Dispatch<SetStateAction<boolean>>;
  setIsStageArtVisible: Dispatch<SetStateAction<boolean>>;
  microphoneMenuButtonRef: RefObject<HTMLButtonElement | null>;
  microphone: ReturnType<typeof useKaraokeMicrophoneInput>;
  isMicrophoneMenuOpen: boolean;
  setIsMicrophoneMenuOpen: Dispatch<SetStateAction<boolean>>;
  hasFullScreenTopBar: boolean;
  onToggleFullScreenTopBar: () => void;
  onToggleFullScreen: () => void;
}

/**
 * The karaoke workspace's toolbar: clearing and adding songs, opening the
 * Maker, the pitch guide and stage art switches, the microphone and its
 * menu, and the full-screen buttons. On the stage it is the stage's own
 * toolbar and fades with the rest of the chrome when idle.
 */
const KaraokeWorkspaceActions = ({
  song,
  isStageArtVisible,
  isFullScreen,
  isChromeIdle,
  playlist,
  clearPlaylist,
  folderInputRef,
  isLoading,
  cancelCountIn,
  session,
  setRestoreMakerDraft,
  setIsMakerOpen,
  fileInputRef,
  isPitchGuideVisible,
  setIsPitchGuideVisible,
  setIsStageArtVisible,
  microphoneMenuButtonRef,
  microphone,
  isMicrophoneMenuOpen,
  setIsMicrophoneMenuOpen,
  hasFullScreenTopBar,
  onToggleFullScreenTopBar,
  onToggleFullScreen,
}: IKaraokeWorkspaceActionsProps) => {
  const { t } = useTranslation();
  const hasStageArt = song ? hasKaraokeStageArt(song) : false;
  const stageArtActionKey = (() => {
    if (!hasStageArt) {
      return 'karaoke.stage.noArt';
    }
    return isStageArtVisible
      ? 'karaoke.stage.hideArt'
      : 'karaoke.stage.showArt';
  })();

  // Full screen gives the vertical space to the lyrics instead of keeping the
  // workspace introduction above them. The same controls move into a compact
  // glass dock inside the lyric surface, so importing or changing the mic does
  // not require leaving the stage.
  return (
    <div
      className={`karaoke-workspace__actions${
        isFullScreen ? ' is-stage-toolbar' : ''
      }${isFullScreen && isChromeIdle ? ' is-idle' : ''}`}
      role="toolbar"
      aria-label={t('karaoke.actions')}
    >
      {playlist.length > 0 && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__action"
          onClick={clearPlaylist}
        >
          <MenuIcon name="clear" className="karaoke-button__icon" />
          <span>{t('karaoke.import.clear')}</span>
        </button>
      )}
      <button
        type="button"
        className="button small subtle karaoke-workspace__action"
        onClick={() => folderInputRef.current?.click()}
        disabled={isLoading}
        aria-disabled={isLoading}
      >
        <MenuIcon name="folder" className="karaoke-button__icon" />
        <span>{t('karaoke.import.folder')}</span>
      </button>
      {song && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__action karaoke-workspace__maker-action"
          onClick={() => {
            cancelCountIn();
            session.pause();
            // Which takes precedence, the saved draft or the player's own
            // timing, depends on what the song is. An existing karaoke — the
            // song itself carries word timing — opens on the player's
            // normalized truth, with the draft one Undo away, so a stale
            // shifted draft cannot make a finished song look out of sync.
            // A song with no timing of its own has all its work in the
            // draft: detected lyrics vanished on reopen until it restored.
            setRestoreMakerDraft(
              !song.lines.some((line) =>
                line.tokens.some((token) => token.startMs !== undefined),
              ),
            );
            setIsMakerOpen(true);
          }}
          title={t('karaoke.maker.openTitle')}
        >
          <svg
            className="karaoke-button__icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="m4 17-.8 3.8L7 20l10.8-10.8-3-3L4 17Zm9.5-9.5 3 3M13 20h8" />
          </svg>
          <span>{t('karaoke.maker.open')}</span>
        </button>
      )}
      <button
        type="button"
        className="button small karaoke-workspace__action karaoke-workspace__open"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        aria-disabled={isLoading}
      >
        <MenuIcon name="filePlus" className="karaoke-button__icon" />
        <span>
          {t(song ? 'karaoke.import.addFiles' : 'karaoke.import.open')}
        </span>
      </button>
      <button
        type="button"
        className="button small subtle karaoke-workspace__icon-action karaoke-workspace__pitch-toggle"
        aria-label={t(
          isPitchGuideVisible ? 'karaoke.pitch.hide' : 'karaoke.pitch.show',
        )}
        title={t(
          isPitchGuideVisible ? 'karaoke.pitch.hide' : 'karaoke.pitch.show',
        )}
        aria-pressed={isPitchGuideVisible}
        onClick={() => {
          setIsPitchGuideVisible((visible) => {
            const next = !visible;
            writePitchGuideVisibility(next);
            return next;
          });
        }}
      >
        <MenuIcon name="graph" className="karaoke-button__icon" />
      </button>
      {/* Present for every song, disabled for the ones with nothing behind
          the words. Hiding it instead was worse: a library of bare UltraStar
          text files never showed the control at all, so the setting looked
          like it did not exist. Disabled and labelled says which of the two
          it is. */}
      {song && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__icon-action karaoke-workspace__stage-art-toggle"
          aria-label={t(stageArtActionKey)}
          title={t(stageArtActionKey)}
          aria-pressed={isStageArtVisible}
          disabled={!hasStageArt}
          aria-disabled={!hasStageArt}
          onClick={() => {
            setIsStageArtVisible((visible) => {
              const next = !visible;
              writeStageArtVisibility(next);
              return next;
            });
          }}
        >
          <svg
            className="karaoke-button__icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 5.5h16v13H4zM4 15.5l4.5-4.5 3 3 3.5-3.5 5 5M14.6 9.6a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0" />
          </svg>
        </button>
      )}
      <button
        ref={microphoneMenuButtonRef}
        type="button"
        className={`button small subtle karaoke-workspace__icon-action karaoke-workspace__settings${
          microphone.status === 'live' ? ' is-live' : ''
        }`}
        aria-label={t('karaoke.mic.settings')}
        title={t('karaoke.mic.settings')}
        aria-haspopup="dialog"
        aria-expanded={isMicrophoneMenuOpen}
        onClick={() => setIsMicrophoneMenuOpen((open) => !open)}
      >
        <MenuIcon name="microphoneSettings" className="karaoke-button__icon" />
      </button>
      {isFullScreen && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__icon-action karaoke-workspace__top-bar"
          aria-label={t(
            hasFullScreenTopBar
              ? 'karaoke.fullscreen.hideHeader'
              : 'karaoke.fullscreen.showHeader',
          )}
          title={t(
            hasFullScreenTopBar
              ? 'karaoke.fullscreen.hideHeader'
              : 'karaoke.fullscreen.showHeader',
          )}
          aria-pressed={hasFullScreenTopBar}
          onClick={onToggleFullScreenTopBar}
        >
          <svg
            className="karaoke-button__icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 4.5h16v15H4zM4 9h16" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className="button small subtle karaoke-workspace__icon-action karaoke-workspace__fullscreen"
        aria-label={t(
          isFullScreen ? 'karaoke.fullscreen.exit' : 'karaoke.fullscreen.enter',
        )}
        title={`${t(
          isFullScreen ? 'karaoke.fullscreen.exit' : 'karaoke.fullscreen.enter',
        )} (Ctrl+F)`}
        aria-pressed={isFullScreen}
        onClick={onToggleFullScreen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {isFullScreen ? (
            <path
              style={{ fill: 'currentColor', stroke: 'none' }}
              d="M5 16h3v3h2v-5H5v2Zm3-8H5v2h5V5H8v3Zm6 11h2v-3h3v-2h-5v5Zm2-11V5h-2v5h5V8h-3Z"
            />
          ) : (
            <path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" />
          )}
        </svg>
      </button>
      <AnchoredMenu
        anchor={microphoneMenuButtonRef.current}
        isOpen={isMicrophoneMenuOpen}
        className="karaoke-microphone-popover"
        role="dialog"
        ariaLabel={t('karaoke.mic.settings')}
      >
        {/* The level is the one reading here that moves, twenty times a
            second while the input is live, and this panel is its only
            reader. */}
        <KaraokeLiveValue value={microphone.liveLevel}>
          {(level) => (
            <KaraokeMicrophoneSettings microphone={{ ...microphone, level }} />
          )}
        </KaraokeLiveValue>
      </AnchoredMenu>
    </div>
  );
};

export default KaraokeWorkspaceActions;
