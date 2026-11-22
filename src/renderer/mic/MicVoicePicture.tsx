/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab's voice picture (Ivan picked it, 2026-11-20): a strip that
 * scrolls with the voice, what reaches the mic faint behind, what others hear
 * bright in front, and the gate's threshold dashed across it. Between words
 * the faint bars are the room and the bright ones fall to nothing: the
 * picture is the cleaner and the gate at work.
 *
 * Levels on a decibel scale from -60 to 0 dBFS, where a voice and a room are
 * both visible; a linear scale put the room on the floor and the voice at
 * the top with nothing between.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import type { IMicLevel } from './useMicLevels';

const FLOOR_DB = -60;

const heightOf = (amplitude: number): number => {
  const db = amplitude > 1e-6 ? 20 * Math.log10(amplitude) : FLOOR_DB;
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
};

interface IMicVoicePictureProps {
  history: React.MutableRefObject<IMicLevel[]>;
  /** The gate's threshold, dBFS, while the gate is on. */
  gateDb: number | undefined;
}

const MicVoicePicture = ({ history, gateDb }: IMicVoicePictureProps) => {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const gate = useRef(gateDb);
  gate.current = gateDb;

  useEffect(() => {
    let animation = 0;
    const draw = () => {
      const element = canvas.current;
      const context = element?.getContext('2d');
      if (element && context) {
        const ratio = window.devicePixelRatio || 1;
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (
          element.width !== Math.round(width * ratio) ||
          element.height !== Math.round(height * ratio)
        ) {
          element.width = Math.round(width * ratio);
          element.height = Math.round(height * ratio);
        }
        const style = getComputedStyle(element);
        const colour = (name: string) => style.getPropertyValue(name).trim();
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        const mid = height / 2;
        const step = 4;
        const bar = 2.5;
        const columns = Math.floor(width / step);
        const levels = history.current;
        const from = Math.max(0, levels.length - columns);
        // Newest at the right edge, like any recorder's strip.
        const offset = columns - (levels.length - from);
        for (let index = from; index < levels.length; index += 1) {
          const level = levels[index];
          const x = (offset + index - from) * step;
          const raw = heightOf(level.input) * mid;
          const heard = heightOf(level.output) * mid;
          context.globalAlpha = 0.45;
          context.fillStyle = colour('--text-faint');
          context.fillRect(x, mid - raw, bar, Math.max(1, raw * 2));
          context.globalAlpha = 1;
          context.fillStyle = colour('--accent');
          context.fillRect(
            x + 0.5,
            mid - heard,
            bar - 1,
            Math.max(1, heard * 2),
          );
        }
        if (gate.current !== undefined) {
          const y = heightOf(10 ** (gate.current / 20)) * mid;
          context.strokeStyle = colour('--dsp-contrast');
          context.lineWidth = 1;
          context.setLineDash([4, 4]);
          context.beginPath();
          context.moveTo(0, mid - y);
          context.lineTo(width, mid - y);
          context.moveTo(0, mid + y);
          context.lineTo(width, mid + y);
          context.stroke();
          context.setLineDash([]);
        }
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [history]);

  return (
    // The figure carries the name: a canvas is interactive to the a11y
    // rules and cannot take a role of its own, and its key says the rest.
    <div
      className="mic-picture"
      role="figure"
      aria-label={t('mic.picture.label')}
    >
      <canvas ref={canvas} className="mic-picture__canvas" aria-hidden="true" />
      <div className="mic-picture__key">
        <span>
          <i className="mic-picture__swatch is-raw" aria-hidden="true" />
          {t('mic.picture.raw')}
        </span>
        <span>
          <i className="mic-picture__swatch is-heard" aria-hidden="true" />
          {t('mic.picture.heard')}
        </span>
        {gateDb !== undefined && (
          <span>
            <i className="mic-picture__swatch is-gate" aria-hidden="true" />
            {t('mic.picture.gate')}
          </span>
        )}
      </div>
    </div>
  );
};

export default MicVoicePicture;
