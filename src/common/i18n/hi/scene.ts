/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const scene = {
  'scene.quality': 'गुणवत्ता',
  'scene.quality.auto': 'स्वचालित',
  'scene.quality.balanced': 'संतुलित',
  'scene.quality.full': 'पूर्ण',
  'scene.quality.auto.hint':
    'सबसे साफ़ तस्वीर जिसे आपका ग्राफ़िक्स कार्ड सहजता से चला सके',
  'scene.quality.balanced.hint':
    'ग्राफ़िक्स कार्ड पर हल्का, कभी आधे आकार से कम नहीं',
  'scene.quality.full.hint': 'हमेशा पूरा आकार और पूरी तरह चिकने किनारे',
} as const;

export default scene;
