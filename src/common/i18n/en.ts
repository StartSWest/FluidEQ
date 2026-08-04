/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

/**
 * The canonical dictionary. Every other locale is a partial of this one.
 *
 * English is the source of truth for two reasons: it is what the code is
 * written in, so a key with no translation yet falls back to something a
 * developer can read; and typing the other locales as `Partial<Dictionary>`
 * means adding a key here immediately tells every translator what is missing
 * without breaking the build.
 *
 * Keys are dotted and grouped by where the string appears, not by what it
 * says — `sidebar.output.title` is findable from the screen, `outputTitle` is
 * findable only from memory.
 *
 * Placeholders are `{name}` and are substituted positionally by name. Nothing
 * else is interpolated: no plural rules, no gender, no markup. Where a count
 * changes the wording, the two forms get separate keys.
 */
const en = {
  // *** Shell ***************************************************************
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
  'whatsNew.eyebrow': 'RELEASE NOTES',
  'whatsNew.title': "What's new in FluidEQ",
  'whatsNew.loading': 'Loading the release notes…',
  'whatsNew.missing':
    'The release notes could not be found in this build. They are also on GitHub.',
  'app.menu.whatsNew': "What's new",
  'app.menu.language': 'Language',
  'app.window.minimize': 'Minimize',
  'app.window.maximize': 'Maximize',
  'app.window.restore': 'Restore',
  'app.window.close': 'Close',
  'app.window.minimizeApp': 'Minimize FluidEQ',
  'app.window.maximizeApp': 'Maximize FluidEQ',
  'app.window.restoreApp': 'Restore FluidEQ',
  'app.window.closeApp': 'Close FluidEQ',
  'app.dismiss': 'Dismiss',

  // *** Workspace tabs ******************************************************
  'tabs.aria': 'Sound workspace',
  'tabs.eq': 'EQ & headset mode',
  'tabs.voicing': 'Voicing',
  'tabs.convolution': 'Convolution',

  // *** Notices *************************************************************
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
  'notice.restartDone':
    'Windows Audio restarted. Reopen any application that is still silent.',

  // *** Sidebar *************************************************************
  'sidebar.engine': 'ENGINE',
  'sidebar.systemEq': 'System EQ',
  'sidebar.preamp': 'Preamp',
  'sidebar.preampAria': 'Pre-Amplification Gain (dB)',
  'sidebar.preampAuto': 'Set for you. Turn off Auto normalize to adjust it.',
  'sidebar.headroom': 'APO HEADROOM',
  'sidebar.autoPreamp': 'Auto normalize',
  'sidebar.visualizer': 'VISUALIZER',
  'sidebar.graphView': 'Response graph',

  // *** Output section ******************************************************
  'output.eyebrow': 'FOLLOWS YOUR OUTPUT',
  'output.title': 'Automatic profile',
  'output.device': 'Output device',
  'output.active': 'ACTIVE',
  'output.none': 'No active outputs found',
  'output.mapping': 'Automatic mapping',
  'output.mapping.neutral': 'Neutral output',
  'output.mapping.live': 'Live tuning attached',
  'output.mapping.hint':
    'Edit any EQ control to save and attach it automatically to this output.',
  'output.hint':
    'FluidEQ maps the stable endpoint ID, so this sound follows the device whenever Windows selects it.',

  // *** Driver section ******************************************************
  'driver.eyebrow': 'WHAT YOU LISTEN ON',
  'driver.title': 'Driver type',
  'driver.none': 'No compensation',
  'driver.none.hint': 'Your bands and voicing only',
  'driver.strength': 'Strength',
  'driver.range': '±1.5 dB',

  // *** Profiles section ****************************************************
  'profiles.eyebrow': 'YOUR SOUND',
  'profiles.title': 'Named profiles',
  'profiles.name': 'Profile name',
  'profiles.nameAria': 'Preset Name',
  'profiles.new': 'New profile',
  'profiles.newAria': 'Start a new profile from the current EQ',
  'profiles.untitled': 'Untitled profile',
  'profiles.save': 'Save as new',
  'profiles.update': 'Update',
  'profiles.saveAria': 'Save settings to preset',
  'profiles.restore': 'Restore',
  'profiles.restoring': 'Restoring…',
  'profiles.restoreAria':
    'Restore the last manually saved version of this profile',
  'profiles.attached': 'ON',
  'profiles.attachedTitle': 'Playing on this output',
  'profiles.detecting': 'Detecting your output…',
  'profiles.empty': 'No profiles yet. Create your first sound.',
  'profiles.error.empty': 'Preset name cannot be empty.',
  'profiles.error.restricted': 'Invalid preset name, please use another.',
  'profiles.error.duplicate': 'Duplicate name found, please use another.',
  'profiles.edit': 'Edit Preset Name',

  // *** AutoEQ library *****************************************************
  'autoeq.eyebrow': 'START FROM A REFERENCE',
  'autoeq.title': 'AutoEQ library',
  'autoeq.selectSource': 'Select a source',
  'autoeq.applied': 'Applied: {name}',
  'autoeq.notApplied': 'No reference applied',
  'autoeq.source': 'Measurement source',
  'autoeq.model': 'Headphone model',
  'autoeq.target': 'Measurement / target',
  'autoeq.apply': 'Apply headset EQ',
  'autoeq.applying': 'Applying…',
  'autoeq.applyAria': 'Apply selected headset EQ',
  'autoeq.checking': 'Checking official database…',
  'autoeq.updateAvailable': 'Update available ({count} models)',
  'autoeq.upToDate': 'Official database up to date — {count} models',
  'autoeq.updateUnknown': 'Update check unavailable',
  'autoeq.update': 'Update database',
  'autoeq.updating': 'Updating…',
  'autoeq.updateAria': 'Update AutoEq database',
  'autoeq.allDatabases': 'All databases',
  'autoeq.allDatabases.hint':
    'Search AutoEq official and GadgetryTech together.',
  'autoeq.pickDevice': 'Pick a device first! 🎧',
  'autoeq.noResponses': 'No supported responses 😞',
  'autoeq.pickResponse': 'Pick a response! 🔊',
  'autoeq.selectSourcePlaceholder': 'Select a source…',
  'autoeq.searchSources': 'Search sources…',
  'autoeq.noModel': 'No measured model matches your search.',
  'autoeq.searchModels': 'Search by brand or model…',
  'voicing.quickAria': 'Voicing: {name}',
  'voicing.quickNone': 'Voicing: none',
  'voicing.quickTitle': 'No voicing applied',
  'voicing.quickLabel': 'Voicing',
  'voicing.quickNoneHint': 'Your EQ bands only',

  // *** Parametric EQ *******************************************************
  'eq.eyebrow': 'FINE TUNE',
  'eq.title': 'Parametric EQ',
  'eq.smart': 'Smart EQ',
  'eq.smart.cancel': 'Cancel',
  'eq.smart.aria': 'Smart EQ from live output',
  'eq.smart.cancelAria': 'Cancel Smart EQ measurement',
  'eq.smart.fromFlat': 'From flat',
  'eq.layers': 'Also applied',
  'eq.layers.aria': 'Also shaping this output',
  'eq.layers.convolution': 'Convolution',
  'eq.layers.voicing': 'Voicing',
  'eq.layers.driver': 'Driver',
  'eq.layers.headset': 'Headset',
  'eq.layers.smart': 'Smart EQ',
  'eq.layers.smart.fullRange': 'Measured · full range',
  'eq.layers.smart.range': 'Measured · {low} to {high}',
  'eq.layers.remove': 'Remove the {layer} layer',
  'eq.layers.clearReference':
    'Clear the reference model and the bands it wrote',
  'eq.layers.clearSmart':
    'Remove the measured correction. Your bands and the reference stay.',
  'eq.fromFlat': 'From flat',
  'eq.fromFlat.hint':
    'Discard the previous Smart EQ correction before listening. Use this when an existing cut is hiding the region it affects — the measurement cannot see through its own correction. Your bands are never touched.',
  'eq.clear': 'Clear EQ',
  'eq.addBand': 'Add band',
  'eq.addBandAria': 'Add EQ band',
  'eq.quickLayouts': 'Quick layouts',
  'eq.bandCount': '{count} Band',
  'eq.selected': 'Selected band',
  'eq.filter': 'Filter',
  'eq.frequency': 'Frequency',
  'eq.gain': 'Gain',
  'eq.gainDisabled': 'Gain · n/a',
  'eq.quality': 'Quality (Q)',
  'eq.delete': 'Delete band',
  'eq.deleteAria': 'Delete selected EQ band',

  // *** Convolution *********************************************************
  'convolution.eyebrow': 'APO impulse responses',
  'convolution.title': 'Convolution library',
  'convolution.intro':
    'Download a verified, minimum-phase headphone impulse and apply it before your parametric EQ. The shared response graph below keeps both curves visible.',
  'convolution.import': 'Import a WAV…',
  'convolution.importing': 'Importing…',
  'convolution.applied': 'Applied to this output',
  'convolution.clear': 'Clear',
  'convolution.search': 'Search headphone models',
  'convolution.searchPlaceholder':
    'Try “Kraken”, “HD 650”, or a measurement provider',
  'convolution.notice':
    'AutoEq provides the downloadable catalogue. Files are imported as 48 kHz WAV because Equalizer APO requires the impulse response to match the active output sample rate.',
  'convolution.loading': 'Loading official catalogue…',
  'convolution.empty':
    'No matching impulse responses. Try a shorter model name.',
  'convolution.source': 'Source',
  'convolution.apply': 'Download & apply',
  'convolution.downloading': 'Downloading…',
  'convolution.isApplied': 'Applied',
  'convolution.none':
    'No convolution loaded. The EQ tab remains fully independent.',

  // *** Voicing *************************************************************
  'voicing.eyebrow': 'TARGET CURVES',
  'voicing.title': 'Voicing',
  'voicing.intro':
    'A tuned target for what you are actually doing. Each one is written as its own layer after your EQ bands, so your own tuning is never touched and switching back to None restores it exactly.',
  'voicing.none': 'None',
  'voicing.none.hint': 'Your EQ bands only, nothing layered on top',
  'voicing.strength': 'Strength',
  'voicing.off': 'Off',
  'voicing.full': 'Full',
  'voicing.inert': 'At 0% strength this voicing does nothing.',
  'voicing.headroom':
    'Adds up to +{peak} dB. Auto normalize reserves the headroom; leave it on unless you are setting the preamp by hand.',

  // *** Support *************************************************************
  'support.eyebrow': 'ENTIRELY OPTIONAL',
  'support.petHint': 'Press space to make it jump',
  'support.game.hint': 'Tap on the beat when the spike reaches the line',
  'support.game.noAudio': 'Play something and the beat shows up here',
  'support.game.listening': 'Listening for the beat…',
  'support.game.best': 'Best',
  'support.game.perfect': 'Perfect',
  'support.game.great': 'Great',
  'support.game.good': 'Good',
  'support.game.miss': 'Missed',
  'support.title': 'Support the work',
  'support.close': 'Close',
  'support.pitch':
    'FluidEQ is free and open source, and it stays that way — nothing here is behind a paywall and nothing is ever tracked. If it earned a place in your setup, a contribution funds the time that keeps it maintained and the next ideas that come out of the same workshop.',
  'support.craft':
    'This is one person’s work, built with a lot of love and an unreasonable amount of attention to detail. Every panel was drawn by hand and argued over: how the response curve reads at a glance, the way a menu unfolds, what a knob does when you drag it slowly, which words go on a button. Nothing here is a stock component with a theme on top.',
  'support.card': 'Card or wallet',
  'support.card.hint':
    'Secure checkout hosted by Stripe. Opens in your browser — the app never sees your card details.',
  'support.coffee': 'Buy me a coffee',
  'support.coffee.hint':
    'A one-off tip, no account needed. Click to open it in your browser, or scan the code with your phone.',
  'support.verify': 'Verify the address before sending.',
  'support.copy': 'Copy address',
  'support.copied': 'Copied',
  'support.openWallet': 'Open in wallet',
  'support.contributed': 'I contributed — unlock the star and the dance',
  'support.thanks': 'Thank you — your pet has its star, and it dances now.',
  'support.releaseNotes': "See what's new in this version",
  'support.footerBefore':
    'Prefer to contribute time instead? Issues and pull requests are just as welcome on',

  // *** Language ************************************************************
  'language.title': 'Language',
  'language.aria': 'Interface language',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

export default en;
