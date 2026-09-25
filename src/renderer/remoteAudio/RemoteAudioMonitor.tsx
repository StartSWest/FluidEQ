/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import type {
  ILanRemoteAudioNetworkStats,
  IRemoteNowPlaying,
} from '../../common/remoteAudio';
import LiveFigure from '../components/LiveFigure';
import { useTranslation } from '../utils/I18nContext';
import { useLiveSurface } from '../utils/theme';
import useSmoothFrames from '../utils/useSmoothFrames';
import type { IRemoteAudioMeter, TRemoteAudioMeterListener } from './meter';
import type { IRemoteAudioComputer } from './remoteAudioState';
import writeLiveText from '../utils/liveText';

interface IRemoteAudioMonitorProps {
  active: boolean;
  connectedComputers: IRemoteAudioComputer[];
  detail?: string;
  mode?: 'listener' | 'sender';
  networkStats: ILanRemoteAudioNetworkStats[];
  status: string;
  subscribe(listener: TRemoteAudioMeterListener): () => void;
}

interface IRemoteAudioMeterLaneProps {
  active: boolean;
  address?: string;
  bufferKind?: 'playback' | 'send';
  /** The word beside the dot while sound is flowing: what this lane is doing
   * with it — receiving on the listener, transmitting on the sender. */
  activeState: string;
  idleState: string;
  label: string;
  large?: boolean;
  meterKey?: string | null;
  network?: ILanRemoteAudioNetworkStats;
  /** What the sender says its bar is showing — see `useRemoteNowPlayingSource`. */
  nowPlaying?: IRemoteNowPlaying;
  subscribe(listener: TRemoteAudioMeterListener): () => void;
}

const EMPTY_METER: IRemoteAudioMeter = {
  peak: 0,
  rms: 0,
  waveform: new Float32Array(64),
};
const HISTORY_POINTS = 320;

/**
 * What the stylesheet paints the waveform in (`.remote-audio__waveform`'s
 * `color`, which is `--accent-light`), before a theme has said otherwise.
 */
const WAVEFORM_INK = '#9cfff4';

/**
 * A lane draws whenever something new has arrived, at the display's own rate:
 * a block of audio lands every few milliseconds, and holding the picture to
 * the thirty frames a second the shell keeps idle drawings at would move the
 * waveform in coarser steps than it always has.
 */
const DRAW_ON_ARRIVAL = () => 0;

/** The widest a buffer figure gets: four digits of milliseconds. */
const WIDEST_MILLISECONDS = 8888;

interface IWaveformHistory {
  cursor: number;
  high: Float32Array;
  low: Float32Array;
}

const emptyHistory = (): IWaveformHistory => ({
  cursor: 0,
  high: new Float32Array(HISTORY_POINTS),
  low: new Float32Array(HISTORY_POINTS),
});

const appendHistory = (history: IWaveformHistory, waveform: Float32Array) => {
  let high = 0;
  let low = 0;
  waveform.forEach((sample) => {
    high = Math.max(high, sample);
    low = Math.min(low, sample);
  });
  history.high[history.cursor] = high;
  history.low[history.cursor] = low;
  history.cursor = (history.cursor + 1) % HISTORY_POINTS;
};

