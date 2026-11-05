/* FluidEQ — GPL-3.0-or-later */

// A window is not evidence that a process is a game. The native watcher
// already omits invisible/background windows; these visible shell, launcher
// and helper windows still must not become targets for automatic sound.
const NON_GAME_EXECUTABLES = new Set([
  'explorer.exe',
  'applicationframehost.exe',
  'shellexperiencehost.exe',
  'startmenuexperiencehost.exe',
  'searchhost.exe',
  'searchapp.exe',
  'runtimebroker.exe',
  'dwm.exe',
  'sihost.exe',
  'taskhostw.exe',
  'dllhost.exe',
  'conhost.exe',
  'svchost.exe',
  'services.exe',
  'lsass.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'smss.exe',
  'fontdrvhost.exe',
  'ctfmon.exe',
  'securityhealthsystray.exe',
  'systemsettings.exe',
  'taskmgr.exe',
  'rundll32.exe',
  'regsvr32.exe',
  'msiexec.exe',
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'windowsterminal.exe',
  'steam.exe',
  'steamwebhelper.exe',
  'epicgameslauncher.exe',
  'epicwebhelper.exe',
  'battle.net.exe',
  'battlenet.exe',
  'eadesktop.exe',
  'eabackgroundservice.exe',
  'origin.exe',
  'galaxyclient.exe',
  'galaxyclientservice.exe',
  'ubisoftconnect.exe',
  'upc.exe',
  'crashpad_handler.exe',
  'crashreporter.exe',
  'crashreportclient.exe',
  'unitycrashhandler32.exe',
  'unitycrashhandler64.exe',
  'easyanticheat.exe',
  'easyanticheat_eos.exe',
  'beservice.exe',
]);

const NON_GAME_FOLDERS = new Set(['_commonredist', 'steamworks shared']);

/** Shared by discovery, manual addition and saved-profile matching. This is
 * a classification rule, never a claim that a permitted executable is safe. */
const isGameProgramEligible = (program: {
  path: string;
  name?: string;
}): boolean => {
  const file =
    program.path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop()
      ?.toLowerCase() ?? '';
  return (
    file !== '' &&
    !NON_GAME_EXECUTABLES.has(file) &&
    !NON_GAME_FOLDERS.has(file) &&
    program.name?.trim().toLowerCase() !==
      'steamworks common redistributables' &&
    !/^fluideq(?:[- .(]|$)/i.test(file) &&
    !/^fluideq(?:[- .(]|$)/i.test(program.name?.trim() ?? '')
  );
};

export default isGameProgramEligible;
