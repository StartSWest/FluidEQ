/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's own effects as the setup helper's status lists them
 * (`runs`, `ownEffectsTaken`), read into what the Mic tab's card shows.
 */

import type { IMicEffect, TMicEffectKind } from '../common/audioEngine';

const MIC_EFFECT_KINDS: readonly TMicEffectKind[] = [
  'stream',
  'mode',
  'endpoint',
];

const isMicEffectKind = (value: unknown): value is TMicEffectKind =>
  MIC_EFFECT_KINDS.some((kind) => kind === value);

/** A text field of the helper's, left out where it is absent or blank. */
const textField = <K extends string>(
  key: K,
  value: unknown,
): Partial<Record<K, string>> =>
  typeof value === 'string' && value.trim() !== ''
    ? ({ [key]: value } as Record<K, string>)
    : {};

/**
 * The helper's `runs` and `ownEffectsTaken`, or nothing from an older one.
 * Each effect keeps what the helper read of it (`setup/apo_names.h`); an
 * older helper's carry the class id and the name alone.
 */
const parseMicEffects = (value: unknown): IMicEffect[] | undefined =>
  Array.isArray(value)
    ? value.flatMap((entry: unknown): IMicEffect[] => {
        if (typeof entry !== 'object' || entry === null) {
          return [];
        }
        const {
          clsid,
          name,
          maker,
          description,
          file,
          version,
          windows,
          kind,
        } = entry as Record<string, unknown>;
        if (typeof clsid !== 'string') {
          return [];
        }
        return [
          {
            clsid,
            name: typeof name === 'string' ? name : '',
            ...textField('maker', maker),
            ...textField('description', description),
            ...textField('file', file),
            ...textField('version', version),
            ...(windows === true ? { windows: true } : {}),
            ...(isMicEffectKind(kind) ? { kind } : {}),
          },
        ];
      })
    : undefined;

export default parseMicEffects;
