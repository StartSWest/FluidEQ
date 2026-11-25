/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type CSSProperties, useRef } from 'react';
import { formatKaraokeTime } from 'common/karaoke/clock';
import type { IKaraokeSong } from 'common/karaoke/types';
import MenuIcon from '../../icons/MenuIcon';
import KaraokeChordGuide from '../../karaoke/KaraokeChordGuide';
import KaraokeLyrics from '../../karaoke/KaraokeLyrics';
import KaraokePaneSplitter from '../../karaoke/KaraokePaneSplitter';
import KaraokePlaylistAddMenu from '../../karaoke/KaraokePlaylistAddMenu';
import KaraokeScoreLines from '../../karaoke/KaraokeScoreLines';
import KaraokeStageToolbar from '../../karaoke/KaraokeStageToolbar';
import { createKaraokeLiveValue } from '../../karaoke/karaokeLiveValue';
import type { TKaraokeMicrophoneInput } from '../../karaoke/useKaraokeMicrophone';
import LibraryCoverArt from '../../library/LibraryCoverArt';
import LibraryPlayingBars from '../../library/LibraryPlayingBars';
import { useTranslation } from '../../utils/I18nContext';
import HelpPitchStrip from './HelpPitchStrip';
import {
  HELP_CHORDS,
  HELP_FIRST_OPEN,
  HELP_PLAYHEAD_MS,
  HELP_RESULTS_SO_FAR,
  HELP_SHEET,
  HELP_SONG,
  HELP_SONG_ARTIST,
  HELP_SONG_DURATION_MS,
  HELP_SONG_TITLE,
} from './karaokeHelpSong';

/**
 * The Karaoke chapter's page, drawn by the page's own parts
 * (`helpChapters/listen.ts` frames the stage and the list out of it).
 *
 * The stage is the tab's own: its options row, the words, the chord chips,
 * the strip's handle and the lines of the score, singing the made-up song
 * (`karaokeHelpSong.ts`) a third of the way in, the microphone on. The
 * strip is drawn by its own painters (`HelpPitchStrip`), because the lane
 * draws only a voice it hears. The song list is its markup, class for
 * class, as `KaraokePlaylist` and its rows draw it: a row looks its song up
 * in the reader's Library and reads its length from the file.
 */

const nothing = () => undefined;

/**
 * A microphone that is on and hears a voice, with nothing behind it: the
 * toolbar only reads whether it is live, and its panel is drawn on its own
 * (`karaokePanelFigures.tsx`).
 */
export const HELP_MICROPHONE: TKaraokeMicrophoneInput = {
  devices: [
    { deviceId: 'default', label: '' },
    { deviceId: 'help-usb-mic', label: 'USB Microphone' },
  ],
  selectedDeviceId: 'help-usb-mic',
  status: 'live',
  liveLevel: createKaraokeLiveValue(0.46),
  inputGain: 1,
  livePitch: createKaraokeLiveValue(undefined),
  pitchAnalysisStatus: 'ready',
  selectDevice: nothing,
  setInputGain: nothing,
  toggle: () => Promise.resolve(),
};

/** The song as the stage holds it: its picture beside it, not behind. */
const STAGE_SONG: IKaraokeSong = {
  ...HELP_SONG,
  assets: [
    {
      id: 'help-cover',
      role: 'cover',
      file: new File([], 'cover.jpg', { type: 'image/jpeg' }),
      extension: 'jpg',
    },
  ],
};

interface IHelpRow {
  title: string;
  artist: string;
  durationMs: number;
}

const FOLDER_SONGS: readonly IHelpRow[] = [
  { title: 'Salt and Ember', artist: HELP_SONG_ARTIST, durationMs: 224_000 },
  {
    title: HELP_SONG_TITLE,
    artist: HELP_SONG_ARTIST,
    durationMs: HELP_SONG_DURATION_MS,
  },
  {
    title: 'Northbound Letters',
    artist: HELP_SONG_ARTIST,
    durationMs: 197_000,
  },
  { title: 'Glass Harbour', artist: HELP_SONG_ARTIST, durationMs: 252_000 },
];

const FOLDED: readonly { name: string; count: number }[] = [
  { name: 'The Lamplighters', count: 6 },
  { name: 'Juniper Lane', count: 9 },
];

/** A song's row, as `KaraokePlaylistRow` draws it. */
const HelpRow = ({ row, isSinging }: { row: IHelpRow; isSinging: boolean }) => {
  const { t } = useTranslation();
  return (
    <li className={`karaoke-playlist__item${isSinging ? ' is-selected' : ''}`}>
      <button
        type="button"
        className="karaoke-playlist__song"
        aria-current={isSinging ? 'true' : undefined}
        aria-label={t('karaoke.playlist.select', { title: row.title })}
      >
        <LibraryCoverArt label={row.title} size="row" />
        <span className="karaoke-playlist__names">
          <strong>{row.title}</strong>
          <small>{row.artist}</small>
        </span>
        {isSinging ? (
          <span className="karaoke-playlist__playing" aria-hidden="true">
            <LibraryPlayingBars />
          </span>
        ) : (
          <span className="karaoke-playlist__duration">
            {formatKaraokeTime(row.durationMs)}
          </span>
        )}
      </button>
    </li>
  );
};

const Chevron = () => (
  <svg
    className="karaoke-playlist__folder-chevron"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
  </svg>
);

