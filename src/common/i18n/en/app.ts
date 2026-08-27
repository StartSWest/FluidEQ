/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The shell around everything: menus, tabs, updates, config, notices. */
const app = {
  'app.tagline': 'Your sound. Every device. Automatically.',
  'app.actions': 'FluidEQ actions',
  'app.actions.title': 'Audio actions',
  'app.status.ready': 'Connected to Equalizer APO',
  'app.status.checking': 'Checking Equalizer APO…',
  'app.status.error': 'Equalizer APO is not responding',
  'app.menu.importEq': 'Import EQ settings…',
  'app.menu.importConvolution': 'Import impulse response…',
  'app.menu.restartAudio': 'Restart Windows audio',
  'app.menu.reconfigure': 'Reconfigure Equalizer APO',
  'app.menu.apoSettings': 'Equalizer APO settings',
  'app.menu.support': 'Support the work',
  'app.menu.fix': 'Fix this',
  'app.menu.reportProblem': 'Report a problem',
  'app.menu.about': 'About {product}…',
  'app.processes.menu': 'Processes…',
  'app.processes.eyebrow': 'Processes',
  'app.processes.hint':
    'Windows names every one of these after the app, because they are all the same program. This is what each one actually does.',
  'app.processes.process': 'Process',
  'app.processes.pid': 'PID',
  'app.processes.memory': 'Memory',
  'app.processes.cpu': 'CPU',
  'app.processes.thisWindow': 'this window',
  'app.processes.total': '{megabytes} MB in total.',
  'app.processes.kindMain': 'Main',
  'app.processes.kindWindow': 'Window',
  'app.processes.kindGpu': 'GPU',
  'app.processes.kindUtility': 'Utility',
  'app.processes.kindDsp': 'DSP engine (C++)',
  'app.menu.reinstallApp': 'Reinstall {product}…',
  'app.menu.fixAudio': 'Fix audio problems…',
  'app.menu.reinstallApo': 'Reinstall Equalizer APO…',
  'whatsNew.eyebrow': 'RELEASE NOTES',
  'whatsNew.title': "What's new in FluidEQ",
  'whatsNew.loading': 'Loading the release notes…',
  'whatsNew.missing':
    'The release notes could not be found in this build. They are also on GitHub.',
  'whatsNew.ok': 'OK',
  'app.menu.whatsNew': "What's new",
  'app.menu.language': 'Language',
  'app.window.minimize': 'Minimize',
  'app.window.maximize': 'Maximize',
  'app.window.restore': 'Restore',
  'app.window.close': 'Close',
  'app.tray.open': 'Open {product}',
  'app.tray.quit': 'Quit {product}',
  'app.tray.tooltip': '{product} — still running',
  'app.tray.installUpdate': 'Install update and restart',
  'app.tray.checkForUpdates': 'Check for updates',
  'app.tray.tooltip.updateReady': '{product} — update ready to install',
  'app.notification.updateReady.title': 'FluidEQ update ready',
  'app.notification.updateReady.body':
    'Version {version} is ready. Click to restart FluidEQ.',
  'app.notification.updateReady.bodyNoVersion':
    'An update is ready. Click to restart FluidEQ.',
  'app.notification.upToDate.title': 'FluidEQ is up to date',
  'app.notification.upToDate.body': 'You already have the latest version.',
  'app.notification.updateFound.title': 'FluidEQ update found',
  'app.notification.updateFound.body':
    'Version {version} is downloading. You will be told when it is ready to install.',
  'app.notification.checkFailed.title': 'Could not check for updates',
  'app.notification.checkFailed.body':
    'The update server could not be reached. FluidEQ will try again later.',
  'app.notification.installFailed.title': 'Could not install the update',
  'app.notification.installFailed.body':
    'FluidEQ could not start the installer. Click to open FluidEQ and try again.',
  'app.window.minimizeApp': 'Minimize FluidEQ',
  'app.window.maximizeApp': 'Maximize FluidEQ',
  'app.window.restoreApp': 'Restore FluidEQ',
  'app.window.closeApp': 'Close FluidEQ',
  'app.media.previous': 'Previous track',
  'app.media.playPause': 'Play or pause',
  'app.media.next': 'Next track',
  'app.media.previousAria': 'Previous track, anywhere on this computer',
  'app.media.playPauseAria': 'Play or pause, anywhere on this computer',
  'app.media.nextAria': 'Next track, anywhere on this computer',
  'app.dismiss': 'Dismiss',
  'common.search': 'Search…',
  'common.recentSearches': 'Recent searches',
  'common.clearRecentSearches': 'Clear recent searches',
  'common.clearSearch': 'Clear search',
  'common.noMatches': 'No matches',
  'common.filterOptions': 'Filter options',
  'common.increase': 'Increase {item}',
  'common.decrease': 'Decrease {item}',
  'common.icon.edit': 'Edit',
  'common.icon.delete': 'Delete',
  'common.icon.trash': 'Remove',
  'common.icon.accept': 'Accept',
  'common.icon.cancel': 'Cancel',
  'tabs.aria': 'Sound workspace',
  'tabs.eq': 'EQ',
  'tabs.eqMain': 'Bands',
  'tabs.presets': 'EQ Presets',
  'tabs.voicing': 'Voicing',
  'tabs.convolution': 'Convolution',
  'tabs.config': 'Config',
  'tabs.media': 'Media',
  'tabs.karaoke': 'Karaoke',
  'tabs.scrollBack': 'Scroll tabs back',
  'tabs.scrollForward': 'Scroll tabs forward',
  'notice.apoReconfigured':
    'Equalizer APO was installed or reconfigured. If audio is missing, reload Windows Audio instead of rebooting the PC.',
  'notice.restartNow': 'Restart audio now',
  'notice.importComplete': 'Import complete',
  'notice.restartConfirm':
    'Audio will stop for a few seconds and Windows will request administrator permission. Continue?',
  'update.title': 'FluidEQ update',
  'update.available': 'Version {version} is available. Downloading it now.',
  'update.downloading': 'Downloading the update… {percent}%',
  'update.ready': 'Version {version} is ready. Restart FluidEQ to finish.',
  'update.restart': 'Restart now',
  'update.restarting': 'Restarting…',
  'update.mandatory.title': 'This version has to be updated',
  'update.mandatory.body':
    'This release fixes a problem serious enough that FluidEQ should not keep running as it is. The update is being fetched now.',
  'update.mandatory.notOptional':
    'This is not an optional update. You can close this notice and finish what you are doing — it will come back until FluidEQ has been updated.',
  'update.mandatory.later': 'Not now',
  'update.mandatory.waiting': 'Fetching the update…',
  'update.mandatory.readyPrompt':
    'The update has been downloaded. FluidEQ will close while it installs, and open again afterwards.',
  'update.mandatory.install': 'Install and restart',
  'update.mandatory.installing': 'Installing…',
  'update.mandatory.failedDownload':
    'The update could not be downloaded. Either the download server could not be reached, or the connection stopped part of the way through.',
  'update.mandatory.failedInstall':
    'The update was downloaded, but the installer did not start. Windows may have refused it, or the downloaded file may be damaged.',
  'update.mandatory.manual':
    'You can install it yourself instead: download the latest version from the release page and run it. Your settings and profiles are kept.',
  'update.mandatory.releasePage': 'Open the download page',
  'notice.restartDone':
    'Windows Audio restarted. Reopen any application that is still silent.',
  'sidebar.engine': 'ENGINE',
  'sidebar.systemEq': 'System EQ',
  'sidebar.preamp': 'Preamp',
  'sidebar.preampAria': 'Pre-Amplification Gain (dB)',
  'sidebar.preampAuto': 'Set for you. Turn off Auto normalize to adjust it.',
  'sidebar.headroom': 'APO HEADROOM',
  'sidebar.autoPreamp': 'Auto normalize',
  'sidebar.visualizer': 'VISUALIZER',
  'sidebar.graphView': 'Response graph',
  'config.eyebrow': 'WHAT THE ENGINE READS',
  'config.title': 'Equalizer APO config',
  'config.lede': 'What is on disk right now, not what FluidEQ intends.',
  'config.reload': 'Reload',
  'config.reloadTitle': 'Read the config from disk again',
  'config.reading': 'Reading…',
  'config.absent':
    'FluidEQ has not written to this Equalizer APO installation yet.',
  'config.status.notIncluded':
    'Equalizer APO is not including this config. Nothing below is being applied.',
  'config.status.engineOff':
    'The FluidEQ engine is switched off — this config names no output, so Equalizer APO is applying none of it.',
  'config.status.active': 'Active — Equalizer APO is applying this config.',
  'config.outputsAria': 'Outputs in the Equalizer APO config',
  'config.filters.one': '{count} filter',
  'config.filters.many': '{count} filters',
  'config.impulse': 'impulse',
  'config.playingNow': 'Playing now',
  'config.liveTitle': 'Continuous EQ is keeping this measured',
  'config.layer.on': 'on',
  'config.layer.off': 'off',
  'config.layers.noFile': 'No file of its own',
  'config.layers.inFile': 'Written into this file, not one of its own.',
  'config.empty': 'Nothing included — this output is left alone.',
  'config.file.missing': 'missing',
  'config.export': 'Export chain',
  'config.import': 'Import chain',
  'config.import.hint': 'Import lands on the output you are listening to.',
  'config.import.customSkipped':
    'Skipped the sender’s custom file: an Include: or Plugin: line in it would load code into Windows audio.',
  'config.file.yours': 'yours',
  'config.hint.custom': 'Yours. Never overwritten.',
  'config.hint.generated': 'Generated — rewritten on the next change.',
  'config.hint.saving': 'Saving writes the file; Equalizer APO picks it up.',
  'config.edit': 'Edit',
  'config.cancel': 'Cancel',
  'config.save': 'Save',
  'disclaimer.heading': 'No warranty, and no liability',
  'disclaimer.asIs':
    'FluidEQ is provided as is, with no warranty of any kind. Nobody promises that it works, that it suits what you want it for, or that it will keep working. This is what sections 15 and 16 of the GNU General Public License say, and it applies whether you were given this copy or paid for it.',
  'disclaimer.liability':
    'FluidEQ changes how audio is processed on your computer, and it installs and drives Equalizer APO, a separate program that runs with administrator rights and sits in the Windows audio path. To the fullest extent the law allows, {author} is not liable for any damage arising from using it — to your hearing, to speakers, headphones or other equipment, to data or other software, or to anything else, including loss you could not have foreseen.',
  'disclaimer.volume':
    'Sound can be loud, and equalisation can make it louder than the material was. Set your volume low before changing a setting, and turn it up afterwards.',
  'disclaimer.localLaw':
    'Some countries do not allow a seller to exclude certain warranties or liabilities. Where that is the case, those rules apply and this notice does not take away rights the law gives you.',
  'disclaimer.accepting': 'By using FluidEQ you accept the above.',
  'disclaimer.language':
    'This notice was written in English. If a translation differs from the English text, the English text is the one that applies.',
  'disclaimer.accept': 'I understand and accept',
  'disclaimer.decline': 'Quit',
  'provenance.heading': 'Check where this copy came from',
  'provenance.body':
    "FluidEQ's official signed installer is delivered only through fluideq.com. Source builds should come from the official repository. The GPL permits third parties to copy, modify, rebuild, and sell FluidEQ, but their builds are not automatically signed, reviewed, supported, or endorsed by FluidEQ. If a download claims to be official and has no valid Windows digital signature, close it and report it.",
  'provenance.site': 'Official site: fluideq.com',
  'provenance.repository': 'Official source: github.com/StartSWest/FluidEQ',
  'language.title': 'Language',
  'language.aria': 'Interface language',
} as const;

export default app;
