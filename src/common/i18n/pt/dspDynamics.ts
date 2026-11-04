/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.title': 'Dinâmica',
  'dsp.dynamics.description':
    'Sobe o que é baixo e segura o que é alto, em três bandas, para que um sussurro e uma explosão se encontrem no meio. Não adiciona atraso.',
  'dsp.dynamics.engineOld':
    'Dinâmica precisa do FluidEQ Engine mais recente. O resto do rack está tocando; este filtro começa assim que o motor for atualizado.',
  'dsp.dynamics.graphLabel': 'O que cada banda faz com o seu nível',
  'dsp.dynamics.graphIn': 'Entrada',
  'dsp.dynamics.graphOut': 'Saída',
  'dsp.dynamics.band.low': 'Graves',
  'dsp.dynamics.band.lowHint':
    'Abaixo de 150 Hz: o estrondo de uma explosão, um bumbo, um motor.',
  'dsp.dynamics.band.mid': 'Médios',
  'dsp.dynamics.band.midHint':
    'De 150 Hz a 4 kHz: vozes, passos e quase todo o som.',
  'dsp.dynamics.band.high': 'Agudos',
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
