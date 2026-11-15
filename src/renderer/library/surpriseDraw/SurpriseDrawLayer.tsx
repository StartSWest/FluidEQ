/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where Surprise me's draw plays. It is Cover Flow's own scene in every view
 * (Ivan, 2026-11-14: "same component, not loading two"):
 *
 * - Over Cover Flow, the row on screen spins: the view lends its scene
 *   (`useCoverFlowSurprise`) and this layer only catches the press or
 *   Escape that skips it.
 * - Over the list or the grid, this layer builds the same scene across the
 *   whole shelf for the length of the spin and gives it back at the end.
 *   Cover Flow is not mounted then, so there is still only one scene, one
 *   WebGL context and one copy of three.js.
 *
 * The song is already playing when this begins (`useSurprise` starts it at
 * the press); the draw is the picture of a choice already made, so nothing
 * here can hold the music back. Another surprise, the shelf going away or
 * the window hiding ends it. With motion reduced the row stands on the pick
 * at once and holds it under its name.
 */
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { ILibraryTrack } from '../../../common/library/types';
import { prefersReducedMotion } from '../../utils/bandReveal';
import { useLibraryPlayerSession } from '../player/LibraryPlayerContext';
import type { ICoverFlowSlot } from '../coverFlow/coverFlowScene';
import { coverFlowLayout } from '../coverFlow/coverFlowGeometry';
import {
  DRAW_DECK_SIZE,
  DRAW_HOLD_MS,
  DRAW_SPIN_MS,
  dealRow,
} from './drawTiming';
import type {
  ISurpriseCaption,
  ISurpriseDraw,
  TSurpriseStageRef,
} from './surpriseStage';

/** How far under the centre cover its name hangs, in covers: Cover Flow's
 * own `--cover-flow-caption-gap` with its panel closed. */
const CAPTION_GAP = 0.4;

const slotOf = (
  id: string,
  artId: string | undefined,
  label: string,
): ICoverFlowSlot => ({
  id,
  artId,
  label,
  isFolder: false,
  isPending: false,
});

/** The shelf-wide scene: built, spun to the pick, and given back. */
const playOwnScene = async (
  host: HTMLElement,
  draw: ISurpriseDraw,
  onLanded: () => void,
): Promise<void> => {
  const { createCoverFlowScene } = await import(
    /* webpackChunkName: "cover-flow" */ '../coverFlow/coverFlowScene'
  );
  if (draw.signal.aborted) {
    return;
  }
  const scene = createCoverFlowScene({
    host,
    onFirstFrame: () => undefined,
    // A lost context ends the spin by itself (`spin`); nothing to rebuild for
    // a picture this short.
    onLost: () => undefined,
    onRestored: () => undefined,
  });
  try {
    scene.setReducedMotion(prefersReducedMotion());
    scene.setSource({
      count: draw.row.length,
      itemAt: (index) => draw.row[index],
      playingId: undefined,
    });
    scene.jumpTo(draw.startIndex);
    await scene.spin({
      to: draw.pickIndex,
      spinMs: DRAW_SPIN_MS,
      holdMs: DRAW_HOLD_MS,
      onLanded,
      signal: draw.signal,
    });
  } finally {
    scene.dispose();
  }
};

/** Where the name hangs under the centre cover, the way Cover Flow places
 * its own: from the same layout the scene puts the cover with. */
const captionPlace = (host: HTMLElement): CSSProperties => {
  const { centreY, coverPx } = coverFlowLayout(
    host.clientWidth,
    host.clientHeight,
  );
  return {
    top: centreY + coverPx * (0.5 + CAPTION_GAP),
    width: Math.min(host.clientWidth - 32, coverPx * 1.6),
  };
};

