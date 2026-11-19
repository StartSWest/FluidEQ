/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import type { TSkyMeasurement } from '../graph/sceneSky';
import { nextCandidate, sceneColourCandidates } from './automaticColours';
import type { TWindowColourStop } from './sceneDayColours';

/** Where a press of Automatic stands. */
export type TColourFinding =
  | { kind: 'idle' }
  | { kind: 'looking' }
  | { kind: 'found' }
  /** Drawn, and nothing in it a window could take a colour from. */
  | { kind: 'none' }
  /** Not drawn at all. */
  | { kind: 'failed' };

const IDLE: TColourFinding = { kind: 'idle' };

/**
 * AUTOMATIC, PRESSED AS OFTEN AS SOMEBODY LIKES (Ivan, 2026-11-19: "it's not
 * like click once and it disables. No, that button is for always finding
 * colour"). Each press has the scene's picture at the open point `stop`
 * looked at by `scan` - drawn once, then remembered for the session - and
 * hands `apply` the set after the one the point wears among those the
 * picture gives (`sceneColourCandidates`, `nextCandidate`), so pressing
 * again lands on another of the scene's own colours.
 *
 * `subject` names what is being looked at (a scene and its version, a
 * Studio build): a press still drawing when it, or the open point, changes
 * hands nothing over, and what it found is not said of the new one.
 */
export default function useColourFinder({
  subject,
  stop,
  current,
  scan,
  apply,
}: {
  subject: string;
  stop: TWindowColourStop;
  current: ISceneWindowColours | undefined;
  scan: (() => Promise<TSkyMeasurement>) | undefined;
  apply: (colours: ISceneWindowColours) => void;
}) {
  const [finding, setFinding] = useState<TColourFinding>(IDLE);
  const asked = `${subject} ${stop}`;
  const askedRef = useRef(asked);
  // What the point wears when the drawing comes back, not when it was
  // asked for: the next press counts from there.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    askedRef.current = asked;
    setFinding(IDLE);
  }, [asked]);

  const find = useCallback(() => {
    if (!scan) {
      return;
    }
    const pressed = asked;
    setFinding({ kind: 'looking' });
    scan()
      .then((sky) => {
        if (askedRef.current !== pressed) {
          return undefined;
        }
        if (sky === undefined) {
          setFinding({ kind: 'failed' });
          return undefined;
        }
        const candidates = sky ? sceneColourCandidates(sky, stop) : [];
        const next = nextCandidate(candidates, currentRef.current);
        if (!next) {
          setFinding({ kind: 'none' });
          return undefined;
        }
        apply(next.colours);
        setFinding({ kind: 'found' });
        return undefined;
      })
      .catch((error: unknown) => {
        console.error(`Automatic could not look at "${pressed}":`, error);
        if (askedRef.current === pressed) {
          setFinding({ kind: 'failed' });
        }
      });
  }, [scan, asked, stop, apply]);

  return { finding, find, canFind: scan !== undefined };
}
