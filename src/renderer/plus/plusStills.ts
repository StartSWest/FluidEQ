/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import hyperdrive from '../../../assets/plus/hyperdrive.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import reefLight from '../../../assets/plus/reef-light.jpg';

/**
 * Stills of real scenes, shipped with the app, for Plus's offer: every scene
 * is the thing on sale, so the offer shows scenes. Shipped rather than read
 * from the gallery, so the offer is whole from its first frame and offline,
 * and never waits on a picture to arrive (the UI never shifts).
 */
const PLUS_STILLS: readonly { id: string; src: string }[] = [
  { id: 'neon-horizon', src: neonHorizon },
  { id: 'nebula-heart', src: nebulaHeart },
  { id: 'prism-bloom', src: prismBloom },
  { id: 'reef-light', src: reefLight },
  { id: 'lantern-lake', src: lanternLake },
  { id: 'hyperdrive', src: hyperdrive },
];

export default PLUS_STILLS;
