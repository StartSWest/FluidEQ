/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The low cut, live (mockup A, Ivan's pick 2026-11-23): the voice as it
 * arrives, before the cut (engine 1.32's arrival tap), with what the cut and
 * the proximity shelf take from it hatched away and what is kept in the
 * voice's colour; the cut's own curve over it, and its dot to drag.
 *
 * What is kept is the arrival times the cut's response, not a second tap:
 * both filters are fixed (a 12 dB/oct Butterworth high-pass and a shelf at
 * 180 Hz, `voice.cpp`), built by the engine with the cookbook the main
 * graph already draws, and the arrival tap's long window is the one reading
 * fine enough under 300 Hz to show the hum, the rumble and the voice's
 * lowest note apart. A tap after the cut would need that window too, for a
 * picture that could only say the same thing. The pop guard acts on pops
 * alone and is not drawn.
 */

import { useEffect, useRef } from 'react';
import type { IVoiceSettings } from '../../common/dsp/voiceStage';
import { FilterTypeEnum } from '../../common/constants';
import { VOICE_RANGES } from '../../common/dsp/voiceStage';
import signedTick from '../graph/signedTick';
import { cookbookGain } from '../graph/utils';
import { createEqSpectrum } from '../dsp/dspEqSpectrum';
import { spectrumInk } from '../dsp/dspInks';
import { startGraphLoop } from '../dsp/graphLoop';
import { readDspAnalyser, readDspSampleRate } from '../dsp/store';
import { readInk, readSurface, readTextInk } from '../utils/theme';
import { useTranslation } from '../utils/I18nContext';
import {
  fitMicCanvas,
  haloText,
  hzOfX,
  IMicPlot,
  MIC_PLOT_FONT,
  TAKEN_INK,
  xOfHz,
  yOfDb,
} from './micPlot';
import { createLowestNote, voicePitch } from './micPitch';

const LOW_HZ = 20;
const HIGH_HZ = 20000;
const TOP_DB = 0;
const FLOOR_DB = -110;
const GRID_DB = [-20, -40, -60, -80, -100];
const GRID_HZ: [number, string][] = [
  [50, '50'],
  [100, '100'],
  [200, '200'],
  [500, '500'],
  [1000, '1k'],
  [2000, '2k'],
  [5000, '5k'],
  [10000, '10k'],
];
const PADS = { left: 0, top: 8, right: 0, bottom: 16 };
/**
 * Where the cut's curve stands: its 0 dB this far under the plot's top, so
 * the curve runs along the head of the picture and drops where it cuts.
 */
const CURVE_TOP_DB = -6;
/** How near the dot a press takes hold of it, CSS pixels. */
const GRAB_PX = 14;
/** The rumble is reckoned up to twice the corner. */
const RUMBLE_SPAN = 2;
/** The high-pass's slope: 12 dB/oct, Butterworth (`voice.h`). */
const SLOPE_DB = 12;
/** `FEQ_VOICE_PROXIMITY_HZ`: where "Close to the mic" shelves. */
const PROXIMITY_HZ = 180;
/** A third of an octave, and how far hum must stand over it to be named. */
const THIRD = 2 ** (1 / 3);
const HUM_LIFT_DB = 8;

interface IPoint {
  px: number;
  arrive: number;
  kept: number;
}

/** The point nearest a pixel, the points running left to right. */
const nearestPoint = (points: readonly IPoint[], px: number): IPoint => {
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].px < px) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return Math.abs(points[low].px - px) <= Math.abs(points[high].px - px)
    ? points[low]
    : points[high];
};

interface IMicLowCutLiveProps {
  voice: IVoiceSettings;
  /** The card's switch: cut, shelf or pop guard on. */
  on: boolean;
  /** The engine answering on this mic. */
  live: boolean;
  onCut: (hz: number) => void;
  onCommit: () => void;
}

/** The two fixed filters' response, dB, at a stream's rate. */
const responseOf = (voice: IVoiceSettings, on: boolean, rate: number) => {
  if (!on) {
    return () => 0;
  }
  const cut =
    voice.lowCutHz > 0
      ? cookbookGain(
          {
            type: FilterTypeEnum.HPQ,
            frequency: Math.min(voice.lowCutHz, rate * 0.45),
            gain: 0,
            quality: Math.SQRT1_2,
          },
          rate,
        )
      : () => 0;
  const shelf =
    voice.proximityDb > 0
      ? cookbookGain(
          {
            type: FilterTypeEnum.LSC,
            frequency: PROXIMITY_HZ,
            gain: -voice.proximityDb,
            quality: Math.SQRT1_2,
          },
          rate,
        )
      : () => 0;
  return (hz: number) => cut(hz) + shelf(hz);
};

