/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import type { TranslationKey } from 'common/i18n/en';
import type { IAppProcess, TProcessRole } from '../../main/ipc/processes';
import { useTranslation } from '../utils/I18nContext';
import { createProcessReadings } from '../utils/processReadings';
import { readSceneDraws } from '../utils/sceneDrawStats';
import DialogHeader from './DialogHeader';
import '../styles/Processes.scss';

interface IProcessesDialogProps {
  onClose: () => void;
}

/** Frames between answers: about four a second on a 60 Hz screen. */
export const ASK_EVERY_FRAMES = 15;

/** Exhaustive by type: a new role does not compile until it has a name. */
const NAME_KEYS: Record<TProcessRole, TranslationKey> = {
  window: 'app.processes.name.window',
  core: 'app.processes.name.core',
  engine: 'app.processes.name.engine',
  systemEngine: 'app.processes.name.systemEngine',
  meter: 'app.processes.name.meter',
  lighting: 'app.processes.name.lighting',
  graphics: 'app.processes.name.graphics',
  desktop: 'app.processes.name.desktop',
  desktopHost: 'app.processes.name.desktopHost',
  models: 'app.processes.name.models',
  libraryScan: 'app.processes.name.libraryScan',
  shareCapture: 'app.processes.name.shareCapture',
  sharePlayback: 'app.processes.name.sharePlayback',
  volume: 'app.processes.name.volume',
  games: 'app.processes.name.games',
  mediaWatch: 'app.processes.name.mediaWatch',
  sound: 'app.processes.name.sound',
  network: 'app.processes.name.network',
  devices: 'app.processes.name.devices',
  page: 'app.processes.name.page',
  helper: 'app.processes.name.helper',
};

