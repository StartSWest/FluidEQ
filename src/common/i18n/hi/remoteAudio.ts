/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'ऑडियो साझा करें',
  'remoteAudio.eyebrow': 'LAN ऑडियो लिंक',
  'remoteAudio.title': 'अपने दूसरे कंप्यूटर यहाँ सुनें',
  'remoteAudio.subtitle':
    'इस कंप्यूटर के लिए एक भूमिका चुनें। रिसीवर वह PC है जिस पर हेडसेट लगा है; बाकी PC सेंडर के रूप में जुड़ सकते हैं।',
  'remoteAudio.choose': 'इस कंप्यूटर की भूमिका चुनें',
  'remoteAudio.security': 'कनेक्शन की विशेषताएँ',
  'remoteAudio.badge.local': 'केवल निजी LAN',
  'remoteAudio.badge.lossless': 'लॉसलेस Float32 PCM ट्रांसपोर्ट',
  'remoteAudio.badge.encrypted': 'AES-256-GCM एन्क्रिप्टेड',
  'remoteAudio.listen.kicker': 'रिसीवर · सर्वर',
  'remoteAudio.listen.title': 'इस कंप्यूटर पर ऑडियो चलाएँ',
  'remoteAudio.listen.body':
    'हेडसेट या स्पीकर वाले कंप्यूटर पर यह भूमिका इस्तेमाल करें। यह एक या अधिक सेंडर स्वीकार करता है और FluidEQ में चुने गए आउटपुट पर उन्हें चलाता है।',
  'remoteAudio.listen.start': 'कनेक्शन कोड बनाएँ',
  'remoteAudio.listen.activeTitle': 'यह कंप्यूटर सुन रहा है',
  'remoteAudio.listen.newCode': 'नया कोड बनाएँ',
  'remoteAudio.listen.stop': 'सुनना बंद करें',
  'remoteAudio.stream.title': 'स्ट्रीम प्राथमिकता',
  'remoteAudio.stream.lossless': 'दोनों लॉसलेस PCM भेजते हैं',
  'remoteAudio.stream.video.title': 'गेम/वीडियो',
  'remoteAudio.stream.video.body':
    'लिप-सिंक के लिए सबसे कम देरी। व्यस्त Wi-Fi पर जल्दी रुक सकता है।',
  'remoteAudio.stream.video.buffer': 'शुरुआत ~100 ms',
  'remoteAudio.stream.music.title': 'संगीत',
  'remoteAudio.stream.music.body':
    'बिना रुकावट सुनने के लिए बड़ा सुरक्षा बफ़र।',
  'remoteAudio.stream.music.buffer': 'शुरुआत ~240 ms',
  'remoteAudio.send.kicker': 'सेंडर · क्लाइंट',
  'remoteAudio.send.title': 'इस कंप्यूटर का ऑडियो भेजें',
  'remoteAudio.send.body':
    'हर उस कंप्यूटर पर यह करें जिसे आप सुनना चाहते हैं। हेडसेट कंप्यूटर पर दिखा कोड चिपकाएँ।',
  'remoteAudio.send.codeLabel': 'कनेक्शन कोड',
  'remoteAudio.send.codePlaceholder': 'FLUIDEQ-LAN-2… चिपकाएँ',
  'remoteAudio.send.start': 'कनेक्ट करके भेजें',
  'remoteAudio.send.activeTitle': 'सिस्टम ऑडियो भेजा जा रहा है',
  'remoteAudio.send.activeBody':
    'दोनों कंप्यूटरों पर FluidEQ खुला रखें। रिसीवर इस लॉसलेस स्ट्रीम को अन्य जुड़े प्रेषकों के साथ चलाता है।',
  'remoteAudio.send.destination': '{name} पर चल रहा है',
  'remoteAudio.send.stop': 'भेजना बंद करें',
  'remoteAudio.send.readyHint':
    'रोकने के बाद भी सेव किया गया कोड यहाँ रहता है।',
  'remoteAudio.status.preparing': 'तैयार हो रहा है…',
  'remoteAudio.status.waiting': 'कंप्यूटरों की प्रतीक्षा',
  'remoteAudio.status.connecting': 'कनेक्ट हो रहा है…',
  'remoteAudio.status.connectedOne': '{count} कंप्यूटर जुड़ा है',
  'remoteAudio.status.connectedMany': '{count} कंप्यूटर जुड़े हैं',
  'remoteAudio.status.sending': 'लॉसलेस ऑडियो भेजा जा रहा है',
  'remoteAudio.status.playbackBlocked':
    'ऑडियो सुनने के लिए फिर शुरू करें दबाएँ',
  'remoteAudio.status.disconnected': 'रिसीवर डिस्कनेक्ट हो गया',
  'remoteAudio.monitor.title': 'लाइव कनेक्शन',
  'remoteAudio.monitor.inactive': 'शुरू करने के लिए भूमिका चुनें',
  'remoteAudio.monitor.ready': 'कनेक्शन कोड के लिए तैयार',
  'remoteAudio.monitor.waveform': 'साझा ऑडियो का लाइव वेवफ़ॉर्म',
  'remoteAudio.monitor.waveformFor': '{name} का लाइव ऑडियो वेवफ़ॉर्म',
  'remoteAudio.monitor.buffer': 'प्लेबैक {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': 'भेजने की कतार {milliseconds} ms',
  'remoteAudio.monitor.noRole': 'कोई भूमिका नहीं चुनी गई',
  'remoteAudio.monitor.noSources': 'कोई स्रोत कंप्यूटर कनेक्ट नहीं है',
  'remoteAudio.monitor.waitingSource': 'प्रेषक की प्रतीक्षा',
  'remoteAudio.monitor.outgoing': 'इस कंप्यूटर से भेजा गया ऑडियो',
  'remoteAudio.monitor.transmitting': 'प्रसारण जारी',
  'remoteAudio.monitor.quiet': 'शांत',
  'remoteAudio.monitor.nowPlaying': 'अभी चल रहा है',
  'remoteAudio.monitor.paused': 'रुका हुआ',
  'remoteAudio.monitor.peakLevel': 'लाइव पीक ऑडियो स्तर',
  'remoteAudio.monitor.peak': 'शिखर {decibels} dB',
  'remoteAudio.monitor.networkUsage': 'LAN {megabits} Mb/s',
  'remoteAudio.monitor.networkHealthy': 'नेटवर्क स्थिर',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms कतार में',
  'remoteAudio.code.title': 'दूसरे कंप्यूटर पेयर करें',
  'remoteAudio.code.hint':
    'हर सेंडर में एक कोड कॉपी करें। ऐप बंद होने या PC रीस्टार्ट होने पर भी पेयरिंग सुरक्षित रहती है। यदि कई पते दिखें, तो दोनों कंप्यूटरों वाला साझा नेटवर्क चुनें।',
  'remoteAudio.code.copy': 'कोड कॉपी करें',
  'remoteAudio.code.copied': 'कॉपी हो गया',
  'remoteAudio.code.forAddress': '{address} के लिए पेयरिंग कोड',
  'remoteAudio.resume': 'ऑडियो फिर शुरू करें',
  'remoteAudio.note.title': 'कम आवाज़ से शुरू करें।',
  'remoteAudio.note.body':
    'कई कंप्यूटरों का ऑडियो मिलाया जाता है और आवाज़ जल्दी बढ़ सकती है। पहला कनेक्शन करने से पहले हेडसेट की आवाज़ कम करें। केवल नया कोड बनाने से सुरक्षित पेयरिंग कटती हैं।',
  'remoteAudio.error.lan':
    'FluidEQ स्थानीय कनेक्शन नहीं खोल सका। सुनिश्चित करें कि दोनों कंप्यूटर एक ही निजी नेटवर्क पर हैं और फ़ायरवॉल FluidEQ को अनुमति देता है।',
  'remoteAudio.error.capture':
    'FluidEQ इस कंप्यूटर का सिस्टम ऑडियो कैप्चर नहीं कर सका। मौजूदा आउटपुट डिवाइस जाँचें, रोकें और फिर कोशिश करें।',
  'remoteAudio.error.playback':
    'FluidEQ लॉसलेस ऑडियो इंजन शुरू नहीं कर सका। FluidEQ को फिर शुरू करके दोबारा कोशिश करें।',
  'remoteAudio.error.connection':
    'एन्क्रिप्टेड ऑडियो कनेक्शन रुक गया। सेव किया गया कोड नीचे मौजूद है; रिसीवर तैयार होने पर दोबारा कनेक्ट करें।',
};

export default remoteAudio;
