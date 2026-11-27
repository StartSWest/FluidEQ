/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { resolveBuiltInLook, type IResolvedLook } from 'common/customLooks';
import {
  getGraphLook,
  graphLookId,
  type GraphPalette,
  type GraphStyle,
} from 'common/graphStyles';
import {
  LiveAudioPicture,
  LiveAudioStandIn,
} from 'renderer/audio/LiveAudioContext';
import { createLiveFrameStore } from 'renderer/audio/liveFrameStore';
import LiveTraceCanvas, {
  type ILiveTraceDriver,
} from 'renderer/graph/LiveTraceCanvas';
import {
  prepareStillSong,
  stillSecondsOf,
  type IStillSong,
} from 'renderer/graph/lookStillSong';
import { drawnSizeOf } from 'renderer/graph/lookStills/drawnSize';
import usePlayerTrace from 'renderer/player/playerTrace';
import type { IBox } from '../protocol';

/**
 * A look drawn by the window's own renderer on the demo song, as the
 * picker's still painter draws it (`LookStillPainter`): the same song, the
 * same stretch of it, the same frames.
 */

interface IPainted {
  canvas: HTMLCanvasElement;
}

/**
 * The page's clock while a look is drawn: the song's, not the wall's. The
 * song plays many times faster than it would be heard, and what reads the
 * wall clock in a drawing - the stereo views' channel readers, which read
 * again only once a few milliseconds have passed (`useAnalysisChannels`),
 * a look's fade in - read a different number of times each drawing: Mid/Side
 * came out a different picture every time, and could not be split into its
 * colours. On the song's clock each frame is a frame's time after the last,
 * the same every drawing, as it is when the look plays live.
 */
const wallNow = performance.now.bind(performance);
const clock = { running: false, at: 0 };
/** Where every drawing's clock starts: any fixed instant serves. */
const CLOCK_START = 1_000_000;
performance.now = () => (clock.running ? clock.at : wallNow());

const startSongClock = () => {
  clock.at = CLOCK_START;
  clock.running = true;
};
const stopSongClock = () => {
  clock.running = false;
};

/** The look drawn on the still's stretch of the demo song, then handed over. */
const Painter = ({
  look,
  width,
  height,
  onDone,
}: {
  look: IResolvedLook;
  width: number;
  height: number;
  onDone: (painted: IPainted | Error) => void;
}) => {
  const { curves, xScale, yScale } = usePlayerTrace(width, height);
  const [song, setSong] = useState<IStillSong>();
  const [driver, setDriver] = useState<ILiveTraceDriver>();
  useEffect(() => {
    const abort = new AbortController();
    prepareStillSong(stillSecondsOf(look.style), abort.signal)
      .then((prepared) =>
        prepared ? setSong(prepared) : onDone(new Error('No demo song.')),
      )
      .catch((error: unknown) => onDone(error as Error));
    return () => abort.abort();
  }, [look.style, onDone]);
  useEffect(() => {
    if (!song || !driver) {
      return;
    }
    const draw = async () => {
      await song.play((deltaMs) => {
        clock.at += deltaMs;
        driver.draw(deltaMs);
      });
      const canvas = driver.canvas();
      onDone(canvas ? { canvas } : new Error('No canvas.'));
    };
    draw().catch((error: unknown) => onDone(error as Error));
  }, [song, driver, onDone]);
  if (!song) {
    return null;
  }
  return (
    <LiveAudioStandIn standIn={song}>
      <LiveTraceCanvas
        picture={look}
        onDriver={setDriver}
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

const stage = document.createElement('div');
stage.style.cssText = 'position:fixed;left:0;top:0;overflow:hidden;';
document.body.appendChild(stage);
/** The drawing in progress gives up on whatever React could not render. */
let failPainting: ((error: Error) => void) | undefined;
const reactRoot = createRoot(stage, {
  onUncaughtError: (error) =>
    failPainting?.(error instanceof Error ? error : new Error(String(error))),
});
/**
 * No capture above the drawing, as in the app's Help figures: the still's
 * own song stands in under it (`LiveAudioStandIn`).
 */
/**
 * Drawings made so far: each new one a new painter, never the last one
 * handed new props. Counted, not timed - on the song's clock every drawing
 * starts at the same instant.
 */
let paintings = 0;

const NO_FRAMES = createLiveFrameStore({
  graphPoints: [],
  points: [],
  waveform: [],
  isClipping: false,
  outputLevels: [],
});

export const lookOf = (style: GraphStyle, palette: GraphPalette) =>
  resolveBuiltInLook(getGraphLook(graphLookId(style, palette)));

/**
 * Draws `look` in a plate of `box` CSS pixels and returns it at `out`
 * device pixels, unpremultiplied, shrunk the way the tile shrinks a look
 * drawn larger.
 */
export const paintLook = (look: IResolvedLook, box: IBox, out: IBox) =>
  new Promise<Uint8ClampedArray>((resolve, reject) => {
    const drawn = drawnSizeOf(look.style, box);
    stage.style.width = `${drawn.width}px`;
    stage.style.height = `${drawn.height}px`;
    const onDone = (painted: IPainted | Error) => {
      failPainting = undefined;
      stopSongClock();
      if (painted instanceof Error) {
        reactRoot.render(null);
        reject(painted);
        return;
      }
      const target = document.createElement('canvas');
      target.width = out.width;
      target.height = out.height;
      const context = target.getContext('2d', { willReadFrequently: true });
      if (!context) {
        reject(new Error('No 2D canvas.'));
        return;
      }
      context.imageSmoothingQuality = 'high';
      context.drawImage(painted.canvas, 0, 0, out.width, out.height);
      const { data } = context.getImageData(0, 0, out.width, out.height);
      reactRoot.render(null);
      resolve(data);
    };
    failPainting = onDone;
    paintings += 1;
    // From before the drawing mounts, so its first frame and its fade in
    // are on the song's clock too.
    startSongClock();
    reactRoot.render(
      <LiveAudioPicture frames={NO_FRAMES}>
        <Painter
          key={`${look.id}-${paintings}`}
          look={look}
          width={drawn.width}
          height={drawn.height}
          onDone={onDone}
        />
      </LiveAudioPicture>,
    );
  });
