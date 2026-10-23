/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TAudioEngine } from 'common/audioEngine';
import type { Translate } from 'common/i18n';

/** One row of the engine dialog's radio group. */
export interface IEngineChoice {
  readonly engine: TAudioEngine;
  readonly name: string;
  readonly recommended: string | undefined;
  readonly isDisabled: boolean;
  readonly lines: readonly (readonly [string, 'yes' | 'no'])[];
}

/**
 * The engine dialog where the FluidEQ Engine ships inside the app (macOS):
 * the one engine there is, described as what it is there.
 *
 * Equalizer APO cannot exist on a Mac, and offering it put a Windows
 * installer one click away from somebody who can never run it. Nothing is
 * recommended, because there is nothing to recommend it over. And of the
 * Windows lines only the one about the EQ and the rack reaching everything
 * holds; the others are about sound-card panels and APO's own commands.
 */
export const builtInEngineChoices = (
  t: Translate,
  fluidSupported: boolean,
): readonly IEngineChoice[] => [
  {
    engine: 'fluid',
    name: t('engine.fluid.name'),
    recommended: undefined,
    isDisabled: !fluidSupported,
    lines: [
      [t('engine.fluid.builtIn.l1'), 'yes'],
      [t('engine.fluid.l2'), 'yes'],
    ],
  },
];
