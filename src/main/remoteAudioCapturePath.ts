/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { existsSync } from 'fs';
import path from 'path';

export const REMOTE_AUDIO_CAPTURE_EXECUTABLE =
  process.platform === 'win32' ? 'FluidEQ-LAN-Capture.exe' : undefined;

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

const candidates = (): string[] => {
  if (!REMOTE_AUDIO_CAPTURE_EXECUTABLE) {
    return [];
  }
  return [
    path.join(resourcesPath(), 'native', REMOTE_AUDIO_CAPTURE_EXECUTABLE),
    path.join(
      __dirname,
      '../../../native/.build/bin',
      REMOTE_AUDIO_CAPTURE_EXECUTABLE,
    ),
    path.join(
      __dirname,
      '../../native/.build/bin',
      REMOTE_AUDIO_CAPTURE_EXECUTABLE,
    ),
  ];
};

export const findRemoteAudioCaptureExecutable = (): string | undefined =>
  candidates().find((candidate) => existsSync(candidate));
