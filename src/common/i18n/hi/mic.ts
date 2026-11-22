/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Mic tab: each microphone's own sound, played by the FluidEQ Engine on
 * the microphone itself, so every app hears it (Ivan, 2026-11-20).
 */
export default {
  'mic.tab': 'माइक',
  'mic.label': 'माइक्रोफ़ोन',
  'mic.pickHint': 'जिस माइक्रोफ़ोन की आवाज़ सँवारनी है, उसे चुनें',
  'mic.list.heading': 'इस कंप्यूटर के माइक्रोफ़ोन',
  'mic.list.on': 'चालू',
  'mic.list.off': 'सेट अप नहीं',
  'mic.live': 'हर ऐप में लाइव · कम देरी {ms} ms',
  'mic.notSetUp': 'इस माइक पर अभी सेट अप नहीं हुआ',
  'mic.state.opening': 'माइक खोला जा रहा है…',
  'mic.state.noInput': 'Windows अभी इस माइक के लिए कोई इनपुट नहीं दिखा रहा',
  'mic.state.blocked': 'Windows ने FluidEQ को यह माइक खोलने नहीं दिया',
  'mic.state.waiting': 'माइक खुला है · इस पर इंजन शुरू होने का इंतज़ार',
  'mic.meter.gateOpen': 'आवाज़ जा रही है',
  'mic.meter.gateClosed': 'गेट बंद',
  'mic.meter.compressor': 'कंप्रेसर',
  'mic.meter.limiter': 'लिमिटर',
  'mic.monitor.label': 'ख़ुद को सुनें',
  'mic.monitor.hint':
    'दूसरों को जो सुनाई देता है, उसे उस आउटपुट पर बजाता है जिसे आप सुन रहे हैं',
  'mic.monitor.warning':
    'हेडफ़ोन लगाएँ: स्पीकर पर आपकी आवाज़ वापस माइक में जाकर गूँजती है।',
  'mic.effectsOff.short': 'इस माइक के लिए Windows के ऑडियो एन्हांसमेंट बंद हैं',
  'mic.effectsOff.title': '{mic} के लिए ऑडियो एन्हांसमेंट बंद हैं',
  'mic.effectsOff.body':
    'इनके बंद रहते Windows इस माइक पर कोई इफ़ेक्ट नहीं चलाता, इसलिए FluidEQ इसे प्रोसेस नहीं कर सकता। माइक की प्रॉपर्टीज़ में “ऑडियो एन्हांसमेंट” चालू करें।',
  'mic.effectsOff.button': 'Windows की साउंड सेटिंग्स खोलें',
  'mic.picture.label':
    'आपकी आवाज़: माइक जो पकड़ता है वह हल्के रंग में, और दूसरे जो सुनते हैं वह चमकीले रंग में',
  'mic.picture.raw': 'आपका माइक',
  'mic.picture.heard': 'दूसरे क्या सुनते हैं',
  'mic.picture.gate': 'गेट',
  'mic.profile.label': 'माइक प्रोफ़ाइल',
  'mic.profile.pickHint':
    'माइक के अपने इस्तेमाल के हिसाब से बनी प्रोफ़ाइल से शुरू करें',
  'mic.profile.group.use': 'उपयोग के अनुसार',
  'mic.profile.group.mic': 'माइक के अनुसार',
  'mic.profile.tuned': 'बदला हुआ',
  'mic.profile.stream': 'स्ट्रीमिंग',
  'mic.profile.stream.hint':
    'Twitch और YouTube के लिए गर्म, पास और स्थिर आवाज़',
  'mic.profile.podcast': 'पॉडकास्ट',
  'mic.profile.podcast.hint': 'हल्के नियंत्रण के साथ स्वाभाविक आवाज़',
  'mic.profile.chat': 'गेम चैट',
  'mic.profile.chat.hint':
    'Discord और टीम चैट में साफ़ और आगे रहने वाली आवाज़, शब्दों के बीच कुछ नहीं',
  'mic.profile.sing': 'गायन',
  'mic.profile.sing.hint':
    'खुली और हवादार आवाज़, कोई पंपिंग नहीं, हर साँस बनी रहती है',
  'mic.profile.broadcast': 'ब्रॉडकास्ट',
  'mic.profile.broadcast.hint': 'रेडियो जैसी आवाज़: भरपूर बेस, कसी हुई और घनी',
  'mic.profile.noisy': 'शोर भरा कमरा',
  'mic.profile.noisy.hint': 'पंखे, बच्चे, ट्रैफ़िक: क्लीनर और गेट पूरे पर',
  'mic.profile.meet': 'मीटिंग',
  'mic.profile.meet.hint':
    'Teams और Zoom: साफ़ शब्द, और उनकी अपनी सफ़ाई उन्हीं पर छोड़ता है',
  'mic.profile.laptop': 'लैपटॉप माइक',
  'mic.profile.laptop.hint':
    'पतली, दूर और कमरे की गूँज वाली आवाज़: लो कट ऊँचा, क्लीनर तेज़',
  'mic.profile.headset': 'हेडसेट बूम',
  'mic.profile.headset.hint':
    'मुँह के पास छोटा कैप्सूल: गर्माहट वापस, पॉप बाहर',
  'mic.reset': '{profile} पर रीसेट करें',
  'mic.setup.title': 'FluidEQ Engine अभी {mic} पर नहीं है।',
  'mic.setup.body':
    'Windows एक बार अनुमति माँगता है। सेट अप के दौरान आपके आउटपुट बजते रहते हैं।',
  'mic.setup.button': 'इस माइक पर सेट अप करें',
  'mic.setup.working': 'सेट अप हो रहा है…',
  'mic.setup.declined': 'Windows ने अनुमति नहीं दी, इसलिए कुछ नहीं बदला।',
  'mic.setup.failed': 'इस माइक पर सेट अप नहीं हो सका।',
  'mic.notFluid.title': 'माइक की अपनी आवाज़ FluidEQ Engine पर बजती है।',
  'mic.notFluid.body':
    'इसकी आवाज़ सहेजी रहती है, और FluidEQ Engine चुनते ही बजने लगती है।',
  'mic.empty.title': 'कोई माइक्रोफ़ोन नहीं मिला',
  'mic.empty.body':
    'माइक्रोफ़ोन लगाएँ, या FluidEQ Engine अपडेट करें ताकि वह उन्हें दिखा सके।',
  'mic.stage.lowCut': 'लो कट',
  'mic.stage.cleaner': 'वॉइस क्लीनर',
  'mic.stage.gate': 'गेट',
  'mic.stage.deEsser': 'डी-एसर',
  'mic.stage.eq': 'EQ',
  'mic.stage.compressor': 'कंप्रेसर',
  'mic.stage.limiter': 'लिमिटर',
  'mic.lowCut.title': 'लो कट',
  'mic.lowCut.description':
    'आवाज़ के नीचे की गड़गड़ाहट, मेज़ की ठक-ठक और पंखे की आवाज़ हटाता है, क्लीनर के सुनने से पहले।',
  'mic.lowCut.group.below': 'आवाज़ के नीचे',
  'mic.lowCut.group.belowHint':
    '“माइक के पास” वह अतिरिक्त बेस हटाता है जो कैप्सूल से कुछ सेंटीमीटर दूर आवाज़ में आ जाता है।',
  'mic.lowCut.cut': 'इसके नीचे कट',
  'mic.lowCut.proximity': 'माइक के पास',
  'mic.lowCut.group.pops': 'पॉप',
  'mic.lowCut.group.popsHint':
    '“प” या “ब” की धमक को नरम करता है और स्थिर आवाज़ को नहीं छेड़ता।',
  'mic.lowCut.plosive': 'पॉप गार्ड',
  'mic.gate.title': 'गेट',
  'mic.gate.description':
    'शब्दों के बीच माइक बंद कर देता है ताकि कमरा, पंखा और कीबोर्ड बाहर रहें। कम कटौती पर यह हल्का एक्सपैंडर बन जाता है।',
  'mic.gate.group.level': 'कब खुले',
  'mic.gate.group.levelHint':
    'तस्वीर में डैश वाली रेखा देखें: आपकी आवाज़ उसके ऊपर जाए, और कमरे का शोर उसके नीचे रहे।',
  'mic.gate.threshold': 'खुलने का स्तर',
  'mic.gate.range': 'कटौती',
  'mic.gate.group.time': 'कितनी तेज़ी से',
  'mic.gate.group.timeHint':
    '“थामना” इसे अक्षरों के बीच खुला रखता है, ताकि शब्दों के अंत कभी न कटें।',
  'mic.gate.attack': 'खुलना',
  'mic.gate.hold': 'थामना',
  'mic.gate.release': 'बंद होना',
};
