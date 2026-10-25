/* FluidEQ — GPL-3.0-or-later */
/** Select the backend before Electron initializes it, using its startup args. */
const linuxWindowArgs = (
  args: string[],
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  if (
    platform !== 'linux' ||
    !env.DISPLAY?.trim() ||
    args.some(
      (arg) =>
        arg === '--ozone-platform' || arg.startsWith('--ozone-platform='),
    ) ||
    env.ELECTRON_OZONE_PLATFORM_HINT?.trim()
  ) {
    return args;
  }
  // Native Wayland reports (0, 0) for every window, ignores saved positions,
  // and on GNOME exposes the whole screen as usable, including its top bar.
  // XWayland supplies the work area the existing app/amp placement needs.
  // A Wayland-only desktop and an explicit backend choice keep that choice.
  // Appending a switch in main changes its reported value but does not change
  // the backend already initialized by Electron. It must be a startup arg.
  return [...args, '--ozone-platform=x11'];
};

export default linuxWindowArgs;