/** The sentence under the name: what it does, and why it is running. */
const WHAT_KEYS: Record<TProcessRole, TranslationKey> = {
  window: 'app.processes.what.window',
  core: 'app.processes.what.core',
  engine: 'app.processes.what.engine',
  systemEngine: 'app.processes.what.systemEngine',
  meter: 'app.processes.what.meter',
  lighting: 'app.processes.what.lighting',
  graphics: 'app.processes.what.graphics',
  desktop: 'app.processes.what.desktop',
  desktopHost: 'app.processes.what.desktopHost',
  models: 'app.processes.what.models',
  libraryScan: 'app.processes.what.libraryScan',
  shareCapture: 'app.processes.what.shareCapture',
  sharePlayback: 'app.processes.what.sharePlayback',
  volume: 'app.processes.what.volume',
  games: 'app.processes.what.games',
  mediaWatch: 'app.processes.what.mediaWatch',
  sound: 'app.processes.what.sound',
  network: 'app.processes.what.network',
  devices: 'app.processes.what.devices',
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
 * is running at all. Two of them are worded so nobody assumes the worst about
 * them: the graphics process, which is busy whenever anything on screen moves
 * and has nothing to do with the karaoke models, and Chromium's video-capture
 * service, which starts when the app asks for the list of audio devices, holds
 * no camera open, and is therefore not called a camera service here.
 *
 * The Plus visualizers have no row of their own because they are not a
 * process: they are a worker thread inside the window, whose WebGL executes in
 * the graphics process. Both of those rows say so.
 *
 * The DSP engine is listed alongside even though it is not Electron's, because
 * somebody looking at this list is asking about FluidEQ rather than about
 * Chromium — and it is the one process Task Manager files somewhere else
 * entirely, being a separate executable. Electron cannot see it; the meter
 * measures it with every other row, so the column adds up.
 */
export default function ProcessesDialog({ onClose }: IProcessesDialogProps) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState<IAppProcess[]>([]);

  // Escape reads whichever `onClose` is current, and focus is placed once:
  // re-run with `onClose`, which the window hands over new on every render of
  // its own, this pulled focus back to Close several times a second while
  // anything played.
  const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => closeOnEscape(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * Asks again once the previous answer has had `ASK_EVERY_FRAMES` frames.
   *
   * One request in flight, the next sent from `requestAnimationFrame` — so the
   * list follows the screen: it keeps up while it is being looked at and stops
   * by itself when the window is minimised or hidden, where Chromium runs no
   * frames. What keeps the answers readable is `processReadings`, which fits
   * CPU over a two-second span and holds a figure until it has genuinely
   * moved; the table re-renders only when one did.
   *
   * Not every frame: each answer is `getAppMetrics`, every web contents and a
   * process snapshot taken by the meter, all on main, so asking sixty times a
   * second made FluidEQ's own row the busiest one in the list — the dialog
   * measuring mostly itself — and held every other reply main owed the window
   * behind it. Four or so answers a second is more points than the fit needs.
   *
   * A failed answer chains the next request just the same. The handler only
   * throws while the window is going away, and a list that stopped on one
   * failure would freeze its figures with nothing on screen saying so.
   */
  useEffect(() => {
    const bridge = window.electron?.ipcRenderer as
      | {
          appProcesses?: () => Promise<IAppProcess[]>;
          appProcessesClosed?: () => void;
        }
      | undefined;
    const ask = bridge?.appProcesses;
    if (!ask) {
      return undefined;
    }
    const readings = createProcessReadings(navigator.hardwareConcurrency);
    let closed = false;
    let frame = 0;
    // Frames since the last answer landed; starts full so the list opens with
    // an answer rather than a quarter of a second of dashes.
    let waited = ASK_EVERY_FRAMES;
    const step = () => {
      if (waited < ASK_EVERY_FRAMES) {
        waited += 1;
        frame = requestAnimationFrame(step);
        return;
      }
      waited = 0;
      ask()
        // Main orders them, and it orders them the same way every time.
        // Sorting by size here is what used to make rows swap places under
        // the cursor while they were being read.
        .then((next) => {
          const shown = closed
            ? undefined
            : readings.take(next, performance.now());
          if (shown) {
            setRows(shown);
          }
          return undefined;
        })
        .catch(() => undefined)
        .finally(() => {
          if (!closed) {
            frame = requestAnimationFrame(step);
          }
        });
    };
    step();
    return () => {
      closed = true;
      cancelAnimationFrame(frame);
      // Main's meter process runs only while this list is open.
      bridge?.appProcessesClosed?.();
    };
  }, []);

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

  // What FluidEQ itself costs. Main lists each process once and measures its
  // private memory, so nothing is counted twice; the Windows audio service the
  // engine runs inside is shown but not added, because most of what it holds
  // and spends is Windows' and the sound card's, not FluidEQ's.
  const owned = rows.filter((row) => !row.isShared);
  const total = owned.reduce((sum, row) => sum + (row.memoryMb ?? 0), 0);
  const totalCpu =
    Math.round(
      owned.reduce((sum, row) => sum + (row.cpuPercent ?? 0), 0) * 10,
    ) / 10;
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
                        zero — a zero reads as a process that costs nothing.
                        For the same reason a measured process under half a
                        megabyte, like a desktop visualizer's helper, reads as
                        under one rather than as none. */}
                    {row.memoryMb === undefined
                      ? '—'
                      : `${row.memoryMb < 1 ? '<1' : row.memoryMb} MB`}
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
          {/* The visualizers being drawn, which are not processes but are
              what the graphics process is spending its share on: read on the
              same refresh as the table, never per frame. */}
          {readSceneDraws().map(({ place, name, report }) => {
            const fps = String(Math.round(1000 / report.intervalMs / 5) * 5);
            const drawn = `${report.drawnWidth}×${report.drawnHeight}`;
            const shown = `${report.outputWidth}×${report.outputHeight}`;
            const placeName = t(`app.processes.place.${place}` as const);
            return (
              <span key={place} className="processes__footnote">
                {report.costMs === undefined
                  ? t('app.processes.sceneRate', {
                      place: placeName,
                      name,
                      fps,
                      drawn,
                      shown,
                    })
                  : t('app.processes.scene', {
                      place: placeName,
                      name,
                      ms: report.costMs.toFixed(1),
                      fps,
                      drawn,
                      shown,
                    })}
              </span>
            );
          })}
          <span className="processes__total">
            {t('app.processes.total', {
              megabytes: String(total),
              cpu: String(totalCpu),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
