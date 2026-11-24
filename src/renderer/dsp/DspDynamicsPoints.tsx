/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  DYNAMICS_RANGES,
  type IDynamicsBand,
} from '../../common/dsp/dynamicsStage';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import DspDynamicsTag from './DspDynamicsTag';
import { onPlot, type IDynamicsPlot } from './dynamicsPlot';
import {
  dragOf,
  dragPoint,
  isPointKey,
  pointAt,
  pointsOf,
  stepPoint,
  type TDynamicsDrag,
  type TDynamicsPoint,
} from './dynamicsPoints';

interface IProps {
  band: IDynamicsBand;
  plot: IDynamicsPlot;
  bandName: string;
  isDisabled: boolean;
  onBand: (next: IDynamicsBand) => void;
  onCommit: () => void;
}

interface IDragging {
  drag: TDynamicsDrag;
  /** Where on the point the hand landed, so the point does not jump to it. */
  offsetIn: number;
  offsetOut: number;
}

const NAME: Record<TDynamicsDrag, TranslationKey> = {
  liftStart: 'dsp.dynamics.point.liftStart',
  liftTop: 'dsp.dynamics.point.liftTop',
  liftPull: 'dsp.dynamics.point.liftPull',
  holdStart: 'dsp.dynamics.point.holdStart',
  holdEnd: 'dsp.dynamics.point.holdEnd',
};

const sameBand = (a: IDynamicsBand, b: IDynamicsBand) =>
  a.upThresholdDb === b.upThresholdDb &&
  a.upRatio === b.upRatio &&
  a.upMaxDb === b.upMaxDb &&
  a.downThresholdDb === b.downThresholdDb &&
  a.downRatio === b.downRatio;

