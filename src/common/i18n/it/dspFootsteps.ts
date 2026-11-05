/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Gioco',
  'dsp.footsteps.description':
    'Tutto ciò che fa suonare bene un gioco: i passi deboli salgono appena arrivano, le voci vengono avanti, il meteo e il ronzio di un livello si abbassano o si alzano e il mondo ti circonda. Non aggiunge ritardo.',
  'dsp.footsteps.isolate': 'Isola',
  'dsp.footsteps.isolateHint': 'Ascolta solo ciò che Gioco cambia.',
  'dsp.footsteps.isolateOn':
    'Suona solo ciò che Gioco cambia. Dovresti sentire salire passi e piccoli suoni, mai spari.',
  'dsp.footsteps.engineOld':
    'Gioco richiede il FluidEQ Engine più recente. Il resto del rack sta suonando; questo filtro parte appena il motore viene aggiornato.',

  'dsp.footsteps.lift': 'Alza',
  'dsp.footsteps.liftHint':
    'Quanto sale un suono debole mentre arriva. Ciò che è già forte resta com’è.',
  'dsp.footsteps.calm': 'Calma',
  'dsp.footsteps.upTo': 'Fino a {db} dB',
  'dsp.footsteps.band.weight': 'Peso di un passo',
  'dsp.footsteps.band.steps': 'Passi ed equipaggiamento',
  'dsp.footsteps.band.detail': 'Davanti, dietro, sopra e sotto',

  'dsp.footsteps.graph.now': 'ora',
  'dsp.footsteps.graph.lifting': 'Alza',
  'dsp.footsteps.graph.calming': 'Calma',
  'dsp.footsteps.graph.background': 'Sfondo',
  'dsp.footsteps.graph.isolate': 'Solo ciò che aggiunge',
  'dsp.footsteps.graph.everything': 'Tutto',
  'dsp.footsteps.graph.steps': 'Banda dei passi',
  'dsp.footsteps.graph.lifted': 'Alzato',
  'dsp.footsteps.graph.calmed': 'Calmato',

  'dsp.footstepsPreset.competitive': 'Competitivo',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Sopravvivenza tattica',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Storia e horror',
  'dsp.footstepsPreset.storyGames':
    'Giochi per giocatore singolo e mondi aperti',

  'dsp.footstepsPresetGroup.kinds': 'Per tipo di gioco',
  'dsp.footstepsPresetGroup.competitive': 'Sparatutto competitivi',
  'dsp.footstepsPresetGroup.battle': 'Battle royale e grandi battaglie',
  'dsp.footstepsPresetGroup.tactical': 'Tattica e sopravvivenza',
  'dsp.footstepsPresetGroup.moba': 'MOBA e strategia',
  'dsp.footstepsPresetGroup.rpg': 'MMO e GDR',
  'dsp.footstepsPresetGroup.story': 'Storia e horror',
  'dsp.footstepsPreset.immersive': 'Qualsiasi gioco, la stanza intorno a te',
  'dsp.footstepsPreset.immersiveGames': 'Giochi stereo in cuffia',
  'dsp.footstepsPreset.topDown': 'Dall’alto',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, strategia',
  'dsp.footstepsPreset.worlds': 'Mondi',
  'dsp.footstepsPreset.worldsGames': 'MMO, GDR open world',
  'dsp.footstepsPreset.speed': 'Velocità',
  'dsp.footstepsPreset.speedGames': 'Corse e guida',
  'dsp.footstepsPreset.impact': 'Impatto',
  'dsp.footstepsPreset.impactGames': 'Picchiaduro, azione, sport',
  'dsp.game.hintOwn3d': 'Suono 3D proprio',
  'dsp.game.hintRoom': 'Stanza: {room}',
  'dsp.game.noteOwn3d':
    '{game} colloca da solo i suoi suoni intorno a te, quindi la stanza resta spenta: con entrambi, un passo arriverebbe da due punti.',
  'dsp.game.noteRoom': '{game}: in cuffia, la stanza lo mette in {room}.',
  'dsp.game.engineOld':
    'Dialoghi, Ambiente e gli zoccoli richiedono il FluidEQ Engine più recente. Passi suona già; il resto parte appena il motore viene aggiornato.',
  'dsp.game.footsteps': 'Passi',
  'dsp.game.heavy': 'Zoccoli e passi pesanti',
  'dsp.game.heavyHint':
    'Anche il tonfo profondo di uno stivale o di un cavallo sale.',
  'dsp.game.dialogue': 'Dialoghi',
  'dsp.game.dialogueHint':
    'Mentre qualcuno parla al centro della scena, la sua voce viene avanti.',
  'dsp.game.voices': 'Voci',
  'dsp.game.duck': 'Fai spazio alle voci',
  'dsp.game.duckHint':
    'Musica ed effetti si fanno un po’ da parte mentre viene detta una battuta.',
  'dsp.game.voiceMeter': 'Qualcuno parla',
  'dsp.game.environment': 'Ambiente',
  'dsp.game.environmentHint':
    'Il meteo e il ronzio di un livello: pioggia, vento, il brusio di una stanza. Abbassalo per sentire gli indizi sopra, alzalo per l’atmosfera.',
  'dsp.game.environmentDial': 'Atmosfera',
  'dsp.game.environmentDown': 'Giù fino a {db} dB',
  'dsp.game.environmentUp': 'Su fino a {db} dB',
  'dsp.game.environmentLeft': 'Come l’ha fatto il gioco',
  'dsp.game.ambienceMeter': 'Ambiente sentito',

  'dsp.game.hintNoRoom': 'Meglio senza la stanza',
  'dsp.game.noteNoRoom':
    '{game} fa più paura così come è stato mixato, quindi la stanza resta spenta.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Gaming',
  'dsp.deEsserPresetGroup.gaming': 'Gaming',
  'dsp.gamingPreset.tightLows': 'Bassi asciutti',
  'dsp.gamingPreset.impact': 'Impatto',
  'dsp.gamingPreset.night': 'Notte',
  'dsp.gamingPreset.positionSafe': 'Posizione fedele',
  'dsp.gamingPreset.openWorld': 'Mondo aperto',
  'dsp.gamingPreset.battlefieldView': 'Vista del campo di battaglia',
  'dsp.gamingPreset.cleanCeiling': 'Tetto pulito',
  'dsp.gamingPreset.battle': 'Battaglia',
  'dsp.gamingPreset.cinematicPunch': 'Punch cinematografico',
  'dsp.gamingPreset.rumble': 'Rombo su driver piccoli',
  'dsp.gamingPreset.engineWeight': 'Peso del motore',
  'dsp.gamingPreset.cueDetail': 'Dettaglio degli indizi',
  'dsp.gamingPreset.dullHeadset': 'Cuffie spente',
  'dsp.gamingPreset.callouts': 'Chiamate di squadra',
  'dsp.gamingPreset.footstepFocus': 'Passi in primo piano',
  'dsp.gamingPreset.blastTamer': 'Freno alle esplosioni',
  'dsp.gamingPreset.voicesForward': 'Voci in avanti',
  'dsp.gamingPreset.cinematicWeight': 'Peso cinematografico',
  'dsp.gamingPreset.dread': 'Terrore',
  'dsp.gamingPreset.engineTyres': 'Motore e pneumatici',
  'dsp.gamingPreset.abilityClarity': 'Abilità chiare',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Precisione',
  'dsp.gamingChain.blast': 'Sopravvivi alle esplosioni',
  'dsp.gamingChain.stealth': 'Furtività',
  'dsp.gamingChain.cinematic': 'Cinematografico',
  'dsp.gamingChain.dread': 'Terrore',
  'dsp.gamingChain.topDown': 'Dall’alto',
  'dsp.gamingChain.worlds': 'Mondi',
  'dsp.gamingChain.speed': 'Velocità',
  'dsp.gamingChain.impact': 'Impatto',
  'dsp.gamingChain.night': 'Gioco notturno',
};
