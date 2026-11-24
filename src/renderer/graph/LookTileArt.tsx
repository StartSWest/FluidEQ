/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { IResolvedLook } from 'common/customLooks';
import type { GraphStyle } from 'common/graphStyles';
import {
  LiveAudioStandIn,
  type IAudioStandIn,
} from '../audio/LiveAudioContext';
import LookIcon from '../icons/LookIcon';
import usePlayerTrace from '../player/playerTrace';
import { prefersReducedMotion } from '../utils/bandReveal';
import { PANEL_MIN_DEPTH, PANEL_MIN_WIDTH } from './analysis/loudnessPanel';
import LiveTraceCanvas, { type ILiveTraceDriver } from './LiveTraceCanvas';
import LookStillPainter from './LookStillPainter';
import {
  useLookStill,
  useLookStillsUnavailable,
  useStillTurn,
} from './lookStillStore';
import { useTileGrid } from './LookStyleGrid';
import type { ILookTileLoop } from './lookTileLoop';
import { useTileSound } from './lookTileSound';

/**
 * A kept still serves a tile within this share of the width it was drawn
 * at: the grid's tiles grow and shrink with the window a few pixels at a
 * time, and a still painted again at every step would be the menu's whole
 * cost. Past it the picture is visibly soft or cramped, and is painted again.
 */
const STILL_SIZE_TOLERANCE = 0.25;

interface IDrawnSize {
  width: number;
  height: number;
  /** How much larger than the plate it is drawn; shrunk back by as much. */
  scale: number;
}

/**
 * The size a look is drawn at for a plate of `box`: the plate's own, unless
 * the look cannot draw itself that small. Stereo & loudness draws nothing
 * in a box under its panel's floor (`loudnessPanel.ts`) - a blank tile, at
 * rest and live - so it is drawn at that floor and shrunk to the plate.
 */
const drawnSizeOf = (
  style: GraphStyle,
  box: { width: number; height: number },
): IDrawnSize => {
  if (style !== 'loudness' || box.width === 0 || box.height === 0) {
    return { ...box, scale: 1 };
  }
  const scale = Math.max(
    1,
    PANEL_MIN_WIDTH / box.width,
    PANEL_MIN_DEPTH / box.height,
  );
  return {
    width: Math.ceil(box.width * scale),
    height: Math.ceil(box.height * scale),
    scale,
  };
};

/**
 * The look drawn live, small, on the sound the grid holds: its frames drawn
 * by the grid's one loop (`lookTileLoop.ts`), never a loop of its own.
 * `onFirstFrame` is told inside the animation frame that drew the first
 * one, so the still can give way before that frame is painted.
 */
const LookTileLive = ({
  look,
  sound,
  loop,
  width,
  height,
  onFirstFrame,
}: {
  look: IResolvedLook;
  sound: IAudioStandIn;
  loop: ILookTileLoop;
  width: number;
  height: number;
  onFirstFrame: () => void;
}) => {
  const { curves, xScale, yScale } = usePlayerTrace(width, height);
  const leaveRef = useRef<(() => void) | undefined>(undefined);
  const onFirstFrameRef = useRef(onFirstFrame);
  onFirstFrameRef.current = onFirstFrame;
  const onDriver = useCallback(
    (driver: ILiveTraceDriver | undefined) => {
      leaveRef.current?.();
      leaveRef.current = undefined;
      if (!driver) {
        return;
      }
      let drawn = false;
      leaveRef.current = loop.add({
        ...driver,
        draw: (deltaMs) => {
          driver.draw(deltaMs);
          if (!drawn) {
            drawn = true;
            onFirstFrameRef.current();
          }
        },
      });
    },
    [loop],
  );
  return (
    <LiveAudioStandIn standIn={sound}>
      <LiveTraceCanvas
        picture={look}
        onDriver={onDriver}
        curves={curves}
        xScale={xScale}
        yScale={yScale}
        width={width}
        height={height}
        offsetLeft={0}
        offsetTop={0}
        isForeground
        hasKey={false}
      />
    </LiveAudioStandIn>
  );
};

/**
 * The plate's size in CSS pixels, followed as the grid reflows, and whether
 * it is in the picker's scroller.
 */
const usePlate = () => {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [inView, setInView] = useState(false);
  const { watch } = useTileGrid();
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setBox((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = ref.current;
    return element ? watch(element, setInView) : undefined;
  }, [watch]);
  return { ref, box, inView };
};