const MicLowCutLive = ({
  voice,
  on,
  live,
  onCut,
  onCommit,
}: IMicLowCutLiveProps) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const taken = useRef<HTMLElement>(null);
  const note = useRef<HTMLElement>(null);
  const noteReading = useRef<HTMLSpanElement>(null);
  const plotRef = useRef<IMicPlot | undefined>(undefined);
  const dragging = useRef(false);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const settings = useRef({ voice, on, live });
  settings.current = { voice, on, live };
  const words = useRef({ chip: '', hum50: '', hum60: '' });
  words.current = {
    chip: t('mic.lowCut.live.chip', {
      hz: Math.round(voice.lowCutHz),
      slope: SLOPE_DB,
    }),
    hum50: t('mic.lowCut.live.hum', { hz: 50 }),
    hum60: t('mic.lowCut.live.hum', { hz: 60 }),
  };

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) {
      return undefined;
    }
    const spectrum = createEqSpectrum();
    const lowest = createLowestNote();
    let pitchFrom: Float32Array | undefined;
    let hatch: { ink: string; pattern: CanvasPattern | null } | undefined;

    const loop = startGraphLoop(({ schedule }) => {
      const plot = fitMicCanvas(element, context, PADS);
      plotRef.current = plot;
      if (!plot) {
        schedule();
        return;
      }
      const { voice: shown, on: isOn, live: isLive } = settings.current;
      const rate = readDspSampleRate();
      const high = Math.min(HIGH_HZ, rate / 2);
      const x = (hz: number) => xOfHz(plot, hz, LOW_HZ, high);
      const y = (db: number) => yOfDb(plot, db, TOP_DB, FLOOR_DB);
      const response = responseOf(shown, isOn, rate);
      const textInk = readTextInk();
      const applied = TAKEN_INK;
      const voiceInk = spectrumInk();
      context.font = MIC_PLOT_FONT;

      // The grid, its levels on the right and its frequencies under it.
      context.strokeStyle = readInk(0.06);
      context.lineWidth = 1;
      context.fillStyle = textInk;
      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        if (hz >= high) {
          return;
        }
        const at = Math.round(x(hz)) + 0.5;
        context.beginPath();
        context.moveTo(at, plot.top);
        context.lineTo(at, plot.bottom);
        context.stroke();
        context.fillText(label, at, plot.height - 3);
      });
      context.textAlign = 'right';
      GRID_DB.forEach((db) => {
        const at = Math.round(y(db)) + 0.5;
        context.beginPath();
        context.moveTo(plot.left, at);
        context.lineTo(plot.right, at);
        context.stroke();
        context.fillText(`${signedTick(db)}`, plot.right - 3, at - 3);
      });

      const cutX = x(shown.lowCutHz > 0 ? shown.lowCutHz : LOW_HZ);
      if (isOn && shown.lowCutHz > 0) {
        context.fillStyle = `rgba(${applied}, 0.05)`;
        context.fillRect(
          plot.left,
          plot.top,
          cutX - plot.left,
          plot.bottom - plot.top,
        );
      }

      const analyser = readDspAnalyser('voiceIn');
      // Up to twice the corner, or twice the shelf's when only it is on.
      const rumbleTop =
        RUMBLE_SPAN * (shown.lowCutHz > 0 ? shown.lowCutHz : PROXIMITY_HZ);
      let rumbleIn = 0;
      let rumbleKept = 0;
      if (analyser && isLive) {
        const { axis, levels } = spectrum.read(analyser, rate);
        const points: IPoint[] = [];
        for (let index = 0; index < axis.length; index += 1) {
          const hz = axis[index];
          if (hz >= LOW_HZ && hz <= high && Number.isFinite(levels[index])) {
            const cut = response(hz);
            points.push({
              px: x(hz),
              arrive: levels[index],
              kept: levels[index] + cut,
            });
            if (hz <= rumbleTop) {
              rumbleIn += 10 ** (levels[index] / 10);
              rumbleKept += 10 ** ((levels[index] + cut) / 10);
            }
          }
        }
        if (points.length > 1) {
          // What the cut takes: between the voice as it arrives and as kept.
          if (!hatch || hatch.ink !== applied) {
            const tile = document.createElement('canvas');
            tile.width = 6;
            tile.height = 6;
            const pen = tile.getContext('2d');
            if (pen) {
              pen.fillStyle = `rgba(${applied}, 0.12)`;
              pen.fillRect(0, 0, 6, 6);
              pen.strokeStyle = `rgba(${applied}, 0.6)`;
              pen.lineWidth = 1.5;
              pen.beginPath();
              pen.moveTo(-1, 7);
              pen.lineTo(7, -1);
              pen.stroke();
            }
            hatch = {
              ink: applied,
              pattern: context.createPattern(tile, 'repeat'),
            };
          }
          context.beginPath();
          points.forEach((point, index) => {
            if (index === 0) {
              context.moveTo(point.px, y(point.arrive));
            } else {
              context.lineTo(point.px, y(point.arrive));
            }
          });
          for (let index = points.length - 1; index >= 0; index -= 1) {
            context.lineTo(points[index].px, y(points[index].kept));
          }
          context.closePath();
          context.fillStyle = hatch.pattern ?? `rgba(${applied}, 0.25)`;
          context.fill();

          // What is kept, as the voice's own area.
          context.beginPath();
          points.forEach((point, index) => {
            if (index === 0) {
              context.moveTo(point.px, y(point.kept));
            } else {
              context.lineTo(point.px, y(point.kept));
            }
          });
          context.strokeStyle = `rgba(${voiceInk}, 0.95)`;
          context.lineWidth = 1.3;
          context.stroke();
          context.lineTo(points[points.length - 1].px, plot.bottom);
          context.lineTo(points[0].px, plot.bottom);
          context.closePath();
          context.fillStyle = `rgba(${voiceInk}, 0.26)`;
          context.fill();

          // Mains hum, named where it stands a third of an octave clear of
          // what is either side of it.
          const at = (hz: number) => nearestPoint(points, x(hz));
          (
            [
              [50, words.current.hum50],
              [60, words.current.hum60],
            ] as const
          ).forEach(([mains, label]) => {
            const peak = at(mains);
            const beside = Math.max(
              at(mains / THIRD).arrive,
              at(mains * THIRD).arrive,
            );
            if (peak.arrive - beside > HUM_LIFT_DB) {
              // In the text's ink: orange on the orange hatching vanished.
              context.font = `600 ${MIC_PLOT_FONT}`;
              context.fillStyle = readInk(0.9);
              context.textAlign = 'center';
              haloText(
                context,
                label,
                peak.px,
                Math.max(plot.top + 10, y(peak.arrive) - 6),
              );
              context.font = MIC_PLOT_FONT;
            }
          });
        }

        // The voice's fundamental, once per long window: a frame without one
        // keeps the last, and the same moment read twice would count twice.
        const long = analyser.live;
        if (long?.detail && long.detail !== pitchFrom) {
          pitchFrom = long.detail;
          lowest.add(
            performance.now(),
            voicePitch(long.detail, rate / long.detailWindow),
          );
        }
      } else if (!isLive) {
        lowest.reset();
      }

      // The cut's curve over the voice, and its dot.
      if (isOn) {
        context.beginPath();
        for (let px = plot.left; px <= plot.right; px += 2) {
          const hz = hzOfX(plot, px, LOW_HZ, high);
          const at = y(CURVE_TOP_DB + response(hz));
          if (px === plot.left) {
            context.moveTo(px, at);
          } else {
            context.lineTo(px, at);
          }
        }
        context.strokeStyle = readInk(dragging.current ? 1 : 0.85);
        context.lineWidth = 2;
        context.stroke();
      }
      if (isOn && shown.lowCutHz > 0) {
        const dotY = y(CURVE_TOP_DB + response(shown.lowCutHz));
        context.setLineDash([3, 3]);
        context.strokeStyle = readInk(0.35);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(Math.round(cutX) + 0.5, dotY);
        context.lineTo(Math.round(cutX) + 0.5, plot.bottom);
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.arc(cutX, dotY, dragging.current ? 7.5 : 6.5, 0, Math.PI * 2);
        context.fillStyle = readSurface('--surface-panel', '#10161c');
        context.fill();
        context.strokeStyle = readInk(0.9);
        context.lineWidth = 2.2;
        context.stroke();
        context.font = `600 ${MIC_PLOT_FONT}`;
        context.fillStyle = readInk(0.9);
        // Beside the dot, on whichever side has the room.
        const label = words.current.chip;
        const { width } = context.measureText(label);
        const right = cutX + 12 + width <= plot.right;
        context.textAlign = right ? 'left' : 'right';
        haloText(context, label, right ? cutX + 12 : cutX - 12, dotY + 16);
        context.font = MIC_PLOT_FONT;
      }

      // The readouts beside it.
      if (taken.current) {
        taken.current.textContent =
          isLive && isOn && rumbleIn > 0
            ? `${signedTick(Math.round(10 * Math.log10(Math.max(1e-12, rumbleKept / rumbleIn))))} dB`
            : '—';
      }
      const lowestHz = lowest.read(performance.now());
      if (note.current) {
        note.current.textContent =
          lowestHz === undefined ? '—' : `${Math.round(lowestHz)} Hz`;
      }
      noteReading.current?.classList.toggle(
        'is-over',
        lowestHz !== undefined && isOn && shown.lowCutHz > lowestHz,
      );
    });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, []);

  redraw.current?.();

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const plot = plotRef.current;
    if (!plot) {
      return undefined;
    }
    const box = event.currentTarget.getBoundingClientRect();
    return { plot, x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const near = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const at = pointAt(event);
    // No dot to take hold of while the corner is off (the shelf alone).
    if (!at || !on || voice.lowCutHz <= 0) {
      return false;
    }
    const high = Math.min(HIGH_HZ, readDspSampleRate() / 2);
    const cutX = xOfHz(at.plot, voice.lowCutHz, LOW_HZ, high);
    return Math.abs(at.x - cutX) <= GRAB_PX;
  };

  const follow = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const at = pointAt(event);
    if (!at) {
      return;
    }
    const high = Math.min(HIGH_HZ, readDspSampleRate() / 2);
    const { min, max } = VOICE_RANGES.lowCutHz;
    const hz = Math.round(hzOfX(at.plot, at.x, LOW_HZ, high));
    onCut(Math.min(max, Math.max(min, hz)));
  };

  return (
    <div
      className="dsp-band mic-live-picture"
      role="figure"
      aria-label={t('mic.lowCut.live.label')}
    >
      <div className="dsp-band-head mic-live-picture__head">
        <span className="dsp-band-title">{t('mic.lowCut.live.title')}</span>
        <span className="mic-live-picture__key" aria-hidden="true">
          <span>
            <i className="mic-live-picture__swatch is-voice" />
            {t('mic.lowCut.live.keyKept')}
          </span>
          <span>
            <i className="mic-live-picture__swatch is-taken" />
            {t('mic.lowCut.live.keyTaken')}
          </span>
          <span>
            <i className="mic-live-picture__rule is-curve" />
            {t('mic.lowCut.live.keyCut')}
          </span>
        </span>
      </div>
      <canvas
        ref={canvas}
        className="mic-live-picture__canvas"
        aria-hidden="true"
        onPointerDown={(event) => {
          if (!near(event)) {
            return;
          }
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          follow(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) {
            follow(event);
            return;
          }
          event.currentTarget.style.cursor = near(event) ? 'ew-resize' : '';
        }}
        onPointerUp={(event) => {
          if (!dragging.current) {
            return;
          }
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
          onCommit();
        }}
        onPointerCancel={() => {
          if (!dragging.current) {
            return;
          }
          dragging.current = false;
          onCommit();
        }}
      />
      <div className="mic-live-picture__readouts">
        <span className="mic-live-picture__reading">
          <span>{t('mic.lowCut.live.taken')}</span>
          <strong ref={taken} className="is-taken">
            —
          </strong>
        </span>
        <span ref={noteReading} className="mic-live-picture__reading">
          <span>{t('mic.lowCut.live.lowest')}</span>
          <strong ref={note}>—</strong>
        </span>
        <span className="dsp-band-hint mic-live-picture__hint">
          {t('mic.lowCut.live.hint')}
        </span>
      </div>
    </div>
  );
};

export default MicLowCutLive;
