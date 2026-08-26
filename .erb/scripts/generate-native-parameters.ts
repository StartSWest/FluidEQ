/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Emit the C parameter header from the TypeScript table.
 *
 * There is one list of parameter ids in this project and it lives in
 * `src/common/dsp/nativeParameters.ts`. Hand-maintaining a second copy in C
 * would work right up until somebody added a control on one side only, at
 * which point a dial would drive whatever processor happened to share its id —
 * silently, and only in release builds where nobody is watching the console.
 *
 * Run by `build:native-dsp` before CMake, so the header cannot be stale. It is
 * gitignored for the same reason: a committed copy is a copy that can be wrong.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import {
  NATIVE_DSP_PARAMETERS,
  NATIVE_DSP_PARAMETER_SCHEMA_VERSION,
} from '../../src/common/dsp/nativeParameters';

const OUTPUT = path.join(
  __dirname,
  '..',
  '..',
  'native',
  'dsp-core',
  'include',
  'fluideq',
  'parameters.h',
);

/** `exciter.bands[].freqHz` becomes `EXCITER_BANDS_FREQ_HZ`. */
const macroName = (parameterPath: string): string =>
  parameterPath
    .replace(/\[\]/g, '')
    .split('.')
    .map((segment) =>
      segment.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
    )
    .join('_');

const build = (): string => {
  const lines: string[] = [];
  const push = (line = '') => lines.push(line);

  push('/*');
  push('<FluidEQ: System-wide parametric audio equalizer interface>');
  push('Copyright (C) <2026>  <Ivan Carmenates Garcia>');
  push('SPDX-License-Identifier: GPL-3.0-or-later');
  push('*/');
  push();
  push('/*');
  push(' * GENERATED FILE. Do not edit.');
  push(' *');
  push(' * Source: src/common/dsp/nativeParameters.ts');
  push(' * Writer: .erb/scripts/generate-native-parameters.ts');
  push(' *');
  push(' * Ids are permanent and sparse. Slots are dense, are derived from the');
  push(' * order of the table, and change whenever the table does — so a slot');
  push(' * must never be persisted, sent over the wire, or written down.');
  push(' */');
  push('#ifndef FLUIDEQ_PARAMETERS_H');
  push('#define FLUIDEQ_PARAMETERS_H');
  push();
  push('#include <stdint.h>');
  push();
  push(
    `#define FEQ_PARAMETER_SCHEMA_VERSION ${NATIVE_DSP_PARAMETER_SCHEMA_VERSION}`,
  );
  push(`#define FEQ_PARAMETER_COUNT ${NATIVE_DSP_PARAMETERS.length}`);
  push();
  push('enum FeqParameterId {');
  NATIVE_DSP_PARAMETERS.forEach((parameter) => {
    push(`  FEQ_PARAM_${macroName(parameter.path)} = ${parameter.id},`);
  });
  push('};');
  push();
  push('/* Table order. The index into this array is the parameter slot. */');
  push('static const uint32_t FEQ_PARAMETER_IDS[FEQ_PARAMETER_COUNT] = {');
  NATIVE_DSP_PARAMETERS.forEach((parameter) => {
    push(`  ${parameter.id}u, /* ${parameter.path} */`);
  });
  push('};');
  push();
  push('/*');
  push(' * Whether applying this needs work the audio thread must not do:');
  push(' * a coefficient set, a linear-phase kernel, a resampler, a routing');
  push(' * topology. Prepared on a worker and swapped whole at a block edge.');
  push(' */');
  push('static const uint8_t FEQ_PARAMETER_STRUCTURAL[FEQ_PARAMETER_COUNT] = {');
  NATIVE_DSP_PARAMETERS.forEach((parameter) => {
    const structural = 'structural' in parameter && parameter.structural;
    push(`  ${structural ? 1 : 0}, /* ${parameter.path} */`);
  });
  push('};');
  push();
  push('/*');
  push(' * Sparse id to dense slot. Returns -1 for an id this build does not');
  push(' * know, which callers must treat as a refusal: slot 0 is a real');
  push(' * parameter, so coercing an unknown id to it drives the wrong one.');
  push(' */');
  push('static inline int feq_parameter_slot(uint32_t id) {');
  push('  for (int slot = 0; slot < FEQ_PARAMETER_COUNT; ++slot) {');
  push('    if (FEQ_PARAMETER_IDS[slot] == id) {');
  push('      return slot;');
  push('    }');
  push('  }');
  push('  return -1;');
  push('}');
  push();
  push('#endif /* FLUIDEQ_PARAMETERS_H */');
  push();

  return lines.join('\n');
};

const generated = build();
mkdirSync(path.dirname(OUTPUT), { recursive: true });

// Written only when it differs, so an unchanged table does not touch the file
// and make Ninja rebuild every translation unit that includes it.
let existing = '';
try {
  existing = readFileSync(OUTPUT, 'utf8');
} catch {
  existing = '';
}
if (existing === generated) {
  console.log(`native parameters unchanged (${NATIVE_DSP_PARAMETERS.length})`);
} else {
  writeFileSync(OUTPUT, generated, 'utf8');
  console.log(
    `native parameters written: ${NATIVE_DSP_PARAMETERS.length} ids -> ${OUTPUT}`,
  );
}
