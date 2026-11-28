/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': 'Calidad',
  'scene.quality.auto': 'Automática',
  'scene.quality.balanced': 'Equilibrada',
  'scene.quality.full': 'Completa',
  'scene.quality.auto.hint':
    'La imagen más nítida que tu tarjeta gráfica mantiene fluida',
  'scene.quality.balanced.hint':
    'Más ligera para la tarjeta gráfica, nunca por debajo de la mitad',
  'scene.quality.full.hint':
    'Siempre a tamaño completo y con los bordes suavizados al máximo',
} as const;

export default scene;
