/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import type en from '../en/about';

const about: Record<keyof typeof en, string> = {
  'about.eyebrow': 'Le projet',
  'about.title': 'À propos',
  'about.mascot': 'Fluid, la mascotte de FluidEQ',
  'about.description':
    'Un EQ précis, des profils automatiques par appareil et un espace pour votre musique. Pour écouter à votre façon.',
  'about.author': 'Créé et maintenu par {author}',
  'about.website': 'Site officiel',
  'about.source': 'Code source',
};

export default about;
