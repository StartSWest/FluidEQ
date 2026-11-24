/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { ISceneDownloadsPaused } from 'common/sceneDownloads';
import { useTranslation } from '../utils/I18nContext';
import PlusToastStack from './PlusToastStack';

interface IPausedNotice extends ISceneDownloadsPaused {
  ok: false;
}

/**
 * When downloads come back, on the reader's own clock. The server's day ends
 * at UTC midnight, which is never more than a day away: later today in the
 * Americas, tomorrow morning in Tokyo, so the line says which.
 */
export const resumeTime = (
  resetsAt: string,
  locale: string,
  now = new Date(),
): { time: string; tomorrow: boolean } => {
  const at = new Date(resetsAt);
  return {
    time: new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(at),
    tomorrow: at.toDateString() !== now.toDateString(),
  };
};

/**
 * The server stopped handing out scene downloads for the day (server 0117):
 * this account's allowance, which nobody reaches by using FluidEQ, or the
 * whole service's, which pauses gallery previews while owned scenes still
 * download. Said once per pause, in the window's stack of notices, whichever
 * download hit it — a tile, an Add, an update in the background.
 */
export default function SceneDownloadsPausedNotice() {
  const { t, locale } = useTranslation();
  const [notice, setNotice] = useState<IPausedNotice>();
  useEffect(
    () =>
      window.electron?.ipcRenderer?.onSceneDownloadsPaused?.((paused) =>
        // The same pause again keeps the same notice, so it is not raised
        // twice, even after it was closed.
        setNotice((current) =>
          current?.reason === paused.reason &&
          current.resetsAt === paused.resetsAt
            ? current
            : { ok: false, ...paused },
        ),
      ),
    [],
  );
  return (
    <PlusToastStack<IPausedNotice>
      sources={{ paused: notice }}
      text={(entry) => {
        if (entry.reason === 'busy') {
          return t('store.download.busy');
        }
        const { time, tomorrow } = resumeTime(entry.resetsAt, locale);
        return tomorrow
          ? t('store.download.limitTomorrow', { time })
          : t('store.download.limit', { time });
      }}
    />
  );
}
