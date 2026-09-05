/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the one worklet bundle lives.
 *
 * Every audio processor in the app — the DSP chain, the loopback capture and
 * the PCM playback — is built into a single module, so every context that
 * needs any of them loads the same file. Development serves it unhashed from
 * the dev server root; production ships it beside the renderer.
 */
const workletUrl = (): URL =>
  new URL(
    process.env.NODE_ENV === 'production'
      ? './dsp-worklet.js'
      : '/dsp-worklet.dev.js',
    window.location.href,
  );

export default workletUrl;
