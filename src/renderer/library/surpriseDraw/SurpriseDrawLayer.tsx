/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where Surprise me's draw plays: a layer over the shelf, empty and out of
 * the way until a surprise starts, and empty again the moment it ends.
 *
 * The song is already playing when this begins (`useSurprise` starts it at
 * the press); the draw is the picture of a choice already made, so nothing
 * here can hold the music back. A press on the layer or Escape skips it, and
 * another surprise, the shelf going away or the window hiding ends it.
 *
 * It asks for a couple of dozen covers (`coverDeck`) and decodes them at the
 * size a card is drawn (`drawCovers.ts`); three.js arrives in a chunk of its
 * own on the first draw. With motion reduced it is a fade of the pick, and
 * three is never loaded at all.
 */
import { useEffect, useRef, useState } from 'react';
import type { ILibraryTrack } from '../../../common/library/types';
import { prefersReducedMotion } from '../../utils/bandReveal';
import { useLibraryPlayerSession } from '../player/LibraryPlayerContext';
import {
  DRAW_COVER_EDGE,
  TDrawCover,
  loadDrawCover,
  releaseDrawCover,
} from './drawCovers';
import { DRAW_DECK_SIZE, dealDeck } from './drawTiming';

/** How long the reduced-motion fade shows the pick. */
const FADE_MS = 1100;

/**
 * The player's cover, where the pick lands. A descendant, not a child: the
 * cover sits inside the bar's reveal button (`NowPlayingBar`), and a child
 * selector found nothing, so the pick flew to the shelf's corner instead.
 */
const playerCover = (): DOMRect | undefined =>
  document
    .querySelector('.now-playing-bar__track .library-cover-art')
    ?.getBoundingClientRect();

/** The pick, faded in and out where the draw would be: no depth, no spin. */
const playFade = (
  host: HTMLElement,
  cover: TDrawCover,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve) => {
    const picture = document.createElement('canvas');
    picture.className = 'library-surprise-draw__solo';
    picture.width = DRAW_COVER_EDGE;
    picture.height = DRAW_COVER_EDGE;
    picture.getContext('2d')?.drawImage(cover, 0, 0);
    host.appendChild(picture);
    const end = () => {
      host.replaceChildren();
      resolve();
    };
    signal.addEventListener('abort', end, { once: true });
    picture
      .animate(
        [
          { opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { opacity: 1, offset: 0.7 },
          { opacity: 0 },
        ],
        { duration: FADE_MS, easing: 'ease' },
      )
      .finished.then(end, end);
  });

const SurpriseDrawLayer = ({ isShelfShown }: { isShelfShown: boolean }) => {
  const { lastSurprise } = useLibraryPlayerSession();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const skipRef = useRef<AbortController | undefined>(undefined);
  /**
   * The surprise already started when the shelf came on screen: a draw
   * belongs to the press that made it, and coming back to the Library is
   * not a press.
   */
  const seenRef = useRef(lastSurprise?.serial ?? 0);

  useEffect(() => {
    const host = layerRef.current;
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
    const held: TDrawCover[] = [];
    setIsPlaying(true);
    const play = async () => {
      const ask = window.electron.ipcRenderer.queryLibrary;
      const [track]: ILibraryTrack[] = await ask({
        type: 'tracks',
        ids: [lastSurprise.trackId],
      });
      if (!track || signal.aborted) {
        return;
      }
      // The player's own label (`NowPlayingBar` draws the song's title), so
      // a song with no cover lands as the very tile it lands on.
      const label = track.title;
      if (prefersReducedMotion()) {
        const cover = await loadDrawCover(track.artId, label);
        held.push(cover);
        if (!signal.aborted) {
          await playFade(host, cover, signal);
        }
        return;
      }
      const artIds = await ask({
        type: 'coverDeck',
        count: DRAW_DECK_SIZE,
        exclude: track.artId ? [track.artId] : [],
      });
      const [scene, pick, ...others] = await Promise.all([
        import(/* webpackChunkName: "surprise-draw" */ './drawScene'),
        loadDrawCover(track.artId, label),
        ...artIds.map((artId) => loadDrawCover(artId, '')),
      ]);
      held.push(pick, ...others);
      if (signal.aborted) {
        return;
      }
      const { deck, pickIndex } = dealDeck(others, pick);
      try {
        await scene.playSurpriseDraw({
          host,
          covers: deck,
          pickIndex,
          caption: {
            title: track.title,
            detail: track.genre ?? track.artist ?? '',
          },
          landing: playerCover,
          signal,
        });
      } catch (error: unknown) {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the plain fade stands in for the draw
        console.error('The Surprise me draw could not start', error);
        await playFade(host, pick, signal);
      }
    };
    play()
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the song plays without its draw
        console.error('Could not prepare the Surprise me draw', error);
      })
      .finally(() => {
        held.forEach(releaseDrawCover);
        // Only while this draw is still the layer's: an aborted one cleared
        // its own pictures at the abort, and by now the next draw may be in
        // the layer.
        if (skipRef.current === controller) {
          host.replaceChildren();
          skipRef.current = undefined;
          setIsPlaying(false);
        }
      });
    return () => controller.abort();
  }, [isShelfShown, lastSurprise]);

  // Escape skips, only while there is something to skip.
  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skipRef.current?.abort();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying]);

  return (
    <div
      ref={layerRef}
      className={`library-surprise-draw${isPlaying ? ' is-playing' : ''}`}
      // A picture of a choice already made, and the player says which song
      // it was: nothing here for a screen reader to read twice.
      aria-hidden="true"
      onPointerDown={() => skipRef.current?.abort()}
    />
  );
};

export default SurpriseDrawLayer;
