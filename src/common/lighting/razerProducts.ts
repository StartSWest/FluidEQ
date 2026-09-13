/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { CHROMA_CHANNELS, type TChromaChannel } from './lampLayouts';
import { RAZER_PRODUCTS, RAZER_UNLIT, RAZER_ZONES } from './razerProductData';

/**
 * Razer's products by USB product id: what Razer calls each one, the class
 * Razer Chroma files it under, and the Chroma channel that lights it.
 *
 * Names alone failed on real machines. A DeathStalker V2 Pro Tenkeyless's
 * Windows container is called "DSV2Pro TKL", a BlackShark V3 has no "Razer"
 * in its name, every Blade laptop is just "Razer Blade", and Razer's own
 * driver renames some interfaces only where Synapse is installed. The product
 * id stays the same through all of that.
 *
 * Gathered 2026-09 from the device table and LED maps Razer Chroma SDK 3.39
 * installs with Synapse 4 (`Devices.xml`, `bin\*.dat`), cross-checked with
 * OpenRazer's and OpenRGB's device definitions and USB captures.
 */

const RAZER_CLASSES = [
  'keyboard',
  'mouse',
  'mousemat',
  'headset',
  'keypad',
  'system',
  'accessory',
  'chromamodule',
  'speaker',
  'external',
] as const;

/** Razer Chroma's class for a product; `system` is a laptop. */
export type TRazerClass = (typeof RAZER_CLASSES)[number];

export interface IRazerProduct {
  productId: number;
  /** Razer's name for it; empty for an id Razer lists without naming. */
  name: string;
  razerClass: TRazerClass;
  channel: TChromaChannel;
  /**
   * A mousepad-channel product's LEDs, LED 0 first: which of the channel's
   * twenty zones each one shows (`CHROMA_CHANNEL_LAMPS.mousepad` order).
   */
  zones?: readonly number[];
}

const hex = (text: string) => Number.parseInt(text, 16);

const lines = (table: string) => table.trim().split('\n');

const isRazerClass = (text: string): text is TRazerClass =>
  (RAZER_CLASSES as readonly string[]).includes(text);

const isChromaChannel = (text: string): text is TChromaChannel =>
  (CHROMA_CHANNELS as readonly string[]).includes(text);

const ZONES_BY_ID: ReadonlyMap<number, readonly number[]> = new Map(
  lines(RAZER_ZONES).map((line) => {
    const [id, zones] = line.split(' ');
    return [hex(id), zones.split(',').map(Number)];
  }),
);

const PRODUCT_BY_ID: ReadonlyMap<number, IRazerProduct> = new Map(
  lines(RAZER_PRODUCTS).map((line): [number, IRazerProduct] => {
    const [id, razerClass, channel, ...words] = line.split(' ');
    if (!isRazerClass(razerClass) || !isChromaChannel(channel)) {
      throw new Error(`Malformed Razer product line: ${line}`);
    }
    const productId = hex(id);
    const name = words.join(' ');
    const zones = ZONES_BY_ID.get(productId);
    return [
      productId,
      {
        productId,
        name: name === '-' ? '' : name,
        razerClass,
        channel,
        ...(zones ? { zones } : {}),
      },
    ];
  }),
);

const UNLIT_IDS: ReadonlySet<number> = new Set(
  RAZER_UNLIT.trim().split(/\s+/).map(hex),
);

/**
 * What Razer's table says of a device from every product id its interfaces
 * carry: the lit product among them; `unlit` when each id is one Razer
 * Chroma cannot light; undefined when any id is one the table has never seen
 * — a product newer than it — so its name has to decide.
 */
export const razerProductOf = (
  productIds: readonly number[],
): IRazerProduct | 'unlit' | undefined => {
  const lit = productIds
    .map((id) => PRODUCT_BY_ID.get(id))
    .find((product) => product !== undefined);
  if (lit) {
    return lit;
  }
  return productIds.length > 0 && productIds.every((id) => UNLIT_IDS.has(id))
    ? 'unlit'
    : undefined;
};
