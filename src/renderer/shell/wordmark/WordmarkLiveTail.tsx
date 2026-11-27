/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useLayoutEffect, useRef, useState } from 'react';
import useReducedMotion from '../../utils/useReducedMotion';
import { TailInk, WORDMARK_SHAPE } from './WordmarkLetters';
import useWordmarkTail from './useWordmarkTail';
import { tailBoxStyle } from './wordmarkLayout';

const { box, tailWidth } = WORDMARK_SHAPE;

/**
 * The Q's tail running on as the live sound, wherever the name is drawn: the
 * main window's title bar (`HeaderWordmark`) and the amp's (`PlayerWordmark`).
 * Still under reduced motion.
 *
 * It is laid in the box the word is drawn in, and reads the word's drawn
 * size from that box: the pen's width where the tail leaves the Q follows the
 * word's height, which each bar sets for itself. Measured from its own parent
 * rather than handed a ref to it: a child's layout effect runs before its
 * parent's ref is attached, so a ref handed down is still empty when the
 * tail first measures, and the tail would start at its thinnest.
 */
export default function WordmarkLiveTail({ length }: { length: number }) {
  const tailRef = useRef<SVGPathElement>(null);
  const tailInk = `wordmark-tail-${useId().replace(/:/g, '')}`;
  const isStill = useReducedMotion();
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const word = tailRef.current?.ownerSVGElement?.parentElement;
    if (!word) {
      return undefined;
    }
    const measure = () => {
      const nextScale = word.getBoundingClientRect().height / box.height;
      setScale((previous) => (previous === nextScale ? previous : nextScale));
    };
    measure();
    // Absent in the jsdom the titlebar's tests run under (`useTitlebarRoom`
    // has the same guard).
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(word);
    return () => observer.disconnect();
  }, []);

  useWordmarkTail(
    tailRef,
    { length, startWidth: Math.max(1.5, tailWidth * scale) },
    isStill,
  );

  return (
    <svg
      className="header-wordmark__tail"
      style={tailBoxStyle(length)}
      aria-hidden="true"
    >
      <defs>
        <TailInk id={tailInk} />
      </defs>
      <path ref={tailRef} fill={`url(#${tailInk})`} />
    </svg>
  );
}
