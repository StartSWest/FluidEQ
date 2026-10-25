/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `outputWatch.ts` for Linux: the outputs moved, follow them.
 *
 * On Windows a helper process prints a line when Windows says the outputs
 * changed. Here the engine rewrites `outputs.json` whenever an output comes,
 * goes or becomes the one played to, so the file being renamed into place
 * is the event — inotify through `fs.watch` on the engine's folder, never a
 * re-read on a clock.
 */

import fs from 'fs';
import path from 'path';
import electronLog from 'electron-log';
import coalesceRequests from '../../common/coalescedRequest';
import type { IAudioDevice } from '../../common/constants';
import type { IOutputWatch, IOutputWatchOptions } from '../outputWatch';
import { linuxEngineRoot } from './linuxEngineFiles';
import { readLinuxOutputs, toAudioDevices } from './linuxOutputs';

const OUTPUTS_FILE = 'outputs.json';

const startLinuxOutputWatch = ({
  onOutputs,
  log = electronLog,
  read,
}: Pick<IOutputWatchOptions, 'onOutputs' | 'log' | 'read'>): IOutputWatch => {
  const root = linuxEngineRoot();
  let isStopped = false;
  let previous: string | undefined;

  // One reading at a time and one queued, however many renames land: the
  // engine rewrites the file for every change of a burst (a headset
  // connecting is several), and a reading queued behind one in flight sees
  // the last of them.
  const follow = coalesceRequests(async () => {
    let devices: IAudioDevice[];
    let signature: string | undefined;
    if (read) {
      devices = await read();
    } else {
      const outputs = await readLinuxOutputs();
      // PulseAudio also announces volume changes. Reopening Share Audio for
      // those interrupts sound on each drag; only a changed output snapshot
      // or engine PID means its devices may need to be opened again.
      signature = JSON.stringify(outputs);
      if (signature === previous) {
        return;
      }
      devices = toAudioDevices(outputs);
    }
    if (!isStopped) {
      await onOutputs(devices);
      previous = signature;
    }
  });
  const wake = () => {
    follow().catch((error) => log.warn('Following the outputs failed', error));
  };

  let watcher: fs.FSWatcher | undefined;
  try {
    // The engine makes it too; made here so the watch can start before the
    // engine has written anything.
    fs.mkdirSync(root, { recursive: true });
    watcher = fs.watch(root, (_event, file) => {
      if (file === OUTPUTS_FILE) {
        wake();
      }
    });
    watcher.on('error', (error) =>
      log.warn(`The engine's outputs are no longer followed: ${error.message}`),
    );
  } catch (error) {
    log.warn(`The engine's outputs cannot be followed in ${root}`, error);
  }
  // What is there already, which no rename will announce.
  if (fs.existsSync(path.join(root, OUTPUTS_FILE))) {
    wake();
  }

  return {
    stop: () => {
      isStopped = true;
      watcher?.close();
    },
  };
};

export default startLinuxOutputWatch;
