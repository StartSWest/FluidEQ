/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { sceneFinishHeader } from 'renderer/graph/sceneFinishHeader';

/**
 * The desktop backgrounds drawn by C++ are brought up to size by FSR and
 * smoothed by FXAA with the very programs the window links
 * (`scene_finish_sources.h`). A pass changed here and not regenerated there
 * finishes the desktop differently from the graph, with nothing to say so —
 * so this holds the header to the TypeScript byte for byte.
 */
it('carries the programs the window finishes its scenes with now', () => {
  const header = readFileSync(
    path.resolve(process.cwd(), 'native/scene-host/src/scene_finish_sources.h'),
    'utf8',
  );
  expect(header).toBe(sceneFinishHeader());
});

it('carries the licences of the passes it copies', () => {
  const header = sceneFinishHeader();
  expect(header).toContain('Copyright (c) 2014, NVIDIA CORPORATION');
  expect(header).toContain('Copyright (c) 2021 Advanced Micro Devices, Inc.');
  expect(header).toContain('Permission is hereby granted, free of charge');
});