const RemoteAudioMeterLane = ({
  active,
  activeState,
  address,
  bufferKind,
  idleState,
  label,
  large = false,
  meterKey,
  network,
  nowPlaying,
  subscribe,
}: IRemoteAudioMeterLaneProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const bufferRef = useRef<HTMLSpanElement>(null);
  const activityRef = useRef<HTMLSpanElement>(null);
  const activityDotRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<IRemoteAudioMeter>(EMPTY_METER);
  const historyRef = useRef<IWaveformHistory>(emptyHistory());
  const networkRef = useRef(network);
  networkRef.current = network;
  const queuedMilliseconds = network?.queuedMilliseconds ?? 0;
  const networkCongested = queuedMilliseconds > 100;
  // The canvas's box in CSS pixels, kept by the observer below.
  const sizeRef = useRef({ width: 0, height: 0 });
  /**
   * The ink, from the theme's own store rather than from the canvas's
   * computed style: that was asked for on every frame, and a computed style
   * is only as cheap as the document is clean, so each read restyled
   * whatever the frame before had changed. This re-renders the lane when the
   * theme or a scene's tint moves the colour, which is when it can change.
   */
  const ink = useLiveSurface('--accent-light', WAVEFORM_INK);
  const inkRef = useRef(ink);
  inkRef.current = ink;

  /**
   * One frame of the lane: the strip, the level bar and the figures.
   *
   * Drawn when something arrives rather than on every frame. The lane used
   * to ask for its next frame unconditionally and measure the canvas and
   * read its style on each, so every lane of the Share Audio page — the
   * placeholder waiting for a sender included — redrew an unchanged picture
   * sixty times a second for as long as the page was open. What moves it is
   * a block of audio, a new size, a new colour or a change of what the lane
   * is, and each of those asks for the frame it needs.
   */
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return false;
    }
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(sizeRef.current.width * pixelRatio));
    const height = Math.max(1, Math.round(sizeRef.current.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }
    const meter = active ? meterRef.current : EMPTY_METER;
    context.clearRect(0, 0, width, height);
    const color = inkRef.current;
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, pixelRatio);
    const history = historyRef.current;
    const historyPoint = (index: number) =>
      (history.cursor + index) % HISTORY_POINTS;
    context.beginPath();
    for (let index = 0; index < HISTORY_POINTS; index += 1) {
      const x = (index / (HISTORY_POINTS - 1)) * width;
      const y =
        height * 0.5 - history.high[historyPoint(index)] * height * 0.42;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    for (let index = HISTORY_POINTS - 1; index >= 0; index -= 1) {
      const x = (index / (HISTORY_POINTS - 1)) * width;
      const y = height * 0.5 - history.low[historyPoint(index)] * height * 0.42;
      context.lineTo(x, y);
    }
    context.closePath();
    context.save();
    context.globalAlpha = 0.13;
    context.fillStyle = color;
    context.fill();
    context.restore();
    context.stroke();
    context.save();
    context.globalAlpha = 0.42;
    context.beginPath();
    context.moveTo(width - pixelRatio, 0);
    context.lineTo(width - pixelRatio, height);
    context.stroke();
    context.restore();

    const peak = Math.min(1, Math.max(0, meter.peak));
    const transmitting = active && peak >= 0.001;
    if (levelRef.current) {
      levelRef.current.style.transform = `scaleX(${peak})`;
    }
    const decibels = peak > 0 ? 20 * Math.log10(peak) : -60;
    writeLiveText(
      valueRef.current,
      t('remoteAudio.monitor.peak', {
        decibels: Math.max(-60, decibels).toFixed(1),
      }),
    );
    const playbackMilliseconds = meter.bufferedMs;
    const sendMilliseconds = networkRef.current?.queuedMilliseconds;
    if (playbackMilliseconds !== undefined) {
      writeLiveText(
        bufferRef.current,
        t('remoteAudio.monitor.buffer', {
          milliseconds: Math.round(playbackMilliseconds),
        }),
      );
    } else if (meterKey === null && sendMilliseconds !== undefined) {
      writeLiveText(
        bufferRef.current,
        t('remoteAudio.monitor.sendQueue', {
          milliseconds: Math.round(sendMilliseconds),
        }),
      );
    } else {
      writeLiveText(bufferRef.current, '');
    }
    writeLiveText(activityRef.current, transmitting ? activeState : idleState);
    activityDotRef.current?.classList.toggle('is-active', transmitting);
    // Nothing here moves on its own: the next frame is whatever asks for it.
    return false;
  }, [active, activeState, idleState, meterKey, t]);

  // Stopped while the canvas cannot be seen — a closed tab, a page scrolled
  // past — and asked again when it can, by the watcher in `useSmoothFrames`.
  const kick = useSmoothFrames(drawFrame, {
    isEnabled: true,
    target: canvasRef,
    minFrameMs: DRAW_ON_ARRIVAL,
  });

  useEffect(() => {
    meterRef.current = EMPTY_METER;
    historyRef.current = emptyHistory();
    // An emptied lane is a new picture as well.
    kick();
    if (!active || meterKey === undefined) {
      return undefined;
    }
    return subscribe((meter) => {
      const matches =
        meterKey === null
          ? meter.sourceId === undefined
          : meter.sourceId === meterKey;
      if (matches) {
        meterRef.current = meter;
        appendHistory(historyRef.current, meter.waveform);
        kick();
      }
    });
  }, [active, kick, meterKey, subscribe]);

  // What the lane is (its words, its role), its network figures and its ink
  // reach the canvas and the figures through here; the audio through the
  // subscription above.
  useEffect(() => {
    kick();
  }, [drawFrame, ink, kick, network]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) {
        return;
      }
      sizeRef.current.width = box.width;
      sizeRef.current.height = box.height;
      kick();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kick]);

  const emptyBufferReadout = bufferKind
    ? t(
        bufferKind === 'send'
          ? 'remoteAudio.monitor.sendQueue'
          : 'remoteAudio.monitor.buffer',
        { milliseconds: '—' },
      )
    : '';
  const initialPeakReadout = t('remoteAudio.monitor.peak', {
    decibels: '−60.0',
  });
  // Every text each figure can show at its widest — see `LiveFigure`. The
  // columns they stand in are fixed, so this decides no width; the figure is
  // what lets their text be laid out on its own rather than with the page.
  const peakWidest = [
    ...new Set([
      initialPeakReadout,
      t('remoteAudio.monitor.peak', { decibels: '-60.0' }),
    ]),
  ];
  const bufferWidest = [
    ...new Set(
      [
        emptyBufferReadout,
        t('remoteAudio.monitor.buffer', { milliseconds: WIDEST_MILLISECONDS }),
        t('remoteAudio.monitor.sendQueue', {
          milliseconds: WIDEST_MILLISECONDS,
        }),
      ].filter((text) => text !== ''),
    ),
  ];

  return (
    <div
      className={`remote-audio__monitor-lane${
        meterKey === undefined ? ' is-placeholder' : ''
      }${large ? ' is-primary' : ''}`}
    >
      <div className="remote-audio__monitor-lane-heading">
        <div className="remote-audio__monitor-source">
          <span
            ref={activityDotRef}
            className="remote-audio__monitor-source-dot"
            aria-hidden="true"
          />
          <strong>{label}</strong>
          {address && (
            <span className="remote-audio__monitor-address">{address}</span>
          )}
          <span ref={activityRef}>{idleState}</span>
        </div>
        <div className="remote-audio__monitor-readouts">
          <span
            className={`remote-audio__network-usage${
              network ? '' : ' is-unavailable'
            }`}
          >
            {network
              ? t('remoteAudio.monitor.networkUsage', {
                  megabits: ((network.bytesPerSecond * 8) / 1_000_000).toFixed(
                    2,
                  ),
                })
              : '—'}
          </span>
          <span
            className={`remote-audio__network-health${
              network ? '' : ' is-unavailable'
            }${networkCongested ? ' is-congested' : ''}`}
          >
            {networkCongested
              ? t('remoteAudio.monitor.networkQueued', {
                  milliseconds: queuedMilliseconds,
                })
              : t('remoteAudio.monitor.networkHealthy')}
          </span>
          {/* Rewritten with every block of audio, so each is laid out on its
              own (`LiveFigure`): a grid item is never a relayout boundary,
              and new text in one had the window laid out with it. */}
          <LiveFigure
            className="remote-audio__buffer-readout"
            widest={bufferWidest}
            textRef={bufferRef}
          >
            {emptyBufferReadout}
          </LiveFigure>
          <LiveFigure
            className="remote-audio__level-readout"
            widest={peakWidest}
            textRef={valueRef}
          >
            {initialPeakReadout}
          </LiveFigure>
        </div>
      </div>
      {/* What is coming down this lane, in the sender's own words. The bar
          at the foot of the window shows one sender; this is the per-sender
          answer, beside the meter it belongs to. */}
      {nowPlaying && (
        <div
          className={`remote-audio__monitor-now-playing${
            nowPlaying.isPlaying ? ' is-playing' : ''
          }`}
        >
          <span className="remote-audio__monitor-now-playing-state">
            {t(
              nowPlaying.isPlaying
                ? 'remoteAudio.monitor.nowPlaying'
                : 'remoteAudio.monitor.paused',
            )}
          </span>
          <strong>{nowPlaying.title}</strong>
          {nowPlaying.subtitle && <span>{nowPlaying.subtitle}</span>}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="remote-audio__waveform"
        aria-label={t('remoteAudio.monitor.waveformFor', { name: label })}
      />
      <div
        className="remote-audio__level"
        aria-hidden="true"
        title={t('remoteAudio.monitor.peakLevel')}
      >
        <div ref={levelRef} />
      </div>
    </div>
  );
};

const RemoteAudioMonitor = ({
  active,
  connectedComputers,
  detail,
  mode,
  networkStats,
  status,
  subscribe,
}: IRemoteAudioMonitorProps) => {
  const { t } = useTranslation();

  return (
    <div className="remote-audio__monitor">
      <div className="remote-audio__monitor-heading">
        <div className="remote-audio__monitor-identity">
          <span
            className={`remote-audio__monitor-live${active ? ' is-active' : ''}`}
            aria-hidden="true"
          />
          <div>
            <strong>
              {mode
                ? t(
                    `remoteAudio.${mode === 'listener' ? 'listen' : 'send'}.kicker`,
                  )
                : t('remoteAudio.monitor.title')}
            </strong>
            <span>{status}</span>
          </div>
        </div>
      </div>

      <div className="remote-audio__monitor-lanes">
        {mode === 'listener' &&
          connectedComputers.map((computer) => (
            <RemoteAudioMeterLane
              key={computer.id}
              active={active}
              activeState={t('remoteAudio.monitor.receiving')}
              address={computer.address}
              bufferKind="playback"
              idleState={t('remoteAudio.monitor.quiet')}
              label={computer.name}
              large={connectedComputers.length === 1}
              meterKey={computer.id}
              network={networkStats.find(
                (stats) =>
                  stats.direction === 'receive' && stats.peerId === computer.id,
              )}
              nowPlaying={computer.nowPlaying}
              subscribe={subscribe}
            />
          ))}
        {mode === 'listener' && connectedComputers.length === 0 && (
          <RemoteAudioMeterLane
            active={false}
            activeState={t('remoteAudio.monitor.receiving')}
            bufferKind="playback"
            idleState={t('remoteAudio.monitor.waitingSource')}
            label={t('remoteAudio.monitor.noSources')}
            large
            subscribe={subscribe}
          />
        )}
        {mode === 'sender' && (
          <RemoteAudioMeterLane
            active={active}
            activeState={t('remoteAudio.monitor.transmitting')}
            bufferKind="send"
            idleState={t('remoteAudio.monitor.quiet')}
            label={detail ?? t('remoteAudio.monitor.outgoing')}
            large
            meterKey={null}
            network={networkStats.find((stats) => stats.direction === 'send')}
            subscribe={subscribe}
          />
        )}
        {!mode && (
          <RemoteAudioMeterLane
            active={false}
            activeState={status}
            idleState={status}
            label={t('remoteAudio.monitor.noRole')}
            large
            subscribe={subscribe}
          />
        )}
      </div>
    </div>
  );
};

export default RemoteAudioMonitor;
