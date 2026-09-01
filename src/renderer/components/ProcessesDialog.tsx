/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import type { TranslationKey } from 'common/i18n/en';
import type { IAppProcess, TProcessRole } from '../../main/ipc/processes';
import { useTranslation } from '../utils/I18nContext';
import DialogHeader from './DialogHeader';
import '../styles/Processes.scss';

interface IProcessesDialogProps {
  onClose: () => void;
}

/** Exhaustive by type: a new role does not compile until it has a name. */
const NAME_KEYS: Record<TProcessRole, TranslationKey> = {
  window: 'app.processes.name.window',
  core: 'app.processes.name.core',
  engine: 'app.processes.name.engine',
  graphics: 'app.processes.name.graphics',
  sound: 'app.processes.name.sound',
  network: 'app.processes.name.network',
  camera: 'app.processes.name.camera',
  page: 'app.processes.name.page',
  helper: 'app.processes.name.helper',
};

/** The sentence under the name: what it does, and why it is running. */
const WHAT_KEYS: Record<TProcessRole, TranslationKey> = {
  window: 'app.processes.what.window',
  core: 'app.processes.what.core',
  engine: 'app.processes.what.engine',
  graphics: 'app.processes.what.graphics',
  sound: 'app.processes.what.sound',
  network: 'app.processes.what.network',
  camera: 'app.processes.what.camera',
  page: 'app.processes.what.page',
  helper: 'app.processes.what.helper',
};

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
 * Electron knows, though, and this is where it says so — but knowing that a
 * process is `Utility: video_capture.mojom.VideoCaptureService` answers a
 * question nobody asked. The list is opened to find out what part of FluidEQ
 * is holding the memory, so every row says what it does for FluidEQ and why it
 * is running at all. Two of them exist only because somebody would otherwise
 * assume the worst about them: the graphics process, which is busy whenever
 * anything on screen moves and has nothing to do with the karaoke models, and
 * the camera service, which Windows starts when the app asks for the list of
 * audio devices and which holds no camera open.
 *
 * The DSP engine is listed alongside even though it is not Electron's, because
 * somebody looking at this list is asking about FluidEQ rather than about
 * Chromium — and it is the one process Task Manager files somewhere else
 * entirely, being a separate executable. Its memory and CPU come from the host
 * itself; Electron cannot see them.
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
      // Main orders them, and it orders them the same way every time. Sorting
      // by size here is what used to make rows swap places under the cursor
      // while they were being read.
      .then((next) => {
        setRows(next);
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
   * The app's name for a process, and the sentence that makes it make sense.
   *
   * Written out rather than built from the role — `app.processes.name.${role}`
   * would be a string the key type cannot check, and the first role added
   * without a string would render the key itself in every language. A helper
   * keeps the service name Chromium gave it, which is more informative than
   * any label this app could invent for a process it never asked for.
   */
  const nameFor = (row: IAppProcess): string =>
    row.role === 'helper' && row.detail ? row.detail : t(NAME_KEYS[row.role]);

  const total = rows.reduce((sum, row) => sum + (row.memoryMb ?? 0), 0);
  const anyUnmeasured = rows.some((row) => row.memoryMb === undefined);

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
          <p className="processes__hint">{t('app.processes.hintSplit')}</p>

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
                  className={
                    row.role === 'window' ? 'is-this-window' : undefined
                  }
                >
                  <td>
                    <span className="processes__name">
                      {nameFor(row)}
                      {row.role === 'window' ? (
                        <span className="processes__tag">
                          {t('app.processes.thisWindow')}
                        </span>
                      ) : undefined}
                    </span>
                    <span className="processes__what">
                      {t(WHAT_KEYS[row.role])}
                    </span>
                  </td>
                  <td className="processes__number">{row.pid}</td>
                  <td className="processes__number">
                    {/* A dash for a figure nobody has measured yet, never a
                        zero — a zero reads as a process that costs nothing. */}
                    {row.memoryMb === undefined ? '—' : `${row.memoryMb} MB`}
                  </td>
                  <td className="processes__number">
                    {row.cpuPercent === undefined ? '—' : `${row.cpuPercent}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Outside the scrolling body on purpose. The total is the one line
            somebody reads after scanning the table, and inside `about__body`
            it was the first thing to scroll out of sight — worst on a short
            window, where the table is exactly long enough to need scrolling
            and the figure it adds up to is exactly what is then hidden. */}
        <div className="processes__footer">
          {anyUnmeasured ? (
            <span className="processes__footnote">
              {t('app.processes.unmeasured')}
            </span>
          ) : undefined}
          <span className="processes__total">
            {t('app.processes.total', { megabytes: String(total) })}
          </span>
        </div>
      </div>
    </div>
  );
}
