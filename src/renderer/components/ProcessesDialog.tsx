/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import type { IAppProcess } from '../../main/ipc/processes';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from './DialogHeader';
import '../styles/Processes.scss';

interface IProcessesDialogProps {
  onClose: () => void;
}

/**
 * Which of our processes is which, since Task Manager cannot say.
 *
 * Windows names a process from the version resource in its executable, and
 * every Electron child IS the same executable — so Task Manager shows half a
 * dozen identical rows called FluidEQ with no way to tell the window from the
 * GPU process from a utility. Chrome has the same limitation: expand it there
 * and every child says "Google Chrome". No naming scheme fixes it, because
 * there is nothing per-process to name.
 *
 * Electron knows, though, and this is where it says so. The row marked as this
 * window is the one that matters when memory climbs: an app playing a video
 * runs several renderers, and picking ours out by process id is a guess that
 * sends the search into the wrong file.
 *
 * The DSP engine is listed alongside even though it is not Electron's, because
 * somebody looking at this list is asking about FluidEQ rather than about
 * Chromium — and it is the one process Task Manager files somewhere else
 * entirely, being a separate executable.
 */
export default function ProcessesDialog({ onClose }: IProcessesDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState<IAppProcess[]>([]);

  const refresh = useCallback(() => {
    const bridge = window.electron?.ipcRenderer as
      { appProcesses?: () => Promise<IAppProcess[]> } | undefined;
    bridge
      ?.appProcesses?.()
      .then((next) => {
        // Largest first: the question this answers is always "what is holding
        // the memory", and making somebody scan for it defeats the point.
        setRows([...next].sort((a, b) => b.memoryMb - a.memoryMb));
        return next;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    refresh();
    /**
     * Once a second: slow enough to read a number off, fast enough to watch
     * a leak move. Four times a second is a table nobody can read.
     */
    const timer = setInterval(refresh, 1_000);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearInterval(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, refresh]);

  /**
   * Electron's own labels, made readable without inventing anything.
   *
   * The service name is the whole point for a utility: six rows saying
   * `Utility` say nothing, while `Network Service` and `Audio Service` say
   * everything. Both come from Electron rather than from a guess about a pid.
   */
  const describe = (row: IAppProcess): string => {
    const kinds: Record<string, string> = {
      Browser: t('app.processes.kindMain'),
      Tab: t('app.processes.kindWindow'),
      GPU: t('app.processes.kindGpu'),
      Utility: t('app.processes.kindUtility'),
      'DSP Engine': t('app.processes.kindDsp'),
    };
    const kind = kinds[row.kind] ?? row.kind;
    return row.service ? `${kind}: ${row.service}` : kind;
  };

  const total = rows.reduce((sum, row) => sum + row.memoryMb, 0);

  return (
    <div
      className="about-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="about processes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="processes-title"
      >
        <DialogHeader
          eyebrow={t('app.processes.eyebrow')}
          title={PRODUCT_NAME}
          titleId="processes-title"
          closeLabel={t('support.close')}
          onClose={onClose}
          closeRef={closeRef}
        />

        <div className="about__body">
          <p className="processes__hint">{t('app.processes.hint')}</p>

          <table className="processes__table">
            <thead>
              <tr>
                <th scope="col">{t('app.processes.process')}</th>
                <th scope="col" className="processes__number">
                  {t('app.processes.pid')}
                </th>
                <th scope="col" className="processes__number">
                  {t('app.processes.memory')}
                </th>
                <th scope="col" className="processes__number">
                  {t('app.processes.cpu')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.pid}
                  className={row.isAppWindow ? 'is-this-window' : undefined}
                >
                  <td>
                    {describe(row)}
                    {row.isAppWindow ? (
                      <span className="processes__tag">
                        {t('app.processes.thisWindow')}
                      </span>
                    ) : undefined}
                  </td>
                  <td className="processes__number">{row.pid}</td>
                  <td className="processes__number">
                    {/* The native host's size is not Electron's to report, and
                        a wrong number is worse than a dash. */}
                    {row.isNative ? '—' : `${row.memoryMb} MB`}
                  </td>
                  <td className="processes__number">
                    {row.isNative ? '—' : `${row.cpuPercent}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="processes__hint">
            {t('app.processes.total', { megabytes: String(total) })}
          </p>
        </div>
      </div>
    </div>
  );
}
