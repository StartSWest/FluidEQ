/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two hidden decks, built once and never rebuilt.
 *
 * Two of them because a real overlap needs two: replacing one element's source
 * cannot crossfade, since the old decoder is already gone by the time the new
 * source starts.
 *
 * Built in a ref with `new Audio()` and deliberately never rendered as JSX.
 * The workspace above them is hidden rather than unmounted when another tab is
 * open, but a RENDERED element would still be at the mercy of React reconciling
 * this tree — a key change, a branch taken differently, anything that makes
 * React tear the element down silently stops the music. An object living only
 * in a ref has no such risk.
 *
 * Both of the properties set here are set BEFORE any `src`, and both for
 * reasons that are invisible afterwards. See each one.
 */
import { MutableRefObject, useEffect, useRef } from 'react';
import { readStoredVolume } from './playbackMemory';

export interface IPlayerDecks {
  audioElements: readonly [HTMLAudioElement, HTMLAudioElement];
  /**
   * The fader, readable from listeners bound once for the life of a deck.
   *
   * Kept here because this is what owns the elements it has to reach: the
   * level belongs to the deck, not to the render that moved the slider.
   */
  volumeRef: MutableRefObject<number>;
}

export const usePlayerDecks = (
  volume: number,
  videoElementRef: MutableRefObject<HTMLVideoElement | null>,
): IPlayerDecks => {
  // Two stable, hidden decks make a real overlap possible. Replacing one
  // element's source cannot crossfade: the old decoder is already gone by the
  // time the new source starts.
  const audioElementsRef = useRef<
    readonly [HTMLAudioElement, HTMLAudioElement] | undefined
  >(undefined);
  if (!audioElementsRef.current) {
    const storedVolume = readStoredVolume();
    const first = new Audio();
    const second = new Audio();
    [first, second].forEach((element) => {
      /**
       * Before any `src`, and that ordering is the whole point.
       *
       * Library tracks are served over `fluideq-media://`, which is a different
       * origin from this page. Without a CORS-mode request the media is tainted,
       * and Chromium's rule for tainted media is that the
       * `MediaElementAudioSourceNode` built on it emits SILENCE while the element
       * carries on decoding — so the transport ran and the seek bar moved with no
       * sound at all. `crossOrigin` is only consulted when the load starts, so
       * setting it after a `src` has been assigned does nothing.
       */
      element.crossOrigin = 'anonymous';
      // Set from storage here, not from an effect after the first render. An
      // element built at unity and turned down afterwards is briefly at unity,
      // and someone who left the fader at 17% would get a burst of full-scale
      // audio on launch — the opposite of what remembering it is for.
      element.volume = storedVolume;
    });
    audioElementsRef.current = [first, second];
  }
  const audioElements = audioElementsRef.current;

  /**
   * Every deck follows the fader, including the video the stage registered.
   *
   * On the elements rather than in the DSP chain, so the level is right even
   * when the graph has fallen back to direct output.
   */
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
    audioElements.forEach((audio) => {
      audio.volume = volume;
    });
    if (videoElementRef.current) {
      videoElementRef.current.volume = volume;
    }
  }, [audioElements, volume, videoElementRef]);

  return { audioElements, volumeRef };
};
