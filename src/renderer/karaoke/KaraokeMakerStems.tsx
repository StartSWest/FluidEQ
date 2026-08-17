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
  onSave: (file: File) => void;
  /** True while a split is running, which is the only time this panel talks. */
  /** Playhead and duration of the one transport all waves follow. */
  playheadMs?: number;
  durationMs?: number;
  onSeek?: (positionMs: number) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  isSeparating?: boolean;
  /** 0..1, or undefined while a stage has begun but reported nothing yet. */
  progress?: number;
  message?: string;
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
  isSeparating = false,
  progress,
  message,
}: IKaraokeMakerStemsProps) => {
  const { t } = useTranslation();
  // While a split runs this panel is the only thing on screen that says so.
  // The shared analysis panel is shaped around Whisper's stages and shows
  // nothing for separation, so a click on "Separate voice from music" appeared
  // to do nothing at all while a 700 MB download ran behind it.
  if (isSeparating) {
    return (
      <section
        className="karaoke-maker__stems"
        aria-label={t('karaoke.maker.stemsTitle')}
      >
        <h3 className="karaoke-maker__tool-group-title">
          {t('karaoke.maker.stemsTitle')}
        </h3>
        <div className="karaoke-maker__stem-progress" role="status">
          <progress max={1} value={progress} />
          <p>{message ?? t('karaoke.maker.separating')}</p>
        </div>
      </section>
    );
  }
  if (!instrumental && !vocals) {
    return null;
  }
  const percent = Math.round((vocalLevel ?? 0) * 100);
  const canMix = vocalLevel !== undefined && onVocalLevel !== undefined;
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
                  onClick={() => (isPlaying ? onPause() : onPlay())}
                  aria-pressed={isPlaying}
                  aria-label={t(
                    isPlaying
                      ? 'karaoke.transport.pause'
                      : 'karaoke.transport.play',
                  )}
                >
                  <KaraokeTransportIcon name={isPlaying ? 'pause' : 'play'} />
                </button>
              )}
              <button
                type="button"
                // Quiet: saving a stem is an escape hatch, not the thing this
                // panel is for.
                className="button small subtle"
                onClick={() => onSave(track.file as File)}
              >
                {t('karaoke.maker.stemSave')}
              </button>
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
          <span>{t('karaoke.transport.vocalLevel')}</span>
          <input
            id="karaoke-maker-vocal-level"
            aria-label={t('karaoke.transport.vocalLevel')}
            aria-valuetext={
              percent === 0 ? t('karaoke.transport.vocalOff') : `${percent}%`
            }
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vocalLevel}
            onChange={(event) => onVocalLevel(Number(event.target.value))}
          />
          <span className="karaoke-maker__stem-level-value">
            {percent === 0 ? t('karaoke.transport.vocalOff') : `${percent}%`}
          </span>
        </label>
      )}
    </section>
  );
};

export default KaraokeMakerStems;
