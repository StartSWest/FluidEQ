/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A deck's life inside this provider: bound, reachable, and torn down.
 *
 * Three effects with one subject. The decks get their listeners; they are
 * registered so the rest of the app can silence them when another player takes
 * over; and they are stopped outright if the provider ever goes away.
 *
 * That last one is not defensive tidying. The decks are bare `Audio()` objects
 * in a ref, so React tears down nothing for them — unmount the provider and the
 * sound simply carries on, reachable by nothing, until the window closes. Mount
 * a second provider, which a hot reload does on every save, and its own fresh
 * deck starts a second song over the top of the orphan.
 */
import { MutableRefObject, useEffect } from 'react';
import { registerPlayer } from '../../audio/playbackOwner';

export const useDeckLifecycle = (options: {
  audioElements: readonly HTMLAudioElement[];
  videoElementRef: MutableRefObject<HTMLVideoElement | null>;
  isDisposedRef: MutableRefObject<boolean>;
  /** Ends a running overlap before the decks are stopped. */
  finishCrossfadeRef: MutableRefObject<(() => void) | undefined>;
  bindMediaEvents: (element: HTMLMediaElement) => () => void;
}): void => {
  const {
    audioElements,
    videoElementRef,
    isDisposedRef,
    finishCrossfadeRef,
    bindMediaEvents,
  } = options;

  // Silence the element if this provider ever goes away.
  //
  // It is a bare `new Audio()` in a ref, deliberately never rendered, which
  // means React tears down nothing for it: unmount the provider and the sound
  // simply carries on, reachable by nothing, until the window closes. Mount a
  // second provider — which a hot reload does on every save — and its own
  // fresh element starts a second song over the top of the orphan. Two tracks
  // at once, and no control on screen governs either.
  //
  // `hasOpenedLibrary` in `App.tsx` is one-way, so this should not fire in a
  // packaged build; it fires constantly in development, which is where the
  // overlap was found.
  useEffect(() => {
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      // Reading the CURRENT overlap is the whole point: there is none when
      // this effect runs, so the rule's advice — copy the ref at setup —
      // would capture `undefined` and leave a running crossfade holding both
      // decks after the provider is gone.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      finishCrossfadeRef.current?.();
      audioElements.forEach((audio) => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
    };
  }, [audioElements, finishCrossfadeRef, isDisposedRef]);

  // Bound once to both decks. Only the active deck writes transport state;
  // the outgoing deck stays audible during overlap without fighting the UI.
  useEffect(() => {
    const unbind = audioElements.map((element) => bindMediaEvents(element));
    return () => unbind.forEach((one) => one());
  }, [audioElements, bindMediaEvents]);

  // How the rest of the app silences this player when it takes over. Pausing
  // rather than clearing the queue: the reader gets their album back where
  // they left it when they come back to the tab, which is what "something
  // else started" should cost them and no more.
  useEffect(
    () =>
      registerPlayer('library', () => {
        audioElements.forEach((audio) => audio.pause());
        videoElementRef.current?.pause();
      }),
    [audioElements, videoElementRef],
  );
};
