/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The De-esser's page. See `en/dspDeEsser.ts`. */
export default {
  'dsp.deEsser.title': 'डी-एसर',
  'dsp.deEsser.description':
    'आवाज़ की तीखी स, ट और श ध्वनियों को सिर्फ़ उनके बजते समय धीमा करता है, और झांझ व बाकी ऊँची आवृत्तियों को नहीं छूता।',
  'dsp.deEsser.isolate': 'अलग करें',
  'dsp.deEsser.isolateHint': 'केवल वही सुनें जो डी-एसर हटाता है।',
  'dsp.deEsser.isolateOn':
    'केवल वही बज रहा है जो डी-एसर हटाता है। अगर इसमें झांझ सुनाई दें, तो यह बहुत ज़्यादा हटा रहा है।',

  'dsp.deEsser.group.find': 'खोजें',
  'dsp.deEsser.group.findHint':
    'संवेदनशीलता गाने के अपने स्तर के सापेक्ष मापी जाती है, इसलिए धीमे और तेज़ ट्रैक के साथ एक जैसा व्यवहार होता है।',
  'dsp.deEsser.group.reduce': 'घटाएँ',
  'dsp.deEsser.group.timing': 'टाइमिंग',
  'dsp.deEsser.group.timingHint':
    'शुरुआत पकड़ें हर स से ठीक पहले प्रतिक्रिया करता है, ताकि उसका पहला किनारा न छूटे। छोड़ें तय करता है कि उसके बाद ऊँची आवृत्तियाँ कितनी जल्दी लौटें।',
  'dsp.deEsser.group.where': 'कहाँ',

  'dsp.deEsser.sensitivity': 'संवेदनशीलता',
  'dsp.deEsser.lowHz': 'से',
  'dsp.deEsser.highHz': 'तक',
  'dsp.deEsser.rangeDb': 'अधिकतम',
  'dsp.deEsser.widthOct': 'चौड़ाई',
  'dsp.deEsser.attackMs': 'शुरुआत पकड़ें',
  'dsp.deEsser.releaseMs': 'छोड़ें',
  'dsp.deEsser.keepCymbals': 'झांझ बचाएँ',

  'dsp.deEsser.mode.label': 'कैसे घटाता है',
  'dsp.deEsser.mode.spectral': 'स्पेक्ट्रल',
  'dsp.deEsser.mode.treble': 'ट्रेबल',
  'dsp.deEsser.mode.whole': 'पूरी आवाज़',
  'dsp.deEsser.mode.spectralHint':
    'केवल वे आवृत्तियाँ घटाता है जिनसे स बना है, और उसके खिसकने पर उसके साथ चलता है।',
  'dsp.deEsser.mode.trebleHint':
    'ज़्यादातर डी-एसर की तरह स के ऊपर का सब कुछ घटाता है। ज़्यादा पक्का, थोड़ा धीमा।',
  'dsp.deEsser.mode.wholeHint':
    'हर स के दौरान पूरी ध्वनि घटाता है। बोलचाल पर स्वाभाविक, संगीत पर ज़्यादा।',

  'dsp.deEsser.where.label': 'स्टीरियो छवि का कौन-सा हिस्सा',
  'dsp.deEsser.where.centre': 'केंद्र',
  'dsp.deEsser.where.all': 'सब कुछ',
  'dsp.deEsser.where.centreHint':
    'आवाज़ें बीच में होती हैं और हाई-हैट आमतौर पर किनारों पर, इसलिए यह केंद्र में सुनता और घटाता है।',
  'dsp.deEsser.where.allHint':
    'पूरी स्टीरियो छवि सुनता है। मोनो रिकॉर्ड, बोलचाल और लाइव रिकॉर्डिंग के लिए।',

  'dsp.deEsser.graph.s': 'स यहाँ',
  'dsp.deEsser.graph.cut': 'कटौती',
  'dsp.deEsser.graph.isolate': 'केवल जो हटाया गया',
  'dsp.deEsser.graph.spared': 'झांझ छोड़ दिए गए',
  'dsp.deEsser.graph.now': 'अभी',
  'dsp.deEsser.graph.voice': 'आवाज़',
  'dsp.deEsser.graph.notVoice': 'आवाज़ नहीं',
  'dsp.deEsser.graph.threshold': 'कहाँ से शुरू',
  'dsp.deEsser.engineOld':
    'यहाँ स्थापित FluidEQ Engine डी-एसर से पुराना है, इसलिए यह चरण अभी सुनाई नहीं देता। रैक का बाकी हिस्सा पहले की तरह बजता है।',
  'dsp.deEsser.upTo': 'अधिकतम {db}',

  'dsp.deEsserPresetGroup.music': 'संगीत',
  'dsp.deEsserPresetGroup.speech': 'बोलचाल',
  'dsp.deEsserPreset.gentle': 'हल्का',
  'dsp.deEsserPreset.vocalMusic': 'गायन वाला संगीत',
  'dsp.deEsserPreset.brightHeadphones': 'तीखे हेडफ़ोन',
  'dsp.deEsserPreset.harshStreams': 'कर्कश स्ट्रीम',
  'dsp.deEsserPreset.live': 'लाइव रिकॉर्डिंग',
  'dsp.deEsserPreset.podcast': 'पॉडकास्ट और बोलचाल',
} as const;
