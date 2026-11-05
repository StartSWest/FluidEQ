/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Jogo',
  'dsp.footsteps.description':
    'Tudo o que faz um jogo soar certo: passos baixos sobem na hora em que acontecem, as vozes vêm para a frente, o clima e o zumbido de uma fase descem ou sobem e o mundo envolve você. Não adiciona atraso.',
  'dsp.footsteps.isolate': 'Isolar',
  'dsp.footsteps.isolateHint': 'Ouvir só o que o Jogo muda.',
  'dsp.footsteps.isolateOn':
    'Tocando só o que o Jogo muda. Você deve ouvir passos e sons pequenos subindo, nunca tiros.',
  'dsp.footsteps.engineOld':
    'O Jogo precisa do FluidEQ Engine mais recente. O resto do rack está tocando; este filtro começa assim que o motor for atualizado.',

  'dsp.footsteps.lift': 'Realçar',
  'dsp.footsteps.liftHint':
    'Quanto um som baixo sobe enquanto chega. O que já está alto fica como está.',
  'dsp.footsteps.calm': 'Acalmar',
  'dsp.footsteps.upTo': 'Até {db} dB',
  'dsp.footsteps.band.weight': 'Peso de um passo',
  'dsp.footsteps.band.steps': 'Passos e equipamento',
  'dsp.footsteps.band.detail': 'Frente, trás, cima e baixo',

  'dsp.footsteps.graph.now': 'agora',
  'dsp.footsteps.graph.lifting': 'Realçando',
  'dsp.footsteps.graph.calming': 'Acalmando',
  'dsp.footsteps.graph.background': 'Fundo',
  'dsp.footsteps.graph.isolate': 'Só o que acrescenta',
  'dsp.footsteps.graph.everything': 'Tudo',
  'dsp.footsteps.graph.steps': 'Faixa dos passos',
  'dsp.footsteps.graph.lifted': 'Realçado',
  'dsp.footsteps.graph.calmed': 'Acalmado',

  'dsp.footstepsPreset.competitive': 'Competitivo',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Sobrevivência tática',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'História e terror',
  'dsp.footstepsPreset.storyGames': 'Jogos para um jogador e mundos abertos',

  'dsp.footstepsPresetGroup.kinds': 'Por tipo de jogo',
  'dsp.footstepsPresetGroup.competitive': 'Shooters competitivos',
  'dsp.footstepsPresetGroup.battle': 'Battle royale e grandes batalhas',
  'dsp.footstepsPresetGroup.tactical': 'Tática e sobrevivência',
  'dsp.footstepsPresetGroup.moba': 'MOBA e estratégia',
  'dsp.footstepsPresetGroup.rpg': 'MMO e RPG',
  'dsp.footstepsPresetGroup.story': 'História e terror',
  'dsp.footstepsPreset.immersive': 'Qualquer jogo, a sala ao seu redor',
  'dsp.footstepsPreset.immersiveGames': 'Jogos estéreo no fone de ouvido',
  'dsp.footstepsPreset.topDown': 'Visão de cima',
  'dsp.footstepsPreset.topDownGames': 'MOBA, RTS, estratégia',
  'dsp.footstepsPreset.worlds': 'Mundos',
  'dsp.footstepsPreset.worldsGames': 'MMO, RPG de mundo aberto',
  'dsp.footstepsPreset.speed': 'Velocidade',
  'dsp.footstepsPreset.speedGames': 'Corrida e direção',
  'dsp.footstepsPreset.impact': 'Impacto',
  'dsp.footstepsPreset.impactGames': 'Luta, ação, esportes',
  'dsp.game.hintOwn3d': 'Som 3D próprio',
  'dsp.game.hintRoom': 'Sala: {room}',
  'dsp.game.noteOwn3d':
    '{game} posiciona os próprios sons ao seu redor, então a sala fica desligada: com os dois, um passo viria de dois lugares.',
  'dsp.game.noteRoom': '{game}: no fone de ouvido, a sala o coloca em {room}.',
  'dsp.game.engineOld':
    'Diálogo, Ambiente e os cascos precisam do FluidEQ Engine mais recente. Passos já toca; o resto começa assim que o motor for atualizado.',
  'dsp.game.footsteps': 'Passos',
  'dsp.game.heavy': 'Cascos e passos pesados',
  'dsp.game.heavyHint':
    'A batida grave de uma bota ou de um cavalo também sobe.',
  'dsp.game.dialogue': 'Diálogo',
  'dsp.game.dialogueHint':
    'Enquanto alguém fala no centro da cena, a voz vem para a frente.',
  'dsp.game.voices': 'Vozes',
  'dsp.game.duck': 'Abrir espaço para as vozes',
  'dsp.game.duckHint':
    'A música e os efeitos recuam um pouco enquanto uma fala é dita.',
  'dsp.game.voiceMeter': 'Alguém falando',
  'dsp.game.environment': 'Ambiente',
  'dsp.game.environmentHint':
    'O clima e o zumbido de uma fase: chuva, vento, o ronco de uma sala. Abaixe para ouvir as pistas por cima, aumente para o clima.',
  'dsp.game.environmentDial': 'Ambiência',
  'dsp.game.environmentDown': 'Desce até {db} dB',
  'dsp.game.environmentUp': 'Sobe até {db} dB',
  'dsp.game.environmentLeft': 'Como o jogo fez',
  'dsp.game.ambienceMeter': 'Ambiente ouvido',

  'dsp.game.hintNoRoom': 'Melhor sem a sala',
  'dsp.game.noteNoRoom':
    '{game} dá mais medo do jeito que foi mixado, então a sala fica desligada.',

  // The Gaming tab's own presets, on every stage.
  'dsp.eqPresetGroup.gaming': 'Jogos',
  'dsp.deEsserPresetGroup.gaming': 'Jogos',
  'dsp.gamingPreset.tightLows': 'Graves contidos',
  'dsp.gamingPreset.impact': 'Impacto',
  'dsp.gamingPreset.night': 'Noite',
  'dsp.gamingPreset.positionSafe': 'Posição fiel',
  'dsp.gamingPreset.openWorld': 'Mundo aberto',
  'dsp.gamingPreset.battlefieldView': 'Visão de batalha',
  'dsp.gamingPreset.cleanCeiling': 'Teto limpo',
  'dsp.gamingPreset.battle': 'Batalha',
  'dsp.gamingPreset.cinematicPunch': 'Soco cinematográfico',
  'dsp.gamingPreset.rumble': 'Ronco em drivers pequenos',
  'dsp.gamingPreset.engineWeight': 'Peso do motor',
  'dsp.gamingPreset.cueDetail': 'Detalhe das pistas',
  'dsp.gamingPreset.dullHeadset': 'Headset abafado',
  'dsp.gamingPreset.callouts': 'Chamadas da equipe',
  'dsp.gamingPreset.footstepFocus': 'Passos em foco',
  'dsp.gamingPreset.blastTamer': 'Freio de explosões',
  'dsp.gamingPreset.voicesForward': 'Vozes à frente',
  'dsp.gamingPreset.cinematicWeight': 'Peso cinematográfico',
  'dsp.gamingPreset.dread': 'Pavor',
  'dsp.gamingPreset.engineTyres': 'Motor e pneus',
  'dsp.gamingPreset.abilityClarity': 'Habilidades claras',

  // The Gaming tab's whole-rack chains.
  'dsp.gamingChain.pinpoint': 'Precisão',
  'dsp.gamingChain.blast': 'Sobreviver às explosões',
  'dsp.gamingChain.stealth': 'Furtividade',
  'dsp.gamingChain.cinematic': 'Cinematográfico',
  'dsp.gamingChain.dread': 'Pavor',
  'dsp.gamingChain.topDown': 'Visão de cima',
  'dsp.gamingChain.worlds': 'Mundos',
  'dsp.gamingChain.speed': 'Velocidade',
  'dsp.gamingChain.impact': 'Impacto',
  'dsp.gamingChain.night': 'Jogar à noite',
};
