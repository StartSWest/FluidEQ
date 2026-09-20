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

  'lighting.preview.status':
    'Preview — your devices light up while this page is open',
  'lighting.preview.lit': 'Lighting your devices with the scene',
  'lighting.preview.oneScene': 'One scene to show what it does',
  'lighting.preview.noScene': 'A Plus scene on your desk',
  'lighting.preview.moreScenes': 'Every scene with Plus',
  'lighting.preview.held':
    'With Plus your devices stay lit like this, on every scene.',
  'lighting.preview.locked': 'Brightness, style and alignment come with Plus.',

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
  'lighting.devices.searching': 'Looking for devices…',
  'lighting.devices.none.title': 'No lighting devices found',
  'lighting.devices.none.body':
    'Devices that work with Windows Dynamic Lighting appear here, and Razer devices once Razer Chroma is installed. Plug one in and it appears.',
  'lighting.devices.together':
    'Razer devices are lit together, through Razer Chroma.',

  'lighting.route.synapse': 'Razer Chroma',
  'lighting.route.windows': 'Windows Dynamic Lighting',
  'lighting.route.none': 'Not reachable',

  'lighting.form.keyboard-full': 'Keyboard',
  'lighting.form.keyboard-tkl': 'Tenkeyless keyboard',
  'lighting.form.keyboard-compact': 'Compact keyboard',
  'lighting.form.laptop': 'Laptop',
  'lighting.form.keypad': 'Keypad',
  'lighting.form.mouse': 'Mouse',
  'lighting.form.mouse-dock': 'Mouse dock',
  'lighting.form.charging-pad': 'Charging pad',
  'lighting.form.mouse-bungee': 'Mouse bungee',
  'lighting.form.mousepad': 'Mousepad',
  'lighting.form.desk-mat': 'Desk mat',
  'lighting.form.headset': 'Headset',
  'lighting.form.headset-stand': 'Headset stand',
  'lighting.form.speakers': 'Speakers',
  'lighting.form.soundbar': 'Soundbar',
  'lighting.form.microphone': 'Microphone',
  'lighting.form.laptop-stand': 'Laptop stand',
  'lighting.form.monitor-stand': 'Monitor stand',
  'lighting.form.dock': 'Dock',
  'lighting.form.light-strip': 'Light strip',
  'lighting.form.light-bar': 'Monitor light bar',
  'lighting.form.lamp': 'Lamp',
  'lighting.form.controller': 'Controller',
  'lighting.form.tower': 'PC case',
  'lighting.form.mixer': 'Audio mixer',
  'lighting.form.monitor': 'Monitor',
  'lighting.form.chair': 'Chair',
  'lighting.form.accessory': 'Accessory',

  'lighting.device.toggle': 'Light {name}',

  'lighting.notice.windows.title':
    'Windows is keeping {devices} for the app in front.',
  'lighting.notice.windows.body':
    'To keep them lit while FluidEQ is behind other windows, allow FluidEQ under Background light control in Windows Settings.',
  'lighting.notice.windows.action': 'Open Windows lighting settings',

  // Windows' own labels are quoted exactly as its Settings page shows them.
  'lighting.windows.controller': 'Dynamic Lighting Background Controller',
  'lighting.windows.notFirst.title':
    'Windows is giving {devices} to another app first.',
  'lighting.windows.off.title': 'Dynamic Lighting is turned off in Windows.',
  'lighting.windows.waiting.title': 'Windows is handing {devices} to FluidEQ.',
  'lighting.windows.waiting.body': 'This can take up to a minute.',
  'lighting.windows.developerMode.title':
    'This copy of FluidEQ needs Developer Mode to light {devices}.',
  'lighting.windows.developerMode.body':
    'Windows lends its lights only to apps it can identify. A development copy of FluidEQ gets that with Developer Mode on; the released app has it already.',
  'lighting.windows.unavailable.title':
    "Windows won't let this copy of FluidEQ light {devices}.",
  'lighting.windows.unavailable.body':
    "Windows lends its lights only to apps it can identify, and this copy couldn't be identified. Reinstalling FluidEQ normally fixes it.",
  'lighting.windows.step.open': 'Open Dynamic Lighting settings.',
  'lighting.windows.step.list': 'Open “Background light control”.',
  'lighting.windows.step.reset':
    'Under “Background light control”, press “Reset for all devices”.',
  'lighting.windows.step.drag': 'Drag FluidEQ to the top of the list.',
  'lighting.windows.step.dragAbove':
    'Drag FluidEQ to the top of the list, above {above}.',
  'lighting.windows.step.wait': 'The lights switch over within about a minute.',
  'lighting.windows.step.turnOn':
    'Turn on “Use Dynamic Lighting on my devices”.',
  'lighting.windows.step.deviceOn':
    'If a device stays dark, open its card and turn on “Use Dynamic Lighting on this device”.',
  'lighting.windows.step.foreground':
    'While a game or another lighting app is in front, it keeps the lights. To let FluidEQ keep them, turn off “Compatible apps in the foreground always control lighting”.',
  'lighting.windows.step.openDevelopers': 'Open Windows’ developer settings.',
  'lighting.windows.step.developerMode': 'Turn on “Developer Mode”.',
  'lighting.windows.step.comeBack':
    'Come back to FluidEQ; this page picks the change up by itself.',
  'lighting.windows.action.developers': 'Open developer settings',
  'lighting.windows.vendor.razer':
    'Razer devices also need Dynamic Lighting chosen under Device Lighting in Razer Synapse’s settings.',
  'lighting.windows.vendor.logitech':
    'While Windows lights a Logitech device, G HUB can’t change its lighting.',
  'lighting.windows.vendor.asus':
    'In Armoury Crate, set the device to “Aura Sync & Windows Dynamic Lighting”.',
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
