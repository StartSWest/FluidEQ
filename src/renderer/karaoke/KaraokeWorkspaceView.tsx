/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  karaokeLyricWarningSentence,
  karaokeSetAsideSentences,
} from './karaokeImportNotices';
import KaraokeWorkspaceActions from './KaraokeWorkspaceActions';
import { KaraokeLiveValue } from './karaokeLiveValue';
import KaraokeTransport from './KaraokeTransport';
import KaraokePlaylist, { KARAOKE_PLAYLIST_DRAG_MIME } from './KaraokePlaylist';
import { KARAOKE_FILE_PICKER_ACCEPT } from '../../common/karaoke/files';
import { ERROR_KEYS, SOURCE_KEYS } from './karaokeWorkspaceLabels';
import KaraokeSetAsideNotice from './KaraokeSetAsideNotice';
import KaraokePaneSplitter from './KaraokePaneSplitter';
import KaraokeStageMedia from './KaraokeStageMedia';
import KaraokeChordGuide from './KaraokeChordGuide';
import { karaokeProviderDisplayName } from '../../common/karaoke/provider';
import { MAX_LYRIC_TEXT_SIZE, MIN_LYRIC_TEXT_SIZE } from './karaokeLyricText';
import KaraokeLyrics from './KaraokeLyrics';
import KaraokePitchLane from './KaraokePitchLane';
import Spinner from '../icons/Spinner';
import karaokeMicrophoneImage from '../../../assets/karaoke-microphone.png';
import MenuIcon from '../icons/MenuIcon';
import KaraokeMaker from './KaraokeMaker';
import { importedFileIdentity } from './karaokeWorkspaceRestore';
import { karaokeMakerProjectToSong } from '../../common/karaoke/makerProject';
import { type IKaraokeWorkspaceProps } from './KaraokeWorkspace';
import { type TKaraokeWorkspaceStage } from './useKaraokeWorkspaceStage';
import { type TKaraokeWorkspacePlaylist } from './useKaraokeWorkspacePlaylist';

