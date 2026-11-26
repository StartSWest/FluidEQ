/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The listener's own presets. See `en/ownPresets.ts`. */
export default {
  'eq.own.new': 'नया प्रीसेट',
  'eq.own.newHint': 'आपका अपना कर्व और रैक',
  'eq.own.dialogHint':
    'मुख्य EQ के लिए एक कर्व और DSP पेज के लिए एक रैक, आपके नाम से सहेजे गए।',
  'eq.own.name': 'नाम',
  'eq.own.defaultName': 'मेरा प्रीसेट',
  'eq.own.defaultFrom': 'मेरा {name}',
  'eq.own.curveFrom': 'कर्व की शुरुआत',
  'eq.own.curveFromHint': 'फिर आप इसे आकार देंगे',
  'eq.own.fromPlaying': '{name}, चल रहा है',
  'eq.own.flat': 'फ़्लैट',
  'eq.own.rackFrom': 'रैक की शुरुआत',
  'eq.own.rackOf': '{name} का रैक',
  'eq.own.rackNow': 'DSP पेज अभी जैसा है',
  'eq.own.rackEmpty': 'खाली',
  'eq.own.create': 'बनाएँ और कर्व को आकार दें',
  'eq.own.editing': 'संपादन जारी',
  'eq.own.parts': 'प्रीसेट के हिस्से',
  'eq.own.curve': 'कर्व',
  'eq.own.rack': 'रैक',
  'eq.own.unsaved': 'सहेजा नहीं गया',
  'eq.own.discard': 'छोड़ें',
  'eq.own.save': 'प्रीसेट सहेजें',
  'eq.own.addBand': 'बैंड जोड़ें',
  'eq.own.curveBands': '“{name}” के कर्व के बैंड',
  'eq.own.edit': 'संपादित करें',
  'eq.own.editCopy': 'कॉपी संपादित करें',
  'eq.own.copyName': '{name} (कॉपी)',
  'eq.own.more': '“{name}” के लिए और',
  'eq.own.renameLabel': '“{name}” का नया नाम',
  'eq.own.about':
    'आपके अपने में से एक। इसका कर्व मुख्य EQ में चलता है, इसका रैक DSP पेज पर।',
  'eq.own.deleteAsk':
    '“{name}” हटाएँ? यह “आपके” से हट जाएगा। अगर यह चल रहा है, तो इसका कर्व और रैक रुक जाएँगे।',
  'eq.own.keep': 'रखें',
  'eq.own.emptyTitle': 'अभी आपका कुछ नहीं',
  'eq.own.emptyHint':
    'नया प्रीसेट एक बनाता है: मुख्य EQ के लिए एक कर्व और DSP पेज के लिए एक रैक।',
} as const;
