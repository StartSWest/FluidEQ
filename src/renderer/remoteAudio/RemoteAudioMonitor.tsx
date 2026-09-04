/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { ILanRemoteAudioNetworkStats } from '../../common/remoteAudio';
import { useTranslation } from '../utils/I18nContext';
import type { IRemoteAudioMeter, TRemoteAudioMeterListener } from './meter';

interface IRemoteAudioMonitorProps {
  active: boolean;
  connectedComputers: { address?: string; id: string; name: string }[];
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
  idleState: string;
  label: string;
  large?: boolean;
  meterKey?: string | null;
  network?: ILanRemoteAudioNetworkStats;
  subscribe(listener: TRemoteAudioMeterListener): () => void;
}

const EMPTY_METER: IRemoteAudioMeter = {
  peak: 0,
  rms: 0,
  waveform: new Float32Array(64),
};
const HISTORY_POINTS = 320;

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
  address,
  bufferKind,
  idleState,
  label,
  large = false,
  meterKey,
  network,
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

  useEffect(() => {
    meterRef.current = EMPTY_METER;
    historyRef.current = emptyHistory();
    if (meterKey === undefined) {
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
      }
    });
  }, [meterKey, subscribe]);

  useEffect(() => {
    let frameId = 0;
    const paint = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      const meter = active ? meterRef.current : EMPTY_METER;
      context.clearRect(0, 0, width, height);
      const { color } = getComputedStyle(canvas);
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
        const y =
          height * 0.5 - history.low[historyPoint(index)] * height * 0.42;
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
      if (valueRef.current) {
        const decibels = peak > 0 ? 20 * Math.log10(peak) : -60;
        valueRef.current.textContent = t('remoteAudio.monitor.peak', {
          decibels: Math.max(-60, decibels).toFixed(1),
        });
      }
      if (bufferRef.current) {
        const playbackMilliseconds = meter.bufferedMs;
        const sendMilliseconds = networkRef.current?.queuedMilliseconds;
        if (playbackMilliseconds !== undefined) {
          bufferRef.current.textContent = t('remoteAudio.monitor.buffer', {
            milliseconds: Math.round(playbackMilliseconds),
          });
        } else if (meterKey === null && sendMilliseconds !== undefined) {
          bufferRef.current.textContent = t('remoteAudio.monitor.sendQueue', {
            milliseconds: Math.round(sendMilliseconds),
          });
        } else {
          bufferRef.current.textContent = '';
        }
      }
      if (activityRef.current) {
        activityRef.current.textContent = transmitting
          ? t('remoteAudio.monitor.transmitting')
          : idleState;
      }
      activityDotRef.current?.classList.toggle('is-active', transmitting);
      frameId = window.requestAnimationFrame(paint);
    };
    frameId = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(frameId);
  }, [active, idleState, meterKey, t]);

  const emptyBufferReadout = bufferKind
    ? t(
        bufferKind === 'send'
          ? 'remoteAudio.monitor.sendQueue'
          : 'remoteAudio.monitor.buffer',
        { milliseconds: '—' },
      )
    : '';

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
          <span className="remote-audio__buffer-readout" ref={bufferRef}>
            {emptyBufferReadout}
          </span>
          <span className="remote-audio__level-readout" ref={valueRef}>
            {t('remoteAudio.monitor.peak', { decibels: '−60.0' })}
          </span>
        </div>
      </div>
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
              subscribe={subscribe}
            />
          ))}
        {mode === 'listener' && connectedComputers.length === 0 && (
          <RemoteAudioMeterLane
            active={false}
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
