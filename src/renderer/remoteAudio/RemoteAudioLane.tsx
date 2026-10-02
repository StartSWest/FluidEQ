/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import LiveFigure from '../components/LiveFigure';
import MenuIcon from '../icons/MenuIcon';
import { useLiveSurface } from '../utils/theme';
import useSmoothFrames from '../utils/useSmoothFrames';
import Switch from '../widgets/Switch';
import {
  emptyLaneHistory,
  fitLaneHistory,
  laneReading,
  pushLaneReading,
} from './laneHistory';
import type { TRemoteAudioMeterListener } from './meter';

/** What the stylesheet paints the bars in before a theme says otherwise. */
const BAR_INK = '#9cfff4';
const BAR_WIDTH_PX = 2.5;
const BAR_GAP_PX = 2.5;

/** How many bars a lane this wide draws: one per reading. */
const barsFor = (cssWidth: number) =>
  Math.max(1, Math.floor(cssWidth / (BAR_WIDTH_PX + BAR_GAP_PX)));

export interface IRemoteAudioLaneProps {
  direction: 'in' | 'out';
  kicker: string;
  title: string;
  /** What is on this lane: a song, or why nothing is. */
  line: string;
  /** Under the song: the artist and where it plays from. */
  lineDetail?: string;
  /** Sound flows on this lane; off, it is drawn as a dashed line. */
  live: boolean;
  /** The other computer's peer id for its sound here; null for this
   * computer's own on its way out. */
  meterKey: string | null;
  subscribe(listener: TRemoteAudioMeterListener): () => void;
  /** The figure on the right, and the word under it. Written by React: the
   * incoming delay is an average that moves a few times a minute
   * (`useIncomingDelays.ts`), not a reading per block. */
  figure: string;
  figureCaption: string;
  /** Every text the figure can show, for its width (`LiveFigure`). */
  figureWidest: readonly string[];
  switchId: string;
  switchLabel: string;
  isOn: boolean;
  isSwitchDisabled: boolean;
  onToggle(): void;
}

/**
 * One direction of a link: what is coming in from the other computer, or
 * what is going out to it.
 *
 * The bars are the last few seconds of the sound on this lane, newest on the
 * right, drawn when a reading arrives and not otherwise: the lane used to be a
 * canvas redrawn sixty times a second whether anything moved or not.
 */
const RemoteAudioLane = ({
  direction,
  kicker,
  title,
  line,
  lineDetail,
  live,
  meterKey,
  subscribe,
  figure,
  figureCaption,
  figureWidest,
  switchId,
  switchLabel,
  isOn,
  isSwitchDisabled,
  onToggle,
}: IRemoteAudioLaneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef(emptyLaneHistory());
  const sizeRef = useRef({ width: 0, height: 0 });
  const ink = useLiveSurface('--accent-light', BAR_INK);
  const inkRef = useRef(ink);
  inkRef.current = ink;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return false;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(sizeRef.current.width * ratio));
    const height = Math.max(1, Math.round(sizeRef.current.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }
    context.clearRect(0, 0, width, height);
    const middle = height / 2;
    if (!live) {
      context.save();
      context.globalAlpha = 0.45;
      context.strokeStyle = inkRef.current;
      context.lineWidth = Math.max(1, ratio);
      context.setLineDash([4 * ratio, 5 * ratio]);
      context.beginPath();
      context.moveTo(0, middle);
      context.lineTo(width, middle);
      context.stroke();
      context.restore();
      return false;
    }
    const step = (BAR_WIDTH_PX + BAR_GAP_PX) * ratio;
    const bars = Math.max(1, Math.floor(width / step));
    const history = historyRef.current;
    context.lineCap = 'round';
    context.lineWidth = BAR_WIDTH_PX * ratio;
    context.strokeStyle = inkRef.current;
    for (let bar = 0; bar < bars; bar += 1) {
      // Newest on the right: the last bar is the latest reading.
      const age = bars - 1 - bar;
      const value = laneReading(history, age);
      // A square root, so music mixed well below full scale still stands up.
      const reach = Math.max(
        ratio,
        Math.sqrt(Math.min(1, value)) * (middle - ratio * 2),
      );
      const x = width - age * step - step / 2;
      context.globalAlpha = 0.35 + 0.65 * (1 - age / bars);
      context.beginPath();
      context.moveTo(x, middle - reach);
      context.lineTo(x, middle + reach);
      context.stroke();
    }
    context.globalAlpha = 1;
    return false;
  }, [live]);

  const kick = useSmoothFrames(draw, { isEnabled: true, target: canvasRef });

  useEffect(() => {
    historyRef.current = fitLaneHistory(
      emptyLaneHistory(),
      barsFor(sizeRef.current.width),
    );
    kick();
    if (!live) {
      return undefined;
    }
    return subscribe((meter) => {
      const matches =
        meterKey === null
          ? meter.sourceId === undefined
          : meter.sourceId === meterKey;
      if (!matches) {
        return;
      }
      pushLaneReading(historyRef.current, meter.peak);
      kick();
    });
  }, [kick, live, meterKey, subscribe]);

  useEffect(() => {
    kick();
  }, [draw, ink, kick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (box) {
        sizeRef.current = { width: box.width, height: box.height };
        historyRef.current = fitLaneHistory(
          historyRef.current,
          barsFor(box.width),
        );
        kick();
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kick]);

  return (
    <div className={`remote-audio__lane${live ? '' : ' is-off'}`}>
      <div className="remote-audio__lane-direction">
        <span className="remote-audio__lane-arrow" aria-hidden="true">
          <MenuIcon name={direction === 'in' ? 'arrowIn' : 'arrowOut'} />
        </span>
        <span className="remote-audio__lane-names">
          <span className="remote-audio__lane-kicker">{kicker}</span>
          <strong>{title}</strong>
        </span>
      </div>
      <div className="remote-audio__lane-body">
        <p className="remote-audio__lane-line">
          <span className="remote-audio__lane-song">{line}</span>
          {lineDetail && (
            <span className="remote-audio__lane-detail">{lineDetail}</span>
          )}
        </p>
        <canvas
          ref={canvasRef}
          className="remote-audio__lane-wave"
          aria-hidden="true"
        />
      </div>
      <div className="remote-audio__lane-figure">
        <LiveFigure className="remote-audio__lane-number" widest={figureWidest}>
          {figure}
        </LiveFigure>
        <span className="remote-audio__lane-caption">{figureCaption}</span>
      </div>
      <div className="remote-audio__lane-switch">
        <span id={`${switchId}-label`}>{switchLabel}</span>
        <Switch
          id={switchId}
          isOn={isOn}
          isDisabled={isSwitchDisabled}
          handleToggle={onToggle}
          ariaLabel={switchLabel}
        />
      </div>
    </div>
  );
};

export default RemoteAudioLane;
