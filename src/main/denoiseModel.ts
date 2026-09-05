/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

/**
 * The Voice module's model, downloaded once when the user asks for it.
 *
 * Never bundled. Ten megabytes is small enough that shipping it would be a
 * courtesy rather than a necessity, and that is exactly the argument for not
 * doing it: the installer stays the size it is, and somebody who never touches
 * the Voice module never pays for a speech model they did not want.
 *
 * DPDFNet, from Ceva. Apache-2.0, which is one-way compatible with this
 * project's GPL-3.0-or-later — not with GPLv2, which is why it was checked
 * rather than assumed. The licence was verified at the author's own repository
 * (`ceva-ip/DPDFNet`); the bytes come from the sherpa-onnx republish because
 * the author's repo ships the export scripts rather than built artefacts. That
 * split is deliberate and safe in this direction: the hash below pins exactly
 * which bytes are accepted, so the mirror is a byte source and not a
 * provenance claim.
 */

const MODEL_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/speech-enhancement-models/dpdfnet2_48khz_hr.onnx';

const MODEL_FILE = 'dpdfnet2_48khz_hr.onnx';

/**
 * Measured, and fatal on a mismatch.
 *
 * The same rule the Equalizer APO installer follows: a file we cannot identify
 * is not one to load into the audio path on somebody's machine. Bumping the
 * model means this and the byte count move with it.
 */
const MODEL_SHA256 =
  '0b399f8a58dc4d70d8cd97541f5c39869406145193b957d00a03b66070944928';

const MODEL_BYTES = 10_596_848;

const modelDir = () => path.join(app.getPath('userData'), 'denoise-models');

export const denoiseModelPath = (): string => path.join(modelDir(), MODEL_FILE);

/** Whether the exact pinned model is on disk. */
export const isDenoiseModelPresent = (): boolean => {
  try {
    const modelPath = denoiseModelPath();
    if (fs.statSync(modelPath).size !== MODEL_BYTES) {
      return false;
    }
    // Size alone let a same-length damaged file survive every restart and be
    // handed back to ONNX Runtime. Ten megabytes is cheap to identify here,
    // and the download path already defines the digest that is trusted.
    return (
      createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex') ===
      MODEL_SHA256
    );
  } catch {
    return false;
  }
};

/**
 * Where the ONNX Runtime shared library is, searched rather than resolved.
 *
 * It already ships for karaoke separation, so the voice module borrows it
 * rather than adding a second copy. What it must NOT do is ask
 * `require.resolve` where the package lives: webpack rewrites that call into
 * its own module-id lookup, so in the built main bundle it answers with a
 * number or throws. This returned undefined for every packaged build, the
 * Voice module could therefore never engage, and — because the card treated
 * "downloaded but not engaged" as failure — the download button appeared to do
 * nothing at all after fetching ten megabytes.
 *
 * The two real layouts are named instead. Under `app.asar.unpacked` when
 * packaged, under the workspace root in development. Runtime releases may
 * change the N-API directory or the Unix SONAME, but selecting another CPU's
 * library is never valid, so only `napi-vN/<platform>/<arch>` is searched.
 */
export const onnxRuntimeLibraryPath = (): string | undefined => {
  if (!['win32', 'darwin', 'linux'].includes(process.platform)) {
    return undefined;
  }
  const roots = [
    process.resourcesPath
      ? path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          'onnxruntime-node',
        )
      : undefined,
    path.join(app.getAppPath(), 'node_modules', 'onnxruntime-node'),
    // The workspace root in development: `getAppPath` points at `release/app`,
    // whose node_modules is a link and does not carry the runtime itself.
    path.join(app.getAppPath(), '..', '..', 'node_modules', 'onnxruntime-node'),
  ].filter((root): root is string => root !== undefined);

  try {
    const matchesRuntime = (name: string) => {
      if (process.platform === 'win32') {
        return name === 'onnxruntime.dll';
      }
      if (process.platform === 'darwin') {
        return /^libonnxruntime(?:\.\d+(?:\.\d+)*)?\.dylib$/.test(name);
      }
      return /^libonnxruntime\.so(?:\.\d+(?:\.\d+)*)?$/.test(name);
    };
    const candidates = roots.flatMap((root) => {
      const bin = path.join(root, 'bin');
      if (!fs.existsSync(bin)) {
        return [];
      }
      return fs
        .readdirSync(bin, { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && /^napi-v\d+$/.test(entry.name),
        )
        .map((entry) => entry.name)
        .sort(
          (left, right) =>
            Number(right.slice('napi-v'.length)) -
            Number(left.slice('napi-v'.length)),
        )
        .flatMap((napiDirectory) => {
          const runtimeDirectory = path.join(
            bin,
            napiDirectory,
            process.platform,
            process.arch,
          );
          if (!fs.existsSync(runtimeDirectory)) {
            return [];
          }
          return (
            fs
              .readdirSync(runtimeDirectory, { withFileTypes: true })
              .filter((entry) => entry.isFile() || entry.isSymbolicLink())
              .map((entry) => entry.name)
              .filter(matchesRuntime)
              // Prefer the stable SONAME over a fully versioned duplicate,
              // while keeping the result independent from enumeration order.
              .sort((left, right) =>
                left.length === right.length
                  ? left.localeCompare(right)
                  : left.length - right.length,
              )
              .map((name) => path.join(runtimeDirectory, name))
          );
        });
    });
    return candidates[0];
  } catch {
    return undefined;
  }
};

export interface IDenoiseModelProgress {
  received: number;
  total: number;
}

let downloading = false;

/**
 * Fetch the model to disk, verify it, and only then put it where it is found.
 *
 * Read whole and then written, never streamed through `pipeline`: fetch plus
 * pipeline crashes inside Node's HTTP parser when the disk is slower than the
 * socket, and it does so AFTER every byte has arrived — which looks exactly
 * like a flaky mirror and is not.
 *
 * Written under a temporary name and renamed only once the hash matches, so a
 * crash or a truncated download cannot leave a file that looks cached forever
 * after and fails at session creation instead.
 */
export const downloadDenoiseModel = async (
  onProgress: (progress: IDenoiseModelProgress) => void,
): Promise<boolean> => {
  if (isDenoiseModelPresent()) {
    return true;
  }
  if (downloading) {
    return false;
  }
  downloading = true;
  const target = denoiseModelPath();
  const temporary = `${target}.download`;
  try {
    fs.mkdirSync(modelDir(), { recursive: true });
    const response = await fetch(MODEL_URL);
    if (!response.ok || !response.body) {
      return false;
    }
    const total = Number(response.headers.get('content-length') ?? MODEL_BYTES);
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop -- a stream is read in order.
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      parts.push(value);
      received += value.length;
      onProgress({ received, total });
    }
    const bytes = Buffer.concat(parts);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== MODEL_SHA256) {
      // Not a warning. A model whose bytes we cannot identify does not go into
      // the audio path, and leaving the file behind would make the next
      // attempt trust it.
      log.error(`denoise model: sha256 ${digest}, expected ${MODEL_SHA256}`);
      return false;
    }
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, target);
    return true;
  } catch (error) {
    log.error('denoise model download failed', error);
    return false;
  } finally {
    try {
      if (fs.existsSync(temporary)) {
        fs.unlinkSync(temporary);
      }
    } catch {
      // A leftover temporary is harmless; it is overwritten next attempt.
    }
    downloading = false;
  }
};
