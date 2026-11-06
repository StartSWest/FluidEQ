/* FluidEQ — GPL-3.0-or-later */
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../src/common/dsp/chainWire';
import { presetToneOf } from '../../src/common/dsp/presetTone';
import { dspPresetVoicing } from '../../src/common/dsp/presetVoicing';
import type { IDspPreset } from '../../src/common/dsp/presets';

export const factoryMusicTone = (preset: IDspPreset) => {
  if (!preset.curve) throw new Error(`Music preset has no curve: ${preset.id}`);
  return presetToneOf(
    {
      isEnabled: true,
      voicing: dspPresetVoicing(preset.id, preset.curve),
      bypassed: [],
      eqMode: 'normal',
      curveEqMode: 'normal',
      isEqDoubleOn: false,
      eqBandQ: 'off',
      curveBandQ: 'off',
    },
    { eq: true, curves: true },
  );
};

/** Includes every native scalar and the curve's actual frequency/Q/model design. */
export const factoryMusicLine = (preset: IDspPreset): string =>
  appendPresetTone(
    encodeChainSettings(preset.settings),
    factoryMusicTone(preset),
  ).join(' ');

export const musicConfigurationSha256 = (preset: IDspPreset): string =>
  createHash('sha256').update(factoryMusicLine(preset)).digest('hex');

const sourceFiles = (
  root: string,
  relative: string,
  extensions = /\.(cpp|h|c)$/,
): string[] =>
  readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(
    (entry) => {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(root, file, extensions);
      // This header is generated from the pinned TypeScript table below.
      if (entry.name === 'parameters.h') return [];
      // Display-only measured results are generated AFTER the render. They
      // never configure processing; hashing them would make evidence circular.
      if (file === 'src/common/dsp/genreEvidence.ts') return [];
      return extensions.test(entry.name) ? [file] : [];
    },
  );

/**
 * Recorded JSON cannot validate a different implementation. Normalize checkout
 * newlines so the same source has the same identity on Windows and Linux;
 * include processing, host integration, coefficient/wire definitions and the
 * analysed-source gain calculation used by the reference renderer.
 */
export const musicProcessingSources = (root: string) => {
  const files = [
    ...new Set([
      'native/CMakeLists.txt',
      'native/system-apo/CMakeLists.txt',
      'native/system-apo/src/engine.rc',
      'docs/dsp/music-reference-policy.json',
      '.erb/scripts/generate-native-parameters.ts',
      '.erb/scripts/build-native-dsp.ts',
      '.erb/scripts/generate-music-dsp-fixture.ts',
      'src/common/dsp/nativeParameters.ts',
      'src/common/dsp/chainStageSettings.ts',
      'src/common/dsp/chainWire.ts',
      'src/common/dsp/presetTone.ts',
      'src/common/dsp/presetVoicing.ts',
      'src/common/dsp/sourceAnalysis.ts',
      'src/renderer/dsp/loudnessAnalysis.ts',
      'src/renderer/dsp/inputNormalizer.ts',
      'src/renderer/dsp/biquad.ts',
      'src/renderer/dsp/biquadMatched.ts',
      'src/renderer/dsp/oversample.ts',
      'src/renderer/dsp/truePeak.ts',
      'src/main/sourceAnalysis.ts',
      'src/main/engineHealth.ts',
      'src/main/ipc/library.ts',
      'src/common/library/types.ts',
      'src/common/library/normalization.ts',
      '.erb/scripts/music-reference-audio.ts',
      '.erb/scripts/review-music-references.ts',
      '.erb/scripts/music-dsp-evidence.ts',
      '.erb/scripts/preset-hearing.ts',
      'native/dsp-core/tests/music_factory_test.cpp',
      'native/system-apo/src/source_analysis.cpp',
      'native/system-apo/src/source_analysis.h',
      ...sourceFiles(root, 'native/dsp-core/src'),
      ...sourceFiles(root, 'native/dsp-core/include'),
      ...sourceFiles(root, 'native/dsp-host/src'),
      ...sourceFiles(root, 'native/system-apo/src'),
      ...sourceFiles(root, 'native/system-apo/include'),
      ...sourceFiles(root, 'src/common/dsp', /\.ts$/),
      ...sourceFiles(root, 'src/main/dspHost', /\.ts$/),
    ]),
  ].sort();
  const hash = createHash('sha256');
  files.forEach((file) => {
    hash.update(file).update('\0');
    hash.update(
      readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'),
    );
    hash.update('\0');
  });
  return { files, sha256: hash.digest('hex') };
};
