/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': 'Qualità',
  'scene.quality.auto': 'Automatica',
  'scene.quality.balanced': 'Bilanciata',
  'scene.quality.full': 'Piena',
  'scene.quality.auto.hint':
    'L’immagine più nitida che la tua scheda grafica mantiene fluida',
  'scene.quality.balanced.hint':
    'Più leggera per la scheda grafica, mai sotto metà dimensione',
  'scene.quality.full.hint':
    'Sempre a piena dimensione, con i bordi levigati al massimo',
} as const;

export default scene;