/** The song list grouped by folder, as `KaraokePlaylist` draws it. */
const HelpPlaylist = () => {
  const { t } = useTranslation();
  const total =
    FOLDER_SONGS.length + FOLDED.reduce((sum, folder) => sum + folder.count, 0);
  return (
    <aside className="karaoke-playlist" aria-labelledby="help-karaoke-songs">
      <div className="karaoke-playlist__heading">
        <h3 id="help-karaoke-songs">
          {t('karaoke.playlist.songs')}
          <span className="karaoke-playlist__count"> · {total}</span>
        </h3>
        <button
          type="button"
          className="karaoke-playlist__tool"
          aria-label={t('karaoke.playlist.search')}
          aria-pressed={false}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </button>
        <KaraokePlaylistAddMenu
          isBusy={false}
          hasSongs
          groupByFolder
          onAddFiles={nothing}
          onAddFolder={nothing}
          onToggleFolderGrouping={nothing}
          onClear={nothing}
        />
        <button
          type="button"
          className="karaoke-playlist__tool"
          aria-label={t('karaoke.playlist.collapse')}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
      </div>
      <div className="karaoke-playlist__groups">
        <ul className="karaoke-playlist__tree">
          <li className="karaoke-playlist__tree-node">
            <button
              type="button"
              className="karaoke-playlist__folder"
              aria-expanded
            >
              <Chevron />
              <MenuIcon name="folder" />
              <span>{HELP_SONG_ARTIST}</span>
              <small className="karaoke-playlist__folder-count">
                {FOLDER_SONGS.length}
              </small>
            </button>
            <ul className="karaoke-playlist__tree-children">
              {FOLDER_SONGS.map((row) => (
                <HelpRow
                  key={row.title}
                  row={row}
                  isSinging={row.title === HELP_SONG_TITLE}
                />
              ))}
            </ul>
          </li>
          {FOLDED.map((folder) => (
            <li className="karaoke-playlist__tree-node" key={folder.name}>
              <button
                type="button"
                className="karaoke-playlist__folder"
                aria-expanded={false}
              >
                <Chevron />
                <MenuIcon name="folder" />
                <span>{folder.name}</span>
                <small className="karaoke-playlist__folder-count">
                  {folder.count}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

const SNAPSHOT = { results: HELP_RESULTS_SO_FAR, firstOpen: HELP_FIRST_OPEN };
const BOTH_GUIDES = { pitch: true, chords: true } as const;
/** The song's chords are its own file's: nothing left to work out. */
const CHORDS_READ = createKaraokeLiveValue(1);

/** The pitch strip's height in the figure: the stage's slim default. */
const PITCH_STYLE = { '--karaoke-pitch-height': '168px' } as CSSProperties;
const PLAYER_STYLE = { '--karaoke-playlist-size': '27%' } as CSSProperties;
/** The page as a laptop window holds it, with the bar at its foot apart. */
const PAGE_STYLE: CSSProperties = { height: 640 };

/** The Karaoke page, singing the help song. */
const KaraokeDrawing = () => {
  const { t } = useTranslation();
  const textSizeButtonRef = useRef<HTMLButtonElement>(null);
  const microphoneButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <section
      className="karaoke-workspace workspace-tab-panel workspace-tab-panel--karaoke has-song"
      style={PAGE_STYLE}
    >
      <div
        className="karaoke-workspace__player has-playlist"
        style={PLAYER_STYLE}
      >
        <HelpPlaylist />
        <KaraokePaneSplitter
          orientation="vertical"
          ariaLabel={t('karaoke.playlist.resize')}
          valuePercent={27}
          onStart={nothing}
          onDrag={nothing}
          onEnd={nothing}
        />
        <div className="karaoke-workspace__stage is-backdrop-none has-song">
          <KaraokeStageToolbar
            song={STAGE_SONG}
            guides={BOTH_GUIDES}
            setGuides={nothing}
            background="none"
            setBackground={nothing}
            onOpenMaker={nothing}
            lyricTextSizeId="help-karaoke-text-size"
            lyricTextSize={100}
            onLyricTextSize={nothing}
            textSizeButtonRef={textSizeButtonRef}
            isTextSizeOpen={false}
            setIsTextSizeOpen={nothing}
            microphoneMenuButtonRef={microphoneButtonRef}
            microphone={HELP_MICROPHONE}
            isMicrophoneMenuOpen={false}
            setIsMicrophoneMenuOpen={nothing}
            isFullScreen={false}
            isChromeIdle={false}
            hasFullScreenTopBar
            onToggleFullScreenTopBar={nothing}
            onToggleFullScreen={nothing}
          />
          <KaraokeLyrics
            song={HELP_SONG}
            playheadMs={HELP_PLAYHEAD_MS}
            onSeek={nothing}
            showTranslationPicker={false}
          />
          <div className="karaoke-stage__guides" style={PITCH_STYLE}>
            <KaraokeChordGuide
              status="ready"
              chords={HELP_CHORDS}
              progress={CHORDS_READ}
              playheadMs={HELP_PLAYHEAD_MS}
            />
            <KaraokePaneSplitter
              orientation="horizontal"
              ariaLabel={t('karaoke.pitch.resize')}
              valuePercent={30}
              onStart={nothing}
              onDrag={nothing}
              onEnd={nothing}
            />
            <HelpPitchStrip />
            <KaraokeScoreLines
              sheet={HELP_SHEET}
              snapshot={SNAPSHOT}
              onPractiseLine={nothing}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default KaraokeDrawing;
