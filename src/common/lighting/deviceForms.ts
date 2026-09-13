/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TLightingKind } from './lightingModel';

/**
 * What a lit device looks like and where it sits on the drawn desk — separate
 * from its lighting kind, which decides how Chroma or Windows lights it.
 *
 * A Razer Mouse Dock Pro and a Base Station V2 Chroma are both lit like a
 * stand, and were both drawn as a headset stand; a Strider Chroma is a
 * mousepad to Chroma and a 900 mm desk mat on the desk. The form is the
 * second answer.
 *
 * A Razer device's form comes from Razer's name for the product, found by its
 * product id (`razerProducts.ts`), matched against Razer's product lines,
 * which have kept their names for a decade (researched 2026-09 from Razer's
 * product pages, master guides and support articles). Windows Dynamic
 * Lighting devices say their kind and their size in metres, which is enough
 * to tell a tenkeyless from a full keyboard.
 */

export type TDeviceForm =
  | 'keyboard-full'
  | 'keyboard-tkl'
  | 'keyboard-compact'
  | 'laptop'
  | 'keypad'
  | 'mouse'
  | 'mouse-dock'
  | 'charging-pad'
  | 'mouse-bungee'
  | 'mousepad'
  | 'desk-mat'
  | 'headset'
  | 'headset-stand'
  | 'speakers'
  | 'soundbar'
  | 'microphone'
  | 'laptop-stand'
  | 'monitor-stand'
  | 'dock'
  | 'light-strip'
  | 'light-bar'
  | 'lamp'
  | 'controller'
  | 'tower'
  | 'mixer'
  | 'monitor'
  | 'chair'
  | 'accessory';

/** How each form is lit when nothing more specific is known. */
export const KIND_OF_FORM: Readonly<Record<TDeviceForm, TLightingKind>> = {
  'keyboard-full': 'keyboard',
  'keyboard-tkl': 'keyboard',
  'keyboard-compact': 'keyboard',
  laptop: 'keyboard',
  keypad: 'keypad',
  mouse: 'mouse',
  'mouse-dock': 'stand',
  'charging-pad': 'stand',
  'mouse-bungee': 'stand',
  mousepad: 'mousepad',
  'desk-mat': 'mousepad',
  headset: 'headset',
  'headset-stand': 'stand',
  speakers: 'speaker',
  soundbar: 'speaker',
  microphone: 'accessory',
  'laptop-stand': 'stand',
  'monitor-stand': 'stand',
  dock: 'stand',
  'light-strip': 'accessory',
  'light-bar': 'accessory',
  lamp: 'accessory',
  controller: 'accessory',
  tower: 'accessory',
  mixer: 'accessory',
  // A Raptor 27's light is in its base, like a stand's.
  monitor: 'stand',
  chair: 'accessory',
  accessory: 'accessory',
};

/** The form a kind is drawn as when nothing more is known about the device. */
export const FORM_OF_KIND: Readonly<Record<TLightingKind, TDeviceForm>> = {
  keyboard: 'keyboard-full',
  keypad: 'keypad',
  mouse: 'mouse',
  mousepad: 'mousepad',
  headset: 'headset',
  stand: 'headset-stand',
  speaker: 'speakers',
  accessory: 'accessory',
};

/**
 * Razer product lines, most specific first: the first rule whose every word
 * appears in the lower-cased name wins, so "mouse dock" is found before
 * "mouse" could be, and "blackwidow v4 mini" before "blackwidow".
 */
