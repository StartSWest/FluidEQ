/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/about';

const about: Record<keyof typeof en, string> = {
  'about.eyebrow': 'O projeto',
  'about.title': 'Sobre',
  'about.mascot': 'Fluid, a mascote do FluidEQ',
  'about.description':
    'EQ preciso, perfis automáticos por dispositivo e um lar para sua música. Para ouvir do seu jeito.',
  'about.author': 'Criado e mantido por {author}',
  'about.website': 'Site oficial',
  'about.source': 'Código-fonte',
};

export default about;
