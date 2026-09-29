const files = {
  'files.title.sharePreset': 'EQ प्रीसेट शेयर करें',
  'files.title.exportDspChain': 'DSP चेन प्रीसेट एक्सपोर्ट करें',
  'files.title.importEq': 'EQ सेटिंग्स इंपोर्ट करें',
  'files.title.importImpulse': 'इम्पल्स रिस्पॉन्स इंपोर्ट करें',
  'files.title.exportChain': 'यह चेन एक्सपोर्ट करें',
  'files.title.importChain': 'चेन इंपोर्ट करें',
  'files.title.exportKaraoke': 'कराओके एक्सपोर्ट करें',
  'files.title.saveDownload': 'डाउनलोड अपने कंप्यूटर में सहेजें',
  'files.save': 'सहेजें',
  'files.type.eqPreset': 'FluidEQ EQ प्रीसेट',
  'files.type.dspChain': 'FluidEQ DSP चेन',
  'files.type.eqSettings': 'EQ सेटिंग्स',
  'files.type.impulse': 'WAV इम्पल्स रिस्पॉन्स',
  'files.type.chain': 'FluidEQ चेन',
  'files.type.scene': 'FluidEQ सीन',
  'files.type.programs': 'प्रोग्राम',
  'files.type.pictures': 'तस्वीरें',
  'files.type.all': 'सभी फ़ाइलें',
  'files.imported.profile': 'FluidEQ प्रोफ़ाइल से {count} बैंड इंपोर्ट किए गए।',
  'files.imported.graphicEq': 'GraphicEQ फ़ाइल से {count} बैंड इंपोर्ट किए गए।',
  'files.imported.parametricEq':
    'Equalizer APO की ParametricEQ फ़ाइल से {count} बैंड इंपोर्ट किए गए।',
  'files.imported.skipped':
    '{count} बैंड में ऐसा फ़िल्टर था जिसे FluidEQ संपादित नहीं कर सकता, इसलिए उन्हें छोड़ दिया गया।',
  'files.imported.squiglink':
    'Squiglink एक्सपोर्ट से {count} बैंड इंपोर्ट किए गए।',
  'files.imported.squiglinkSkipped':
    '{count} बैंड FluidEQ में संपादित नहीं हो सकते थे, इसलिए उन्हें छोड़ दिया गया।',
  'files.imported.preampKept':
    'इसका {gain} dB प्रीऐम्प रखा गया है, इसलिए ऑटो नॉर्मलाइज़ बंद है।',
  'files.impulse.applied': '{name} लागू किया गया।',
  'files.chain.exported': '{device} की चेन एक्सपोर्ट की गई।',
  'files.chain.imported': 'चेन इंपोर्ट की गई।',
  'files.chain.importedFrom': '{device} से चेन इंपोर्ट की गई।',
  'files.chain.noOutput':
    'कोई आउटपुट सक्रिय नहीं है, इसलिए इंपोर्ट करने के लिए कुछ नहीं है।',
  'files.chain.notChain': 'वह फ़ाइल FluidEQ चेन नहीं है।',
  'files.squiglink.empty':
    'इंपोर्ट करने से पहले Squiglink का EQ एक्सपोर्ट पेस्ट करें।',
  'files.squiglink.tooLarge':
    'वह EQ एक्सपोर्ट इंपोर्ट करने के लिए बहुत बड़ा है।',
  'files.squiglink.noFilters':
    'कोई Equalizer APO फ़िल्टर नहीं मिला। Squiglink से एक्सपोर्ट किया गया ParametricEQ या GraphicEQ टेक्स्ट कॉपी करें।',
  'files.eq.tooLarge': 'वह फ़ाइल EQ सेटिंग होने के लिए बहुत बड़ी है।',
  'files.eq.notProfile': 'वह JSON फ़ाइल FluidEQ प्रोफ़ाइल नहीं है।',
  'files.eq.noFilters':
    'उस फ़ाइल में कोई Equalizer APO फ़िल्टर नहीं मिला। ParametricEQ, GraphicEQ या FluidEQ प्रोफ़ाइल अपेक्षित थी।',
  'files.wav.notWav': 'वह फ़ाइल WAV इम्पल्स रिस्पॉन्स नहीं है।',
  'files.wav.truncated': 'वह WAV फ़ाइल अधूरी है।',
  'files.wav.unsupported': 'Equalizer APO इस WAV फ़ॉर्मैट को सपोर्ट नहीं करता।',
  'files.wav.noFormat': 'उस WAV फ़ाइल में फ़ॉर्मैट खंड नहीं है।',
  'files.wav.tooLarge':
    'वह इम्पल्स रिस्पॉन्स सुरक्षित रूप से इंपोर्ट करने के लिए बहुत बड़ा है।',
  'files.wav.rate':
    'वह इम्पल्स रिस्पॉन्स {rate} Hz का है। Equalizer APO को इनमें से एक चाहिए: {rates} Hz।',
  'files.wav.noChunks':
    'उस WAV फ़ाइल में इस्तेमाल लायक फ़ॉर्मैट या डेटा खंड नहीं है।',
  'files.wav.sampleFormat':
    'उस WAV के सैंपल फ़ॉर्मैट का सुरक्षित विश्लेषण नहीं हो सकता।',
  'files.wav.noSamples': 'उस WAV इम्पल्स रिस्पॉन्स में कोई सैंपल नहीं है।',
  'files.wav.badSamples': 'उस WAV इम्पल्स रिस्पॉन्स में अमान्य सैंपल हैं।',
  'files.wav.silent':
    'उस WAV इम्पल्स रिस्पॉन्स में मापने लायक कोई रिस्पॉन्स नहीं है।',
  'files.apo.notLocated':
    'Equalizer APO इंस्टॉल नहीं है, या उसका इंस्टॉलेशन नहीं मिला।',
  'files.apo.selectorMissing':
    'Equalizer APO का डिवाइस कॉन्फ़िगरेटर नहीं मिला।',
  'files.apo.editorMissing': 'Equalizer APO की सेटिंग्स नहीं मिलीं।',
  'files.wav.tooLong':
    'वह इम्पल्स रिस्पॉन्स सुरक्षित नॉर्मलाइज़ेशन के लिए विश्लेषण करने को बहुत लंबा है।',
} as const;

export default files;
