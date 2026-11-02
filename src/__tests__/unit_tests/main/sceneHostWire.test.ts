/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import {
  FIXTURE_FAILED,
  FIXTURE_GRID,
  FIXTURE_PICTURE,
  fixtureGridRgb,
  lampWireFixture,
  referenceFailed,
  referenceGrid,
  referenceLoaded,
  referencePicture,
} from 'main/lighting/lampWireFixture';
import {
  createSceneHostReader,
  encodePause,
  type ISceneHostHandlers,
} from 'main/lighting/sceneHostWire';

/**
 * `FluidEQ-Scenes.exe` and main hold one layout for the lamps' messages:
 * `lamp_messages_test.cpp` reads what this side encodes and writes what
 * this side reads, both from `lamp_wire_fixture.h`. A change to the encoder
 * that is not regenerated there is a host test held to bytes main no longer
 * sends — so the header is held to the module byte for byte.
 */
it('is what sceneHostWire.ts sends now', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/scene-host/tests/lamp_wire_fixture.h'),
    'utf8',
  );
  expect(header).toBe(lampWireFixture());
});

const handlers = () => {
  const heard = {
    grid: jest.fn(),
    picture: jest.fn(),
    loaded: jest.fn(),
    failed: jest.fn(),
    invalid: jest.fn(),
  } satisfies ISceneHostHandlers;
  return heard;
};

it('reads each of the host’s messages as the layout says', () => {
  const heard = handlers();
  const read = createSceneHostReader(heard);
  read(referenceGrid());
  read(referencePicture());
  read(referenceLoaded());
  read(referenceFailed());
  expect(heard.invalid).not.toHaveBeenCalled();
  expect(heard.grid).toHaveBeenCalledWith({
    width: 48,
    height: 27,
    ...FIXTURE_GRID,
    rgb: fixtureGridRgb(),
  });
  expect(heard.picture).toHaveBeenCalledWith(2, 1, FIXTURE_PICTURE);
  expect(heard.loaded).toHaveBeenCalledWith(42);
  expect(heard.failed).toHaveBeenCalledWith(
    FIXTURE_FAILED.id,
    'compile',
    FIXTURE_FAILED.words,
  );
});

it('hands out whole messages from a stream cut anywhere', () => {
  const heard = handlers();
  const read = createSceneHostReader(heard);
  const stream = new Uint8Array([...referenceGrid(), ...referenceLoaded()]);
  for (let at = 0; at < stream.length; at += 13) {
    read(stream.subarray(at, at + 13));
  }
  expect(heard.grid).toHaveBeenCalledTimes(1);
  expect(heard.loaded).toHaveBeenCalledWith(42);
  expect(heard.grid.mock.calls[0][0].rgb).toEqual(fixtureGridRgb());
});

it('stops at the first thing that is not the host’s', () => {
  const heard = handlers();
  const read = createSceneHostReader(heard);
  // Main's own message is no message from the host.
  read(encodePause(true));
  read(referenceLoaded());
  expect(heard.invalid).toHaveBeenCalledTimes(1);
  expect(heard.loaded).not.toHaveBeenCalled();

  // A header without the host's magic word, otherwise a fine message.
  const foreign = handlers();
  const stranger = referenceLoaded();
  new DataView(stranger.buffer).setUint32(0, 0x12345678, true);
  createSceneHostReader(foreign)(stranger);
  expect(foreign.invalid).toHaveBeenCalledTimes(1);
  expect(foreign.loaded).not.toHaveBeenCalled();

  const short = handlers();
  const grid = referenceGrid();
  // A grid that claims fewer colours than its size: the length disagrees.
  new DataView(grid.buffer).setUint32(8, grid.length - 12 - 1, true);
  createSceneHostReader(short)(grid.subarray(0, grid.length - 1));
  expect(short.invalid).toHaveBeenCalledTimes(1);
  expect(short.grid).not.toHaveBeenCalled();
});
