/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Juego',
  'dsp.footsteps.description':
    'Todo lo que hace que un juego suene bien: los pasos bajos suben en el momento en que suenan, las voces pasan al frente, el clima y el zumbido de un nivel bajan o suben y el mundo te rodea. No añade retardo.',
  'dsp.footsteps.isolate': 'Aislar',
  'dsp.footsteps.isolateHint': 'Escuchar solo lo que cambia Juego.',
  'dsp.footsteps.isolateOn':
    'Suena solo lo que cambia Juego. Deberías oír subir pasos y sonidos pequeños, nunca disparos.',
  'dsp.footsteps.engineOld':
    'Juego necesita el FluidEQ Engine más reciente. El resto del rack está sonando; este filtro empieza en cuanto se actualice el motor.',

  'dsp.footsteps.lift': 'Subir',
  'dsp.footsteps.liftHint':
    'Cuánto sube un sonido bajo mientras llega. Lo que ya suena fuerte se queda como está.',
  'dsp.footsteps.calm': 'Calmar',
  'dsp.footsteps.upTo': 'Hasta {db} dB',
  'dsp.footsteps.band.weight': 'Peso de un paso',
  'dsp.footsteps.band.steps': 'Pasos y equipo',
  'dsp.footsteps.band.detail': 'Delante, detrás, arriba y abajo',

  'dsp.footsteps.graph.now': 'ahora',
  'dsp.footsteps.graph.lifting': 'Subiendo',
  'dsp.footsteps.graph.calming': 'Calmando',
  'dsp.footsteps.graph.background': 'Fondo',
  'dsp.footsteps.graph.isolate': 'Solo lo que añade',
  'dsp.footsteps.graph.everything': 'Todo',
  'dsp.footsteps.graph.steps': 'Banda de los pasos',
  'dsp.footsteps.graph.lifted': 'Subido',
  'dsp.footsteps.graph.calmed': 'Calmado',

  'dsp.footstepsPreset.competitive': 'Competitivo',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Supervivencia táctica',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'Historia y terror',
  'dsp.footstepsPreset.storyGames': 'Juegos para un jugador y mundos abiertos',

  'dsp.footstepsPresetGroup.kinds': 'Por tipo de juego',
  'dsp.footstepsPresetGroup.competitive': 'Shooters competitivos',
  'dsp.footstepsPresetGroup.battle': 'Battle royale y grandes batallas',
  'dsp.footstepsPresetGroup.tactical': 'Táctica y supervivencia',
  'dsp.footstepsPresetGroup.moba': 'MOBA y estrategia',
  'dsp.footstepsPresetGroup.rpg': 'MMO y rol',
  'dsp.footstepsPresetGroup.story': 'Historia y terror',
  'dsp.footstepsPreset.immersive': 'Cualquier juego, la sala a tu alrededor',
  'dsp.footstepsPreset.immersiveGames': 'Juegos en estéreo con auriculares',
  'dsp.footstepsPreset.topDown': 'Vista cenital',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, estrategia',
  'dsp.footstepsPreset.worlds': 'Mundos',
  'dsp.footstepsPreset.worldsGames': 'MMO, RPG de mundo abierto',
  'dsp.footstepsPreset.speed': 'Velocidad',
  'dsp.footstepsPreset.speedGames': 'Carreras y conducción',
  'dsp.footstepsPreset.impact': 'Impacto',
  'dsp.footstepsPreset.impactGames': 'Lucha, acción, deportes',
  'dsp.game.hintOwn3d': 'Su propio sonido 3D',
  'dsp.game.hintRoom': 'Sala: {room}',
  'dsp.game.noteOwn3d':
    '{game} coloca sus sonidos a tu alrededor por sí mismo, así que la sala se queda apagada: con dos, un paso sonaría en dos sitios.',
  'dsp.game.noteRoom': '{game}: con auriculares, la sala lo pone en {room}.',
  'dsp.game.engineOld':
    'Diálogo, Entorno y los caballos necesitan el FluidEQ Engine más reciente. Pasos ya suena; el resto empieza en cuanto se actualice el motor.',
  'dsp.game.footsteps': 'Pasos',
  'dsp.game.heavy': 'Caballos y pasos pesados',
  'dsp.game.heavyHint':
    'El golpe grave de una bota o de un caballo también sube.',
  'dsp.game.dialogue': 'Diálogo',
  'dsp.game.dialogueHint':
    'Mientras alguien habla en el centro de la escena, su voz pasa al frente.',
  'dsp.game.voices': 'Voces',
  'dsp.game.duck': 'Hacer sitio a las voces',
  'dsp.game.duckHint':
    'La música y los efectos se apartan un poco mientras se dice una frase.',
  'dsp.game.voiceMeter': 'Alguien habla',
  'dsp.game.environment': 'Entorno',
  'dsp.game.environmentHint':
    'El clima y el zumbido de un nivel: lluvia, viento, el rumor de una sala. Bájalo para oír las pistas por encima, súbelo para el ambiente.',
  'dsp.game.environmentDial': 'Ambiente',
  'dsp.game.environmentDown': 'Baja hasta {db} dB',
  'dsp.game.environmentUp': 'Sube hasta {db} dB',
  'dsp.game.environmentLeft': 'Como lo hizo el juego',
  'dsp.game.ambienceMeter': 'Entorno que se oye',

  'dsp.game.hintNoRoom': 'Mejor sin la sala',
  'dsp.game.noteNoRoom':
    '{game} da más miedo tal como se mezcló, así que la sala se queda apagada.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Juegos',
  'dsp.deEsserPresetGroup.gaming': 'Juegos',
  'dsp.gamingPreset.tightLows': 'Graves contenidos',
  'dsp.gamingPreset.impact': 'Impacto',
  'dsp.gamingPreset.night': 'Noche',
  'dsp.gamingPreset.positionSafe': 'Posición fiel',
  'dsp.gamingPreset.openWorld': 'Mundo abierto',
  'dsp.gamingPreset.battlefieldView': 'Vista de batalla',
  'dsp.gamingPreset.cleanCeiling': 'Techo limpio',
  'dsp.gamingPreset.battle': 'Batalla',
  'dsp.gamingPreset.cinematicPunch': 'Golpe cinematográfico',
  'dsp.gamingPreset.rumble': 'Retumbo en drivers pequeños',
  'dsp.gamingPreset.engineWeight': 'Peso del motor',
  'dsp.gamingPreset.cueDetail': 'Detalle de pistas',
  'dsp.gamingPreset.dullHeadset': 'Auriculares apagados',
  'dsp.gamingPreset.callouts': 'Avisos del equipo',
  'dsp.gamingPreset.footstepFocus': 'Pasos al frente',
  'dsp.gamingPreset.blastTamer': 'Freno de explosiones',
  'dsp.gamingPreset.voicesForward': 'Voces al frente',
  'dsp.gamingPreset.cinematicWeight': 'Peso cinematográfico',
  'dsp.gamingPreset.dread': 'Pavor',
  'dsp.gamingPreset.engineTyres': 'Motor y neumáticos',
  'dsp.gamingPreset.abilityClarity': 'Habilidades claras',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Precisión',
  'dsp.gamingChain.blast': 'Sobrevivir a la explosión',
  'dsp.gamingChain.stealth': 'Sigilo',
  'dsp.gamingChain.cinematic': 'Cinematográfico',
  'dsp.gamingChain.dread': 'Pavor',
  'dsp.gamingChain.topDown': 'Vista cenital',
  'dsp.gamingChain.worlds': 'Mundos',
  'dsp.gamingChain.speed': 'Velocidad',
  'dsp.gamingChain.impact': 'Impacto',
  'dsp.gamingChain.night': 'Jugar de noche',
};
