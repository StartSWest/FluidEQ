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

/** The Look Designer, the support panel, the creature and its game. */
const look = {
  'look.edit': 'Edit look',
  'look.create': 'Create look',
  'look.new': 'New look',
  'look.close': 'Close the look designer',
  'look.closeHint': 'Close without saving (Esc)',
  'look.pickForm': 'Pick the form with the picker above, or press Space.',
  'look.colourBy': 'Colour by',
  'look.palette.cycle': 'Colouring',
  'look.palette.flat': 'Flat',
  'look.palette.flatHint': 'One colour for the whole figure',
  'look.palette.frequency': 'Frequency',
  'look.palette.frequencyHint':
    'Colour runs across the axis and shows where a bar sits in the range.',
  'look.palette.level': 'Level',
  'look.palette.levelHint':
    'Colour runs up the axis and shows how loud a bar is.',
  'look.palette.heat': 'Heat',
  'look.palette.heatHint':
    'Colour follows how loud it is, cool through to red.',
  'look.colours': 'Colours',
  'look.colourValue': 'Colour {number}: {colour}',
  'look.removeColour': 'Remove colour {number}',
  'look.custom': 'Custom',
  'look.customColour': 'Any other colour',
  'look.reset': 'Reset',
  'look.addColour': 'Add a colour',
  'look.addColourHint': 'Add a colour to the end of the ramp',
  'look.pieces': 'Pieces',
  'look.continuous': 'This form is drawn as one continuous figure',
  'look.attack': 'Attack',
  'look.release': 'Release',
  'look.releaseHint': 'How long a peak hangs before it falls away',
  'look.drawnAs': 'Drawn as',
  'look.filled': 'Filled',
  'look.stroked': 'Stroked',
  'look.fill': 'Fill',
  'look.weight': 'Weight',
  'look.rainbow': 'Rainbow',
  'look.glow': 'Glow',
  'look.off': 'Off',
  'look.glowHint': 'How hard the figure swells and brightens on a beat.',
  'look.glowNeedsRainbow':
    'Needs Rainbow mode. With it off, glow does not change the drawing.',
  'look.needsRainbow': 'Needs Rainbow mode.',
  'look.rainbowBorder': 'Rainbow border',
  'look.rainbowBorderHint':
    'Rings the graph in a colour that travels around the whole wheel.',
  'look.borderWeight': 'Border weight',
  'look.litPeaks': 'Lit peaks',
  'look.noLitPeaks': 'This form has no lit tips to show',
  'look.name': 'Name',
  'look.resetAll': 'Reset every setting',
  'look.resetAllHint': 'Put every setting back to how this form ships',
  'look.export': 'Export this look to a file',
  'look.exportHint': 'Write this look to a file you can share',
  'look.import': 'Import a look from a file',
  'look.delete': 'Delete this look',
  'look.save': 'Save',
  'look.saveHint': 'Save this look and select it',
  'look.full': 'The list is full — delete a look to make room',
  'look.error.emptyFile': 'No looks were found in that file.',
  'look.error.readFile': 'FluidEQ could not read that look file.',
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
  'support.game.shareEuphoria': 'Share rainbow',
  'support.game.shareTitle': 'Share your score',
  'support.game.shareUnlock':
    'Reach ×10 and this card turns into Rainbow mode — spectrum and all.',
  'support.game.shareNote':
    'Save the card, then attach it to your post — none of these networks can pull an image out of a link.',
  'support.game.shareSave': 'Save card',
  'support.game.shareCopyCard': 'Copy card',
  'support.game.shareCardCopied': 'Copied — paste it in',
  'support.game.shareCopy': 'Copy text',
  'support.game.shareCopied': 'Copied',
  'support.game.shareLinkOnly':
    'Shares the link only — paste the text yourself',
  'support.game.euphoria': 'Rainbow mode',
  'support.game.euphoriaToggle': 'Turn Rainbow mode on or off',
  'support.game.perfect': 'Perfect',
  'support.game.great': 'Great',
  'support.game.good': 'Good',
  'support.game.miss': 'Missed',
  'support.title': 'Support the work',
  'support.close': 'Close',
  'support.pitch':
    'FluidEQ is free and open source, and it stays that way — the source is public, you can always build it yourself for nothing, and nothing here is ever tracked. What is sold is the signed, ready-to-run build. If it earned a place in your setup, a contribution funds the time that keeps it maintained and the next ideas that come out of the same workshop.',
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
} as const;

export default look;
