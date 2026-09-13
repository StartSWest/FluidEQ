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
