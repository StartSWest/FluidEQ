/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { isLockedLookId } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import LookPicker from '../graph/LookPicker';
import MenuIcon from '../icons/MenuIcon';
import { setGraphLook, useSelectedLookId } from '../utils/graphStyle';
import AnchoredMenu from '../widgets/AnchoredMenu';
import FullScreenToggles from '../widgets/FullScreenToggles';
import ViewBar from '../widgets/ViewBar';
import rangeFill from '../utils/rangeFill';
import { useTranslation } from '../utils/I18nContext';
import { type TranslationKey } from '../../common/i18n';
import { type IKaraokeSong } from '../../common/karaoke/types';
import { KaraokeLiveValue } from './karaokeLiveValue';
import { KaraokeMicrophoneSettings } from './KaraokeMicrophone';
import {
  hasKaraokeStageStill,
  hasKaraokeStageVideo,
} from './KaraokeStageMedia';
import {
  type TKaraokeBackground,
  type TKaraokeStageGuides,
  writeKaraokeBackground,
  writeKaraokeStageGuides,
} from './karaokeWorkspacePrefs';
import {
  LYRIC_TEXT_SIZE_MARKS,
  MAX_LYRIC_TEXT_SIZE,
  MIN_LYRIC_TEXT_SIZE,
  snapLyricTextSize,
} from './karaokeLyricText';
import { snapFraction } from '../utils/percentSnaps';
import { type useKaraokeMicrophoneInput } from './useKaraokeMicrophone';

interface IKaraokeStageToolbarProps {
  /** What stands before the song's name: the folded playlist's button. */
  leading?: ReactNode;
  song: IKaraokeSong | undefined;
  guides: TKaraokeStageGuides;
  setGuides: Dispatch<SetStateAction<TKaraokeStageGuides>>;
  background: TKaraokeBackground;
  setBackground: Dispatch<SetStateAction<TKaraokeBackground>>;
  onOpenMaker: () => void;
  lyricTextSizeId: string;
  lyricTextSize: number;
  onLyricTextSize: (size: number) => void;
  textSizeButtonRef: RefObject<HTMLButtonElement | null>;
  isTextSizeOpen: boolean;
  setIsTextSizeOpen: Dispatch<SetStateAction<boolean>>;
  microphoneMenuButtonRef: RefObject<HTMLButtonElement | null>;
  microphone: ReturnType<typeof useKaraokeMicrophoneInput>;
  isMicrophoneMenuOpen: boolean;
  setIsMicrophoneMenuOpen: Dispatch<SetStateAction<boolean>>;
  isFullScreen: boolean;
  isChromeIdle: boolean;
  hasFullScreenTopBar: boolean;
  onToggleFullScreenTopBar: () => void;
  onToggleFullScreen: () => void;
}

const GUIDES: readonly [TKaraokeStageGuides, TranslationKey][] = [
  ['pitch', 'karaoke.stage.pitch'],
  ['chords', 'karaoke.stage.chords'],
  ['words', 'karaoke.stage.wordsOnly'],
];

