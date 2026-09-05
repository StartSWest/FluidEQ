/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The listener's half of "what is playing over there".
 *
 * Turns what a sending computer said its bar is showing into the same
 * `ITransportSource` the app's own players publish, so the listener's bar
 * draws it with the same card and the same play button instead of "Nothing
 * playing" — the way `useSystemMediaSource` does for a browser tab on this
 * machine. The bar's third line names the computer.
 *
 * ONE DESCRIPTION, HOWEVER MANY SENDERS. The bar has room for one thing, and
 * the honest one is whichever sender is actually playing; with several
 * playing, the first that connected. A sender that has said nothing yet, or
 * whose bar is empty, is not a candidate.
 *
 * The play button goes back over the wire to the sender and is pressed there,
 * on whatever its bar is showing. No seek and no queue: a position read a
 * second ago on another machine is not a playhead this one can move honestly,
 * and the sender's source may not have a queue at all.
 */

import { useEffect } from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import {
  clearTransportSource,
  setTransportSource,
} from '../audio/transportSource';
import type {
  IRemoteAudioComputer,
  TRemoteAudioRole,
} from './remoteAudioState';

/** The sender worth the bar: playing first, then whoever described itself. */
export const pickRemoteNowPlaying = (
  computers: IRemoteAudioComputer[],
): IRemoteAudioComputer | undefined =>
  computers.find((computer) => computer.nowPlaying?.isPlaying === true) ??
  computers.find((computer) => computer.nowPlaying !== undefined);

const useRemoteNowPlayingSource = (
  role: TRemoteAudioRole | undefined,
  computers: IRemoteAudioComputer[],
): void => {
  useEffect(() => {
    const computer =
      role === 'listener' ? pickRemoteNowPlaying(computers) : undefined;
    const playing = computer?.nowPlaying;
    if (!computer || !playing) {
      clearTransportSource('remote');
      return;
    }
    const peerId = computer.id;
    setTransportSource({
      owner: 'remote',
      title: playing.title,
      subtitle: playing.subtitle,
      origin: computer.name,
      identity: buildSongIdentity(
        'remote',
        computer.name,
        playing.title,
        playing.artist,
      ),
      isPlaying: playing.isPlaying,
      positionMs: playing.positionMs,
      durationMs: playing.durationMs,
      toggle: () => {
        window.electron.ipcRenderer
          .sendRemoteAudioLanSignal({
            peerId,
            signal: { kind: 'transport', command: 'toggle' },
          })
          .catch(() => undefined);
      },
    });
  }, [computers, role]);

  useEffect(() => () => clearTransportSource('remote'), []);
};

export default useRemoteNowPlayingSource;