/**
 * A standard look's picture in the look picker: the look itself, live, while
 * its tile is in the picker's scroller (`LookStyleGrid`), and a still of it
 * otherwise - under reduced motion, before the sound is there, in a picture
 * of the picker with no capture behind it.
 *
 * NOTHING BLINKS (Ivan's standing rule: nothing in the UI moves or flickers
 * as data arrives). The plate holds its size from the first frame. A tile
 * goes live only from its still, never from an empty plate or an icon; the
 * live drawing arrives whole (`LiveTraceCanvas`'s `picture`) and the still
 * is hidden inside the very animation frame that drew it, so the two are
 * never both on screen and never both off it; and the still is back before
 * the frame that takes the drawing away is painted. A still painted while
 * the tile is open fades into the empty plate, as a scene's clip does; one
 * already kept is there from the first frame. The icon stands only where no
 * still can be had at all (no demo song, no offline audio).
 */
const LookTileArt = ({ look }: { look: IResolvedLook }) => {
  const { ref, box, inView } = usePlate();
  const { loop, paintKey } = useTileGrid();
  const sound = useTileSound();
  const stillKey = useMemo(
    () => `${JSON.stringify(look)}|${paintKey}`,
    [look, paintKey],
  );
  const still = useLookStill(stillKey);
  // The picture on the plate: this look's still in these colours, or until
  // that is painted the one shown before it. New window colours name new
  // stills, and a plate grown past its still asks for another: both are
  // painted behind the one on the plate, which never goes blank and keeps
  // the look live meanwhile.
  const shownRef = useRef(still);
  shownRef.current = still ?? shownRef.current;
  const picture = shownRef.current;
  const unavailable = useLookStillsUnavailable();
  // A still that arrives after the tile is up fades in, and the look goes
  // live only once it is in; one kept is simply there.
  const [arriving] = useState(picture === undefined);
  const [stillIn, setStillIn] = useState(!arriving);
  const stillRef = useRef<HTMLImageElement>(null);
  const drawn = drawnSizeOf(look.style, box);
  const fits =
    still !== undefined &&
    Math.abs(still.width - drawn.width) <= drawn.width * STILL_SIZE_TOLERANCE;
  const live =
    inView &&
    sound !== undefined &&
    loop !== undefined &&
    box.width > 0 &&
    ((picture !== undefined && stillIn) || unavailable) &&
    !prefersReducedMotion();
  // A still is painted only for a tile in view that has none fitting: one
  // scrolled out of the picker is painted when it comes into it.
  const { mine, done } = useStillTurn(
    box.width > 0 && inView && !fits && !unavailable,
  );
  // Shown again in the commit that takes the drawing away, before it paints.
  useLayoutEffect(() => {
    if (!live && stillRef.current) {
      stillRef.current.style.visibility = '';
    }
  }, [live]);
  const hideStill = useCallback(() => {
    if (stillRef.current) {
      stillRef.current.style.visibility = 'hidden';
    }
  }, []);
  // Where the drawing stands: the plate, or a larger box shrunk onto it.
  const stage = {
    width: drawn.width,
    height: drawn.height,
    ...(drawn.scale > 1 ? { transform: `scale(${1 / drawn.scale})` } : {}),
  };

  return (
    <span ref={ref} className="look-tile-art">
      {picture && (
        <img
          ref={stillRef}
          className={`look-tile-art__still${arriving ? ' is-arriving' : ''}`}
          onAnimationEnd={() => setStillIn(true)}
          src={picture.url}
          alt=""
          draggable={false}
        />
      )}
      {!picture && unavailable && !live && (
        <LookIcon
          className="look-picker__drawing"
          style={look.style}
          palette={look.palette}
          colours={look.colours}
        />
      )}
      {mine && !fits && (
        <span className="look-tile-art__stage" style={stage}>
          <LookStillPainter
            look={look}
            stillKey={stillKey}
            width={drawn.width}
            height={drawn.height}
            onDone={done}
          />
        </span>
      )}
      {live && sound && loop && (
        <span className="look-tile-art__stage" style={stage}>
          <LookTileLive
            look={look}
            sound={sound}
            loop={loop}
            width={drawn.width}
            height={drawn.height}
            onFirstFrame={hideStill}
          />
        </span>
      )}
    </span>
  );
};

export default LookTileArt;
