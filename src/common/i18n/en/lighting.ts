/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dynamic lighting, the Plus tab's place for lighting a member's devices with
 * the scene on the graph. Device names are never here: they are the maker's,
 * as Windows and Razer report them. "Razer Chroma" and "Windows Dynamic
 * Lighting" are product names and stay as they are in every language.
 */
const lighting = {
  'lighting.alignment.title': 'Scene alignment',
  'lighting.alignment.hint':
    'Move or resize the scene on this device. Position is a percentage of its width or height.',
  'lighting.alignment.keyboardFit':
    'Fitted to the detected key positions. Fine-tune the scene here.',
  'lighting.alignment.size': 'Scene size',
  'lighting.alignment.horizontal': 'Horizontal position (%)',
  'lighting.alignment.vertical': 'Vertical position (%)',
  'lighting.alignment.reset': 'Centre and fit',
  'lighting.tuning.foregroundBrightness': 'Foreground brightness',
  'lighting.tuning.backgroundBrightness': 'Background brightness',
  'lighting.status.ambient': 'Flowing quietly · {scene}',
  'lighting.scene.title': 'Lighting for {scene}',
  'lighting.scene.saved': 'Saved for this visualizer',
  'lighting.device.edit': 'Tune {name}',
  'lighting.target.all': 'All devices',
  'lighting.target.shared': 'Shared lighting: {devices}',
  'lighting.tuning.title': 'Lighting style',
  'lighting.tuning.reset': 'Reset',
  'lighting.effect.scene': 'Scene',
  'lighting.effect.flow': 'Colour wave',
  'lighting.effect.spectrum': 'Spectrum',
  'lighting.effect.pulse': 'Beat ripple',
  'lighting.tuning.sensitivity': 'Music sensitivity',
  'lighting.tuning.speed': 'Motion speed',
  'lighting.tuning.saturation': 'Colour intensity',
  'lighting.tuning.smoothing': 'Smoothness',
  'lighting.tuning.spread': 'Pattern spread',
  'lighting.tuning.reverse': 'Reverse direction',
  'lighting.tuning.focus': 'Respond to',
  'lighting.focus.balanced': 'Full mix',
  'lighting.focus.bass': 'Bass',
  'lighting.focus.mid': 'Mids',
  'lighting.focus.treble': 'Treble',
  'lighting.tuning.advanced': 'Fine tuning',
  'lighting.idle.title': 'When music stops',
  'lighting.idle.flow': 'Keep flowing',
  'lighting.idle.breathe': 'Slow breathing',
  'lighting.idle.hold': 'Hold colour',
  'lighting.idle.brightness': 'Idle brightness',
  'lighting.idle.speed': 'Idle motion',
  'lighting.preview.live': 'Live desk preview',
  'lighting.tuning.master': 'Master brightness',
  'lighting.title': 'Dynamic lighting',
  'lighting.rail.blurb': 'Your desk follows the scene',
  'lighting.description':
    'Your keyboard, mouse, mousepad, headset and stand light up with the scene',

  'lighting.gate.title':
    'Light your keyboard, mouse and headset with every Plus scene',
  'lighting.gate.body':
    'Dynamic lighting is part of FluidEQ Plus. Your devices take the colours of the scene on the graph and pulse with its beat.',
  'lighting.gate.cta': 'See Plus',

  'lighting.unsupported.title': 'Dynamic lighting works on Windows',
  'lighting.unsupported.body':
    'It lights devices through Windows Dynamic Lighting and Razer Chroma, and both are only on Windows.',

  'lighting.switch': 'Light my devices while a Plus scene plays',
  'lighting.status.live': 'Following {scene}',
  'lighting.status.waiting': 'Waiting for music',
  'lighting.status.nothingLit': 'The scene is playing, but no device is lit',
  'lighting.status.off': 'Off — your devices keep their own lighting',
  'lighting.status.noScene': 'Pick a Plus scene and your devices follow it',
  'lighting.pickScene': 'Browse visualizers',
  'lighting.showGraph': 'Show the graph',

  'lighting.brightness': 'Brightness',
  'lighting.brightness.value': '{percent} %',
  'lighting.pulse': 'Pulse with the beat',
  'lighting.pulse.off': 'Off',
  'lighting.pulse.gentle': 'Gentle',
  'lighting.pulse.full': 'Full',
  'lighting.colours.hint':
    'The colours come from the scene itself, so there is nothing to pick.',

  'lighting.devices.title': 'Your devices',
  'lighting.devices.found': 'Found on your desk',
  'lighting.devices.searching': 'Looking for devices…',
  'lighting.devices.none.title': 'No lighting devices found',
  'lighting.devices.none.body':
    'Devices that work with Windows Dynamic Lighting appear here, and Razer devices once Razer Chroma is installed. Plug one in and it appears.',
  'lighting.devices.together':
    'Razer devices are lit together, through Razer Chroma.',

  'lighting.route.synapse': 'Razer Chroma',
  'lighting.route.windows': 'Windows Dynamic Lighting',
  'lighting.route.none': 'Not reachable',

  'lighting.kind.keyboard': 'Keyboard',
  'lighting.kind.mouse': 'Mouse',
  'lighting.kind.mousepad': 'Mousepad',
  'lighting.kind.headset': 'Headset',
  'lighting.kind.keypad': 'Keypad',
  'lighting.kind.stand': 'Stand',
  'lighting.kind.speaker': 'Speaker',
  'lighting.kind.accessory': 'Accessory',

  'lighting.device.toggle': 'Light {name}',

  'lighting.notice.windows.title':
    'Windows is keeping {devices} for the app in front.',
  'lighting.notice.windows.body':
    'To keep them lit while FluidEQ is behind other windows, allow FluidEQ under Background light control in Windows Settings.',
  'lighting.notice.windows.action': 'Open Windows lighting settings',
  'lighting.notice.chroma.title': "Razer Chroma isn't answering.",
  'lighting.notice.chroma.body':
    'Your Razer devices take their colours through Razer Chroma. Start it and they join in.',
  'lighting.notice.chroma.action': 'Open Razer Chroma',
  'lighting.notice.appsOff.title':
    'Razer Chroma is not letting apps light your devices.',
  'lighting.notice.appsOff.body':
    'Turn on Chroma Apps in Razer Chroma, and allow FluidEQ there.',

  'lighting.graph.on': 'Stop lighting my devices',
  'lighting.graph.off': 'Light my devices with this scene',
} as const;

export default lighting;
