/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Spiel',
  'dsp.footsteps.description':
    'Alles, was ein Spiel richtig klingen lässt: leise Schritte kommen hoch, sobald sie erklingen, Stimmen rücken nach vorn, Wetter und Brummen eines Levels werden leiser oder lauter, und die Welt umgibt Sie. Es fügt keine Verzögerung hinzu.',
  'dsp.footsteps.isolate': 'Isolieren',
  'dsp.footsteps.isolateHint': 'Nur hören, was Spiel verändert.',
  'dsp.footsteps.isolateOn':
    'Es spielt nur, was Spiel verändert. Sie sollten Schritte und kleine Geräusche aufsteigen hören, nie Schüsse.',
  'dsp.footsteps.engineOld':
    'Spiel braucht die neueste FluidEQ Engine. Der Rest des Racks spielt; dieser Filter startet, sobald die Engine aktualisiert ist.',

  'dsp.footsteps.lift': 'Anheben',
  'dsp.footsteps.liftHint':
    'Wie weit ein leises Geräusch angehoben wird, während es eintrifft. Was schon laut ist, bleibt, wie es ist.',
  'dsp.footsteps.calm': 'Dämpfen',
  'dsp.footsteps.upTo': 'Bis zu {db} dB',
  'dsp.footsteps.band.weight': 'Gewicht eines Schritts',
  'dsp.footsteps.band.steps': 'Schritte und Ausrüstung',
  'dsp.footsteps.band.detail': 'Vorn, hinten, oben und unten',

  'dsp.footsteps.graph.now': 'jetzt',
  'dsp.footsteps.graph.lifting': 'Hebt an',
  'dsp.footsteps.graph.calming': 'Dämpft',
  'dsp.footsteps.graph.background': 'Hintergrund',
  'dsp.footsteps.graph.isolate': 'Nur was hinzukommt',
  'dsp.footsteps.graph.everything': 'Alles',
  'dsp.footsteps.graph.steps': 'Schrittband',
  'dsp.footsteps.graph.lifted': 'Angehoben',
  'dsp.footsteps.graph.calmed': 'Gedämpft',

  'dsp.footstepsPreset.competitive': 'Kompetitiv',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle Royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Taktisches Überleben',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Story und Horror',
  'dsp.footstepsPreset.storyGames': 'Einzelspieler und offene Welten',

  'dsp.footstepsPresetGroup.kinds': 'Nach Art des Spiels',
  'dsp.footstepsPresetGroup.competitive': 'Kompetitive Shooter',
  'dsp.footstepsPresetGroup.battle': 'Battle Royale und große Schlachten',
  'dsp.footstepsPresetGroup.tactical': 'Taktik und Survival',
  'dsp.footstepsPresetGroup.moba': 'MOBA und Strategie',
  'dsp.footstepsPresetGroup.rpg': 'MMO und Rollenspiel',
  'dsp.footstepsPresetGroup.story': 'Story und Horror',
  'dsp.footstepsPreset.immersive': 'Jedes Spiel, der Raum um Sie herum',
  'dsp.footstepsPreset.immersiveGames': 'Stereo-Spiele mit Kopfhörern',
  'dsp.footstepsPreset.topDown': 'Von oben',
  'dsp.footstepsPreset.topDownGames': 'MOBA, Echtzeitstrategie, Strategie',
  'dsp.footstepsPreset.worlds': 'Welten',
  'dsp.footstepsPreset.worldsGames': 'MMO, Open-World-Rollenspiele',
  'dsp.footstepsPreset.speed': 'Tempo',
  'dsp.footstepsPreset.speedGames': 'Rennspiele und Fahren',
  'dsp.footstepsPreset.impact': 'Wucht',
  'dsp.footstepsPreset.impactGames': 'Kampf, Action, Sport',
  'dsp.game.hintOwn3d': 'Eigener 3D-Sound',
  'dsp.game.hintRoom': 'Raum: {room}',
  'dsp.game.noteOwn3d':
    '{game} platziert seine Klänge selbst um Sie herum, darum bleibt der Raum aus: zwei davon würden einen Schritt an zwei Orte setzen.',
  'dsp.game.noteRoom': '{game}: Mit Kopfhörern stellt der Raum es in {room}.',
  'dsp.game.engineOld':
    'Dialog, Umgebung und die Hufe brauchen die neueste FluidEQ Engine. Schritte spielt bereits; der Rest startet, sobald die Engine aktualisiert ist.',
  'dsp.game.footsteps': 'Schritte',
  'dsp.game.heavy': 'Hufe und schwere Schritte',
  'dsp.game.heavyHint':
    'Das tiefe Poltern eines Stiefels oder eines Pferdes kommt mit hoch.',
  'dsp.game.dialogue': 'Dialog',
  'dsp.game.dialogueHint':
    'Während jemand in der Mitte der Szene spricht, rückt seine Stimme nach vorn.',
  'dsp.game.voices': 'Stimmen',
  'dsp.game.duck': 'Platz für Stimmen',
  'dsp.game.duckHint':
    'Musik und Effekte treten etwas zurück, während ein Satz gesprochen wird.',
  'dsp.game.voiceMeter': 'Jemand spricht',
  'dsp.game.environment': 'Umgebung',
  'dsp.game.environmentHint':
    'Wetter und Brummen eines Levels: Regen, Wind, das Dröhnen eines Raums. Leiser, um die Hinweise darüber zu hören, lauter für die Atmosphäre.',
  'dsp.game.environmentDial': 'Ambiente',
  'dsp.game.environmentDown': 'Bis zu {db} dB leiser',
  'dsp.game.environmentUp': 'Bis zu {db} dB lauter',
  'dsp.game.environmentLeft': 'Wie das Spiel es gemacht hat',
  'dsp.game.ambienceMeter': 'Gehörte Umgebung',

  'dsp.game.hintNoRoom': 'Am besten ohne Raum',
  'dsp.game.noteNoRoom':
    '{game} ist so, wie es abgemischt wurde, am unheimlichsten, darum bleibt der Raum aus.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Gaming',
  'dsp.deEsserPresetGroup.gaming': 'Gaming',
  'dsp.gamingPreset.tightLows': 'Straffe Tiefen',
  'dsp.gamingPreset.impact': 'Wucht',
  'dsp.gamingPreset.night': 'Nacht',
  'dsp.gamingPreset.positionSafe': 'Richtungstreu',
  'dsp.gamingPreset.openWorld': 'Offene Welt',
  'dsp.gamingPreset.battlefieldView': 'Schlachtfeld-Ansicht',
  'dsp.gamingPreset.cleanCeiling': 'Saubere Obergrenze',
  'dsp.gamingPreset.battle': 'Gefecht',
  'dsp.gamingPreset.cinematicPunch': 'Kino-Wucht',
  'dsp.gamingPreset.rumble': 'Grollen für kleine Treiber',
  'dsp.gamingPreset.engineWeight': 'Motorgewicht',
  'dsp.gamingPreset.cueDetail': 'Hinweis-Details',
  'dsp.gamingPreset.dullHeadset': 'Dumpfes Headset',
  'dsp.gamingPreset.callouts': 'Funksprüche',
  'dsp.gamingPreset.footstepFocus': 'Schritte im Fokus',
  'dsp.gamingPreset.blastTamer': 'Explosionsbremse',
  'dsp.gamingPreset.voicesForward': 'Stimmen nach vorn',
  'dsp.gamingPreset.cinematicWeight': 'Kino-Gewicht',
  'dsp.gamingPreset.dread': 'Grauen',
  'dsp.gamingPreset.engineTyres': 'Motor und Reifen',
  'dsp.gamingPreset.abilityClarity': 'Fähigkeiten klar',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Punktgenau',
  'dsp.gamingChain.blast': 'Explosionen überstehen',
  'dsp.gamingChain.stealth': 'Schleichen',
  'dsp.gamingChain.cinematic': 'Kinoreif',
  'dsp.gamingChain.dread': 'Grauen',
  'dsp.gamingChain.topDown': 'Von oben',
  'dsp.gamingChain.worlds': 'Welten',
  'dsp.gamingChain.speed': 'Tempo',
  'dsp.gamingChain.impact': 'Wucht',
  'dsp.gamingChain.night': 'Nachts spielen',
};
