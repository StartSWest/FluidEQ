/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TLightingKind } from './lightingModel';

/**
 * What a Razer device is, from its product name.
 *
 * Razer Synapse lights devices by kind and never lists them, and Windows says
 * only "HID-compliant mouse" for a Razer keyboard's macro collection. Razer's
 * product lines, though, have kept their names for a decade — a DeathAdder has
 * always been a mouse — so the line in the name is the most reliable answer on
 * offer. A name matching no line is an accessory, which is drawn as one and
 * still lit through Chroma Link.
 */
const LINES: readonly (readonly [TLightingKind, readonly string[]])[] = [
  [
    'keyboard',
    [
      'blackwidow',
      'deathstalker',
      'huntsman',
      'ornata',
      'cynosa',
      'pro type',
      'reclusa',
      'turret keyboard',
      'anansi',
      'blade',
    ],
  ],
  [
    'mouse',
    [
      'basilisk',
      'deathadder',
      'viper',
      'naga',
      'cobra',
      'orochi',
      'mamba',
      'lancehead',
      'pro click',
      'boomslang',
      'atheris',
      'abyssus',
      'turret mouse',
      'diamondback',
      'imperator',
      'ouroboros',
      'taipan',
    ],
  ],
  ['mousepad', ['firefly', 'goliathus', 'strider chroma', 'sphex', 'vespula']],
  [
    'headset',
    ['kraken', 'nari', "man o'war", 'tiamat', 'electra', 'hammerhead'],
  ],
  ['keypad', ['tartarus', 'orbweaver', 'nostromo']],
  [
    'stand',
    [
      'base station',
      'mouse dock',
      'laptop stand',
      'mouse bungee',
      'charging pad',
      'charging dock',
    ],
  ],
  ['speaker', ['nommo', 'leviathan']],
];

export const razerKindOf = (name: string): TLightingKind => {
  const lower = name.toLowerCase();
  const line = LINES.find(([, names]) =>
    names.some((product) => lower.includes(product)),
  );
  return line ? line[0] : 'accessory';
};

/**
 * Razer devices with no lights of their own. A wireless receiver is another
 * face of the device it receives for; the BlackShark, Barracuda, Opus and
 * Thresher headsets were made without RGB; and a dock is listed only when its
 * name says it has Chroma. Showing any of them as a device that follows the
 * scene would be a promise the desk does not keep.
 */
export const isRazerLightingCandidate = (name: string): boolean => {
  const lower = name.toLowerCase();
  if (!lower.startsWith('razer ')) {
    return false;
  }
  if (
    /receiver|dongle|transceiver|control device|blackshark|barracuda|opus|thresher/.test(
      lower,
    )
  ) {
    return false;
  }
  if (lower.includes('dock') && !lower.includes('chroma')) {
    // A mouse dock is a stand with lights; a USB-C dock is a hub.
    return lower.includes('mouse dock');
  }
  return true;
};
