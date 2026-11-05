/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';

/** What a meter shows now: how full, and the figure beside it. */
export interface IGameMeterReading {
  /** 0 to 1. */
  fill: number;
  figure: string;
}

interface IDspGameMeterProps {
  label: string;
  /** Read in the frame loop; nothing while the engine has nothing to say. */
  read: () => IGameMeterReading | undefined;
  /** Which part's ink: the voice's or the environment's. */
  tone: 'voice' | 'ambience';
}

/** How long the fill takes to fall once its reading drops, ms. */
const RELEASE_MS = 350;

/**
 * One live reading of the Game filter, as a lamp that fills: how sure it is
 * someone is speaking, how much of the sound is the game's environment.
 *
 * Painted straight onto the elements in the frame loop, as the Footsteps
 * lamps are, so a reading twenty-three times a second is never a React
 * render; it rises at once and falls over a third of a second, so a word is
 * seen and the gap after it does not flicker.
 */
const DspGameMeter = ({ label, read, tone }: IDspGameMeterProps) => {
  const fill = useRef<HTMLSpanElement | null>(null);
  const figure = useRef<HTMLSpanElement | null>(null);
  const reader = useRef(read);
  reader.current = read;
  const held = useRef(0);
  const lastFrame = useRef(0);

  useEffect(() => {
    const paint = ({ schedule }: IGraphLoopFrame) => {
      const now = performance.now();
      const dt = Math.min(100, Math.max(0, now - lastFrame.current));
      lastFrame.current = now;
      const reading = reader.current();
      const target = Math.min(1, Math.max(0, reading?.fill ?? 0));
      const ease = 1 - Math.exp(-dt / RELEASE_MS);
      const was = held.current;
      held.current = target > was ? target : was + (target - was) * ease;
      if (held.current < 0.01) {
        held.current = 0;
      }
      if (fill.current) {
        fill.current.style.transform = `scaleX(${held.current})`;
      }
      const text = reading?.figure ?? '';
      if (figure.current && figure.current.textContent !== text) {
        figure.current.textContent = text;
      }
      // The loop sleeps while nothing plays; a fill falling asks for frames.
      if (held.current > 0) {
        schedule();
      }
    };
    const loop = startGraphLoop(paint, {
      onEngineGone: () => {
        held.current = 0;
      },
    });
    loop.schedule();
    return () => loop.stop();
  }, []);

  return (
    <div className={`dsp-footsteps-lamp dsp-game-meter is-${tone}`}>
      <span className="dsp-footsteps-lamp-name">{label}</span>
      <span className="dsp-footsteps-lamp-track" aria-hidden="true">
        <span className="dsp-footsteps-lamp-fill" ref={fill} />
      </span>
      <span className="dsp-footsteps-lamp-figure" ref={figure} />
    </div>
  );
};

export default DspGameMeter;
