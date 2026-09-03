/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'साझा करें',
  'remoteAudio.eyebrow': 'LAN ऑडियो लिंक',
  'remoteAudio.title': 'अपने दूसरे कंप्यूटर यहाँ सुनें',
  'remoteAudio.subtitle':
    'हेडसेट वाले कंप्यूटर को रिसीवर बनाएँ। उसी स्थानीय नेटवर्क पर FluidEQ वाले कितने भी कंप्यूटर जुड़कर अपना सिस्टम ऑडियो यहाँ भेज सकते हैं।',
  'remoteAudio.security': 'कनेक्शन की विशेषताएँ',
  'remoteAudio.badge.local': 'केवल स्थानीय नेटवर्क',
  'remoteAudio.badge.lossless': 'लॉसलेस 32-बिट PCM',
  'remoteAudio.badge.encrypted': 'AES-256 एन्क्रिप्टेड',
  'remoteAudio.listen.kicker': 'कंप्यूटर B · हेडसेट',
  'remoteAudio.listen.title': 'इस कंप्यूटर पर ऑडियो चलाएँ',
  'remoteAudio.listen.body':
    'यहाँ जुड़े हेडसेट या स्पीकर चुनें, फिर हर उस कंप्यूटर को पेयरिंग कोड दें जिसे आप सुनना चाहते हैं।',
  'remoteAudio.listen.start': 'सुनना शुरू करें',
  'remoteAudio.listen.activeTitle': 'यह कंप्यूटर सुन रहा है',
  'remoteAudio.listen.stop': 'सुनना बंद करें',
  'remoteAudio.send.kicker': 'कंप्यूटर A · स्रोत',
  'remoteAudio.send.title': 'इस कंप्यूटर का ऑडियो भेजें',
  'remoteAudio.send.body':
    'हेडसेट वाले कंप्यूटर का कोड चिपकाएँ। FluidEQ सिस्टम लूपबैक ऑडियो को बिना कंप्रेशन भेजता है।',
  'remoteAudio.send.codeLabel': 'हेडसेट वाले कंप्यूटर का पेयरिंग कोड',
  'remoteAudio.send.codePlaceholder': 'FLUIDEQ-LAN-1… चिपकाएँ',
  'remoteAudio.send.start': 'भेजना शुरू करें',
  'remoteAudio.send.activeTitle': 'सिस्टम ऑडियो भेजा जा रहा है',
  'remoteAudio.send.activeBody':
    'दोनों कंप्यूटरों पर FluidEQ खुला रखें। रिसीवर इस लॉसलेस स्ट्रीम को अन्य जुड़े प्रेषकों के साथ चलाता है।',
  'remoteAudio.send.stop': 'भेजना बंद करें',
  'remoteAudio.output.label': 'इससे चलाएँ',
  'remoteAudio.output.default': 'डिफ़ॉल्ट ऑडियो आउटपुट',
  'remoteAudio.output.unnamed': 'ऑडियो आउटपुट {number}',
  'remoteAudio.status.preparing': 'तैयार हो रहा है…',
  'remoteAudio.status.waiting': 'कंप्यूटरों की प्रतीक्षा',
  'remoteAudio.status.connecting': 'कनेक्ट हो रहा है…',
  'remoteAudio.status.connectedOne': '{count} कंप्यूटर जुड़ा है',
  'remoteAudio.status.connectedMany': '{count} कंप्यूटर जुड़े हैं',
  'remoteAudio.status.sending': 'लॉसलेस ऑडियो भेजा जा रहा है',
  'remoteAudio.status.playbackBlocked':
    'ऑडियो सुनने के लिए फिर शुरू करें दबाएँ',
  'remoteAudio.status.disconnected': 'रिसीवर डिस्कनेक्ट हो गया',
  'remoteAudio.code.title': 'दूसरे कंप्यूटर पेयर करें',
  'remoteAudio.code.hint':
    'हर प्रेषक में एक कोड कॉपी करें। रिसीवर चालू रहने तक वही कोड कई कंप्यूटर जोड़ सकता है। यदि कई पते दिखें, तो दोनों कंप्यूटरों वाला साझा नेटवर्क चुनें।',
  'remoteAudio.code.copy': 'कोड कॉपी करें',
  'remoteAudio.code.copied': 'कॉपी हो गया',
  'remoteAudio.code.forAddress': '{address} के लिए पेयरिंग कोड',
  'remoteAudio.resume': 'ऑडियो फिर शुरू करें',
  'remoteAudio.note.title': 'कम आवाज़ से शुरू करें।',
  'remoteAudio.note.body':
    'कई कंप्यूटरों का ऑडियो मिलाया जाता है और आवाज़ जल्दी बढ़ सकती है। पहला कनेक्शन करने से पहले हेडसेट की आवाज़ कम करें। रिसीवर रोकते ही उसका कोड अमान्य हो जाता है।',
  'remoteAudio.error.lan':
    'FluidEQ स्थानीय कनेक्शन नहीं खोल सका। सुनिश्चित करें कि दोनों कंप्यूटर एक ही निजी नेटवर्क पर हैं और फ़ायरवॉल FluidEQ को अनुमति देता है।',
  'remoteAudio.error.capture':
    'FluidEQ इस कंप्यूटर का सिस्टम ऑडियो कैप्चर नहीं कर सका। मौजूदा आउटपुट डिवाइस जाँचें, रोकें और फिर कोशिश करें।',
  'remoteAudio.error.connection':
    'एन्क्रिप्टेड ऑडियो कनेक्शन रुक गया। यह सत्र रोकें और नए कोड से दोबारा कनेक्ट करें।',
};

export default remoteAudio;
