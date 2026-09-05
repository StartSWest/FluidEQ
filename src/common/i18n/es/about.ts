/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/about';

const about: Record<keyof typeof en, string> = {
  'about.eyebrow': 'El proyecto',
  'about.title': 'Acerca de',
  'about.mascot': 'Fluid, la mascota de FluidEQ',
  'about.description':
    'EQ preciso, perfiles automáticos por dispositivo y un hogar para tu música. Para escuchar a tu manera.',
  'about.author': 'Creado y mantenido por {author}',
  'about.website': 'Sitio oficial',
  'about.source': 'Código fuente',
};

export default about;
