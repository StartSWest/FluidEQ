const engineHealth = {
  'engineHealth.offTitle': 'O motor FluidEQ não está a funcionar em {device}',
  'engineHealth.offBody':
    'Esta saída está a tocar sem o seu EQ. Reiniciar o áudio do Windows costuma trazer o motor de volta, e tudo o resto no FluidEQ continua a funcionar entretanto.',
  'engineHealth.partlyOff': 'EM PARTE DESLIG.',
  'engineHealth.problemsTitle': 'Parte do seu som não está a chegar a {device}',
  'engineHealth.problem.convolution':
    'A convolução está desligada: o motor não conseguiu carregar a resposta ao impulso. Experimente outro ficheiro.',
  'engineHealth.problem.eq-phase':
    'O EQ de fase linear não iniciou; os filtros originais continuam ativos.',
  'engineHealth.problem.graphic-eq':
    'O EQ gráfico está desligado: o motor não conseguiu construir a sua curva.',
  'engineHealth.problem.dsp-rack':
    'Os efeitos DSP estão desligados: o motor não conseguiu iniciá-los.',
  'engineHealth.problem.reload-failed':
    'A sua última alteração não carregou, por isso a anterior continua a tocar.',
  'engineHealth.problem.unwatched':
    'O motor não vê as alterações que faz para esta saída.',
  'engineHealth.problem.other':
    'Outra coisa pedida ao motor não está a funcionar.',
  'engineHealth.useApo': 'Usar o Equalizer APO…',
} as const;

export default engineHealth;
