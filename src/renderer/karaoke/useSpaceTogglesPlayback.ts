/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';

interface ISpaceTogglesPlaybackInput {
  lineEntryMode: boolean;
  isPlaying: boolean;
  onPause: () => void;
  onPlay: () => Promise<void> | void;
}

/**
 * Space plays and pauses the song anywhere in the editor, except while
 * lines are being recorded, a dialog or menu is open, or the key is typing
 * into a text field.
 */
const useSpaceTogglesPlayback = ({
  lineEntryMode,
  isPlaying,
  onPause,
  onPlay,
}: ISpaceTogglesPlaybackInput) => {
  useEffect(() => {
    const togglePlaybackWithSpace = (event: KeyboardEvent) => {
      const isSpace =
        event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
      if (
        !isSpace ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        lineEntryMode ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      let target: HTMLElement | undefined;
      if (event.target instanceof HTMLElement) {
        target = event.target;
      } else if (document.activeElement instanceof HTMLElement) {
        target = document.activeElement;
      }
      const isEnteringText = Boolean(
        target?.isContentEditable ||
        target?.closest(
          'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"]',
        ),
      );
      if (isEnteringText) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isPlaying) {
        onPause();
      } else {
        Promise.resolve(onPlay()).catch(() => undefined);
      }
    };
    window.addEventListener('keydown', togglePlaybackWithSpace, true);
    return () =>
      window.removeEventListener('keydown', togglePlaybackWithSpace, true);
  }, [isPlaying, lineEntryMode, onPause, onPlay]);
};

export default useSpaceTogglesPlayback;
