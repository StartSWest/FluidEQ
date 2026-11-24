/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { IResolvedLook } from 'common/customLooks';
import { LiveAudioStandIn } from '../audio/LiveAudioContext';
import usePlayerTrace from '../player/playerTrace';
import LiveTraceCanvas, { type ILiveTraceDriver } from './LiveTraceCanvas';
import { keepLookStill, markLookStillsUnavailable } from './lookStillStore';
import {
  prepareStillSong,
  stillSecondsOf,
  type IStillSong,
} from './lookStillSong';

interface ILookStillPainterProps {
  look: IResolvedLook;
  /** What the still is kept under (`lookStillStore.ts`). */
  stillKey: string;
  width: number;
  height: number;
  /** The turn is over: a still kept, or none to be had. */
  onDone: () => void;
}

/**
 * Paints one look's still picture for the look picker: the graph's own
 * renderer (`LiveTraceCanvas`), handed the demo song played offline
 * (`lookStillSong.ts`) and told to draw a frame at each of its moments, then
 * the canvas kept as a picture. Hidden while it paints - the song runs many
 * times faster than it plays, and three seconds of a look in a blink is
 * nothing to show - and gone once its picture is kept.
 */
const LookStillPainter = ({
  look,
  stillKey,
  width,
  height,
  onDone,
}: ILookStillPainterProps) => {
  const { curves, xScale, yScale } = usePlayerTrace(width, height);
  const [run, setRun] = useState<{ song: IStillSong; signal: AbortSignal }>();
  const [driver, setDriver] = useState<ILiveTraceDriver>();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // What the picture is kept as, read when it is done rather than started:
  // the tile may have been resized in between.
  const keptRef = useRef({ stillKey, width });
  keptRef.current = { stillKey, width };

  useEffect(() => {
    const abort = new AbortController();
    const { signal } = abort;
    const prepare = async () => {
      const song = await prepareStillSong(stillSecondsOf(look.style), signal);
      if (signal.aborted) {
        return;
      }
      if (song) {
        setRun({ song, signal });
      } else {
        markLookStillsUnavailable();
        onDoneRef.current();
      }
    };
    prepare().catch(() => onDoneRef.current());
    return () => abort.abort();
  }, [look.style]);

  useEffect(() => {
    if (!run || !driver) {
      return undefined;
    }
    const { song, signal } = run;
    // A hidden window draws nothing (`drawLiveTraceFrame`): a still painted
    // through one would be kept blank for the session.
    const seen = { hidden: document.hidden };
    const onVisibility = () => {
      seen.hidden = seen.hidden || document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);
    const paint = async () => {
      await song.play((deltaMs) => driver.draw(deltaMs));
      const canvas = driver.canvas();
      if (signal.aborted) {
        return;
      }
      if (seen.hidden || !canvas) {
        onDoneRef.current();
        return;
      }
      canvas.toBlob((blob) => {
        if (blob && !signal.aborted) {
          const { stillKey: key, width: drawnAt } = keptRef.current;
          keepLookStill(key, {
            url: URL.createObjectURL(blob),
            width: drawnAt,
          });
        }
        onDoneRef.current();
      }, 'image/png');
    };
    paint().catch(() => onDoneRef.current());
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [run, driver]);

  if (!run) {
    return null;
  }
  const { song } = run;
  return (
    <span className="look-tile-art__painter" aria-hidden="true">
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
    </span>
  );
};

export default LookStillPainter;
