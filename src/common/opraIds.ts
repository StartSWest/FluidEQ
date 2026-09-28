/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

/**
 * A product id as the importer writes it: `razer::kraken_v3_pro`, a vendor and
 * a slug of lowercase letters, digits, `_`, `&` and `-`. The vendor half names
 * the product's shard file, so nothing that could leave the curves folder — a
 * dot, a separator, a drive colon — ever counts as an id, whatever asks.
 *
 * One rule for both ends: the app refuses a downloaded library holding any id
 * outside it, and `opraLibraryTest.ts` holds the library the monthly job
 * publishes to it, so an id OPRA someday spells differently fails that job
 * loudly instead of every user's update quietly.
 */
export const OPRA_PRODUCT_ID = /^([a-z0-9_&-]+)::([a-z0-9_&-]+)$/;

export const isOpraProductId = (id: unknown): id is string =>
  typeof id === 'string' && OPRA_PRODUCT_ID.test(id);

/** A shard's file name: its vendor, spelled as a product id spells it. */
export const isOpraShardName = (name: string): boolean =>
  /^[a-z0-9_&-]+\.json$/.test(name);
