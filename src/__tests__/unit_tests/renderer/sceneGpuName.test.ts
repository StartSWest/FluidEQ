/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { gpuNameOf } from '../../../renderer/graph/sceneGpuName';

/**
 * The card's name out of what a driver reports. Worth pinning because the
 * strings come from cards we do not own, every one is a sentence rather than
 * a name, and a mistake here is invisible until somebody else's machine.
 */
describe('the graphics card’s name', () => {
  it('takes the card out of what ANGLE reports', () => {
    expect(
      gpuNameOf(
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('NVIDIA GeForce RTX 4080');
    // The one Ivan was stuck on: a device id in brackets and a legal mark.
    expect(
      gpuNameOf(
        'ANGLE (Intel, Intel(R) UHD Graphics (0x0000A788) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('Intel UHD Graphics');
    expect(
      gpuNameOf(
        'ANGLE (AMD, AMD Radeon RX 7900 XTX (0x0000744C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('AMD Radeon RX 7900 XTX');
  });

  it('says so when the drawing is not being done by a card at all', () => {
    // Nobody should see this and wonder why everything is slow.
    expect(
      gpuNameOf(
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      ),
    ).toContain('SwiftShader');
  });

  it('answers a driver that reports a plain name', () => {
    // Not every driver speaks ANGLE's sentence; some answer with the name.
    expect(gpuNameOf('Apple M2 Pro')).toBe('Apple M2 Pro');
    expect(gpuNameOf('  Mesa Intel(R) Graphics  ')).toBe('Mesa Intel Graphics');
  });
});
