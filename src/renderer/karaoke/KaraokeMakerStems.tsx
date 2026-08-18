/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import { KaraokeTransportIcon } from './KaraokeTransport';

/**
 * One stem drawn as a waveform.
 *
 * This is the proof a split worked, in the only language that needs no
 * reading: the voice shows phrases with silence between them, the backing
 * track shows the song's whole shape. Two named rows with Save buttons say a
 * split happened; two visibly different waveforms say what it did.
 */
const StemWave = ({
  file,
  playheadFraction,
  onSeekFraction,
}: {
  file: File;
  /** 0..1 through the song, so every wave tracks the one transport. */
  playheadFraction: number;
  onSeekFraction?: (fraction: number) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<Float32Array | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    peaksRef.current = undefined;
    (async () => {
      const context = new OfflineAudioContext(1, 1, 44_100);
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      if (cancelled) {
        return;
      }
      const samples = decoded.getChannelData(0);
      const width = canvasRef.current?.width ?? 560;
      const peaks = new Float32Array(width);
      const bucket = Math.max(1, Math.floor(samples.length / width));
      for (let x = 0; x < width; x += 1) {
        let peak = 0;
        const start = x * bucket;
        // Every 16th sample is plenty for a thumbnail and 16x cheaper.
        for (let i = start; i < start + bucket && i < samples.length; i += 16) {
          const magnitude = Math.abs(samples[i]);
          if (magnitude > peak) {
            peak = magnitude;
          }
        }
        peaks[x] = peak;
      }
      peaksRef.current = peaks;
      draw();
    })().catch(() => {
      // A stem that cannot be decoded simply has no picture; the row, its
      // name and its Save button still work.
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const draw = () => {
    const canvas = canvasRef.current;
    const peaks = peaksRef.current;
    const paint = canvas?.getContext('2d');
    if (!canvas || !peaks || !paint) {
      return;
    }
    const { width, height } = canvas;
    const middle = height / 2;
    paint.clearRect(0, 0, width, height);
    const playedX = Math.round(playheadFraction * width);
    for (let x = 0; x < width; x += 1) {
      // Two colours, split at the playhead, so the wave itself is the
      // progress bar — the same reading the main transport teaches.
      paint.fillStyle =
        x <= playedX ? 'rgba(30, 215, 199, 0.9)' : 'rgba(30, 215, 199, 0.42)';
      const half = Math.max(1, peaks[x] * middle);
      paint.fillRect(x, middle - half, 1, half * 2);
    }
    paint.fillStyle = 'rgba(255, 255, 255, 0.85)';
    paint.fillRect(playedX, 0, 1, height);
  };
  useEffect(draw);

  return (
    <canvas
      ref={canvasRef}
      className="karaoke-maker__stem-wave"
      width={560}
      height={36}
      aria-hidden="true"
      style={onSeekFraction ? { cursor: 'pointer' } : undefined}
      onClick={(event) => {
        if (!onSeekFraction) {
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        onSeekFraction(
          Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        );
      }}
    />
  );
};

interface IKaraokeMakerStemsProps {
  /** The backing track, once a song has been split. */
  instrumental?: File;
  /** The isolated voice — the same file the detectors now read. */
  vocals?: File;
  /**
   * The guide-vocal level, 0 to 1, or undefined when the player has no stem
   * loaded to blend. Owned by the player and passed through, because the Maker
   * previews on the same audio element — a second level here would be a slider
   * that moved nothing.
   */
  vocalLevel?: number;
  onVocalLevel?: (level: number) => void;
  /** The chosen format travels with the file; the panel does not encode. */
  onSave: (file: File, format: 'wav' | 'mp3') => void;
  /** Playhead and duration of the one transport all waves follow. */
  playheadMs?: number;
  durationMs?: number;
  onSeek?: (positionMs: number) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  /** Which stem play focuses; the slider below follows the choice. */
  stemFocus?: 'backing' | 'voice';
  onFocusStem?: (row: 'backing' | 'voice') => void;
  /** Backing level under a soloed voice, 0..1. */
  backingBlend?: number;
  onBackingBlend?: (blend: number) => void;
}

/**
 * The two tracks a split produces, shown together once there are two.
 *
 * Separation is otherwise invisible work: the detectors quietly start reading
 * a different file and nothing on screen says so. Listing both stems makes the
 * result concrete — you can see what was produced, hear it, and keep it.
 *
 * The level control monitors the voice against the backing track while
 * editing, which is a different question from the player's guide-vocal fader
 * even though they look alike. Here it is a tool for checking the split and
 * for hearing whether a lyric lands where the waveform says it does; there it
 * is how much help the singer wants. Sharing one control between the two would
 * mean tuning the editor changed how the song performs.
 */
const KaraokeMakerStems = ({
  instrumental,
  vocals,
  vocalLevel,
  onVocalLevel,
  onSave,
  playheadMs = 0,
  durationMs = 0,
  onSeek,
  isPlaying = false,
  onPlay,
  onPause,
  stemFocus = 'backing',
  onFocusStem,
  backingBlend = 0,
  onBackingBlend,
}: IKaraokeMakerStemsProps) => {
  const { t } = useTranslation();
  // Shows the RESULT of a split and never its progress. This panel is rendered
  // inside the Advanced popover, which is shut unless somebody opened it, so a
  // progress bar here would be hidden for the whole of the one job in the app
  // long enough to need one. Running separation reports through
  // `analysisProgress` instead, which the editor surface draws in
  // KaraokeMakerAnalysisPanels — always visible, and where the cancel button
  // that aborts the split lives.
  if (!instrumental && !vocals) {
    return null;
  }
  const percent = Math.round((vocalLevel ?? 0) * 100);
  const canMix = vocalLevel !== undefined && onVocalLevel !== undefined;
  // What the slider reads as, in whichever of its two modes it is in. Silence
  // gets its name only in guide-vocal mode, where 0 is a state ("backing
  // only") rather than merely a low number.
  let levelText = `${percent}%`;
  if (stemFocus === 'voice') {
    levelText = `${Math.round(backingBlend * 100)}%`;
  } else if (percent === 0) {
    levelText = t('karaoke.transport.vocalOff');
  }
  const tracks: { icon: 'stem' | 'vocal'; label: string; file?: File }[] = [
    {
      icon: 'stem',
      label: t('karaoke.maker.stemBacking'),
      file: instrumental,
    },
    { icon: 'vocal', label: t('karaoke.maker.stemVoice'), file: vocals },
  ];

  return (
    <section
      className="karaoke-maker__stems"
      aria-label={t('karaoke.maker.stemsTitle')}
    >
      <h3 className="karaoke-maker__tool-group-title">
        {t('karaoke.maker.stemsTitle')}
      </h3>
      <ul className="karaoke-maker__stem-list">
        {tracks
          .filter((track) => track.file)
          .map((track) => (
            <li key={track.icon} className="karaoke-maker__stem">
              <KaraokeMakerToolIcon name={track.icon} />
              <span className="karaoke-maker__stem-name">{track.label}</span>
              {/*
                The one global transport, not a private player: pressing play
                here plays the song from the shared playhead, exactly like the
                header button — and the guide-vocal fader decides how much of
                each stem is heard. A second audition player drifted from the
                transport and answered to neither seek nor pause.
              */}
              {onPlay && onPause && (
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => {
                    const row = track.icon === 'vocal' ? 'voice' : 'backing';
                    if (isPlaying && stemFocus === row) {
                      onPause();
                      return;
                    }
                    onFocusStem?.(row);
                    if (!isPlaying) {
                      onPlay();
                    }
                  }}
                  aria-pressed={
                    isPlaying &&
                    stemFocus === (track.icon === 'vocal' ? 'voice' : 'backing')
                  }
                  aria-label={t(
                    isPlaying
                      ? 'karaoke.transport.pause'
                      : 'karaoke.transport.play',
                  )}
                >
                  <KaraokeTransportIcon name={isPlaying ? 'pause' : 'play'} />
                </button>
              )}
              {/* TWO BUTTONS, NOT ONE THAT WRITES TWO FILES.
                  The format is the user's choice: a WAV goes into a DAW and an
                  MP3 goes on a phone, and which one somebody wants is a thing
                  only they know. Saving both on every press hands over a file
                  nobody asked for and spends several seconds encoding it. */}
              <span
                className="karaoke-maker__stem-save"
                role="group"
                aria-label={t('karaoke.maker.stemSaveAs', {
                  name: track.label,
                })}
              >
                <span aria-hidden="true">{t('karaoke.maker.stemSave')}</span>
                {(['wav', 'mp3'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    // Quiet: saving a stem is an escape hatch, not the thing
                    // this panel is for.
                    className="button small subtle"
                    aria-label={t('karaoke.maker.stemSaveFormat', {
                      name: track.label,
                      format: format.toUpperCase(),
                    })}
                    onClick={() => onSave(track.file as File, format)}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </span>
              <StemWave
                file={track.file as File}
                playheadFraction={durationMs > 0 ? playheadMs / durationMs : 0}
                onSeekFraction={
                  onSeek && durationMs > 0
                    ? (fraction) => onSeek(fraction * durationMs)
                    : undefined
                }
              />
            </li>
          ))}
      </ul>
      {canMix && (
        <label
          className="karaoke-maker__stem-level"
          htmlFor="karaoke-maker-vocal-level"
        >
          {/*
            One slider, two meanings, switched by which stem was played last:
            under the backing track it raises the guide vocal; under a soloed
            voice it raises the backing underneath. Both read as "how much of
            the other one", the only question this slider answers.
          */}
          <span>
            {stemFocus === 'voice'
              ? t('karaoke.maker.stemBacking')
              : t('karaoke.transport.vocalLevel')}
          </span>
          <input
            id="karaoke-maker-vocal-level"
            aria-label={
              stemFocus === 'voice'
                ? t('karaoke.maker.stemBacking')
                : t('karaoke.transport.vocalLevel')
            }
            aria-valuetext={levelText}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={stemFocus === 'voice' ? backingBlend : vocalLevel}
            onChange={(event) =>
              stemFocus === 'voice'
                ? onBackingBlend?.(Number(event.target.value))
                : onVocalLevel(Number(event.target.value))
            }
          />
          <span className="karaoke-maker__stem-level-value">{levelText}</span>
        </label>
      )}
    </section>
  );
};

export default KaraokeMakerStems;
