/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  NATIVE_DSP_PARAMETERS,
  decodeNativeEnum,
  encodeNativeEnum,
} from '../../common/dsp/nativeParameters';
import { FilterTypeEnum } from '../../common/constants';

/**
 * The order of every enum vocabulary on the wire, pinned as literals.
 *
 * `nativeParameters.ts` promised this file by name and it did not exist. The
 * comment it promised it in was also wrong about the design in a way that
 * matters here: it said the lists were "owned here rather than read from the
 * app's own union", when in fact eight of the nine are imported straight from
 * `chain.ts`. That makes COVERAGE — does the protocol know every value the app
 * can produce — true by construction and not worth a test.
 *
 * ORDER is the invariant that is actually exposed, and nothing was holding it.
 * `encodeNativeEnum` sends `values.indexOf(value)` and `decodeNativeEnum` reads
 * `values[index]`, so the index IS the wire representation. Reordering
 * `NORMALIZER_MODES` in `chain.ts` — an edit that looks like tidying, passes
 * the type checker, and touches no file named "protocol" — silently re-points
 * every value a running host is holding. A user's normalizer would come back
 * from a restart set to something they never chose.
 *
 * So the vocabularies are written out here as literals. A reorder or an insert
 * fails loudly, in a file whose name says why; appending stays legal, which is
 * the rule the ids themselves already follow.
 */
const EXPECTED_VOCABULARIES: Record<string, readonly string[]> = {
  'normalizer.mode': ['off', 'truePeak', 'loudness'],
  'crossfade.curve': ['equalPower', 'smooth', 'linear', 'custom'],
  'eq.model': ['clean', 'proportional', 'wide'],
  'eq.engine': ['serial', 'parallel'],
  'eq.phase': ['minimum', 'linear'],
  'denoise.profileSource': ['scanned', 'adaptive'],
  'denoise.hum.mode': ['auto', 'fifty', 'sixty'],
};

/** Every parameter that declares a vocabulary, by its path. */
const enumParameters = NATIVE_DSP_PARAMETERS.filter(
  (parameter): parameter is typeof parameter & { values: readonly string[] } =>
    'values' in parameter && Array.isArray(parameter.values),
);

describe('the native enum vocabularies', () => {
  /**
   * The positive control, and it is not decoration here.
   *
   * `NATIVE_DSP_PARAMETERS` is a large literal filtered by a type guard. If
   * that guard ever stopped matching — a renamed field, a changed shape — every
   * `it.each` below would receive an empty list and the suite would report all
   * green having checked nothing at all. That is the same null-test trap the
   * separation packing bug passed clean.
   */
  it('finds the enum parameters it is meant to check', () => {
    expect(enumParameters.length).toBeGreaterThanOrEqual(
      Object.keys(EXPECTED_VOCABULARIES).length,
    );
  });

  it.each(Object.keys(EXPECTED_VOCABULARIES))(
    '%s has the exact order the wire depends on',
    (path) => {
      const parameter = enumParameters.find((entry) => entry.path === path);
      expect(parameter).toBeDefined();
      expect(parameter?.values).toEqual(EXPECTED_VOCABULARIES[path]);
    },
  );

  /**
   * Two lists share a vocabulary, and that is deliberate.
   *
   * `exciter.stereo` and `eq.stereo` are both `EQ_STEREO_MODES`. Pinning
   * them separately would let one drift; checking that they are still the same
   * three values in the same order says what is actually meant.
   */
  it('every stereo-mode parameter shares one vocabulary', () => {
    const stereo = enumParameters.filter((entry) =>
      entry.path.endsWith('stereo'),
    );
    expect(stereo.length).toBeGreaterThanOrEqual(2);
    stereo.forEach((entry) => {
      expect(entry.values).toEqual(['stereo', 'mid', 'side']);
    });
  });
});

/**
 * The one vocabulary that is genuinely a second copy.
 *
 * `EQ_BAND_TYPES` is built by hand out of `FilterTypeEnum` members rather than
 * imported, so it is the only list that CAN fall behind the union it mirrors —
 * which makes it the only place the coverage check the old comment described is
 * a real check rather than a tautology.
 *
 * Uncommenting a filter type in `constants.ts` is the edit that does it. There
 * are seven commented-out members sitting directly under the seven live ones,
 * so this is not hypothetical: enabling All Pass gives the UI a band type the
 * protocol cannot encode, and `encodeNativeEnum` answers `undefined` for it.
 * The band would simply not reach the engine.
 */
describe('the EQ band-type vocabulary', () => {
  const bandTypes = enumParameters.find(
    (entry) => entry.path === 'eq.bands[].type',
  );

  it('is declared', () => {
    expect(bandTypes).toBeDefined();
  });

  it('covers every filter type the app can produce', () => {
    const appTypes = Object.values(FilterTypeEnum);
    expect(appTypes.length).toBeGreaterThan(0);
    appTypes.forEach((type) => {
      expect(bandTypes?.values).toContain(type);
    });
  });

  it('has the exact order the wire depends on', () => {
    expect(bandTypes?.values).toEqual([
      FilterTypeEnum.PK,
      FilterTypeEnum.NO,
      FilterTypeEnum.LSC,
      FilterTypeEnum.HSC,
      FilterTypeEnum.LPQ,
      FilterTypeEnum.HPQ,
      FilterTypeEnum.BP,
    ]);
  });
});

/**
 * The codecs, round-tripped.
 *
 * Both answer `undefined` for something they have never heard of, and the
 * module comment is explicit that a caller must treat that as a refusal rather
 * than coercing to zero — "zero is a real setting". Worth holding, because
 * `indexOf` returning `-1` and an index of `0` are one careless `||` apart.
 */
describe('the enum codecs', () => {
  it('round-trips every value of every vocabulary', () => {
    enumParameters.forEach((parameter) => {
      parameter.values.forEach((value, index) => {
        expect(encodeNativeEnum(parameter.id, value)).toBe(index);
        expect(decodeNativeEnum(parameter.id, index)).toBe(value);
      });
    });
  });

  it('refuses a value the protocol has never heard of', () => {
    const first = enumParameters[0];
    expect(encodeNativeEnum(first.id, 'not-a-real-value')).toBeUndefined();
  });

  it('refuses an index past the end rather than wrapping', () => {
    const first = enumParameters[0];
    expect(decodeNativeEnum(first.id, first.values.length)).toBeUndefined();
    expect(decodeNativeEnum(first.id, -1)).toBeUndefined();
  });

  it('refuses an id that is not an enum parameter', () => {
    expect(encodeNativeEnum(0, 'off')).toBeUndefined();
    expect(decodeNativeEnum(0, 0)).toBeUndefined();
  });
});
