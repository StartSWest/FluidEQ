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
  'tabs.config': 'Config',
  'tabs.video': 'Video',

  // *** Response graph ******************************************************
  'graph.resize': 'Drag to resize the graph',

  // *** Built-in player *****************************************************
  'video.sites': 'Video sites',
  'video.back': 'Back',
  'video.forward': 'Forward',
  'video.reload': 'Reload',
  'video.stop': 'Stop',
  'video.searchAria': 'Search the current site',
  'video.searchOn': 'Search {site}',
  'video.searchGo': 'Search',
  'video.searchClear': 'Clear the search',
  'video.searchRecent': 'Recent searches',
  'video.searchForget': 'Forget “{term}”',
  'video.searchForgetAll': 'Clear recent searches',
  'video.adBlock': 'Block ads',
  'video.adBlockHint': 'Skips video ads and hides ad slots on YouTube.',
  'video.blockedTitle': 'That link leads outside the player',
  'video.blockedSignInTitle': 'Sign-in happens in your browser, not here',
  'video.openInBrowser': 'Open in browser',
  'video.resize': 'Drag to resize the player',

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
  'eq.smart.continuous': 'Continuous',
  'eq.smart.continuousAria':
    'Keep Smart EQ measuring and adjusting while music plays',
  'eq.smart.modeAria': 'Choose how Smart EQ measures',
  'eq.smart.mode.once.note': 'One measurement, applied at once',
  'eq.smart.mode.detail': 'Detail',
  'eq.smart.mode.detail.note': 'Keeps measuring · peaks and dips only',
  'eq.smart.mode.balance': 'Balance',
  'eq.smart.mode.balance.note':
    'Keeps measuring · also evens out bright and warm',
  'eq.smart.mode.target': 'Target',
  'eq.smart.mode.target.note':
    'Keeps measuring · every record to the same curve',
  'eq.layers': 'Also applied',
  'eq.layers.aria': 'Also shaping this output',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(modified)',
  'eq.layers.eq.bands': '{count} bands',
  'eq.layers.convolution': 'Convolution',
  'eq.layers.voicing': 'Voicing',
  'eq.layers.driver': 'Driver',
  'eq.layers.disable': 'Switch {layer} off without removing it',
  'eq.layers.enable': 'Switch {layer} back on',
  'eq.layers.smart': 'Smart EQ',
  'eq.layers.smart.fullRange': 'Measured · full range',
  'eq.layers.smart.range': 'Measured · {low} to {high}',
  'eq.layers.remove': 'Remove the {layer} layer',
  'eq.layers.clearBands': 'Reset every band to 0 dB',
  'eq.layers.clearReference':
    'Clear the reference model and the bands it wrote',
  'eq.layers.clearSmart':
    'Remove the measured correction. Your bands and the reference stay.',
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

  // *** Smart EQ readout ****************************************************
  //
  // The bubble over the Smart EQ button, and every sentence in it is ASSEMBLED
  // rather than written: a clause per frequency range, the loudest three,
  // joined into one line.
  //
  // Which is why each clause is a whole key with the range dropped into a
  // placeholder, and never a verb and a noun glued together in code. English is
  // the one language where that would have worked. "lifted" + "air" is fine;
  // the same two halves in Spanish have to agree in gender, in Russian and
  // German in case, and in Japanese the verb goes last — so a translator needs
  // the whole clause in front of them, and the freedom to move the range
  // wherever their language puts it.
  //
  // The range names are separate keys because they are also said on their own,
  // in a list, after "waiting on". Several dictionaries deliberately phrase the
  // clauses so the noun can stay in its dictionary form — a label with a colon,
  // or a noun phrase — because a slot cannot be declined and a wrong case reads
  // worse than a plain one.
  'eq.smart.range.deepBass': 'deep bass',
  'eq.smart.range.bass': 'bass',
  'eq.smart.range.lowMids': 'low mids',
  'eq.smart.range.mids': 'mids',
  'eq.smart.range.upperMids': 'upper mids',
  'eq.smart.range.presence': 'presence',
  'eq.smart.range.treble': 'treble',
  'eq.smart.range.highTreble': 'high treble',
  'eq.smart.range.air': 'air',
  // Between two named ranges. Its own key because the comma-and-space of a
  // Latin script is an ideographic comma in Chinese and Japanese.
  'eq.smart.range.separator': ', ',
  // What a finished correction did. Past tense: it is printed beside the word
  // that says the measurement is over, and a present participle there reads as
  // a run still going.
  'eq.smart.shape.lifted': 'lifted {range}',
  'eq.smart.shape.eased': 'eased {range}',
  // What the correction still owes the music — the observation that made it
  // run, rather than the operation it is performing.
  'eq.smart.need.more': 'needs more {range}',
  'eq.smart.need.less': 'too much {range}',
  'eq.smart.status.listening': 'Listening',
  'eq.smart.status.listeningPercent': 'Listening {percent}%',
  'eq.smart.status.settling': 'Listening {percent}% - settling',
  // "Waiting on", not "needs": this names a range the measurement has not heard
  // enough of, and "needs air" over a top end somebody has just boosted reads as
  // the app asking for more of it.
  'eq.smart.status.waitingOn': 'Listening {percent}% - waiting on {ranges}',
  'eq.smart.status.waitingOnMore':
    'Listening {percent}% - waiting on {ranges} +{count}',
  'eq.smart.status.paused': 'Paused',
  'eq.smart.status.pausedResume': 'Paused - resume to finish',
  'eq.smart.status.pausedSilent': 'Paused - no sound playing',
  'eq.smart.status.waitingForSound': 'Waiting for sound',
  'eq.smart.status.soundChanged': 'Sound changed - measuring again',
  'eq.smart.status.keptChanging': 'The sound kept changing - stopped',
  'eq.smart.status.notEnoughRange': 'Not enough range to measure',
  'eq.smart.status.alreadyBalanced': 'Already balanced',
  'eq.smart.status.applying': 'Applying…',
  'eq.smart.status.cancelled': 'Cancelled - nothing changed',
  'eq.smart.status.failed': 'Could not measure the output.',
  'eq.smart.result.fullRange': 'Balanced - full range',
  'eq.smart.result.range': 'Balanced - {low} to {high} only',
  // What was heard, then what was done about it. One key so a language can
  // repunctuate the join or swap the halves.
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  // Why a measurement stopped. These are thrown as Error messages by the
  // capture hook and land in the same bubble as everything above, so they are
  // looked up where they are thrown rather than where they are caught — the
  // catch cannot tell one of ours from one the browser raised.
  'eq.smart.error.noCapture':
    'Media capture is not available in this environment.',
  'eq.smart.error.noLoopback':
    'Desktop loopback capture is not available in this environment.',
  'eq.smart.error.streamStopped':
    'The output stream stopped before the measurement finished.',
  'eq.smart.error.analyserPaused':
    'The analyser is paused, so the measurement stopped.',
  'eq.smart.error.noSound':
    'No sound was playing. Start some music and measure again.',
  'eq.smart.error.noAudioTrack':
    'Windows did not provide a system-audio stream.',
  'eq.smart.error.formatChanged':
    'The output format changed while measuring. Try again.',
  'eq.smart.error.deviceChanged':
    'The audio device changed while measuring. Try again.',
  'eq.smart.error.captureFailed':
    'Unable to capture the processed system output.',
  'eq.smart.error.analyserOff':
    'The live output analyser is not running, so there is nothing to measure.',
  'eq.smart.error.alreadyRunning': 'A measurement is already running.',
  'eq.smart.error.timedOut': 'The measurement timed out. Try again.',
  'eq.smart.error.closed': 'FluidEQ closed the measurement.',
  // The caption on the draggable presence line inside each listening band.
  // One key, not a range name with an English tail concatenated onto it: the
  // number goes in a different place in Japanese and the verb has to agree with
  // the range in several of the others.
  'eq.smart.presence.ignoredBelow': '{range} · ignored below {db} dB',
  'eq.smart.presence.trustedAbove': '{range} · fully trusted above {db} dB',
  'eq.smart.presence.reset': 'Reset {range} for this mode',
  'eq.smart.limit.label': 'Smart EQ limit {db} dB',

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
  'voicing.refused': 'Could not switch voicing',
  'voicing.groupPurpose': 'What for',
  'voicing.groupGenre': 'Genre',
  'voicing.none': 'None',
  'voicing.none.hint': 'Your EQ bands only, nothing layered on top',
  'voicing.strength': 'Strength',
  'voicing.off': 'Off',
  'voicing.full': 'Full',
  'voicing.inert': 'At 0% strength this voicing does nothing.',
  'voicing.headroom':
    'Adds up to +{peak} dB. Auto normalize reserves the headroom; leave it on unless you are setting the preamp by hand.',

  // *** Config inspector ****************************************************
  'config.eyebrow': 'Equalizer APO config',
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
  'config.empty': 'Nothing included — this output is left alone.',
  'config.file.missing': 'missing',
  'config.export': 'Export chain',
  'config.import': 'Import chain',
  'config.import.hint': 'Import lands on the output you are listening to.',
  'config.file.yours': 'yours',
  'config.hint.custom': 'Yours. Never overwritten.',
  'config.hint.generated': 'Generated — rewritten on the next change.',
  'config.hint.saving': 'Saving writes the file; Equalizer APO picks it up.',
  'config.edit': 'Edit',
  'config.cancel': 'Cancel',
  'config.save': 'Save',

  // *** Support *************************************************************
  'support.eyebrow': 'ENTIRELY OPTIONAL',
  'support.petHint': 'Press space to make it jump',
  'support.game.hint': 'Tap on the beat when the spike reaches the line',
  'support.game.howTo':
    'Tap the pet or press space on every beat. Keep it up and something happens at ×10.',
  'support.game.thanks':
    'If any of this made you smile, ideas and support are what keep it coming.',
  'support.game.noAudio': 'Play something and the beat shows up here',
  'support.game.listening': 'Listening for the beat…',
  'support.game.share': 'Share',
  'support.game.shareEuphoria': 'Share euphoria',
  'support.game.shareTitle': 'Share your score',
  'support.game.shareUnlock':
    'Reach ×10 and this card turns into euphoria mode — spectrum and all.',
  'support.game.shareNote':
    'Save the card, then attach it to your post — none of these networks can pull an image out of a link.',
  'support.game.shareSave': 'Save card',
  'support.game.shareCopyCard': 'Copy card',
  'support.game.shareCardCopied': 'Copied — paste it in',
  'support.game.shareCopy': 'Copy text',
  'support.game.shareCopied': 'Copied',
  'support.game.shareLinkOnly':
    'Shares the link only — paste the text yourself',
  'support.game.euphoria': 'Euphoria mode',
  'support.game.euphoriaToggle': 'Turn euphoria mode on or off',
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
  'waveform.style': 'Change the meter style',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

export default en;
