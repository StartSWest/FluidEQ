const engineHealth = {
  'engineHealth.offTitle': 'O Motor FluidEQ não está funcionando em {device}',
  'engineHealth.offBody':
    'Esta saída está tocando sem o seu EQ. Reiniciar o áudio do Windows costuma trazer o motor de volta, e todo o resto no FluidEQ continua funcionando enquanto isso.',
  'engineHealth.neverRanTitle': 'O Windows nunca iniciou o Motor FluidEQ',
  'engineHealth.neverRanBody':
    'O motor está instalado e colocado em {device}, e o Windows não o carregou uma única vez aí — por isso reiniciar o áudio não o trará de volta. O FluidEQ já corrigiu tudo o que consegue alcançar; se continuar assim, é o seu software de segurança ou o driver da placa de som que o está impedindo. Enquanto isso, o Equalizer APO processa o seu som.',
  'engineHealth.bypassedTitle':
    'O seu som não está passando pelo FluidEQ em {device}',
  'engineHealth.bypassedBody':
    'O motor está instalado e ligado para esta saída, e o Windows está reproduzindo a música ao lado dele: não lhe chegou som nenhum. Uma saída tem vários lugares onde um efeito pode ficar, e o Windows escolhe um diferente para cada tipo de reprodução; o FluidEQ está num por onde esta música não passa. Mudá-lo pede uma permissão do Windows e um segundo de silêncio.',
  'engineHealth.tryAnotherSlot': 'Tentar outro lugar',
  'engineHealth.partlyOff': 'EM PARTE DESLIG.',
  'engineHealth.problemsTitle': 'Parte do seu som não está chegando a {device}',
  'engineHealth.problem.convolution':
    'A convolução está desligada: o motor não conseguiu carregar a resposta ao impulso. Experimente outro arquivo.',
  'engineHealth.problem.eq-phase':
    'O EQ de fase linear não iniciou; os filtros originais continuam ativos.',
  'engineHealth.problem.graphic-eq':
    'O EQ gráfico está desligado: o motor não conseguiu construir a sua curva.',
  'engineHealth.problem.dsp-rack':
    'Os efeitos DSP estão desligados: o motor não conseguiu iniciá-los.',
  'engineHealth.problem.reload-failed':
    'A sua última alteração não carregou, por isso a anterior continua tocando.',
  'engineHealth.problem.unwatched':
    'O motor não vê as alterações que você faz para esta saída.',
  'engineHealth.problem.other':
    'Outra coisa pedida ao motor não está funcionando.',
  'engineHealth.engineIsOld':
    'O Motor FluidEQ instalado neste PC não é o que esta versão do FluidEQ traz.',
  'engineHealth.rackNeedsEngine':
    'Os efeitos DSP rodam dentro do próprio motor, por isso reiniciar o áudio do Windows inicia o mesmo motor outra vez. O que resolve é colocar no lugar o motor do próprio FluidEQ — uma permissão do Windows e um segundo de silêncio.',
  'engineHealth.useApo': 'Usar o Equalizer APO…',
} as const;

export default engineHealth;
