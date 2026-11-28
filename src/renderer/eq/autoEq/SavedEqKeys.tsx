/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import LoadEqMenu from './LoadEqMenu';
import SaveEqMenu from './SaveEqMenu';

/**
 * The saved EQs in the bands toolbar, the EQ page's and the amp's alike
 * (Ivan, 2026-11-27, option A of the Save EQ options): the name of the one
 * that is on, which loads, and the disk beside it, which saves. Each key's
 * menu holds only what its face says it does.
 */
const SavedEqKeys = () => (
  <>
    <LoadEqMenu />
    <SaveEqMenu />
  </>
);

export default SavedEqKeys;
