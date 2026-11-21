/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import {
  getSmartEqPreview,
  subscribeSmartEqPreview,
} from '../utils/smartEqPreview';
import { watchCanvasLoss } from '../utils/canvasLoss';
import { windowPrimary } from '../utils/windowInk';
import { isLightWindow } from '../utils/windowSide';
import {
  HOLD_CLOSE_S,
  HOLD_SWEEP_S,
  IDustFrame,
  IDustPaint,
  clamp01,
  closedOf,
  curveEaseShare,
  confidenceAt,
  createDustField,
  drawDust,
  responseAt,
  smoothstep,
} from './smartEqDustDraw';
import SmartEqChip from './SmartEqChip';
import { SUPPORTING_CURVE_OPACITY } from './chartCurves';
import { ColorEnum } from '../styles/color';

/**
 * Smart correction's curve forming on the EQ graph — see `smartEqDustDraw`.
 *
 * A canvas of its own over the chart's SVG (`chart-smart-dust`). The store says what to
 * draw (`smartEqPreview.ts`); the drawing runs on animation frames only while
 * there is something moving, and stops itself when the song is held and its
 * arrival has played.
 */

const CONFIDENCE_EASE_S = 0.35;
const ARRIVE_S = 0.45;
/**
 * The arrival once held: the points close into the line in one sweep from the
 * bass up (`HOLD_SWEEP_S`, `HOLD_CLOSE_S`), the light runs along the
 * finished line, it stands a moment and hands over to the layer's own line.
 */
const HELD_PASS_FROM_S = HOLD_SWEEP_S + HOLD_CLOSE_S;
const HELD_PASS_S = 0.85;
const HELD_LINE_FROM_S = HELD_PASS_FROM_S + HELD_PASS_S + 0.6;
const HELD_LINE_OUT_S = 0.75;
const HELD_DONE_S = HELD_LINE_FROM_S + HELD_LINE_OUT_S;

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const mix = (
  from: readonly number[],
  to: readonly number[],
  amount: number,
): [number, number, number] => [
  Math.round(from[0] + (to[0] - from[0]) * amount),
  Math.round(from[1] + (to[1] - from[1]) * amount),
  Math.round(from[2] + (to[2] - from[2]) * amount),
];

/**
 * The window's accent, as light on a dark window — added, so where the
 * points crowd they glow — and as a deeper ink on a white one, where light
 * added to white is nothing.
 */
const paintOfWindow = (): IDustPaint => {
  const accent = channels(windowPrimary());
  if (isLightWindow()) {
    const ink = mix(accent, [4, 22, 28], 0.42);
    return {
      ink,
      light: mix(accent, [4, 22, 28], 0.15),
      blend: 'source-over',
    };
  }
  return {
    ink: accent,
    light: mix(accent, [255, 255, 255], 0.6),
    blend: 'lighter',
  };
};

/**
 * The Smart layer's own line, as the chart draws it (`chartCurves.ts`: its
 * colour at the supporting curves' opacity), for the fade it gets when Smart
 * correction is switched off and the chart drops it at once.
 */
const LAYER_PAINT: IDustPaint = {
  ink: channels(ColorEnum.SMART),
  light: channels(ColorEnum.SMART),
  blend: 'source-over',
};
/** Seconds for that line to fade out, the arrival's own pace. */
const DEPART_S = ARRIVE_S;

/** The share of the way an eased value moves in `dt` seconds. */
const easeStep = (dt: number, seconds: number) => 1 - Math.exp(-dt / seconds);

const isMotionReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ISmartEqDustProps {
  xScale: AxisScale<NumberValue>;
  yScale: AxisScale<NumberValue>;
  /** The chart's own box, which this covers exactly. */
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  /** The plot inside that box, which the drawing is clipped to. */
  plotLeft: number;
  plotRight: number;
  plotBottom: number;
}

