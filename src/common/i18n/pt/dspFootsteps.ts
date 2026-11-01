/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'Passos',
  'dsp.footsteps.description':
    'Aumenta os sons baixos de um jogo, como passos, recargas e portas, no momento em que acontecem. Tiros, explosões, chuva e ecos ficam como estão, os dois ouvidos recebem o mesmo aumento e não há atraso.',
  'dsp.footsteps.isolate': 'Isolar',
  'dsp.footsteps.isolateHint': 'Ouvir só o que o Passos acrescenta.',
  'dsp.footsteps.isolateOn':
    'Tocando só o que o Passos acrescenta. Você deve ouvir passos e outros sons pequenos, nunca tiros.',
  'dsp.footsteps.engineOld':
    'O Passos precisa do FluidEQ Engine mais recente. O resto do rack está tocando; esta etapa começa assim que o motor for atualizado.',

  'dsp.footsteps.lift': 'Realçar',
  'dsp.footsteps.liftHint':
    'Quanto um som baixo sobe enquanto chega. O que já está alto fica como está.',
  'dsp.footsteps.calm': 'Acalmar',
  'dsp.footsteps.calmHint':
    'Quanto o estrondo de uma explosão desce. Ele é solto em um décimo de segundo, para que o próximo passo seja ouvido.',
  'dsp.footsteps.upTo': 'Até {db} dB',
  'dsp.footsteps.bands': 'O que realça',
  'dsp.footsteps.bandsHint':
    'O mesmo aumento em cada alto-falante, para que um som fique onde está.',
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

  'dsp.footstepsPresetGroup.games': 'Por tipo de jogo',
  'dsp.footstepsPreset.competitive': 'Competitivo',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'Battle royale',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'Sobrevivência tática',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'História e terror',
  'dsp.footstepsPreset.storyGames': 'Jogos para um jogador e mundos abertos',
};