const db = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}`;
const ratio = (value: number) => value.toFixed(1);

/** A point's value in words, for its tag and for assistive technology. */
const useValueText = () => {
  const { t } = useTranslation();
  return (drag: TDynamicsDrag, band: IDynamicsBand): string => {
    switch (drag) {
      case 'liftStart':
        return `${t('dsp.dynamics.upThreshold')} ${db(band.upThresholdDb)} dB`;
      case 'liftTop':
        return `${ratio(band.upRatio)}:1 · ${t('dsp.dynamics.upMax')} ${db(
          band.upMaxDb,
        )} dB`;
      case 'liftPull':
        return `${t('dsp.dynamics.upThreshold')} ${db(
          band.upThresholdDb,
        )} dB · ${t('dsp.dynamics.upMax')} 0 dB`;
      case 'holdStart':
        return `${t('dsp.dynamics.downThreshold')} ${db(
          band.downThresholdDb,
        )} dB`;
      default:
        return `${t('dsp.dynamics.downRatio')} ${ratio(band.downRatio)}:1`;
    }
  };
};

/** The value a point's slider reports, and its range. */
const valueOf = (drag: TDynamicsDrag, band: IDynamicsBand) => {
  const r = DYNAMICS_RANGES;
  switch (drag) {
    case 'liftStart':
      return { now: band.upThresholdDb, ...r.upThresholdDb };
    case 'liftTop':
      return { now: band.upMaxDb, ...r.upMaxDb };
    case 'liftPull':
      return { now: 0, ...r.upMaxDb };
    case 'holdStart':
      return { now: band.downThresholdDb, ...r.downThresholdDb };
    default:
      return { now: band.downRatio, ...r.downRatio };
  }
};

/** Hollow where a band starts, filled for how hard; dashed while idle. */
const shapeOf = (drag: TDynamicsDrag, band: IDynamicsBand) => {
  if (drag === 'liftPull') {
    return 'is-pull';
  }
  if (drag === 'holdStart' && band.downRatio <= 1) {
    return 'is-start is-idle';
  }
  return drag === 'liftStart' || drag === 'holdStart' ? 'is-start' : 'is-end';
};

/**
 * The points on a band's curve, each a slider: pressed and dragged it sets
 * the values it is named for, and from the keyboard the arrows step the same
 * values the drag moves (`dynamicsPoints`). A tag beside the point says the
 * values while it is in hand.
 */
const DspDynamicsPoints = ({
  band,
  plot,
  bandName,
  isDisabled,
  onBand,
  onCommit,
}: IProps) => {
  const { t } = useTranslation();
  const valueText = useValueText();
  const latest = useRef({ band, plot, onBand });
  latest.current = { band, plot, onBand };
  const dragging = useRef<IDragging | undefined>(undefined);
  const [held, setHeld] = useState<TDynamicsPoint>();
  const [focused, setFocused] = useState<TDynamicsPoint>();
  const [byKeys, setByKeys] = useState(false);

  const levelAt = (event: PointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    const p = latest.current.plot;
    // The drawing is laid out at its own size, so a box that reads zero
    // (an element not laid out) scales by one rather than by nothing.
    const scaleX = box && box.width > 0 ? p.width / box.width : 1;
    const scaleY = box && box.height > 0 ? p.height / box.height : 1;
    return {
      inDb: p.inAt((event.clientX - (box?.left ?? 0)) * scaleX),
      outDb: p.outAt((event.clientY - (box?.top ?? 0)) * scaleY),
    };
  };

  const send = (next: IDynamicsBand | undefined) => {
    if (next && !sameBand(next, latest.current.band)) {
      latest.current.onBand(next);
    }
  };

  const onPointerDown =
    (point: TDynamicsPoint) => (event: PointerEvent<SVGGElement>) => {
      if (isDisabled || event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
      const at = pointAt(point, band);
      const hand = levelAt(event);
      dragging.current = {
        drag: dragOf(point, band),
        offsetIn: hand.inDb - at.inDb,
        offsetOut: hand.outDb - at.outDb,
      };
      setByKeys(false);
      setHeld(point);
    };

  const onPointerMove = (event: PointerEvent<SVGGElement>) => {
    const drag = dragging.current;
    if (!drag) {
      return;
    }
    const hand = levelAt(event);
    send(
      dragPoint(
        drag.drag,
        latest.current.band,
        hand.inDb - drag.offsetIn,
        hand.outDb - drag.offsetOut,
      ),
    );
  };

  const onPointerEnd = () => {
    if (!dragging.current) {
      return;
    }
    dragging.current = undefined;
    setHeld(undefined);
    onCommit();
  };

  const onKeyDown =
    (point: TDynamicsPoint) => (event: KeyboardEvent<SVGGElement>) => {
      if (isDisabled || !isPointKey(event.key)) {
        return;
      }
      const next = stepPoint(
        dragOf(point, band),
        band,
        event.key,
        event.shiftKey,
      );
      if (next) {
        event.preventDefault();
        setByKeys(true);
        send(next);
      }
    };

  const onKeyUp = (event: KeyboardEvent<SVGGElement>) => {
    if (!isDisabled && isPointKey(event.key)) {
      onCommit();
    }
  };

  const points = pointsOf(band);
  const tagged = held ?? (byKeys ? focused : undefined);

  return (
    <g className="dsp-dynamics-points">
      {points.map((point) => {
        const drag = dragOf(point, band);
        const at = pointAt(point, band);
        const { x, y } = onPlot(plot, at.inDb, at.outDb);
        const value = valueOf(drag, band);
        return (
          <g
            key={point}
            role="slider"
            tabIndex={isDisabled ? -1 : 0}
            aria-label={`${bandName} · ${t(NAME[drag])}`}
            aria-valuenow={value.now}
            aria-valuemin={value.min}
            aria-valuemax={value.max}
            aria-valuetext={valueText(drag, band)}
            aria-disabled={isDisabled || undefined}
            className={`dsp-dynamics-point ${shapeOf(drag, band)}${
              held === point ? ' is-held' : ''
            }`}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
            onPointerDown={onPointerDown(point)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onLostPointerCapture={onPointerEnd}
            onKeyDown={onKeyDown(point)}
            onKeyUp={onKeyUp}
            onFocus={() => setFocused(point)}
            onBlur={() => {
              setFocused(undefined);
              setByKeys(false);
            }}
          >
            <circle className="dsp-dynamics-point__reach" r="12" />
            <circle className="dsp-dynamics-point__halo" r="11" />
            <circle className="dsp-dynamics-point__mark" r="5" />
          </g>
        );
      })}
      {tagged && points.includes(tagged) ? (
        <DspDynamicsTag
          plot={plot}
          at={pointAt(tagged, band)}
          text={valueText(dragOf(tagged, band), band)}
        />
      ) : null}
    </g>
  );
};

export default DspDynamicsPoints;