const SurpriseDrawLayer = ({
  isShelfShown,
  stageRef,
  onPick,
}: {
  isShelfShown: boolean;
  /** Filled while Cover Flow is on screen: its row is then the draw. */
  stageRef: TSurpriseStageRef;
  /** The shelf moves to the pick while the draw spins, so the row and the
   * panel under it name the song now playing when it ends. */
  onPick?: (track: ILibraryTrack) => void;
}) => {
  const { lastSurprise } = useLibraryPlayerSession();
  const sceneHostRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<'idle' | 'flow' | 'own'>('idle');
  const [caption, setCaption] = useState<
    (ISurpriseCaption & { place: CSSProperties }) | undefined
  >(undefined);
  const skipRef = useRef<AbortController | undefined>(undefined);
  /** The latest `onPick`, read inside a draw without restarting it. */
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  /**
   * The surprise already started when the shelf came on screen: a draw
   * belongs to the press that made it, and coming back to the Library is
   * not a press.
   */
  const seenRef = useRef(lastSurprise?.serial ?? 0);

  useEffect(() => {
    const host = sceneHostRef.current;
    if (!lastSurprise || lastSurprise.serial <= seenRef.current || !host) {
      return undefined;
    }
    seenRef.current = lastSurprise.serial;
    if (!isShelfShown) {
      return undefined;
    }
    const controller = new AbortController();
    skipRef.current = controller;
    const { signal } = controller;
    const play = async () => {
      const ask = window.electron.ipcRenderer.queryLibrary;
      const [track]: ILibraryTrack[] = await ask({
        type: 'tracks',
        ids: [lastSurprise.trackId],
      });
      if (!track || signal.aborted) {
        return;
      }
      onPickRef.current?.(track);
      const artIds = await ask({
        type: 'coverDeck',
        count: DRAW_DECK_SIZE,
        exclude: track.artId ? [track.artId] : [],
      });
      if (signal.aborted) {
        return;
      }
      const key = `surprise-${lastSurprise.serial}`;
      const { row, startIndex, pickIndex } = dealRow(
        artIds.map((artId, index) => slotOf(`${key}-${index}`, artId, '')),
        // The player's own label (`NowPlayingBar` draws the song's title), so
        // a song with no cover lands as the very tile it lands on.
        slotOf(`${key}-pick`, track.artId, track.title),
      );
      const draw: ISurpriseDraw = {
        row,
        startIndex,
        pickIndex,
        caption: {
          title: track.title,
          detail: track.genre ?? track.artist ?? '',
        },
        signal,
      };
      const stage = stageRef.current;
      if (stage) {
        setMode('flow');
        // Cover Flow shows the name under its own row; a view still loading
        // its scene shows nothing rather than a second scene over it.
        await stage.play(draw);
        return;
      }
      setMode('own');
      await playOwnScene(host, draw, () =>
        setCaption({ ...draw.caption, place: captionPlace(host) }),
      );
    };
    play()
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the song plays without its draw
        console.error('Could not play the Surprise me draw', error);
      })
      .finally(() => {
        // Only while this draw is still the layer's: by now the next one may
        // have started.
        if (skipRef.current === controller) {
          skipRef.current = undefined;
          setMode('idle');
          setCaption(undefined);
        }
      });
    return () => controller.abort();
  }, [isShelfShown, lastSurprise, stageRef]);

  // Escape skips, and a hidden window ends it, only while there is a draw.
  useEffect(() => {
    if (mode === 'idle') {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skipRef.current?.abort();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        skipRef.current?.abort();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode]);

  return (
    <div
      className={`library-surprise-draw${mode === 'idle' ? '' : ' is-playing'}${mode === 'flow' ? ' is-over-flow' : ''}`}
      // A picture of a choice already made, and the player says which song
      // it was: nothing here for a screen reader to read twice.
      aria-hidden="true"
      onPointerDown={() => skipRef.current?.abort()}
    >
      <div ref={sceneHostRef} className="library-surprise-draw__stage" />
      {caption && (
        <div className="library-surprise-draw__caption" style={caption.place}>
          <b>{caption.title}</b>
          {caption.detail !== '' && <span>{caption.detail}</span>}
        </div>
      )}
    </div>
  );
};

export default SurpriseDrawLayer;
