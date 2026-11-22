/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Sharing the listener's own presets (2026-11-20): Share and its menu on the
 * Preset tab's tiles, the export, the preset a Forum topic carries, the card
 * a post shows, the import from pasted text and a link's question.
 *
 * The `presetShare.text.*` lines are written into posts on other forums in
 * the sharer's language, so keep them short and plain.
 */
export default {
  'presetShare.share': 'Share {name}',
  'presetShare.menu.community': 'Share to the community…',
  'presetShare.menu.copyLink': 'Copy share link',
  'presetShare.menu.export': 'Export…',
  'presetShare.linkCopied': 'Share link copied',
  'presetShare.linkMaking': 'Making the link…',
  'presetShare.linkFailed.signedOut': 'Sign in to make a link',
  'presetShare.linkFailed.suspended': 'This account can’t share now',
  'presetShare.linkFailed.rateLimited': 'Too many links this hour',
  'presetShare.linkFailed.tooMany': 'This account’s link limit is reached',
  'presetShare.linkFailed.takenDown': 'This link was taken down',
  'presetShare.linkFailed.offline': 'No answer from FluidEQ’s server',

  'presetShare.text.title': '{name} · FluidEQ preset',
  'presetShare.text.curve': 'Curve: {count} bands',
  'presetShare.text.rack': 'Rack: {stages}',
  'presetShare.text.open': 'Open in FluidEQ',

  'presetShare.chip.curve': 'Curve · {count} bands',
  'presetShare.chip.flat': 'No changes',

  'presetShare.export.title': 'Export {name}',
  'presetShare.export.hint':
    'The curve and every stage of the rack. Your Normalizer and your Room’s head stay yours.',
  'presetShare.export.tab.forum': 'For any forum',
  'presetShare.export.tab.file': 'File',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · other boards',
  'presetShare.format.plain': 'Plain text',
  'presetShare.format.plainFor': 'Anywhere else',
  'presetShare.export.withLink': 'Add a short link to its page on fluideq.com',
  'presetShare.export.linkSignIn': 'Sign in to add a short link',
  'presetShare.export.fits': '{count} characters · fits one Discord message',
  'presetShare.export.long':
    '{count} characters · too long for one Discord message. Send the short link alone.',
  'presetShare.export.pasteHint':
    'Anyone with FluidEQ can paste this into Import.',
  'presetShare.export.fileHint':
    'Readable JSON with the curve and every stage, the file the DSP page saves. Drop it on Import to bring it back.',
  'presetShare.export.apoNoCurve':
    'This preset has no curve: its sound is all in the rack, which needs FluidEQ.',
  'presetShare.export.apoRack':
    'Only the curve travels in this format. {stages} need FluidEQ.',
  'presetShare.export.copy': 'Copy',
  'presetShare.export.copyCurve': 'Copy curve',
  'presetShare.export.save': 'Save file…',
  'presetShare.export.copied': 'Copied',
  'presetShare.export.saved': 'Saved',
  'presetShare.export.failed': 'That didn’t go through. Try again.',

  'presetShare.forum.attached': 'Attached preset',
  'presetShare.forum.remove': 'Remove the preset',
  'presetShare.forum.template':
    'Made for: \nHeard on: \nTry it with: \n\nWhat it does: ',

  'presetShare.card.by': 'Shared by @{author}',
  'presetShare.card.sharedBy': 'Shared by {author}',
  'presetShare.card.sharedByMember': 'Shared by a FluidEQ member',
  'presetShare.card.add': 'Add to my presets',
  'presetShare.card.added': 'In Yours · playing',
  'presetShare.card.try': 'Try it',
  'presetShare.card.stopTrying': 'Stop trying',
  'presetShare.card.tryingNote':
    'Playing until you stop or leave the post; then your own sound comes back.',

  'presetShare.import.button': 'Import',
  'presetShare.import.title': 'Import a preset',
  'presetShare.import.hint':
    'Paste a forum post, a share link or a preset file. Only the preset inside is read.',
  'presetShare.import.placeholder': 'Paste here…',
  'presetShare.import.chooseFile': 'Choose file…',
  'presetShare.import.found': 'Found one preset',
  'presetShare.import.missing':
    'This text holds no FluidEQ preset. Paste the whole post or the share link.',
  'presetShare.import.newer':
    'This preset was made with a newer FluidEQ. Update FluidEQ to read it.',
  'presetShare.import.damaged':
    'The preset’s code is cut off or damaged. Copy it again from start to end.',
  'presetShare.import.gone':
    'This preset is no longer shared. Ask for its code instead.',
  'presetShare.import.offline':
    'FluidEQ couldn’t reach its server to open this link. Check the connection and try again.',

  'presetShare.link.title': 'Add this preset?',
  'presetShare.link.hint':
    'From a link you opened. Nothing plays or saves until you press.',
  'presetShare.link.notNow': 'Not now',
  'presetShare.link.fetching': 'Getting the preset from FluidEQ…',
} as const;
