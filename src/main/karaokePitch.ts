/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, ipcMain } from 'electron';
import path from 'path';
import log from 'electron-log';

/**
 * Vocal pitch detection on SwiftF0, run in the main process.
 *
 * Basic Pitch detected the notes first, and on real songs the notes were the
 * weakest part of the result: it is a polyphonic transcriber, built to pull
 * chords out of a mix, and even against a clean vocal stem it reported
 * harmonics and breath as extra notes. SwiftF0 is the opposite bet — a
 * monophonic pitch tracker built for exactly one voice — and it is 398KB of
 * MIT-licensed ONNX, small enough to ship inside the installer: no download,
 * no consent dialog, no cache to manage.
 *
 * The contract was verified empirically before this file was written: input
 * `input_audio` [1, N] float32 at 16kHz, outputs `pitch_hz` and `confidence`
 * per ~16ms frame (hop 256). A 440Hz sine reads 437.5Hz at 0.99 confidence.
 * The renderer decodes and segments; this side only runs the model.
 */

const modelPath = () =>
  path.join(
    app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets'),
    'models/swift-f0.onnx',
  );

/** SwiftF0's fixed processing rate and hop, from its published contract. */
export const SWIFT_F0_SAMPLE_RATE = 16_000;
export const SWIFT_F0_HOP = 256;

type TOnnxSession = {
  inputNames: string[];
  run: (
    feeds: Record<string, unknown>,
  ) => Promise<Record<string, { data: Float32Array }>>;
};

let session: TOnnxSession | undefined;

export const registerKaraokePitch = () => {
  ipcMain.on('karaoke-pitch-release', () => {
    session = undefined;
    log.info('[karaoke][pitch] SwiftF0 session released');
  });
  ipcMain.handle('karaoke-pitch-f0', async (_event, samples: Float32Array) => {
    // eslint-disable-next-line global-require
    const ort = require('onnxruntime-node');
    if (!session) {
      session = (await ort.InferenceSession.create(modelPath(), {
        executionProviders: ['cpu'],
      })) as TOnnxSession;
      log.info('[karaoke][pitch] SwiftF0 session ready');
    }
    const output = await session.run({
      input_audio: new ort.Tensor('float32', samples, [1, samples.length]),
    });
    return {
      pitchHz: output.pitch_hz.data,
      confidence: output.confidence.data,
      hopSeconds: SWIFT_F0_HOP / SWIFT_F0_SAMPLE_RATE,
    };
  });
};
