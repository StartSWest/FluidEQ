/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.key.now': 'A banda agora',
  'dsp.dynamics.key.lifted': 'Subido',
  'dsp.dynamics.key.held': 'Segurado',
  'dsp.dynamics.untouched': 'Intocado',
  'dsp.dynamics.dragHint':
    'Arraste um ponto: vazado onde uma banda começa, cheio para a força.',
  'dsp.dynamics.idleHint':
    'Nada está tocando. O ponto de cada banda percorre sua curva assim que o som chega.',
  'dsp.dynamics.state.lifting': 'Subindo',
  'dsp.dynamics.state.holding': 'Segurando',
  'dsp.dynamics.state.silent': 'Sem som',
  'dsp.dynamics.bands': 'Bandas',
  'dsp.dynamics.axisIn': 'Entrada',
  'dsp.dynamics.axisOut': 'Saída',
  'dsp.dynamics.table.starts': 'Começa',
  'dsp.dynamics.table.atMost': 'No máximo',
  'dsp.dynamics.table.liftUnder': 'Subir abaixo de',
  'dsp.dynamics.table.holdOver': 'Segurar acima de',
  'dsp.dynamics.point.liftStart': 'Onde a subida começa',
  'dsp.dynamics.point.liftTop': 'Até onde a subida vai',
  'dsp.dynamics.point.liftPull': 'Puxar uma subida',
  'dsp.dynamics.point.holdStart': 'Onde a contenção começa',
  'dsp.dynamics.point.holdEnd': 'Quanto segura',
  'dsp.dynamics.engineLiveOld':
    'Atualize o motor para ver Dynamics em movimento. O som já está sendo processado.',
  'dsp.dynamics.title': 'Dinâmica',
  'dsp.dynamics.description':
    'Sobe o que é baixo e segura o que é alto, em três bandas, para que um sussurro e uma explosão se encontrem no meio. Não adiciona atraso.',
  'dsp.dynamics.engineOld':
    'Dinâmica precisa do FluidEQ Engine mais recente. O resto do rack está tocando; este filtro começa assim que o motor for atualizado.',
  'dsp.dynamics.graphLabel': 'O que cada banda faz com o seu nível',
  'dsp.dynamics.band.low': 'Graves',
  'dsp.dynamics.band.lowRange': 'abaixo de 150 Hz',
  'dsp.dynamics.band.lowHint':
    'Abaixo de 150 Hz: o estrondo de uma explosão, um bumbo, um motor.',
  'dsp.dynamics.band.mid': 'Médios',
  'dsp.dynamics.band.midRange': '150 Hz – 4 kHz',
  'dsp.dynamics.band.midHint':
    'De 150 Hz a 4 kHz: vozes, passos e quase todo o som.',
  'dsp.dynamics.band.high': 'Agudos',
  'dsp.dynamics.band.highRange': 'acima de 4 kHz',
  'dsp.dynamics.band.highHint':
    'Acima de 4 kHz: detalhe, ar, a borda de um passo.',
  'dsp.dynamics.lift': 'Subir',
  'dsp.dynamics.hold': 'Segurar',
  'dsp.dynamics.upThreshold': 'Abaixo de',
  'dsp.dynamics.upRatio': 'Proporção',
  'dsp.dynamics.upMax': 'Até',
  'dsp.dynamics.downThreshold': 'Acima de',
  'dsp.dynamics.downRatio': 'Proporção',
  'dsp.dynamics.timing': 'Tempo e nível',
  'dsp.dynamics.timingHint':
    'Quão rápido o segurar chega e o subir volta, e quão alto fica o resultado.',
  'dsp.dynamics.attack': 'Ataque',
  'dsp.dynamics.release': 'Liberação',
  'dsp.dynamics.makeup': 'Compensação',
  'dsp.dynamics.mix': 'Mistura',
  'dsp.dynamicsPreset.gentle': 'Nivelamento suave',
  'dsp.dynamicsPreset.speech': 'Fala',
  'dsp.gamingPreset.quietLift': 'Subir o baixo',
  'dsp.gamingPreset.blastGuard': 'Proteção contra explosões',
  'dsp.gamingPreset.longSession': 'Sessão longa',
  'dsp.gamingPreset.competitiveLight': 'Competitivo leve',
};
