/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Footsteps' page. See `en/dspFootsteps.ts`. */
export default {
  'dsp.footsteps.title': 'कदमों की आहट',
  'dsp.footsteps.description':
    'खेल की धीमी आवाज़ों, जैसे कदम, रीलोड और दरवाज़े, को उसी पल उभारता है जब वे होती हैं। गोलियाँ, धमाके, बारिश और गूँज जैसी हैं वैसी रहती हैं, दोनों कानों को एक जैसा उभार मिलता है, और कोई देरी नहीं जुड़ती।',
  'dsp.footsteps.isolate': 'अलग करें',
  'dsp.footsteps.isolateHint': 'केवल वही सुनें जो कदमों की आहट जोड़ता है।',
  'dsp.footsteps.isolateOn':
    'केवल वही बज रहा है जो कदमों की आहट जोड़ता है। आपको कदम और दूसरी छोटी आवाज़ें सुनाई देनी चाहिए, गोलियाँ कभी नहीं।',
  'dsp.footsteps.engineOld':
    'कदमों की आहट को सबसे नया FluidEQ Engine चाहिए। रैक का बाकी हिस्सा बज रहा है; इंजन अपडेट होते ही यह चरण शुरू हो जाएगा।',

  'dsp.footsteps.lift': 'उभार',
  'dsp.footsteps.liftHint':
    'कोई धीमी आवाज़ आते समय कितनी उभरती है। जो पहले से तेज़ है, वह वैसा ही रहता है।',
  'dsp.footsteps.calm': 'शांत',
  'dsp.footsteps.calmHint':
    'धमाके की गड़गड़ाहट कितनी नीचे आती है। यह एक सेकंड के दसवें हिस्से में छूट जाती है, ताकि अगला कदम सुनाई दे।',
  'dsp.footsteps.upTo': '{db} dB तक',
  'dsp.footsteps.bands': 'क्या उभरता है',
  'dsp.footsteps.bandsHint':
    'हर स्पीकर पर एक जैसा उभार, ताकि आवाज़ अपनी जगह पर रहे।',
  'dsp.footsteps.band.weight': 'कदम का भार',
  'dsp.footsteps.band.steps': 'कदम और साज़-सामान',
  'dsp.footsteps.band.detail': 'आगे, पीछे, ऊपर और नीचे',

  'dsp.footsteps.graph.now': 'अभी',
  'dsp.footsteps.graph.lifting': 'उभार रहा है',
  'dsp.footsteps.graph.calming': 'शांत कर रहा है',
  'dsp.footsteps.graph.background': 'पृष्ठभूमि',
  'dsp.footsteps.graph.isolate': 'केवल जो जुड़ता है',
  'dsp.footsteps.graph.everything': 'सब कुछ',
  'dsp.footsteps.graph.steps': 'कदमों का बैंड',
  'dsp.footsteps.graph.lifted': 'उभारा गया',
  'dsp.footsteps.graph.calmed': 'शांत किया गया',

  'dsp.footstepsPresetGroup.games': 'खेल के प्रकार के अनुसार',
  'dsp.footstepsPreset.competitive': 'प्रतिस्पर्धी',
  'dsp.footstepsPreset.competitiveGames': 'CS2, Valorant, Rainbow Six',
  'dsp.footstepsPreset.battleRoyale': 'बैटल रॉयल',
  'dsp.footstepsPreset.battleRoyaleGames': 'Warzone, Apex, PUBG, Fortnite',
  'dsp.footstepsPreset.tactical': 'टैक्टिकल सर्वाइवल',
  'dsp.footstepsPreset.tacticalGames': 'Tarkov, Hunt, Arma',
  'dsp.footstepsPreset.story': 'कहानी और हॉरर',
  'dsp.footstepsPreset.storyGames': 'सिंगल-प्लेयर खेल और खुली दुनिया',
};