const SmartEqDust = ({
  xScale,
  yScale,
  width,
  height,
  offsetLeft,
  offsetTop,
  plotLeft,
  plotRight,
  plotBottom,
}: ISmartEqDustProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef({ width, height, plotLeft, plotRight, plotBottom });
  boxRef.current = { width, height, plotLeft, plotRight, plotBottom };
  const yScaleRef = useRef(yScale);
  yScaleRef.current = yScale;

  const [low, high] = xScale.domain().map(Number);
  const [rangeLeft, rangeRight] = xScale.range().map(Number);
  const field = useMemo(() => {
    const span = Math.log(high / low);
    const frequencyAt = (x: number) =>
      low * Math.exp(((x - rangeLeft) / (rangeRight - rangeLeft)) * span);
    return createDustField(frequencyAt, plotLeft, plotRight);
  }, [low, high, rangeLeft, rangeRight, plotLeft, plotRight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    const count = field.frequencies.length;
    const targetCurve = new Float64Array(count);
    const targetConfidence = new Float64Array(count);
    const ys = new Float64Array(count);
    const frame: IDustFrame = {
      curve: new Float64Array(count),
      confidence: new Float64Array(count),
      seconds: 0,
      presence: 0,
      closed: new Float64Array(count),
      line: 1,
      pass: -1,
    };
    // The correction leaving when Smart correction is switched off, drawn as
    // the layer's own line draws it and faded out (`departSmartEqPreview`).
    const departing: IDustFrame = {
      curve: new Float64Array(count),
      confidence: new Float64Array(count).fill(1),
      seconds: 0,
      presence: 1,
      closed: new Float64Array(count).fill(1),
      line: 0,
      pass: -1,
    };
    let { departId } = getSmartEqPreview();
    let departAt: number | undefined;
    let isDepartNew = false;
    let shownGains: unknown;
    let shownRegions: unknown;
    let heldId = getSmartEqPreview().holdId;
    let heldAt: number | undefined;
    /** Held since the last frame: its first frame is when the arrival starts. */
    let isHeldNew = false;
    let request = 0;
    let lastTime: number | undefined;
    let isFirst = true;

    const isActive = () => {
      const { phase } = getSmartEqPreview();
      return phase === 'listening' || phase === 'settling';
    };

    const tick = (time: number) => {
      request = 0;
      const dt =
        lastTime === undefined ? 0 : Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      if (isHeldNew) {
        isHeldNew = false;
        heldAt = time;
      }
      if (isDepartNew) {
        isDepartNew = false;
        departAt = time;
      }
      const reduced = isMotionReduced();
      const sinceDepart =
        departAt === undefined || reduced ? DEPART_S : (time - departAt) / 1000;
      departing.line =
        SUPPORTING_CURVE_OPACITY * (1 - smoothstep(0, DEPART_S, sinceDepart));
      if (sinceDepart >= DEPART_S) {
        departAt = undefined;
      }
      if (!reduced) {
        frame.seconds += dt;
      }
      const active = isActive();
      const sinceHeld =
        heldAt === undefined ? undefined : (time - heldAt) / 1000;

      // Ease toward the measurement, so a checkpoint every half second reads
      // as one movement and not as steps.
      const curveShare = isFirst
        ? 1
        : curveEaseShare(dt, sinceHeld !== undefined);
      const confidenceShare = isFirst ? 1 : easeStep(dt, CONFIDENCE_EASE_S);
      isFirst = false;
      for (let index = 0; index < count; index += 1) {
        frame.curve[index] +=
          (targetCurve[index] - frame.curve[index]) * curveShare;
        frame.confidence[index] +=
          (targetConfidence[index] - frame.confidence[index]) * confidenceShare;
      }
      frame.presence =
        active || sinceHeld !== undefined
          ? Math.min(1, frame.presence + dt / ARRIVE_S)
          : Math.max(0, frame.presence - dt / ARRIVE_S);
      closedOf(frame.confidence, sinceHeld, reduced, frame.closed);
      if (sinceHeld === undefined) {
        frame.line = 1;
        frame.pass = -1;
      } else {
        frame.line = 1 - smoothstep(HELD_LINE_FROM_S, HELD_DONE_S, sinceHeld);
        frame.pass = reduced
          ? -1
          : clamp01((sinceHeld - HELD_PASS_FROM_S) / HELD_PASS_S);
      }

      const box = boxRef.current;
      const ratio = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(box.width * ratio));
      const pixelHeight = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, box.width, box.height);
      const isDustDone =
        !active &&
        (sinceHeld === undefined
          ? frame.presence <= 0
          : sinceHeld >= HELD_DONE_S);
      if (isDustDone && departAt === undefined) {
        heldAt = undefined;
        lastTime = undefined;
        return;
      }
      context.save();
      context.beginPath();
      context.rect(
        box.plotLeft,
        0,
        Math.max(0, box.plotRight - box.plotLeft),
        box.plotBottom,
      );
      context.clip();
      const scale = yScaleRef.current;
      const yOf = (db: number) => Number(scale(db));
      if (departAt !== undefined) {
        drawDust(context, field, departing, LAYER_PAINT, yOf, ys);
      }
      if (!isDustDone) {
        drawDust(context, field, frame, paintOfWindow(), yOf, ys);
      }
      context.restore();
      request = requestAnimationFrame(tick);
    };

    const sync = () => {
      const preview = getSmartEqPreview();
      if (preview.gains !== shownGains) {
        shownGains = preview.gains;
        responseAt(preview.gains, field.frequencies, targetCurve);
      }
      if (preview.regions !== shownRegions) {
        shownRegions = preview.regions;
        confidenceAt(preview.regions, field.frequencies, targetConfidence);
      }
      if (preview.departId !== departId) {
        departId = preview.departId;
        if (preview.departing) {
          responseAt(preview.departing, field.frequencies, departing.curve);
          isDepartNew = true;
        }
      }
      if (preview.phase === 'held' && preview.holdId !== heldId) {
        heldId = preview.holdId;
        // The sweep closes what the measurement had not: confidence is left
        // where it was, or every range would close at once ahead of it.
        isHeldNew = true;
      } else if (preview.phase !== 'held') {
        heldAt = undefined;
        isHeldNew = false;
      }
      if (
        !request &&
        (isActive() ||
          isHeldNew ||
          heldAt !== undefined ||
          isDepartNew ||
          departAt !== undefined)
      ) {
        request = requestAnimationFrame(tick);
      }
    };

    const unsubscribe = subscribeSmartEqPreview(sync);
    // Hidden through a loss of the GPU, and drawn again when the canvas
    // comes back empty: every frame lays the whole field down, so asking for
    // one is all a restore needs (`canvasLoss.ts`).
    const stopWatchingLoss = watchCanvasLoss(canvas, sync);
    sync();
    return () => {
      unsubscribe();
      stopWatchingLoss();
      if (request) {
        cancelAnimationFrame(request);
      }
    };
  }, [field]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="chart-smart-dust"
        style={{ left: offsetLeft, top: offsetTop, width, height }}
        aria-hidden
      />
      <SmartEqChip
        left={offsetLeft + (plotLeft + plotRight) / 2}
        top={offsetTop}
      />
    </>
  );
};

export default SmartEqDust;
