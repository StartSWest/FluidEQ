const engineHealth = {
  'engineHealth.offTitle': 'FluidEQ इंजन {device} पर नहीं चल रहा',
  'engineHealth.offBody':
    'इस आउटपुट पर आवाज़ आपके EQ के बिना चल रही है। Windows ऑडियो फिर से चालू करने से आमतौर पर इंजन लौट आता है, और तब तक FluidEQ में बाकी सब काम करता रहता है।',
  'engineHealth.neverRanTitle': 'Windows ने FluidEQ इंजन कभी शुरू ही नहीं किया',
  'engineHealth.neverRanBody':
    'इंजन इंस्टॉल है और {device} पर लगा है, फिर भी Windows ने वहाँ उसे एक बार भी लोड नहीं किया — इसलिए ऑडियो रीस्टार्ट करने से वह वापस नहीं आएगा। FluidEQ जहाँ तक पहुँच सकता था, सब ठीक कर चुका है; अगर यही बना रहे तो आपका सुरक्षा सॉफ़्टवेयर या साउंड कार्ड ड्राइवर उसे रोक रहा है। तब तक Equalizer APO आपकी आवाज़ पर काम करता रहेगा।',
  'engineHealth.bypassedTitle':
    '{device} पर आपकी आवाज़ FluidEQ से होकर नहीं जा रही',
  'engineHealth.bypassedBody':
    'इंजन इस आउटपुट के लिए इंस्टॉल और चालू है, और Windows संगीत को उसके बगल से बजा रहा है — उस तक कोई आवाज़ पहुँची ही नहीं। एक आउटपुट में इफ़ेक्ट के लिए कई जगहें होती हैं, और Windows हर तरह के प्लेबैक के लिए अलग जगह चुनता है; FluidEQ ऐसी जगह है जहाँ से यह संगीत नहीं गुज़रता। उसे दूसरी जगह ले जाने के लिए Windows की एक अनुमति और एक पल की खामोशी चाहिए।',
  'engineHealth.tryAnotherSlot': 'दूसरी जगह आज़माएँ',
  'engineHealth.partlyOff': 'आंशिक रूप से बंद',
  'engineHealth.problemsTitle':
    'आपकी आवाज़ का कुछ हिस्सा {device} तक नहीं पहुँच रहा',
  'engineHealth.problem.convolution':
    'कन्वॉल्यूशन बंद है: इंजन इंपल्स रिस्पॉन्स लोड नहीं कर सका। कोई दूसरी फ़ाइल आज़माएँ।',
  'engineHealth.problem.eq-phase':
    'लीनियर-फेज़ EQ शुरू नहीं हो सका; मूल फ़िल्टर सक्रिय हैं।',
  'engineHealth.problem.graphic-eq':
    'ग्राफ़िक EQ बंद है: इंजन उसका कर्व नहीं बना सका।',
  'engineHealth.problem.dsp-rack':
    'DSP इफ़ेक्ट बंद हैं: इंजन उन्हें शुरू नहीं कर सका।',
  'engineHealth.problem.reload-failed':
    'आपका पिछला बदलाव लोड नहीं हुआ, इसलिए उससे पहले वाला अभी भी चल रहा है।',
  'engineHealth.problem.unwatched':
    'इस आउटपुट के लिए आप जो बदलाव करते हैं, वे इंजन को नहीं दिखते।',
  'engineHealth.problem.other': 'इंजन से कहा गया कोई और काम नहीं चल रहा।',
  'engineHealth.engineIsOld':
    'इस PC पर लगा FluidEQ इंजन वह नहीं है जो FluidEQ का यह संस्करण साथ लाता है।',
  'engineHealth.rackNeedsEngine':
    'DSP प्रभाव इंजन के भीतर ही चलते हैं, इसलिए Windows ऑडियो दोबारा शुरू करने से वही इंजन फिर चालू हो जाता है। इसे ठीक करता है FluidEQ का अपना इंजन लगाना — एक Windows अनुमति और एक पल की ख़ामोशी।',
  'engineHealth.useApo': 'Equalizer APO इस्तेमाल करें…',
} as const;

export default engineHealth;