type TKaraokeLyricSizeStyle = CSSProperties & {
  '--karaoke-lyric-size-progress': string;
};

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
    useStagePitch,
    isPitchGuideVisible,
    setIsPitchGuideVisible,
    isStageArtVisible,
    setIsStageArtVisible,
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
    handlePitchScrubStart,
    handlePitchScrub,
    handlePitchScrubEnd,
    layout,
    updateLayout,
    commitLayout,
    startPlaylistResize,
    resizePlaylist,
    startPitchResize,
    resizePitch,
    playerStyle,
    pitchStyle,
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
  const lyricWarningSentence = warning
    ? karaokeLyricWarningSentence(warning, t)
    : '';

  const workspaceActions = (
    <KaraokeWorkspaceActions
      song={song}
      isStageArtVisible={isStageArtVisible}
      isFullScreen={isFullScreen}
      isChromeIdle={isChromeIdle}
      playlist={playlist}
      clearPlaylist={clearPlaylist}
      folderInputRef={folderInputRef}
      isLoading={isLoading}
      cancelCountIn={cancelCountIn}
      session={session}
      setRestoreMakerDraft={setRestoreMakerDraft}
      setIsMakerOpen={setIsMakerOpen}
      fileInputRef={fileInputRef}
      isPitchGuideVisible={isPitchGuideVisible}
      setIsPitchGuideVisible={setIsPitchGuideVisible}
      setIsStageArtVisible={setIsStageArtVisible}
      microphoneMenuButtonRef={microphoneMenuButtonRef}
      microphone={microphone}
      isMicrophoneMenuOpen={isMicrophoneMenuOpen}
      setIsMicrophoneMenuOpen={setIsMicrophoneMenuOpen}
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
    <KaraokeLiveValue value={playhead}>
      {(playheadMs) => (
        <KaraokeTransport
          status={status}
          playheadMs={playheadMs}
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
                    onChange: fader.setLevel,
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
          onTogglePlayback={handleTogglePlayback}
          onStop={handleStopPlayback}
          onJumpToStart={() => handleSeek(0)}
          onJumpToEnd={() => handleSeek(session.durationMs)}
          onSeek={handleSeek}
        />
      )}
    </KaraokeLiveValue>
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
      }${isFullScreen ? ' is-fullscreen' : ''}${
        isGraphOverlay && !isMakerOpen ? ' is-graph-overlay' : ''
      }${isMakerOpen ? ' is-maker-open' : ''}${
        song ? ' has-song' : ' is-empty'
      }`}
      aria-labelledby={isFullScreen ? undefined : 'karaoke-workspace-title'}
      aria-label={isFullScreen ? t('karaoke.title') : undefined}
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
      {!isFullScreen && (
        <header className="karaoke-workspace__header">
          <div>
            <p className="eyebrow">{t('karaoke.eyebrow')}</p>
            <h2 id="karaoke-workspace-title">{t('karaoke.title')}</h2>
            {/* The sentence explaining what this tab is for, and only while
                it is not being used for it. With a playlist loaded and a song
                on the stage, "this workspace will keep songs, timed lyrics and
                pitch feedback together" is a paragraph about what is already
                on screen, taking the room the playlist could have. */}
            {!song && playlist.length === 0 && (
              <p className="karaoke-workspace__intro">{t('karaoke.intro')}</p>
            )}
          </div>
          {workspaceActions}
        </header>
      )}

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
            groupByFolder={groupPlaylistByFolder}
            onToggleFolderGrouping={toggleFolderGrouping}
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
          className={`karaoke-workspace__stage${song ? ' has-song' : ''}${
            isPitchGuideVisible && song && useStagePitch
              ? ' has-stage-pitch'
              : ''
          }${
            playlist.length > 0 && layout.playlistCollapsed
              ? ' has-collapsed-playlist'
              : ''
          }${isDragging ? ' is-dragging' : ''}`}
          style={pitchStyle}
        >
          {isFullScreen && !isGraphOverlay && workspaceActions}
          {playlist.length > 0 && layout.playlistCollapsed && (
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
          )}
          {song ? (
            <>
              {/* First, so it is behind everything the stage draws. It is
                  absolutely positioned and takes no row of its own — the
                  heading, lyrics and pitch guide keep the grid they had.
                  Unmounted rather than hidden when the art is switched off, so
                  a video stops decoding instead of playing to nobody. */}
              {isStageArtVisible && (
                <KaraokeLiveValue value={playhead}>
                  {(playheadMs) => (
                    <KaraokeStageMedia
                      song={song}
                      playheadMs={playheadMs}
                      isPlaying={status === 'playing'}
                    />
                  )}
                </KaraokeLiveValue>
              )}
              <div className="karaoke-song__heading">
                <div>
                  <p>{song.artist || t('karaoke.song.unknownArtist')}</p>
                  <h3>{song.title}</h3>
                </div>
                <div className="karaoke-song__tools">
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
                  <div className="karaoke-song__utility">
                    <span className="karaoke-song__source">
                      {SOURCE_KEYS[song.meta.sourceFormat]
                        ? t(SOURCE_KEYS[song.meta.sourceFormat])
                        : karaokeProviderDisplayName(song.meta.sourceFormat) ||
                          t(SOURCE_KEYS['audio-only'])}
                    </span>
                    <label
                      className="karaoke-song__text-size"
                      htmlFor={lyricTextSizeId}
                    >
                      <span className="is-small" aria-hidden="true">
                        A
                      </span>
                      <input
                        id={lyricTextSizeId}
                        type="range"
                        min={MIN_LYRIC_TEXT_SIZE}
                        max={MAX_LYRIC_TEXT_SIZE}
                        step="5"
                        value={lyricTextSize}
                        aria-label={t('karaoke.lyrics.textSize')}
                        aria-valuetext={`${lyricTextSize}%`}
                        title={`${t(
                          'karaoke.lyrics.textSize',
                        )} · ${lyricTextSize}%`}
                        style={
                          {
                            '--karaoke-lyric-size-progress': `${
                              ((lyricTextSize - MIN_LYRIC_TEXT_SIZE) /
                                (MAX_LYRIC_TEXT_SIZE - MIN_LYRIC_TEXT_SIZE)) *
                              100
                            }%`,
                          } as TKaraokeLyricSizeStyle
                        }
                        onChange={(event) =>
                          changeLyricTextSize(Number(event.target.value))
                        }
                      />
                      <span className="is-large" aria-hidden="true">
                        A
                      </span>
                      <span className="karaoke-song__text-value">
                        {lyricTextSize}%
                      </span>
                    </label>
                  </div>
                </div>
              </div>
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
                  />
                )}
              </KaraokeLiveValue>
              {isPitchGuideVisible && useStagePitch && (
                <>
                  <KaraokePaneSplitter
                    orientation="horizontal"
                    ariaLabel={t('karaoke.pitch.resize')}
                    valuePercent={layout.pitchShare * 100}
                    onStart={startPitchResize}
                    onDrag={resizePitch}
                    onEnd={commitLayout}
                  />
                  {/* No playhead here: the lane reads the element itself
                      every frame, and re-renders only for the pitch its
                      header prints. */}
                  <KaraokeLiveValue value={microphone.livePitch}>
                    {(pitch) => (
                      <KaraokePitchLane
                        isActive={!isHidden && !isMakerShown}
                        isPlaying={status === 'playing'}
                        pitch={pitch}
                        analysisStatus={microphone.pitchAnalysisStatus}
                        microphoneStatus={microphone.status}
                        onToggleMicrophone={microphone.toggle}
                        target={song.pitch}
                        durationMs={session.durationMs}
                        readPlayheadMs={session.readPlayheadMs}
                        onPracticeIssue={practicePitchIssue}
                        onScrubStart={handlePitchScrubStart}
                        onScrub={handlePitchScrub}
                        onScrubEnd={handlePitchScrubEnd}
                      />
                    )}
                  </KaraokeLiveValue>
                </>
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
            (isRestoring && (
              <div className="karaoke-workspace__restoring" role="status">
                <Spinner />
              </div>
            )) || (
              <>
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
                  <button
                    type="button"
                    className="button small karaoke-workspace__empty-open"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    aria-disabled={isLoading}
                  >
                    <MenuIcon
                      name="filePlus"
                      className="karaoke-button__icon"
                    />
                    <span>{t('karaoke.import.open')}</span>
                  </button>
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
              </>
            )
          )}
          {isDragging && (
            <div className="karaoke-workspace__drop-overlay" role="status">
              {t('karaoke.import.drop')}
            </div>
          )}
        </div>
      </div>

      {isPitchGuideVisible && (!song || !useStagePitch) && (
        <>
          <KaraokePaneSplitter
            orientation="horizontal"
            ariaLabel={t('karaoke.pitch.resize')}
            valuePercent={layout.pitchShare * 100}
            onStart={startPitchResize}
            onDrag={resizePitch}
            onEnd={commitLayout}
          />
          <div
            className="karaoke-workspace__readiness is-pitch-only is-resizable"
            style={pitchStyle}
          >
            <KaraokeLiveValue value={microphone.livePitch}>
              {(pitch) => (
                <KaraokePitchLane
                  isActive={!isHidden && !isMakerShown}
                  isPlaying={status === 'playing'}
                  pitch={pitch}
                  analysisStatus={microphone.pitchAnalysisStatus}
                  microphoneStatus={microphone.status}
                  onToggleMicrophone={microphone.toggle}
                  target={song?.pitch}
                  durationMs={session.durationMs}
                  readPlayheadMs={session.readPlayheadMs}
                  onPracticeIssue={practicePitchIssue}
                  onScrubStart={handlePitchScrubStart}
                  onScrub={handlePitchScrub}
                  onScrubEnd={handlePitchScrubEnd}
                />
              )}
            </KaraokeLiveValue>
          </div>
        </>
      )}
      {isMakerShown && song && makerAudio && (
        <KaraokeLiveValue value={playhead}>
          {(playheadMs) => (
            <KaraokeMaker
              // Apply replaces only this song's in-memory normalized timing,
              // so it deliberately keeps the same editor. A different audio
              // item gets a fresh Maker instance and restores its own saved
              // draft.
              key={importedFileIdentity(makerAudio.file)}
              song={song}
              audioFile={makerAudio.file}
              playheadMs={playheadMs}
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
                applyStemsToSong(song, vocals, instrumental);
                // And onto disk, so a refresh recovers them with the
                // workspace.
                Promise.all([vocals.arrayBuffer(), instrumental.arrayBuffer()])
                  .then(([vocalBytes, instrumentalBytes]) =>
                    window.electron.ipcRenderer.saveKaraokeStems(
                      song.id,
                      vocalBytes,
                      instrumentalBytes,
                    ),
                  )
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
            />
          )}
        </KaraokeLiveValue>
      )}
    </section>
  );
};

export default KaraokeWorkspaceView;
