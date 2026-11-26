/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useNowPlayingIdentity } from '../../audio/nowPlayingIdentity';
import useReducedMotion from '../../utils/useReducedMotion';
import WordmarkLetters, { TailInk, WORDMARK_SHAPE } from './WordmarkLetters';
import useWordmarkTail from './useWordmarkTail';
import {
  TAIL_X,
  TAIL_Y,
  VERSION_STYLE,
  WORDMARK_VERSION,
  tailBoxStyle,
} from './wordmarkLayout';
import {
  TAIL_FLOURISH_PX,
  isLineClipped,
  wordmarkRoom,
  type IWordmarkRoom,
} from './wordmarkRoom';

const { box, tailWidth } = WORDMARK_SHAPE;

const sameRoom = (a: IWordmarkRoom, b: IWordmarkRoom) =>
  a.tailLength === b.tailLength &&
  a.songLeft === b.songLeft &&
  a.songWidth === b.songWidth;

/**
 * The header's name: "FluidEQ" in the broad pen, the version over the Q's
 * shoulder, and the Q's tail running on as the live sound (Ivan, 2026-11-26).
 * On a bar with room between the name and the first tab, the playing song
 * rides the tail; anywhere else the tail is a short flourish and no song is
 * shown ("we dont show song name under it"). The name keeps one width in the
 * flow whatever plays, so nothing in the bar moves when a song changes.
 */
export default function HeaderWordmark() {
  const rootRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const versionRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const songRef = useRef<HTMLDivElement>(null);
  const tailInk = `wordmark-tail-${useId().replace(/:/g, '')}`;
  const isStill = useReducedMotion();
  const { identity, isPlaying } = useNowPlayingIdentity();
  const [room, setRoom] = useState<IWordmarkRoom>({
    tailLength: TAIL_FLOURISH_PX,
  });
  const [scale, setScale] = useState(0);

  // Measured against the first tab, whose place the name's own width decides
  // and the song (out of the flow) does not: nothing here moves what it
  // measures.
  useLayoutEffect(() => {
    const word = wordRef.current;
    const end = rootRef.current?.closest<HTMLElement>('.window-titlebar__left');
    const tabs = end?.querySelector<HTMLElement>('.workspace-tabs-shell');
    if (!word) {
      return undefined;
    }
    const measure = () => {
      const wordBox = word.getBoundingClientRect();
      const nextScale = wordBox.height / box.height;
      const versionBox = versionRef.current?.getBoundingClientRect();
      const next = wordmarkRoom({
        tailStart: wordBox.width * TAIL_X,
        versionRight: versionBox ? versionBox.right - wordBox.left : 0,
        tabsLeft: tabs
          ? tabs.getBoundingClientRect().left - wordBox.left
          : Number.NaN,
      });
      setScale((previous) => (previous === nextScale ? previous : nextScale));
      setRoom((previous) => (sameRoom(previous, next) ? previous : next));
    };
    measure();
    // Absent in the jsdom the titlebar's tests run under (`useTitlebarRoom`
    // has the same guard): the name keeps its flourish there.
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    [word, end, tabs].forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });
    return () => observer.disconnect();
  }, []);

  const showsSong = room.songLeft !== undefined && identity !== undefined;
  // With nothing to carry, the tail is its short flourish again: run on
  // across an empty space it read as a line to nowhere.
  const tailLength = showsSong ? room.tailLength : TAIL_FLOURISH_PX;

  useWordmarkTail(
    tailRef,
    {
      length: tailLength,
      startWidth: Math.max(1.5, tailWidth * scale),
      carriesSong: showsSong,
    },
    isStill,
  );

  // A title or artist longer than its line fades out at its end.
  const title = identity?.title ?? '';
  const artist = identity?.artist ?? '';
  useLayoutEffect(() => {
    songRef.current
      ?.querySelectorAll<HTMLElement>('.header-wordmark__line')
      .forEach((line) =>
        line.classList.toggle(
          'is-clipped',
          isLineClipped(line.scrollWidth, line.clientWidth),
        ),
      );
  }, [title, artist, room.songWidth, showsSong]);

  const songStyle: CSSProperties = {
    left: room.songLeft,
    width: room.songWidth,
    bottom: `calc(${(1 - TAIL_Y) * 100}% + 5px)`,
  };

  return (
    <div className="header-wordmark" ref={rootRef}>
      <span className="header-wordmark__word" ref={wordRef}>
        <WordmarkLetters />
        {WORDMARK_VERSION && (
          <span
            className="header-wordmark__version"
            ref={versionRef}
            style={VERSION_STYLE}
          >
            {WORDMARK_VERSION}
          </span>
        )}
        <svg
          className="header-wordmark__tail"
          style={tailBoxStyle(tailLength)}
          aria-hidden="true"
        >
          <defs>
            <TailInk id={tailInk} />
          </defs>
          <path ref={tailRef} fill={`url(#${tailInk})`} />
        </svg>
        {showsSong && (
          <div
            className={`header-wordmark__song${isPlaying ? '' : ' is-paused'}`}
            ref={songRef}
            style={songStyle}
            title={artist ? `${title} — ${artist}` : title}
          >
            <span className="header-wordmark__line header-wordmark__title">
              {title}
            </span>
            {artist && (
              <span className="header-wordmark__line header-wordmark__artist">
                {artist}
              </span>
            )}
          </div>
        )}
      </span>
    </div>
  );
}
