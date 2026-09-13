/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useRef } from 'react';
import log from 'electron-log/renderer';
import { useTranslation } from '../utils/I18nContext';
import { usePlaybackOwner, TPlaybackOwner } from './playbackOwner';
import { useLastTransportOwner, useTransportSources } from './transportSource';
import pickTransportOwner from './transportRouting';

/** Mounted once, alongside the bars, including while the window is minimized. */
const TaskbarTransport = ({ tabOwner }: { tabOwner?: TPlaybackOwner }) => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const { locale } = useTranslation();
  const owner = pickTransportOwner(tabOwner, sources, playingOwner, lastOwner);
  const source = owner === undefined ? undefined : sources[owner];
  const sourceRef = useRef(source);
  useLayoutEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (window.electron?.platform !== 'win32') {
      return undefined;
    }
    return window.electron.ipcRenderer.onTaskbarTransport?.((action) => {
      // Read the current bar at click time. Holding the source from the first
      // render would keep controlling its old queue after a player handoff.
      const { current } = sourceRef;
      log.info('Taskbar command received', { action, owner: current?.owner });
      if (action === 'toggle' && current?.canToggle !== false) {
        current?.toggle();
      }
      if (action === 'previous') {
        current?.previous?.();
      }
      if (action === 'next') {
        current?.next?.();
      }
    });
  }, []);

  const canToggle = source !== undefined && source.canToggle !== false;
  const canPrevious = source?.previous !== undefined;
  const canNext = source?.next !== undefined;
  const isPlaying = source?.isPlaying === true;
  const navigation = source?.navigation ?? 'tracks';
  useEffect(() => {
    if (window.electron?.platform !== 'win32') {
      return;
    }
    window.electron.ipcRenderer
      .setTaskbarTransport?.({
        canToggle,
        canPrevious,
        canNext,
        isPlaying,
        locale,
        navigation,
      })
      ?.catch((error: unknown) =>
        log.error('Could not update taskbar playback controls', error),
      );
    // Position ticks and changing callbacks must not redraw the native toolbar.
  }, [canToggle, canPrevious, canNext, isPlaying, locale, navigation]);

  useEffect(
    () => () => {
      if (window.electron?.platform !== 'win32') {
        return;
      }
      window.electron.ipcRenderer
        .setTaskbarTransport?.({
          canToggle: false,
          canPrevious: false,
          canNext: false,
          isPlaying: false,
          locale,
          navigation: 'tracks',
        })
        ?.catch((error: unknown) =>
          log.error('Could not clear taskbar playback controls', error),
        );
    },
    [locale],
  );
  return null;
};

export default TaskbarTransport;
