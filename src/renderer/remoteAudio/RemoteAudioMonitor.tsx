/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import type { IRemoteAudioMeter, TRemoteAudioMeterListener } from './meter';

interface IRemoteAudioMonitorProps {
  active: boolean;
  connectedComputers: { address?: string; id: string; name: string }[];
  detail?: string;
  mode?: 'listener' | 'sender';
  status: string;
  subscribe(listener: TRemoteAudioMeterListener): () => void;
}

interface IRemoteAudioMeterLaneProps {
  active: boolean;
  address?: string;
  idleState: string;
  label: string;
  large?: boolean;
  meterKey?: string | null;
  subscribe(listener: TRemoteAudioMeterListener): () => void;
}

const EMPTY_METER: IRemoteAudioMeter = {
  peak: 0,
  rms: 0,
  waveform: new Float32Array(64),
};

const RemoteAudioMeterLane = ({
  active,
  address,
  idleState,
  label,
  large = false,
  meterKey,
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

  useEffect(() => {
    meterRef.current = EMPTY_METER;
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
      context.strokeStyle = getComputedStyle(canvas).color;
      context.lineWidth = Math.max(1, pixelRatio);
      context.beginPath();
      meter.waveform.forEach((sample, index) => {
        const x = (index / (meter.waveform.length - 1)) * width;
        const y = height * 0.5 - sample * height * 0.42;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();

      const peak = Math.min(1, Math.max(0, meter.peak));
      const transmitting = active && peak >= 0.001;
      if (levelRef.current) {
        levelRef.current.style.transform = `scaleX(${peak})`;
      }
      if (valueRef.current) {
        const decibels = peak > 0 ? 20 * Math.log10(peak) : -60;
        valueRef.current.textContent = `${Math.max(-60, decibels).toFixed(1)} dB`;
      }
      if (bufferRef.current) {
        bufferRef.current.textContent =
          meter.bufferedMs === undefined
            ? ''
            : t('remoteAudio.monitor.buffer', {
                milliseconds: Math.round(meter.bufferedMs),
              });
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
  }, [active, idleState, t]);

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
          <span ref={bufferRef} />
          <span ref={valueRef}>−60.0 dB</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="remote-audio__waveform"
        aria-label={t('remoteAudio.monitor.waveformFor', { name: label })}
      />
      <div className="remote-audio__level" aria-hidden="true">
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
              idleState={t('remoteAudio.monitor.quiet')}
              label={computer.name}
              large={connectedComputers.length === 1}
              meterKey={computer.id}
              subscribe={subscribe}
            />
          ))}
        {mode === 'listener' && connectedComputers.length === 0 && (
          <RemoteAudioMeterLane
            active={false}
            idleState={t('remoteAudio.monitor.waitingSource')}
            label={t('remoteAudio.monitor.noSources')}
            large
            subscribe={subscribe}
          />
        )}
        {mode === 'sender' && (
          <RemoteAudioMeterLane
            active={active}
            idleState={t('remoteAudio.monitor.quiet')}
            label={detail ?? t('remoteAudio.monitor.outgoing')}
            large
            meterKey={null}
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
