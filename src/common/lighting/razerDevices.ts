/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { KIND_OF_FORM, razerFormOf, type TDeviceForm } from './deviceForms';
import type { TChromaChannel } from './lampLayouts';
import type { TLightingKind } from './lightingModel';
import { razerProductOf, type TRazerClass } from './razerProducts';

/**
 * What a Razer device is: its name, what it looks like, and whether and how
 * Razer Chroma lights it.
 *
 * The product ids its interfaces carry decide first (`razerProducts.ts`).
 * Only a product newer than that table falls back to its name — Razer's
 * product lines have kept their names for a decade, a DeathAdder has always
 * been a mouse — and a name matching no line is an accessory, drawn as one
 * and still lit.
 */

/** What Windows reports about one Razer device. */
export interface IRazerIdentity {
  name: string;
  /** The first product id Windows listed for it. */
  productId: number;
  /** Every product id among its interfaces, where the helper reports them. */
  productIds?: readonly number[];
}

export interface IRazerDescription {
  /**
   * Razer's own name where Windows has only the device's USB string, which
   * for some products is a code ("DSV2Pro TKL").
   */
  name: string;
  form: TDeviceForm;
  kind: TLightingKind;
  /** Whether Razer Chroma can light it at all. */
  lit: boolean;
  /** The Chroma channel that lights it. */
  channel: TChromaChannel;
  /** Its LEDs' zones on the mousepad channel, where Razer's LED map says. */
  zones?: readonly number[];
}

/**
 * Razer products made without lights Razer Chroma controls, for a product
 * id the table does not know yet: receivers (another face of the device they
 * receive for); headsets and earbuds without Chroma; webcams, whose one ring
 * light is plain white; microphones with only a status light; controllers
 * lit from a phone or console app, if at all; hubs and eGPUs without Chroma.
 * Showing any of them as a device that follows the scene would be a promise
 * the desk does not keep.
 */
const UNLIT: readonly RegExp[] = [
  /receiver|dongle|transceiver|control device|\bhub\b/,
  /blackshark|opus|thresher|kaira|hammerhead|freyja|clio/,
  /barracuda(?!.*chroma)/,
  /kraken (x\b|tournament)|kraken kitty v3 x/,
  /kiyo/,
  /seiren (mini|x\b|elite|bt|v2|v3 mini)/,
  /nommo v2 x|^razer nommo$/,
  /^razer leviathan$/,
  /kishi(?!.*ultra)/,
  /wolverine(?!.*v3 pro)|v3 pro 8k|raiju|raion|panthera|kitsune/,
  /usb-c dock|usb ?4 dock/,
  /core x v2|core x(?!.*chroma)/,
  /pwm/,
];

const litByName = (name: string): boolean => {
  const lower = name.toLowerCase();
  if (UNLIT.some((pattern) => pattern.test(lower))) {
    return false;
  }
  if (lower.includes('dock') && !lower.includes('chroma')) {
    // A mouse dock is a stand with lights; a plain dock is a hub.
    return lower.includes('mouse dock');
  }
  return true;
};

/** What a Razer class looks like when neither name says. */
const FORM_OF_CLASS: Readonly<Record<TRazerClass, TDeviceForm>> = {
  keyboard: 'keyboard-full',
  mouse: 'mouse',
  mousemat: 'mousepad',
  headset: 'headset',
  keypad: 'keypad',
  system: 'laptop',
  speaker: 'speakers',
  accessory: 'accessory',
  chromamodule: 'accessory',
  external: 'accessory',
};

/**
 * The channel Razer Chroma lights a kind of device on, for a product the
 * table does not know. Stands, speakers and the rest share Chroma Link.
 */
const CHANNEL_OF_KIND: Readonly<Record<TLightingKind, TChromaChannel>> = {
  keyboard: 'keyboard',
  mouse: 'mouse',
  mousepad: 'mousepad',
  headset: 'headset',
  keypad: 'keypad',
  stand: 'chromalink',
  speaker: 'chromalink',
  accessory: 'chromalink',
};

export const describeRazer = (device: IRazerIdentity): IRazerDescription => {
  const product = razerProductOf(device.productIds ?? [device.productId]);
  if (product === undefined || product === 'unlit') {
    const form = razerFormOf(device.name);
    const kind = KIND_OF_FORM[form];
    return {
      name: device.name,
      form,
      kind,
      lit: product === undefined && litByName(device.name),
      channel: CHANNEL_OF_KIND[kind],
    };
  }
  // Razer's driver names its nodes "Razer …"; anything else is the device's
  // own USB string — "DSV2Pro TKL", "RAZER THUNDERBOLT 4 DOCK CHROMA".
  const name =
    product.name && !device.name.startsWith('Razer ')
      ? product.name
      : device.name;
  // Razer's name for the product first: it says "Tenkeyless" where the
  // device's own string says "TKL" or nothing at all.
  const byProduct = product.name ? razerFormOf(product.name) : 'accessory';
  const byName = razerFormOf(device.name);
  let form = FORM_OF_CLASS[product.razerClass];
  if (byProduct !== 'accessory') {
    form = byProduct;
  } else if (byName !== 'accessory') {
    form = byName;
  }
  return {
    name,
    form,
    kind: KIND_OF_FORM[form],
    lit: true,
    channel: product.channel,
    ...(product.zones ? { zones: product.zones } : {}),
  };
};
