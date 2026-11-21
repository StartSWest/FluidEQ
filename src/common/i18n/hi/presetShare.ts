/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Sharing the listener's own presets. See `en/presetShare.ts`. */
export default {
  'presetShare.share': '{name} साझा करें',
  'presetShare.menu.community': 'समुदाय के साथ साझा करें…',
  'presetShare.menu.copyLink': 'साझा लिंक कॉपी करें',
  'presetShare.menu.export': 'निर्यात करें…',
  'presetShare.linkCopied': 'साझा लिंक कॉपी हो गया',
  'presetShare.linkMaking': 'लिंक बनाया जा रहा है…',
  'presetShare.linkFailed.signedOut': 'लिंक बनाने के लिए साइन इन करें',
  'presetShare.linkFailed.suspended': 'यह खाता अभी साझा नहीं कर सकता',
  'presetShare.linkFailed.rateLimited': 'इस घंटे बहुत ज़्यादा लिंक बने',
  'presetShare.linkFailed.tooMany': 'खाते की लिंक सीमा पूरी हो गई',
  'presetShare.linkFailed.takenDown': 'यह लिंक हटा दिया गया',
  'presetShare.linkFailed.offline': 'FluidEQ सर्वर ने जवाब नहीं दिया',

  'presetShare.text.title': '{name} · FluidEQ प्रीसेट',
  'presetShare.text.curve': 'कर्व: {count} बैंड',
  'presetShare.text.rack': 'रैक: {stages}',
  'presetShare.text.open': 'FluidEQ में खोलें',

  'presetShare.chip.curve': 'कर्व · {count} बैंड',
  'presetShare.chip.flat': 'कोई बदलाव नहीं',

  'presetShare.export.title': '{name} निर्यात करें',
  'presetShare.export.hint':
    'कर्व और रैक का हर चरण। आपका नॉर्मलाइज़र और आपके कमरे का सिर आपके पास ही रहते हैं।',
  'presetShare.export.tab.forum': 'किसी भी फ़ोरम के लिए',
  'presetShare.export.tab.file': 'फ़ाइल',
  'presetShare.export.tab.apo': 'Equalizer APO',
  'presetShare.format.markdown': 'Markdown',
  'presetShare.format.markdownFor': 'Reddit · Discord · GitHub',
  'presetShare.format.bbcode': 'BBCode',
  'presetShare.format.bbcodeFor': 'Head-Fi · दूसरे फ़ोरम',
  'presetShare.format.plain': 'सादा टेक्स्ट',
  'presetShare.format.plainFor': 'बाकी हर जगह',
  'presetShare.export.withLink': 'fluideq.com पर इसके पेज का छोटा लिंक जोड़ें',
  'presetShare.export.linkSignIn': 'छोटा लिंक जोड़ने के लिए साइन इन करें',
  'presetShare.export.fits': '{count} अक्षर · एक Discord संदेश में आ जाता है',
  'presetShare.export.long':
    '{count} अक्षर · एक Discord संदेश के लिए बहुत लंबा। केवल छोटा लिंक भेजें।',
  'presetShare.export.pasteHint':
    'FluidEQ वाला कोई भी इसे “आयात करें” में पेस्ट कर सकता है।',
  'presetShare.export.fileHint':
    'कर्व और हर चरण वाली पढ़ने योग्य JSON, वही फ़ाइल जो DSP पेज सहेजता है। इसे वापस लाने के लिए “आयात करें” पर छोड़ें।',
  'presetShare.export.apoNoCurve':
    'इस प्रीसेट में कोई कर्व नहीं है: इसकी पूरी ध्वनि रैक में है, जिसके लिए FluidEQ चाहिए।',
  'presetShare.export.apoRack':
    'इस फ़ॉर्मेट में केवल कर्व जाता है। {stages} के लिए FluidEQ चाहिए।',
  'presetShare.export.copy': 'कॉपी करें',
  'presetShare.export.copyCurve': 'कर्व कॉपी करें',
  'presetShare.export.save': 'फ़ाइल सहेजें…',
  'presetShare.export.copied': 'कॉपी हो गया',
  'presetShare.export.saved': 'सहेजा गया',
  'presetShare.export.failed': 'यह नहीं हो पाया। फिर से कोशिश करें।',

  'presetShare.forum.attached': 'संलग्न प्रीसेट',
  'presetShare.forum.remove': 'प्रीसेट हटाएँ',
  'presetShare.forum.template':
    'किसके लिए: \nकिस पर सुना: \nइसके साथ आज़माएँ: \n\nयह क्या करता है: ',

  'presetShare.card.by': '@{author} ने साझा किया',
  'presetShare.card.sharedBy': '{author} ने साझा किया',
  'presetShare.card.sharedByMember': 'FluidEQ के एक सदस्य ने साझा किया',
  'presetShare.card.add': 'मेरे प्रीसेट में जोड़ें',
  'presetShare.card.added': '“आपके” में · चल रहा है',
  'presetShare.card.try': 'आज़माएँ',
  'presetShare.card.stopTrying': 'आज़माना बंद करें',
  'presetShare.card.tryingNote':
    'जब तक आप इसे रोकें नहीं या पोस्ट से बाहर न जाएँ, यह चलता रहेगा; फिर आपकी अपनी ध्वनि लौट आएगी।',

  'presetShare.import.button': 'आयात करें',
  'presetShare.import.title': 'प्रीसेट आयात करें',
  'presetShare.import.hint':
    'कोई फ़ोरम पोस्ट, साझा लिंक या प्रीसेट फ़ाइल पेस्ट करें। केवल उसके अंदर का प्रीसेट पढ़ा जाता है।',
  'presetShare.import.paste': 'क्लिपबोर्ड से पेस्ट करें',
  'presetShare.import.placeholder': 'यहाँ पेस्ट करें…',
  'presetShare.import.chooseFile': 'फ़ाइल चुनें…',
  'presetShare.import.found': 'एक प्रीसेट मिला',
  'presetShare.import.missing':
    'इस टेक्स्ट में कोई FluidEQ प्रीसेट नहीं है। पूरी पोस्ट या साझा लिंक पेस्ट करें।',
  'presetShare.import.newer':
    'यह प्रीसेट FluidEQ के नए संस्करण से बना है। इसे पढ़ने के लिए FluidEQ अपडेट करें।',
  'presetShare.import.damaged':
    'प्रीसेट का कोड कटा हुआ या ख़राब है। इसे शुरू से अंत तक फिर से कॉपी करें।',
  'presetShare.import.clipboardFailed':
    'FluidEQ क्लिपबोर्ड नहीं पढ़ सका। इसके बजाय बॉक्स में पेस्ट करें।',
  'presetShare.import.gone':
    'यह प्रीसेट अब साझा नहीं है। इसके बजाय इसका कोड माँगें।',
  'presetShare.import.offline':
    'यह लिंक खोलने के लिए FluidEQ अपने सर्वर तक नहीं पहुँच सका। कनेक्शन जाँचें और फिर कोशिश करें।',

  'presetShare.link.title': 'यह प्रीसेट जोड़ें?',
  'presetShare.link.hint':
    'आपके खोले गए लिंक से। जब तक आप दबाएँ नहीं, न कुछ चलेगा, न सहेजा जाएगा।',
  'presetShare.link.notNow': 'अभी नहीं',
  'presetShare.link.fetching': 'FluidEQ से प्रीसेट लाया जा रहा है…',
} as const;
