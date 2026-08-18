/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, SetStateAction, useRef } from 'react';
import {
  IKaraokeMakerProject,
  validateKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { TKaraokePitchTarget } from '../../common/karaoke/types';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { formatClock } from './makerFormat';
import { KaraokeTransportIcon } from './KaraokeTransport';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerHeaderActions from './KaraokeMakerHeaderActions';
import { TDestructiveMakerAction } from './KaraokeMakerConfirmDialog';

/**
 * The bar across the top: transport, clock, undo, and what leaves the editor.
 *
 * A hundred and seventy-six lines of the component's return. Everything in it
 * either moves the playhead or ends the session — applying the project,
 * closing, going full screen, or throwing work away — which is why it is the
 * one part of the editor that needs the callbacks the Maker itself was given.
 *
 * The validation issues arrive rather than being computed here: the same list
 * decides whether Apply is offered and what the inspector warns about, and two
 * readers of one answer must not each derive their own.
 */
export interface IKaraokeMakerHeaderProps extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'project' | 'commit' | 'undo' | 'redo' | 'canUndo' | 'canRedo'
> {
  /** What the Maker was handed, and what it hands back. */
  onApply: (project: IKaraokeMakerProject) => void;
  onClose: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;

  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (positionMs: number) => void;
  playheadMs: number;
  /**
   * The playhead as drawn rather than as known.
   *
   * Interpolated between transport updates so the clock does not tick in
   * visible steps while the song plays smoothly.
   */
  visualPlayheadMs: number;
  effectiveDurationMs: number;

  issues: ReturnType<typeof validateKaraokeMakerProject>;
  melodyTone: ReturnType<typeof useKaraokeMelodyTone>;
  /**
   * The guide-vocal level for a separated song, 0..1, next to the tone volume
   * because both answer the same question: how much help while singing.
   * Undefined until a split exists, and the control simply is not there.
   */
  vocalLevel?: number;
  onVocalLevel?: (level: number) => void;
  /** Backing-track fader beside it; the master volume stays the player's. */
  backingLevel?: number;
  onBackingLevel?: (level: number) => void;
  /** What the melody preview plays against, if the song has a melody. */
  makerMelodyTarget: TKaraokePitchTarget | undefined;

  maximumViewStartMs: number;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  setFollowViewport: Dispatch<SetStateAction<boolean>>;
  setDestructiveAction: Dispatch<
    SetStateAction<TDestructiveMakerAction | undefined>
  >;
  setNotice: (message?: string) => void;
}

const KaraokeMakerHeader = ({
  canRedo,
  canUndo,
  commit,
  effectiveDurationMs,
  isFullScreen,
  isPlaying,
  issues,
  makerMelodyTarget,
  maximumViewStartMs,
  melodyTone,
  onApply,
  onBackingLevel,
  onClose,
  onVocalLevel,
  onPause,
  onPlay,
  onSeek,
  onToggleFullScreen,
  playheadMs,
  project,
  redo,
  setDestructiveAction,
  setFollowViewport,
  setNotice,
  setViewStartMs,
  backingLevel,
  undo,
  visualPlayheadMs,
  vocalLevel,
}: IKaraokeMakerHeaderProps) => {
  const { t } = useTranslation();
  const lastVocalLevelRef = useRef(0.6);
  const lastBackingLevelRef = useRef(1);
  if (vocalLevel !== undefined && vocalLevel > 0) {
    lastVocalLevelRef.current = vocalLevel;
  }
  if (backingLevel !== undefined && backingLevel > 0) {
    lastBackingLevelRef.current = backingLevel;
  }
  return (
    <header className="karaoke-maker__header">
      <div className="karaoke-maker__identity">
        <button
          className="karaoke-maker__header-icon karaoke-maker__header-back"
          type="button"
          onClick={onClose}
          aria-label={t('karaoke.maker.close')}
          data-tooltip={t('karaoke.maker.close')}
        >
          <KaraokeMakerToolIcon name="back" />
        </button>
        <div>
          <span className="karaoke-maker__eyebrow">
            {t('karaoke.maker.eyebrow')}
          </span>
          <input
            className="karaoke-maker__title-input"
            value={project.title}
            aria-label={t('karaoke.maker.songTitle')}
            onChange={(event) =>
              commit((current) => ({
                ...current,
                title: event.target.value.slice(0, 2_000),
              }))
            }
          />
        </div>
      </div>
      <div
        className="karaoke-maker__transport"
        role="group"
        aria-label={t('karaoke.transport.title')}
      >
        <div className="karaoke-maker__transport-buttons">
          <button
            className="karaoke-maker__transport-control"
            type="button"
            onClick={() => {
              onSeek(0);
              setViewStartMs(0);
              setFollowViewport(true);
            }}
            aria-label={t('karaoke.maker.jumpToStart')}
            data-tooltip={t('karaoke.maker.jumpToStart')}
          >
            <KaraokeTransportIcon name="previous" />
          </button>
          <button
            className="karaoke-maker__transport-control"
            type="button"
            onClick={() => onSeek(Math.max(0, playheadMs - 5_000))}
            aria-label={t('karaoke.maker.seekBack', { seconds: 5 })}
            data-tooltip={t('karaoke.maker.seekBack', { seconds: 5 })}
          >
            <KaraokeTransportIcon name="previous" />
            <small>5</small>
          </button>
          <button
            className={`karaoke-maker__transport-control karaoke-maker__play${
              isPlaying ? ' is-playing' : ''
            }`}
            type="button"
            onClick={() => {
              if (isPlaying) {
                onPause();
              } else {
                Promise.resolve(onPlay()).catch(() => undefined);
              }
            }}
            aria-label={t(
              isPlaying ? 'karaoke.transport.pause' : 'karaoke.transport.play',
            )}
            aria-keyshortcuts="Space"
            aria-pressed={isPlaying}
            data-tooltip={t('karaoke.transport.spaceShortcut', {
              action: t(
                isPlaying
                  ? 'karaoke.transport.pause'
                  : 'karaoke.transport.play',
              ),
            })}
          >
            <KaraokeTransportIcon name={isPlaying ? 'pause' : 'play'} />
          </button>
          <button
            className="karaoke-maker__transport-control"
            type="button"
            onClick={() =>
              onSeek(Math.min(effectiveDurationMs, playheadMs + 5_000))
            }
            aria-label={t('karaoke.maker.seekForward', { seconds: 5 })}
            data-tooltip={t('karaoke.maker.seekForward', { seconds: 5 })}
          >
            <KaraokeTransportIcon name="next" />
            <small>5</small>
          </button>
          <button
            className="karaoke-maker__transport-control"
            type="button"
            onClick={() => {
              onSeek(effectiveDurationMs);
              setViewStartMs(maximumViewStartMs);
              setFollowViewport(true);
            }}
            aria-label={t('karaoke.maker.jumpToEnd')}
            data-tooltip={t('karaoke.maker.jumpToEnd')}
          >
            <KaraokeTransportIcon name="next" />
          </button>
        </div>
        <div className="karaoke-maker__transport-time">
          <time>{formatClock(visualPlayheadMs)}</time>
          <span aria-hidden="true" />
          <time>{formatClock(effectiveDurationMs)}</time>
        </div>
        <div
          className={`karaoke-maker__tone-guide${
            melodyTone.enabled ? ' is-enabled' : ''
          }`}
        >
          <button
            type="button"
            className="karaoke-maker__transport-control"
            disabled={!makerMelodyTarget || !melodyTone.isAvailable}
            onClick={() => melodyTone.toggle().catch(() => undefined)}
            aria-pressed={melodyTone.enabled}
            aria-label={t(
              melodyTone.enabled
                ? 'karaoke.pitch.toneDisable'
                : 'karaoke.pitch.toneEnable',
            )}
            data-tooltip={t('karaoke.pitch.toneGuide')}
          >
            <KaraokeTransportIcon name="volume" />
          </button>
          {melodyTone.enabled && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={melodyTone.volume}
              aria-label={t('karaoke.pitch.toneVolume')}
              aria-valuetext={`${Math.round(melodyTone.volume * 100)}%`}
              onChange={(event) =>
                melodyTone.setVolume(Number(event.target.value))
              }
            />
          )}
        </div>
        {backingLevel !== undefined && onBackingLevel && (
          <div className="karaoke-maker__tone-guide is-enabled">
            {/* The backing track's own fader; master stays the player's. */}
            <button
              type="button"
              className="karaoke-maker__transport-control"
              onClick={() =>
                onBackingLevel(
                  backingLevel > 0 ? 0 : lastBackingLevelRef.current,
                )
              }
              aria-pressed={backingLevel > 0}
              aria-label={t('karaoke.maker.stemBacking')}
              data-tooltip={`${t('karaoke.maker.stemBacking')} · ${Math.round(
                backingLevel * 100,
              )}%`}
            >
              <KaraokeMakerToolIcon name="stem" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={backingLevel}
              aria-label={t('karaoke.maker.stemBacking')}
              aria-valuetext={`${Math.round(backingLevel * 100)}%`}
              onChange={(event) => onBackingLevel(Number(event.target.value))}
            />
          </div>
        )}
        {vocalLevel !== undefined && onVocalLevel && (
          <div className="karaoke-maker__tone-guide is-enabled">
            {/*
              The guide-vocal fader, beside the tone volume because both
              answer the same question — how much help while singing. A
              click on the icon mutes the voice and restores it, the way
              every volume icon behaves.
            */}
            <button
              type="button"
              className="karaoke-maker__transport-control"
              onClick={() =>
                onVocalLevel(vocalLevel > 0 ? 0 : lastVocalLevelRef.current)
              }
              aria-pressed={vocalLevel > 0}
              aria-label={t('karaoke.transport.vocalLevel')}
              data-tooltip={`${t('karaoke.transport.vocalLevel')} · ${
                vocalLevel === 0
                  ? t('karaoke.transport.vocalOff')
                  : `${Math.round(vocalLevel * 100)}%`
              }`}
            >
              <KaraokeTransportIcon name="volume" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={vocalLevel}
              aria-label={t('karaoke.transport.vocalLevel')}
              aria-valuetext={
                vocalLevel === 0
                  ? t('karaoke.transport.vocalOff')
                  : `${Math.round(vocalLevel * 100)}%`
              }
              onChange={(event) => onVocalLevel(Number(event.target.value))}
            />
          </div>
        )}
      </div>
      <KaraokeMakerHeaderActions
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onRestore={() => setDestructiveAction('restore')}
        onApply={() => {
          const untimedCount = issues.filter(
            (issue) => issue.code === 'untimed-word',
          ).length;
          if (untimedCount > 0) {
            setNotice(t('karaoke.maker.applyUntimed', { count: untimedCount }));
            return;
          }
          onApply(project);
          onClose();
        }}
        isFullScreen={isFullScreen}
        onToggleFullScreen={onToggleFullScreen}
      />
    </header>
  );
};

export default KaraokeMakerHeader;
