/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What main hands the tray to tell the FluidEQ Engine the song while main is
 * gone: only under that engine and with the media helper to read songs from,
 * and named exactly as main names its own programme files.
 */

import path from 'path';
import { outputConfigFileName } from '../../../common/outputConfigFiles';
import { songHandover } from '../../../main/nativeTray/songHandover';
import { leavingLine } from '../../../main/nativeTray/trayHostWire';

const ENGINE = path.join('C:', 'ProgramData', 'FluidEQ', 'engine');
const DATA = path.join('C:', 'data');

const deps = {
  resolveConfigDir: () => Promise.resolve(path.join(ENGINE, 'config')),
  mediaExecutable: path.join('C:', 'app', 'FluidEQ-Media.exe'),
  selfId: 'FluidEQ',
  userDataDir: DATA,
  mainEndpoint: '{6C1F5A7E-2B3D-4E5F-8A9B-0C1D2E3F4A5B}',
  singlePlayer: true,
  pauseOthers: { file: 'powershell.exe', args: ['-Command', 'pause'] },
};

describe('the song job main hands the tray', () => {
  it("names main's own files, and reads statuses from the engine's root", async () => {
    const songs = await songHandover(deps);
    expect(songs).toEqual({
      mediaExe: deps.mediaExecutable,
      selfId: 'FluidEQ',
      configDir: path.join(ENGINE, 'config'),
      statusDir: ENGINE,
      levelsFile: path.join(DATA, 'song-levels.json'),
      rootName: 'fluideq-programme.txt',
      perOutputPrefix: 'fluideq-programme-',
      mainEndpoint: deps.mainEndpoint,
      singlePlayer: true,
      pauseOthers: deps.pauseOthers,
    });
    // The prefix and a GUID make the very name main writes for that output.
    const guid = '6c1f5a7e-2b3d-4e5f-8a9b-0c1d2e3f4a5b';
    expect(`${songs?.perOutputPrefix}${guid}.txt`).toBe(
      outputConfigFileName('programme', guid),
    );
  });

  it('hands nothing over off the FluidEQ Engine, or with no media helper', async () => {
    await expect(
      songHandover({
        ...deps,
        resolveConfigDir: () => Promise.resolve(undefined),
      }),
    ).resolves.toBeUndefined();
    await expect(
      songHandover({ ...deps, mediaExecutable: undefined }),
    ).resolves.toBeUndefined();
  });

  it('leaves the main output out when there is none', async () => {
    const songs = await songHandover({ ...deps, mainEndpoint: undefined });
    expect(songs).not.toHaveProperty('mainEndpoint');
  });

  it('travels in the leaving line, and only when there is one', async () => {
    const relaunch = { file: 'FluidEQ.exe', args: [], cwd: DATA };
    const songs = await songHandover(deps);
    expect(JSON.parse(leavingLine(relaunch, songs))).toEqual({
      type: 'leaving',
      relaunch,
      songs,
    });
    expect(JSON.parse(leavingLine(relaunch))).toEqual({
      type: 'leaving',
      relaunch,
    });
  });
});