/** One part of a two- or three-way switch, as the mockup's `.seg` draws it. */
const Segment = ({
  isOn,
  disabled = false,
  title,
  onClick,
  children,
}: {
  isOn: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    className="karaoke-stage-bar__segment"
    aria-pressed={isOn}
    disabled={disabled}
    title={title}
    onClick={onClick}
  >
    {children}
  </button>
);

/**
 * The stage's one quiet row, at the top of the stage, as the K1 mockup draws
 * it (Ivan, 2026-11-15, "K1 · Library twin"): where you are, what the stage
 * shows under the words, what stands behind them, the Maker, and the stage's
 * own settings. It replaces a header row of its own above the whole tab, and
 * in full screen fades with the rest of the chrome when the pointer rests.
 * Adding and clearing songs moved to the list's +.
 */
const KaraokeStageToolbar = ({
  leading,
  song,
  guides,
  setGuides,
  background,
  setBackground,
  onOpenMaker,
  lyricTextSizeId,
  lyricTextSize,
  onLyricTextSize,
  textSizeButtonRef,
  isTextSizeOpen,
  setIsTextSizeOpen,
  microphoneMenuButtonRef,
  microphone,
  isMicrophoneMenuOpen,
  setIsMicrophoneMenuOpen,
  isFullScreen,
  isChromeIdle,
  hasFullScreenTopBar,
  onToggleFullScreenTopBar,
  onToggleFullScreen,
}: IKaraokeStageToolbarProps) => {
  const { t } = useTranslation();
  const selectedLookId = useSelectedLookId();
  const hasStill = song ? hasKaraokeStageStill(song) : false;
  const hasVideo = song ? hasKaraokeStageVideo(song) : false;
  // A background pressed again is the bare stage: three choices and "none"
  // without a fourth button.
  const chooseBackground = (choice: TKaraokeBackground) =>
    setBackground((current) => {
      const next = current === choice ? 'none' : choice;
      writeKaraokeBackground(next);
      return next;
    });
  const chooseGuides = (choice: TKaraokeStageGuides) => {
    writeKaraokeStageGuides(choice);
    setGuides(choice);
  };

  return (
    // Goes with the pointer at rest, or a click on the words, in every view,
    // as the graph's strip does (Ivan, 2026-11-16: "same behaviour
    // everywhere"): the one row every page has (`ViewBar`).
    <ViewBar
      className="karaoke-stage-bar"
      isIdle={isChromeIdle}
      label={t('karaoke.actions')}
    >
      {leading}
      <p className="view-bar__crumb">
        <span>{t('tabs.karaoke')}</span>
        {song && (
          <>
            <span aria-hidden="true">›</span>
            <strong title={song.title}>{song.title}</strong>
          </>
        )}
      </p>
      {song && (
        <>
          <div
            className="karaoke-stage-bar__switch"
            role="group"
            aria-label={t('karaoke.stage.show')}
          >
            {GUIDES.map(([choice, key]) => (
              <Segment
                key={choice}
                isOn={guides === choice}
                onClick={() => chooseGuides(choice)}
              >
                {t(key)}
              </Segment>
            ))}
          </div>
          <div
            className="karaoke-stage-bar__switch"
            role="group"
            aria-label={t('karaoke.stage.background')}
          >
            <Segment
              isOn={background === 'graph'}
              title={t(
                background === 'graph'
                  ? 'karaoke.stage.hideGraph'
                  : 'karaoke.stage.showGraph',
              )}
              onClick={() => chooseBackground('graph')}
            >
              {t('karaoke.stage.scene')}
            </Segment>
            <Segment
              isOn={background === 'cover' && hasStill}
              disabled={!hasStill}
              title={hasStill ? undefined : t('karaoke.stage.noArt')}
              onClick={() => chooseBackground('cover')}
            >
              {t('karaoke.stage.art')}
            </Segment>
            <Segment
              isOn={background === 'video' && hasVideo}
              disabled={!hasVideo}
              title={hasVideo ? undefined : t('karaoke.stage.noVideo')}
              onClick={() => chooseBackground('video')}
            >
              {t('karaoke.stage.video')}
            </Segment>
          </div>
          {/* The scene behind the words, changed where it is seen (Ivan,
              2026-11-16: "the scene selector there too, to change the
              background quickly, only with Scene on"). The graph's own
              picker: the stage plays the window's scene, so one choice
              moves both. A locked scene asks for the Account panel and
              leaves the one on screen, as the graph's does. */}
          {background === 'graph' && (
            <span className="karaoke-stage-bar__look">
              <LookPicker
                value={selectedLookId}
                disabled={false}
                // The app's quiet button, as "Open in the Maker" beside it:
                // with no class of its own the trigger was a bare browser
                // button, grey and outset.
                triggerClassName="look-picker__trigger button small subtle"
                onChoose={(lookId) => {
                  if (isLockedLookId(lookId)) {
                    requestAccountPanel();
                    return;
                  }
                  setGraphLook(lookId);
                }}
              />
            </span>
          )}
          <button
            type="button"
            className="button small subtle karaoke-stage-bar__maker"
            // Named here too: a narrow stage hides the words beside the pencil.
            aria-label={t('karaoke.maker.openIn')}
            title={t('karaoke.maker.openTitle')}
            onClick={onOpenMaker}
          >
            <MenuIcon name="pencil" className="karaoke-button__icon" />
            <span>{t('karaoke.maker.openIn')}</span>
          </button>
          <button
            ref={textSizeButtonRef}
            type="button"
            className="view-bar__icon"
            aria-label={t('karaoke.lyrics.textSize')}
            title={t('karaoke.lyrics.textSize')}
            aria-haspopup="dialog"
            aria-expanded={isTextSizeOpen}
            onClick={() => setIsTextSizeOpen((open) => !open)}
          >
            <span className="karaoke-stage-bar__glyph" aria-hidden="true">
              A<small>A</small>
            </span>
          </button>
        </>
      )}
      <button
        ref={microphoneMenuButtonRef}
        type="button"
        className={`view-bar__icon${
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
      <FullScreenToggles
        isFullScreen={isFullScreen}
        hasTopBar={hasFullScreenTopBar}
        onToggleTopBar={onToggleFullScreenTopBar}
        onToggleFullScreen={onToggleFullScreen}
      />
      <AnchoredMenu
        anchor={textSizeButtonRef.current}
        isOpen={isTextSizeOpen && Boolean(song)}
        className="karaoke-stage-bar__popover"
        role="dialog"
        ariaLabel={t('karaoke.lyrics.textSize')}
      >
        <label
          className="karaoke-stage-bar__text-size"
          htmlFor={lyricTextSizeId}
        >
          <span className="is-small" aria-hidden="true">
            A
          </span>
          <span className="karaoke-stage-bar__text-size-track">
            {LYRIC_TEXT_SIZE_MARKS.map((mark) => (
              <span
                key={mark}
                className="karaoke-stage-bar__text-size-mark"
                style={
                  {
                    '--snap-frac': snapFraction(
                      mark,
                      MIN_LYRIC_TEXT_SIZE,
                      MAX_LYRIC_TEXT_SIZE,
                    ),
                  } as CSSProperties
                }
                aria-hidden
              >
                {mark}
              </span>
            ))}
            <input
              id={lyricTextSizeId}
              type="range"
              min={MIN_LYRIC_TEXT_SIZE}
              max={MAX_LYRIC_TEXT_SIZE}
              step="5"
              value={lyricTextSize}
              aria-label={t('karaoke.lyrics.textSize')}
              aria-valuetext={`${lyricTextSize}%`}
              style={rangeFill(
                lyricTextSize,
                MIN_LYRIC_TEXT_SIZE,
                MAX_LYRIC_TEXT_SIZE,
              )}
              onChange={(event) =>
                onLyricTextSize(snapLyricTextSize(Number(event.target.value)))
              }
            />
          </span>
          <span className="is-large" aria-hidden="true">
            A
          </span>
          <output>{lyricTextSize}%</output>
        </label>
      </AnchoredMenu>
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
    </ViewBar>
  );
};

export default KaraokeStageToolbar;
