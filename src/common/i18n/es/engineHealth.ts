const engineHealth = {
  'engineHealth.offTitle': 'El motor FluidEQ no está funcionando en {device}',
  'engineHealth.offBody':
    'Esta salida está sonando sin tu EQ. Reiniciar el audio de Windows suele recuperar el motor, y todo lo demás en FluidEQ sigue funcionando mientras tanto.',
  'engineHealth.partlyOff': 'EN PARTE DESACT.',
  'engineHealth.problemsTitle': 'Parte de tu sonido no llega a {device}',
  'engineHealth.problem.convolution':
    'La convolución está desactivada: el motor no pudo cargar la respuesta al impulso. Prueba con otro archivo.',
  'engineHealth.problem.graphic-eq':
    'El EQ gráfico está desactivado: el motor no pudo construir su curva.',
  'engineHealth.problem.dsp-rack':
    'Los efectos DSP están desactivados: el motor no pudo iniciarlos.',
  'engineHealth.problem.reload-failed':
    'Tu último cambio no se cargó, así que sigue sonando el anterior.',
  'engineHealth.problem.unwatched':
    'El motor no ve los cambios que haces para esta salida.',
  'engineHealth.problem.other':
    'Otra cosa que se pidió al motor no se está ejecutando.',
  'engineHealth.useApo': 'Usar Equalizer APO…',
} as const;

export default engineHealth;
