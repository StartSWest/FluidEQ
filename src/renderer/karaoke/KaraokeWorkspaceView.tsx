/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  karaokeLyricWarningSentence,
  karaokeSetAsideSentences,
} from './karaokeImportNotices';
import KaraokeStageToolbar from './KaraokeStageToolbar';
import { KaraokeLiveValue } from './karaokeLiveValue';
import KaraokeTransport from './KaraokeTransport';
import KaraokeSceneAppearanceControls from './KaraokeSceneAppearanceControls';
import KaraokePlaylist from './KaraokePlaylist';
import { KARAOKE_PLAYLIST_DRAG_MIME } from './karaokePlaylistTree';
import { KARAOKE_FILE_PICKER_ACCEPT } from '../../common/karaoke/files';
import { ERROR_KEYS } from './karaokeWorkspaceLabels';
import KaraokeSetAsideNotice from './KaraokeSetAsideNotice';
import KaraokePaneSplitter from './KaraokePaneSplitter';
import KaraokeBackdrop, { karaokeBackdropKind } from './KaraokeBackdrop';
import KaraokeChordGuide from './KaraokeChordGuide';
import KaraokeLyrics from './KaraokeLyrics';
import KaraokePitchScore from './KaraokePitchScore';
import Spinner from '../icons/Spinner';
import karaokeMicrophoneImage from '../../../assets/karaoke-microphone.png';
import MenuIcon from '../icons/MenuIcon';
import KaraokeMaker from './KaraokeMaker';
import { useStandInForGraphScene } from '../graph/sceneStandIn';
import { useSceneLook } from '../utils/graphStyle';
import { importedFileIdentity } from './karaokeWorkspaceRestore';
import { setKaraokeHostSource } from './karaokeMediaPath';
import { karaokeMakerProjectToSong } from '../../common/karaoke/makerProject';
import { type IKaraokeWorkspaceProps } from './KaraokeWorkspace';
import { type TKaraokeWorkspaceStage } from './useKaraokeWorkspaceStage';
import { type TKaraokeLibraryEntry } from './useKaraokeLibraryEntry';
import { type TKaraokeWorkspacePlaylist } from './useKaraokeWorkspacePlaylist';

type TKaraokeWorkspaceViewProps = Pick<IKaraokeWorkspaceProps, 'isHidden'> &
  Required<
    Pick<
      IKaraokeWorkspaceProps,
      | 'hasFullScreenTopBar'
      | 'isChromeIdle'
      | 'isFullScreen'
      | 'isGraphOverlay'
      | 'onToggleFullScreen'
      | 'onToggleFullScreenTopBar'
    >
  > & {
    stage: TKaraokeWorkspaceStage;
    songs: TKaraokeWorkspacePlaylist;
    library: TKaraokeLibraryEntry;
  };

/**
 * The karaoke workspace's markup: the playlist pane, the stage with its
 * lyrics, pitch lane and art, the toolbar, the transport handed to the
 * window's bar, notices and the Maker. Holds no state and runs no hooks;
 * everything it shows comes from the stage and the playlist.
 */