const RAZER_RULES: readonly (readonly [TDeviceForm, readonly string[]])[] = [
  // Docks, stands and pads that share a word with a mouse or a keyboard.
  ['mouse-dock', ['mouse dock']],
  ['charging-pad', ['charging pad']],
  ['mouse-bungee', ['bungee']],
  ['laptop-stand', ['laptop stand']],
  ['monitor-stand', ['monitor stand']],
  ['headset-stand', ['base station']],
  ['dock', ['thunderbolt']],
  ['dock', ['handheld dock']],
  ['mixer', ['audio mixer']],
  // A Stream Controller is a grid of lit keys, drawn as one.
  ['keypad', ['stream controller']],
  // A laptop cooling pad carries the laptop the way a stand does.
  ['laptop-stand', ['cooling pad']],
  ['monitor', ['raptor']],
  ['chair', ['soma chroma']],
  // Mats: the desk-length ones first.
  ['desk-mat', ['strider chroma']],
  ['desk-mat', ['goliathus', 'extended']],
  ['desk-mat', ['goliathus', '3xl']],
  ['mousepad', ['firefly']],
  ['mousepad', ['goliathus']],
  ['mousepad', ['sphex']],
  ['mousepad', ['vespula']],
  // Keyboards by size before by family. "Mini" only with a keyboard's line:
  // a Viper Mini is a mouse and a Seiren Mini a microphone.
  ['keyboard-compact', ['blackwidow', 'mini']],
  ['keyboard-compact', ['huntsman', 'mini']],
  ['keyboard-compact', ['reclusa', 'mini']],
  ['keyboard-compact', ['joro']],
  ['keyboard-compact', ['75%']],
  ['keyboard-compact', ['65%']],
  ['keyboard-compact', ['60%']],
  ['keyboard-tkl', ['tenkeyless']],
  ['keyboard-tkl', ['tkl']],
  ['keyboard-tkl', ['huntsman tournament']],
  ['keyboard-tkl', ['blackwidow', 'tournament']],
  ['keyboard-tkl', ['blackwidow lite']],
  ['laptop', ['blade']],
  ['keyboard-full', ['blackwidow']],
  ['keyboard-full', ['huntsman']],
  ['keyboard-full', ['deathstalker']],
  ['keyboard-full', ['ornata']],
  ['keyboard-full', ['cynosa']],
  ['keyboard-full', ['pro type']],
  ['keyboard-full', ['reclusa']],
  ['keyboard-full', ['turret', 'keyboard']],
  ['keyboard-full', ['anansi']],
  ['keypad', ['tartarus']],
  ['keypad', ['orbweaver']],
  ['keypad', ['nostromo']],
  ['mouse', ['basilisk']],
  ['mouse', ['deathadder']],
  ['mouse', ['viper']],
  ['mouse', ['naga']],
  ['mouse', ['cobra']],
  ['mouse', ['orochi']],
  ['mouse', ['mamba']],
  ['mouse', ['lancehead']],
  ['mouse', ['pro click']],
  ['mouse', ['boomslang']],
  ['mouse', ['atheris']],
  ['mouse', ['abyssus']],
  ['mouse', ['diamondback']],
  ['mouse', ['imperator']],
  ['mouse', ['ouroboros']],
  ['mouse', ['taipan']],
  ['mouse', ['turret', 'mouse']],
  ['headset', ['kraken']],
  ['headset', ['nari']],
  ['headset', ["man o'war"]],
  ['headset', ['manowar']],
  ['headset', ['tiamat']],
  ['headset', ['barracuda x chroma']],
  ['headset', ['electra']],
  ['speakers', ['nommo']],
  ['soundbar', ['leviathan']],
  ['microphone', ['seiren']],
  ['light-strip', ['addressable']],
  ['light-strip', ['argb controller']],
  ['light-strip', ['light strip']],
  ['light-strip', ['hardware development kit']],
  ['light-strip', ['chroma hdk']],
  ['light-strip', ['case lighting']],
  // Aether Standing Light Bars stand beside the monitor like lamps; the
  // Monitor Light Bar sits on it.
  ['lamp', ['standing light bar']],
  ['light-bar', ['light bar']],
  ['lamp', ['key light']],
  ['lamp', ['aether lamp']],
  ['lamp', ['lamp']],
  ['controller', ['wolverine']],
  ['controller', ['kishi']],
  ['controller', ['raiju']],
  ['controller', ['kitsune']],
  ['tower', ['core x']],
  ['tower', ['core v2']],
  ['tower', ['tomahawk']],
  ['tower', ['razer core']],
  ['tower', ['lian li']],
  // An all-in-one cooler lives inside a case; the case is what is seen.
  ['tower', ['hanbo']],
];

/** A Razer device's form from its product name; `accessory` when unknown. */
export const razerFormOf = (name: string): TDeviceForm => {
  const lower = name.toLowerCase();
  const rule = RAZER_RULES.find(([, words]) =>
    words.every((word) => lower.includes(word)),
  );
  return rule ? rule[0] : 'accessory';
};

/** Windows' LampArrayKind values (Windows.Devices.Lights.LampArrayKind). */
const LAMP_ARRAY = {
  keyboard: 1,
  mouse: 2,
  gameController: 3,
  peripheral: 4,
  scene: 5,
  notification: 6,
  chassis: 7,
  wearable: 8,
  furniture: 9,
  art: 10,
  headset: 11,
  microphone: 12,
  speaker: 13,
} as const;

/**
 * A Windows Dynamic Lighting device's form from what it reports: its kind,
 * its name and its size in metres. A keyboard's width says its layout (full
 * ~0.44 m, tenkeyless ~0.36 m, compact below); a peripheral's name and width
 * say mat, pad or something else.
 */
export const lampArrayFormOf = (
  kind: number,
  name: string,
  widthMetres: number,
): TDeviceForm => {
  const lower = name.toLowerCase();
  switch (kind) {
    case LAMP_ARRAY.keyboard:
      if (
        /laptop|notebook|blade|zephyrus|legion|omen|predator|vivobook|tuf/.test(
          lower,
        )
      ) {
        return 'laptop';
      }
      if (widthMetres >= 0.4) {
        return 'keyboard-full';
      }
      return widthMetres >= 0.33 ? 'keyboard-tkl' : 'keyboard-compact';
    case LAMP_ARRAY.mouse:
      return 'mouse';
    case LAMP_ARRAY.gameController:
      return 'controller';
    case LAMP_ARRAY.headset:
    case LAMP_ARRAY.wearable:
      return 'headset';
    case LAMP_ARRAY.microphone:
      return 'microphone';
    case LAMP_ARRAY.speaker:
      return /bar/.test(lower) ? 'soundbar' : 'speakers';
    case LAMP_ARRAY.chassis:
      return 'tower';
    case LAMP_ARRAY.scene:
      return /lamp|bulb/.test(lower) ? 'lamp' : 'light-strip';
    case LAMP_ARRAY.furniture:
    case LAMP_ARRAY.art:
      return 'light-strip';
    default:
      if (/pad|mat\b|mat |powerplay/.test(lower)) {
        return widthMetres >= 0.6 ? 'desk-mat' : 'mousepad';
      }
      if (/stand|base station/.test(lower)) {
        return 'headset-stand';
      }
      if (/strip|bar\b/.test(lower)) {
        return 'light-strip';
      }
      return 'accessory';
  }
};
