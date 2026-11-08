// The Studio's palette control (contract 9, `scenePalette.ts`): its words,
// and the stock palettes its Presets menu offers.
const studioPalette = {
  'studioPalette.group': 'Colori',
  'studioPalette.lead':
    'Le palette della scena, dai bassi agli acuti. Ogni modifica si vede subito sul palco e viene salvata nella scena.',
  'studioPalette.presets': 'Predefinite',
  'studioPalette.reverse': 'Inverti',
  'studioPalette.reverseHint':
    'Gira la palette: i colori degli acuti passano ai bassi.',
  'studioPalette.strip': '{name}: {count} colori',
  'studioPalette.stop': 'Colore {index} di {count}, {colour}, al {percent}%',
  'studioPalette.colour': 'Colore del punto selezionato',
  'studioPalette.hint':
    'Fai clic sulla striscia per aggiungere un colore. Trascinane uno per spostarlo, fai clic per cambiarlo, clic destro o trascinalo fuori per toglierlo. Una palette ne tiene almeno due.',
  'studioPalette.appColours':
    'In modalità colorata, l’onda, i misuratori e le bande di FluidEQ prendono la prima palette mostrata da questa scena.',
  'studioPalette.preset.rainbow': 'Arcobaleno',
  'studioPalette.preset.viridis': 'Viridis',
  'studioPalette.preset.magma': 'Magma',
  'studioPalette.preset.inferno': 'Inferno',
  'studioPalette.preset.plasma': 'Plasma',
  'studioPalette.preset.turbo': 'Turbo',
  'studioPalette.preset.sunset': 'Tramonto',
  'studioPalette.preset.ocean': 'Oceano',
  'studioPalette.preset.fire': 'Fuoco',
  'studioPalette.preset.ice': 'Ghiaccio',
  'studioPalette.preset.neon': 'Neon',
  'studioPalette.preset.vaporwave': 'Vaporwave',
  'studioPalette.preset.aurora': 'Aurora',
  'studioPalette.preset.forest': 'Foresta',
  'studioPalette.preset.gold': 'Oro',
  'studioPalette.preset.pastel': 'Pastello',
  'studioPalette.preset.cool': 'Freddo',
  'studioPalette.preset.spring': 'Primavera',
  'studioPalette.preset.tropical': 'Tropicale',
  'studioPalette.preset.chrome': 'Cromo',
  'studioPalette.pickColour': '{name}: scegli un colore',
} as const;

export default studioPalette;