const KaraokeWorkspaceView = ({
  stage,
  songs,
  library,
  hasFullScreenTopBar,
  isChromeIdle,
  isFullScreen,
  isGraphOverlay,
  isHidden,
  onToggleFullScreen,
  onToggleFullScreenTopBar,
}: TKaraokeWorkspaceViewProps) => {
  const {
    t,
    lyricTextSizeId,
    fileInputRef,
    folderInputRef,
    microphoneMenuButtonRef,
    workspaceRef,
    playerRef,
    stageRef,
    isDragging,
    setIsDragging,
    isMicrophoneMenuOpen,
    setIsMicrophoneMenuOpen,
    isMakerOpen,
    setIsMakerOpen,
    setIsMakerWorking,
    restoreMakerDraft,
    setRestoreMakerDraft,
    countInCue,
    countInLabel,
    lyricsFollowRequestKey,
    setLyricsFollowRequestKey,
    lyricTextSize,
    playlist,
    groupPlaylistByFolder,
    selectedPlaylistId,
    setAsideFiles,
    setSetAsideFiles,
    guides,
    setGuides,
    isTextSizeOpen,
    setIsTextSizeOpen,
    textSizeButtonRef,
    background,
    setBackground,
    audioClock,
    microphone,
    session,
    fader,
    song,
    status,
    error,
    warning,
    playhead,
    melodyTone,
    chordAnalysis,
    vocalLevel,
    setVocalLevel,
    canMixVocals,
    stemFocus,
    backingBlend,
    backingLevel,
    focusStem,
    changeBackingBlend,
    changeBackingLevel,
    applyStemsToSong,
    isLoading,
    changeLyricTextSize,
    cancelCountIn,
    practicePitchIssue,
    handleTogglePlayback,
    handleEditorPlay,
    handleEditorPause,
    handleSeek,
    handleStopPlayback,
    handleSelectLyric,
    handleRestart,
    handlePitchScrubStart,
    handlePitchScrub,
    handlePitchScrubEnd,
    layout,
    updateLayout,
    commitLayout,
    startPlaylistResize,
    resizePlaylist,
    playerStyle,
    pitchStyle,
    pitchHeightPercent,
    startPitchResize,
    resizePitch,
    isRestoring,
  } = stage;
  const {
    onFileInput,
    onDrop,
    clearPlaylist,
    selectPlaylistItem,
    activatePlaylistItem,
    movePlaylistItem,
    removePlaylistItem,
    toggleFolderGrouping,
    collapsePlaylist,
    transportSlot,
    makerAudio,
    isMakerShown,
  } = songs;
  // No scene behind the Maker, the Karaoke's or the window's (Ivan,
  // 2026-11-16: "it is very slow ... the Maker cannot show the scene
  // behind"): its own backdrop is not mounted while it is open, and taking
  // the stand-in stops the graph's scene, which would otherwise have taken
  // over the moment the Karaoke's let it go.
  useStandInForGraphScene(!isHidden && isMakerOpen);
  // A picture behind the words - a scene, a cover, a video - is not whitened
  // on a white window (Ivan, 2026-11-18: "scene bg or even cover art doesn't
  // mean we need to white it too"; `_karaokeGraphBackground.scss`), and the
  // words and the pitch lane's notes over it are drawn flat, with no light
  // halo or plate, which over a picture read as a glowing border ("remove
  // the glowing border ... flat and clean").
  const backdropKind = karaokeBackdropKind(background, song);
  const sceneLook = useSceneLook();
  const overPicture =
    backdropKind === 'cover' ||
    backdropKind === 'video' ||
    (backdropKind === 'graph' && sceneLook !== null);
  const addFiles = useCallback(
    () => fileInputRef.current?.click(),
    [fileInputRef],
  );
  const addFolder = useCallback(
    () => folderInputRef.current?.click(),
    [folderInputRef],
  );
  const lyricWarningSentence = warning
    ? karaokeLyricWarningSentence(warning, t)
    : '';

  /** The Maker opened on the song on the stage. */
  const openMaker = useCallback(() => {
    if (!song) {
      return;
    }
    cancelCountIn();
    session.pause();
    // Which takes precedence, the saved draft or the player's own timing,
    // depends on what the song is. An existing karaoke — the song itself
    // carries word timing — opens on the player's normalized truth, with the
    // draft one Undo away, so a stale shifted draft cannot make a finished
    // song look out of sync. A song with no timing of its own has all its
    // work in the draft: detected lyrics vanished on reopen until it
    // restored.
    setRestoreMakerDraft(
      !song.lines.some((line) =>
        line.tokens.some((token) => token.startMs !== undefined),
      ),
    );
    setIsMakerOpen(true);
  }, [cancelCountIn, session, setIsMakerOpen, setRestoreMakerDraft, song]);

  // In the stage's bar, ahead of the song's name: it floated over the
  // stage's corner and stood on the name (Ivan, 2026-11-16: "fix this too,
  // name on top of floating list button").
  const playlistExpand = playlist.length > 0 && layout.playlistCollapsed && (
    <button
      type="button"
      className="karaoke-playlist__expand"
      aria-label={t('karaoke.playlist.expand')}
      title={t('karaoke.playlist.expand')}
      onClick={() => updateLayout({ playlistCollapsed: false }, true)}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 5.5h6M4 10h6M4 14.5h6M12.5 4.5 18 10l-5.5 5.5" />
      </svg>
      <span>{t('karaoke.playlist.title')}</span>
    </button>
  );

  const stageToolbar = (
    <KaraokeStageToolbar
      leading={playlistExpand}
      song={song}
      guides={guides}
      setGuides={setGuides}
      background={background}
      setBackground={setBackground}
      onOpenMaker={openMaker}
      lyricTextSizeId={lyricTextSizeId}
      lyricTextSize={lyricTextSize}
      onLyricTextSize={changeLyricTextSize}
      textSizeButtonRef={textSizeButtonRef}
      isTextSizeOpen={isTextSizeOpen}
      setIsTextSizeOpen={setIsTextSizeOpen}
      microphoneMenuButtonRef={microphoneMenuButtonRef}
      microphone={microphone}
      isMicrophoneMenuOpen={isMicrophoneMenuOpen}
      setIsMicrophoneMenuOpen={setIsMicrophoneMenuOpen}
      isFullScreen={isFullScreen}
      isChromeIdle={isChromeIdle}
      hasFullScreenTopBar={hasFullScreenTopBar}
      onToggleFullScreenTopBar={onToggleFullScreenTopBar}
      onToggleFullScreen={onToggleFullScreen}
    />
  );

  /**
   * This tab's own transport, handed to the bar at the foot of the window.
   *
   * One wrapper for the whole app, and the options change with the tab: a
   * karaoke transport is not a play button, and reducing it to one on the way
   * into a shared bar would take the mix faders, the jumps and the pitch tone
   * away from the one tab that has them. The bar draws this where its own
   * buttons would have gone.
   */
  /**
   * What is wrong with THIS song's lyrics, if anything.
   *
   * Two cases and one line: a lyric file that could not be read, and a song
   * that simply has none. Both are facts about the song on the stage, which
   * is why this is worked out here and drawn beside the words rather than
   * announced once for an import and left there.
   */
  const selectedItem = playlist.find((item) => item.id === selectedPlaylistId);
  const lyricNotice = (() => {
    if (warning) {
      return `${warning.fileName} ${lyricWarningSentence} ${t(
        'karaoke.warning.lyricsAudioIntact',
      )}`;
    }
    if (song && selectedItem && !selectedItem.lyrics) {
      return t('karaoke.warning.lyricsAudioIntact');
    }
    return undefined;
  })();

  const karaokeControls = song ? (
    <KaraokeTransport
      status={status}
      playhead={playhead}
      durationMs={session.durationMs}
      levels={[
        // The computer's volume, the same fader the Library and the Media
        // tab draw. First in the row and the one on the bar by default,
        // because every other tab's bar opens on the volume and karaoke's
        // opening on a stem made the same window a different shape. The
        // three below it are a MIX — how the parts sit against each other
        // — and none of them answers "how loud is this". Only once Windows
        // has said what its level is: with no helper to ask there is no
        // master row, rather than one that moves nothing.
        ...(fader.level !== undefined
          ? [
              {
                id: 'master',
                label: t('library.volume'),
                value: fader.level,
                valueText: `${Math.round((fader.confirmedLevel ?? fader.level) * 100)}%`,
                onBeginChange: fader.beginChange,
                onKeyDown: fader.onKeyDown,
                onCommit: fader.endChange,
                onChange: fader.setLevel,
                // The master has a real output mute. Zeroing a stem and
                // restoring its level cannot release that separate mute.
                pressed: fader.isMuted,
                onToggle: fader.toggleMute,
                toggleLabel: t(
                  fader.isMuted ? 'library.unmute' : 'library.mute',
                ),
              },
            ]
          : []),
        {
          id: 'melody',
          label: t('karaoke.pitch.toneVolume'),
          value: melodyTone.volume,
          channel: 'melody',
          disabled: !melodyTone.isAvailable || !melodyTone.enabled,
          toggleDisabled: !melodyTone.isAvailable,
          pressed: melodyTone.enabled,
          onToggle: () => melodyTone.toggle().catch(() => undefined),
          onChange: melodyTone.setVolume,
        },
        {
          id: 'backing',
          label: t('karaoke.maker.stemBacking'),
          value: backingLevel,
          channel: 'backing',
          onChange: changeBackingLevel,
        },
        ...(canMixVocals
          ? [
              {
                id: 'vocal',
                label: t('karaoke.transport.vocalLevel'),
                value: vocalLevel,
                valueText:
                  vocalLevel === 0
                    ? t('karaoke.transport.vocalOff')
                    : `${Math.round(vocalLevel * 100)}%`,
                channel: 'vocal' as const,
                onChange: setVocalLevel,
              },
            ]
          : []),
      ]}
      appearanceControls={
        background === 'graph' ? <KaraokeSceneAppearanceControls /> : undefined
      }
      onTogglePlayback={handleTogglePlayback}
      onStop={handleStopPlayback}
      onJumpToStart={() => handleSeek(0)}
      onJumpToEnd={() => handleSeek(session.durationMs)}
      onSeek={handleSeek}
    />
  ) : undefined;
  const karaokeTransportPortal =
    transportSlot && karaokeControls
      ? createPortal(karaokeControls, transportSlot, 'karaoke-transport')
      : null;

  if (isHidden) {
    return (
      // The wrapper matches the visible root so React preserves the keyed
      // audio node across tab changes. Reparenting that live element would
      // remount it and create exactly the stop/click this path prevents.
      <section className="karaoke-audio-host" hidden>
        {/* Audio-only karaoke; timed lyrics are rendered only by the visible workspace. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio key="karaoke-audio" ref={session.audioRef} preload="metadata" />
        {karaokeTransportPortal}
      </section>
    );
  }

  const setAsideText = setAsideFiles
    ? karaokeSetAsideSentences(setAsideFiles, t).join(' ')
    : undefined;

  return (
    <section
      ref={workspaceRef}
      className={`karaoke-workspace workspace-tab-panel workspace-tab-panel--karaoke${
        isHidden ? ' is-hidden' : ''
      }${isRestoring ? ' is-restoring' : ''}${isFullScreen ? ' is-fullscreen' : ''}${
        isGraphOverlay && !isMakerOpen ? ' is-graph-overlay' : ''
      }${isMakerOpen ? ' is-maker-open' : ''}${
        isMakerShown ? ' is-maker-shown' : ''
      }${song ? ' has-song' : ' is-empty'}`}
      aria-label={t('tabs.karaoke')}
      aria-hidden={isHidden}
      /* No press handler on the stage.

         Pressing used to show the chrome and later to toggle it, and both
         fought the gestures the stage already has: a double-click leaves full
         screen, and each of its two presses flipped the bar on the way out.
         The chrome is on one rule now — it goes after five still seconds and
         comes back when the pointer reaches the edge it lives at. */
      onDoubleClick={(event) => {
        const target = event.target as Element;
        // The stage itself is the fullscreen target. Controls keep their own
        // double-click behaviour, and the Maker is a separate editing surface
        // where an accidental window-mode change would be especially costly.
        if (
          target.closest(
            'button, input, select, textarea, a, [role="dialog"], [role="menu"], .karaoke-maker',
          )
        ) {
          return;
        }
        onToggleFullScreen();
      }}
      // A labelled region is also the deliberate whole-surface drop target.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      onDragEnter={(event) => {
        event.preventDefault();
        if (!event.dataTransfer.types.includes(KARAOKE_PLAYLIST_DRAG_MIME)) {
          setIsDragging(true);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={onDrop}
    >
      {/* Imported timed lyrics are rendered beside this audio-only element;
          there is no video track to caption. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio key="karaoke-audio" ref={session.audioRef} preload="metadata" />
      {karaokeTransportPortal}
      {/* Over the whole Karaoke page, playlist and all, so it stands at the
          page's centre whatever the playlist takes (Ivan, 2026-11-16: "it
          needs to centre on the whole Karaoke content"); inside the stage it
          sat off centre whenever the playlist was open. */}
      {isRestoring && !song && (
        <div className="karaoke-workspace__restoring" role="status">
          <Spinner />
        </div>
      )}
      <input
        ref={fileInputRef}
        className="karaoke-workspace__file-input"
        type="file"
        multiple
        accept={KARAOKE_FILE_PICKER_ACCEPT}
        onChange={onFileInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={folderInputRef}
        className="karaoke-workspace__file-input"
        type="file"
        multiple
        // Chromium's folder picker attribute is not yet in React's DOM types.
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...({ webkitdirectory: '' } as { webkitdirectory: string })}
        onChange={onFileInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      {error && (
        <div className="karaoke-workspace__notice is-error" role="alert">
          {t(ERROR_KEYS[error])}
        </div>
      )}
      {/* What the import could not use. Not the same thing as the lyric
          warning that used to sit beside it: that one is about the song on
          the stage and now lives in the lyrics pane, while this is about the
          folder that was just opened — the `.srt` nothing here can read, the
          two lyric files that matched one song. There is no single song to
          hang it on, and set aside without a word it reads as a feature that
          silently did nothing. */}
      {setAsideText && (
        // Keyed by what it says, so a new import's news starts its own few
        // seconds rather than inheriting what was left of the last one's.
        <KaraokeSetAsideNotice
          key={setAsideText}
          text={setAsideText}
          onDismiss={() => setSetAsideFiles(undefined)}
        />
      )}
      {/* The idle-release question is not drawn here. It outlives this tab
          being looked at, so `SpeechMemoryNotice` asks it from the app root. */}

      <div
        ref={playerRef}
        className={`karaoke-workspace__player${
          playlist.length > 0 ? ' has-playlist' : ''
        }${
          playlist.length > 0 && layout.playlistCollapsed
            ? ' is-playlist-collapsed'
            : ''
        }`}
        style={playerStyle}
      >
        {/* Mounted while folded as well, so the column can close and open
            around the list (`Karaoke.scss`) instead of the list vanishing in
            one frame. */}
        {playlist.length > 0 && (
          <KaraokePlaylist
            items={playlist}
            selectedId={selectedPlaylistId}
            isPlaying={status === 'playing'}
            groupByFolder={groupPlaylistByFolder}
            isBusy={isLoading}
            onToggleFolderGrouping={toggleFolderGrouping}
            onAddFiles={addFiles}
            onAddFolder={addFolder}
            onClear={clearPlaylist}
            onSelect={selectPlaylistItem}
            onActivate={activatePlaylistItem}
            onMove={movePlaylistItem}
            onRemove={removePlaylistItem}
            onCollapse={collapsePlaylist}
            isCollapsed={layout.playlistCollapsed}
          />
        )}
        {playlist.length > 0 && (
          <KaraokePaneSplitter
            orientation="vertical"
            ariaLabel={t('karaoke.playlist.resize')}
            valuePercent={layout.playlistShare * 100}
            onStart={startPlaylistResize}
            onDrag={resizePlaylist}
            onEnd={commitLayout}
          />
        )}
        <div
          ref={stageRef}
          className={`karaoke-workspace__stage is-backdrop-${backdropKind}${
            overPicture ? ' has-picture' : ''
          }${song ? ' has-song' : ''}${
            playlist.length > 0 && layout.playlistCollapsed
              ? ' has-collapsed-playlist'
              : ''
          }${isDragging ? ' is-dragging' : ''}`}
        >
          {!isHidden && !isMakerOpen && (
            <KaraokeBackdrop
              background={background}
              song={song}
              playhead={playhead}
              isPlaying={status === 'playing'}
              isGraphOverlay={isGraphOverlay}
            />
          )}
          {!(isFullScreen && isGraphOverlay) && stageToolbar}
          {song ? (
            <>
              {/* Beside the words, because it is about the words.
                  It used to sit in the header as one sentence for a whole
                  import -- "these lyric files were not used", listed for a
                  folder of twenty songs, still on screen while a song played
                  perfectly well. What belongs on screen is what is wrong with
                  the song you are looking at. */}
              {lyricNotice && (
                <p className="karaoke-lyrics__notice" role="status">
                  {lyricNotice}
                </p>
              )}
              <KaraokeLiveValue value={playhead}>
                {(playheadMs) => (
                  <KaraokeLyrics
                    song={song}
                    playheadMs={playheadMs}
                    isActive={!isMakerShown}
                    onSeek={handleSelectLyric}
                    followRequestKey={lyricsFollowRequestKey}
                    textSize={lyricTextSize}
                    overPicture={overPicture}
                  />
                )}
              </KaraokeLiveValue>
              {/* Under the words, as the K1 mockup draws them: the chords as a
                  row of chips over the slim pitch lane, each the toolbar's
                  own toggle. */}
              {(guides.chords || guides.pitch) && (
                <div className="karaoke-stage__guides" style={pitchStyle}>
                  {guides.chords && (
                    <KaraokeLiveValue value={playhead}>
                      {(playheadMs) => (
                        <KaraokeChordGuide
                          status={chordAnalysis.status}
                          chords={chordAnalysis.chords}
                          progress={chordAnalysis.progress}
                          playheadMs={playheadMs}
                        />
                      )}
                    </KaraokeLiveValue>
                  )}
                  {/* The strip's handle, under the chords and over the strip
                      it sizes (Ivan, 2026-11-16: "move the resizer below
                      the chords"). */}
                  {guides.pitch && (
                    <KaraokePaneSplitter
                      orientation="horizontal"
                      ariaLabel={t('karaoke.pitch.resize')}
                      valuePercent={pitchHeightPercent}
                      onStart={startPitchResize}
                      onDrag={resizePitch}
                      onEnd={commitLayout}
                    />
                  )}
                  {guides.pitch && (
                    <KaraokePitchScore
                      song={song}
                      status={status}
                      microphone={microphone}
                      isActive={!isHidden && !isMakerShown}
                      durationMs={session.durationMs}
                      readPlayheadMs={session.readPlayheadMs}
                      onPracticeIssue={practicePitchIssue}
                      onScrubStart={handlePitchScrubStart}
                      onScrub={handlePitchScrub}
                      onScrubEnd={handlePitchScrubEnd}
                      onSingFrom={handleSelectLyric}
                      onSingAgain={handleRestart}
                      overPicture={overPicture}
                    />
                  )}
                </div>
              )}
              {countInCue && (
                <div
                  className="karaoke-count-in"
                  role="status"
                  aria-live="assertive"
                >
                  <strong key={countInCue}>{countInCue}</strong>
                  <span>{countInLabel}</span>
                </div>
              )}
            </>
          ) : (
            /* Nothing about being empty until the question has been
               answered. Last session's playlist is read back a moment after
               the tab opens, and for that moment this drew a microphone and
               "drop a folder here" over a library that was about to appear.
               Same as the library tab's own empty panel. */
            !isRestoring && (
              <div className="karaoke-workspace__empty">
                <img
                  className="karaoke-workspace__microphone-art"
                  src={karaokeMicrophoneImage}
                  alt=""
                  aria-hidden="true"
                  draggable="false"
                />
                <div className="karaoke-workspace__empty-copy">
                  <h3>
                    {t(
                      isLoading
                        ? 'karaoke.import.loading'
                        : 'karaoke.empty.title',
                    )}
                  </h3>
                  <p>{t('karaoke.empty.body')}</p>
                  <div className="karaoke-workspace__empty-actions">
                    <button
                      type="button"
                      className="button small karaoke-workspace__empty-open"
                      onClick={addFiles}
                      disabled={isLoading}
                      aria-disabled={isLoading}
                    >
                      <MenuIcon
                        name="filePlus"
                        className="karaoke-button__icon"
                      />
                      <span>{t('karaoke.import.open')}</span>
                    </button>
                    <button
                      type="button"
                      className="button small subtle karaoke-workspace__empty-open"
                      onClick={addFolder}
                      disabled={isLoading}
                      aria-disabled={isLoading}
                    >
                      <MenuIcon
                        name="folder"
                        className="karaoke-button__icon"
                      />
                      <span>{t('karaoke.import.folder')}</span>
                    </button>
                  </div>
                  <small>{t('karaoke.import.formats')}</small>
                </div>
                <div className="karaoke-workspace__levels" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )
          )}
          {isDragging && (
            <div className="karaoke-workspace__drop-overlay" role="status">
              {t('karaoke.import.drop')}
            </div>
          )}
        </div>
      </div>

      {isMakerShown && song && makerAudio && (
        <KaraokeMaker
          // Apply replaces only this song's in-memory normalized timing,
          // so it deliberately keeps the same editor. A different audio
          // item gets a fresh Maker instance and restores its own saved
          // draft.
          // A press of the Library's "Open in Karaoke" is a fresh editor
          // even on the song already open: it brings that song's words.
          key={`${importedFileIdentity(makerAudio.file)}#${
            library.libraryEntry?.nonce ?? 0
          }`}
          song={song}
          audioFile={makerAudio.file}
          playhead={playhead}
          durationMs={session.durationMs}
          isPlaying={status === 'playing'}
          restoreSavedDraft={restoreMakerDraft}
          readPlayheadMs={session.readPlayheadMs}
          audioRef={session.audioRef}
          audioClock={audioClock}
          vocalLevel={canMixVocals ? vocalLevel : undefined}
          onVocalLevel={canMixVocals ? setVocalLevel : undefined}
          stemFocus={stemFocus}
          onFocusStem={focusStem}
          backingBlend={backingBlend}
          onBackingBlend={changeBackingBlend}
          onSeek={session.seek}
          onPlay={handleEditorPlay}
          onPause={handleEditorPause}
          onModelWorkChange={setIsMakerWorking}
          onStems={({ vocals, instrumental }) => {
            // Both stems join the song as their own roles; the audio
            // asset stays exactly as imported — the Maker is keyed on it,
            // and an earlier version that swapped it remounted the open
            // editor.
            //
            // Onto disk first, so a refresh recovers them with the
            // workspace — and because the Library's native player opens
            // a file by its path, and a stem only has one once main has
            // written it. Joined to the song either way: a save that
            // failed leaves the song playing on the page's own element.
            Promise.all([vocals.arrayBuffer(), instrumental.arrayBuffer()])
              .then(([vocalBytes, instrumentalBytes]) =>
                window.electron.ipcRenderer.saveKaraokeStems(
                  song.id,
                  vocalBytes,
                  instrumentalBytes,
                ),
              )
              .then(
                () => {
                  setKaraokeHostSource(vocals, {
                    kind: 'stem',
                    key: song.id,
                    role: 'vocals',
                  });
                  setKaraokeHostSource(instrumental, {
                    kind: 'stem',
                    key: song.id,
                    role: 'instrumental',
                  });
                  return undefined;
                },
                () => undefined,
              )
              .then(() => applyStemsToSong(song, vocals, instrumental))
              .catch(() => undefined);
          }}
          onApply={(project) => {
            session.applySong(
              karaokeMakerProjectToSong(project, makerAudio, song.assets),
            );
            setLyricsFollowRequestKey((request) => request + 1);
          }}
          onClose={() => {
            // Solo listening must not outlive the editor: leaving with
            // the voice soloed kept the backing scaled to its blend —
            // often zero — and the player looked broken at any master
            // volume.
            focusStem('backing');
            setIsMakerOpen(false);
          }}
          isFullScreen={isFullScreen}
          onToggleFullScreen={onToggleFullScreen}
          libraryOrigin={library.libraryOrigin}
          libraryEntry={library.libraryEntry}
        />
      )}
    </section>
  );
};

export default KaraokeWorkspaceView;
