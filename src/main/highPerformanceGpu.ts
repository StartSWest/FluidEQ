/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every FluidEQ window draws on the fast graphics card of a computer with
 * two (Ivan, 2026-11-27: "always to try enforce fast high performance").
 *
 * The switch is the name of one of Chromium's GPU workarounds, and any
 * workaround's name on the command line turns it on
 * (`GpuDriverBugList::AppendWorkaroundsFromCommandLine`,
 * `gpu/config/gpu_driver_bug_list.cc`); the GPU process is handed it with
 * the rest (`gpu_process_host.cc`). With it, `SetupGLDisplayManagerEGL`
 * (`gpu/ipc/service/gpu_init.cc`) puts ANGLE's display — the compositor's
 * and every WebGL context's, the scenes' and the 3D worlds' included — on
 * the adapter DXGI ranks first for `DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE`:
 * an external card, then a discrete one, then the built-in chip. That
 * ranking is asked for by name (`IDXGIFactory6::EnumAdapterByGpuPreference`,
 * `gpu_info_collector_win.cc`), apart from the default order Windows' own
 * per-app Graphics setting rearranges, so nothing needs writing there for it
 * to hold. It is read only where there are two GPUs or more, and only on
 * Windows and macOS: on Linux Chromium picks no GPU by preference at all.
 * Electron documents the same spelling, underscores and all.
 *
 * It used to be a row of the View menu, off by default, and with it off
 * Windows ran the app on a laptop's built-in graphics unless the laptop
 * decided otherwise. Kept on, a laptop's discrete card stays awake while
 * FluidEQ sits in the tray — the price of never drawing a scene on the slow
 * one.
 */
export const HIGH_PERFORMANCE_GPU_SWITCH = 'force_high_performance_gpu';

/** Chromium reads its switches once, so this runs before the app is ready. */
export const startOnTheFastGpu = (commandLine: {
  appendSwitch(name: string): void;
}) => commandLine.appendSwitch(HIGH_PERFORMANCE_GPU_SWITCH);
