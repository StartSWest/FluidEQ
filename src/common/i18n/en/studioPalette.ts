// The Studio's palette control (contract 9, `scenePalette.ts`): its words,
// and the stock palettes its Presets menu offers.
const studioPalette = {
  'studioPalette.group': 'Colours',
  'studioPalette.lead':
    "The scene's palettes, bass to treble. A change shows on the stage at once and is saved into the scene.",
  'studioPalette.presets': 'Presets',
  'studioPalette.reverse': 'Reverse',
  'studioPalette.reverseHint':
    "Turn the palette round: the treble's colours go to the bass.",
  'studioPalette.strip': '{name}: {count} colours',
  'studioPalette.stop': 'Colour {index} of {count}, {colour}, at {percent}%',
  'studioPalette.colour': 'Colour of the selected stop',
  'studioPalette.hint':
    'Click the strip to add a colour. Drag one to move it, click it to change it, right-click it or drag it off to remove it. A palette keeps at least two.',
  'studioPalette.preset.rainbow': 'Rainbow',
  'studioPalette.preset.viridis': 'Viridis',
  'studioPalette.preset.magma': 'Magma',
  'studioPalette.preset.inferno': 'Inferno',
  'studioPalette.preset.plasma': 'Plasma',
  'studioPalette.preset.turbo': 'Turbo',
  'studioPalette.preset.sunset': 'Sunset',
  'studioPalette.preset.ocean': 'Ocean',
  'studioPalette.preset.fire': 'Fire',
  'studioPalette.preset.ice': 'Ice',
  'studioPalette.preset.neon': 'Neon',
  'studioPalette.preset.vaporwave': 'Vaporwave',
  'studioPalette.preset.aurora': 'Aurora',
  'studioPalette.preset.forest': 'Forest',
  'studioPalette.preset.gold': 'Gold',
  'studioPalette.preset.pastel': 'Pastel',
  'studioPalette.preset.cool': 'Cool',
  'studioPalette.preset.spring': 'Spring',
  'studioPalette.preset.tropical': 'Tropical',
  'studioPalette.preset.chrome': 'Chrome',
} as const;

export default studioPalette;
