/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': 'ऑडियो साझा करें',
  'remoteAudio.eyebrow': 'LAN ऑडियो लिंक',
  'remoteAudio.title': 'अपने दूसरे कंप्यूटर यहाँ सुनें',
  'remoteAudio.subtitle':
    'दो कंप्यूटर लिंक करें, और हर एक दूसरे की आवाज़ चलाएगा। हर कंप्यूटर अपनी आवाज़ बिना बदले भेजता है; जिस कंप्यूटर पर आप सुनते हैं, वह अपना EQ, कर्व और DSP लगाता है।',
  'remoteAudio.security': 'कनेक्शन की विशेषताएँ',
  'remoteAudio.badge.local': 'केवल निजी LAN',
  'remoteAudio.badge.lossless': 'लॉसलेस Float32 PCM ट्रांसपोर्ट',
  'remoteAudio.badge.encrypted': 'AES-256-GCM एन्क्रिप्टेड',
  'remoteAudio.link.section': 'कंप्यूटर लिंक करें',
  'remoteAudio.link.thisComputer': 'यह कंप्यूटर',
  'remoteAudio.link.thisHint':
    'यह कोड दूसरे कंप्यूटर पर पेस्ट करें, या उस कंप्यूटर का कोड यहाँ पेस्ट करें। दोनों तरह से काम करता है।',
  'remoteAudio.link.or': 'या',
  'remoteAudio.link.otherComputer': 'दूसरे कंप्यूटर का कोड',
  'remoteAudio.link.codeLabel': 'कनेक्शन कोड',
  'remoteAudio.link.placeholder': 'FLUIDEQ-LAN-2… चिपकाएँ',
  'remoteAudio.link.start': 'लिंक करें',
  'remoteAudio.link.otherHint':
    'दोनों कंप्यूटर तुरंत एक-दूसरे की आवाज़ चलाने लगते हैं। अगर सिर्फ़ एक दिशा चाहिए, तो बाद में दूसरी बंद कर दें।',
  'remoteAudio.link.once':
    'बस एक बार। लिंक किए गए कंप्यूटर रीस्टार्ट के बाद एक-दूसरे को फिर ढूँढ लेते हैं, किसी भी तरफ़ से।',
  'remoteAudio.rule.echoTitle': 'दोनों दिशाओं में, बिना गूँज',
  'remoteAudio.rule.echo':
    'हर कंप्यूटर सिर्फ़ वही भेजता है जो वह खुद चला रहा है — कभी वह आवाज़ नहीं जो उसे मिल रही है — इसलिए कुछ भी वापस नहीं आता।',
  'remoteAudio.rule.eqTitle': 'जहाँ सुनें, वहीं आपका EQ',
  'remoteAudio.rule.eq':
    'आवाज़ बिना बदले जाती है। जिस कंप्यूटर पर आप उसे सुनते हैं, वह अपना EQ, हेडफ़ोन कर्व और DSP लगाता है — एक बार।',
  'remoteAudio.rule.steadyTitle': 'स्थिर, बिना खिसके',
  'remoteAudio.rule.steady':
    'लगभग 30 ms पीछे, और वहीं बनी रहती है: दोनों कंप्यूटरों की घड़ियाँ साथ चलती हैं, न रुकावट, न धीरे-धीरे खिसकना।',
  'remoteAudio.linked.section': 'लिंक किए गए',
  'remoteAudio.linked.cardLabel': '{name} के साथ लिंक',
  'remoteAudio.linked.bothWays': 'दोनों दिशाओं में',
  'remoteAudio.linked.incomingOnly': 'सिर्फ़ आने वाली',
  'remoteAudio.linked.outgoingOnly': 'सिर्फ़ जाने वाली',
  'remoteAudio.linked.paused': 'रुका हुआ',
  'remoteAudio.linked.looking': 'आपके नेटवर्क पर {name} ढूँढ रहे हैं…',
  'remoteAudio.linked.lossless': 'लॉसलेस',
  'remoteAudio.linked.unlink': 'लिंक हटाएँ',
  'remoteAudio.linked.noEcho':
    'कोई गूँज नहीं: {name} की आवाज़ कभी उसे वापस नहीं भेजी जाती।',
  'remoteAudio.linked.untouched':
    'दोनों दिशाओं में बिना बदले जाती है — हर कंप्यूटर अपना EQ और DSP लगाता है।',
  'remoteAudio.lane.from': '{name} से',
  'remoteAudio.lane.to': '{name} को',
  'remoteAudio.lane.playsHere': 'यहाँ चलती है',
  'remoteAudio.lane.yourSound': 'आपकी आवाज़',
  'remoteAudio.lane.playItHere': 'यहाँ चलाएँ',
  'remoteAudio.lane.sendMySound': 'मेरी आवाज़ भेजें',
  'remoteAudio.lane.delay': 'देरी',
  'remoteAudio.lane.sent': 'भेजा गया',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': 'मिल रही है',
  'remoteAudio.lane.paused': 'रुका हुआ',
  'remoteAudio.lane.inQuiet': '{name} पर कुछ नहीं चल रहा',
  'remoteAudio.lane.inOff': 'बंद: {name} की आवाज़ इस कंप्यूटर पर नहीं चलती।',
  'remoteAudio.lane.inNotSent': '{name} पर “मेरी आवाज़ भेजें” बंद है।',
  'remoteAudio.lane.inOld':
    '{name} को अपनी आवाज़ यहाँ भेजने के लिए नवीनतम FluidEQ चाहिए।',
  'remoteAudio.lane.inOneWay':
    'दोनों दिशाओं में चलाने के लिए इस कंप्यूटर पर Windows चाहिए।',
  'remoteAudio.lane.outQuiet': 'इस कंप्यूटर पर कुछ नहीं चल रहा',
  'remoteAudio.lane.outOff': 'नहीं भेज रहे। {name} इस कंप्यूटर को नहीं सुनता।',
  'remoteAudio.lane.outNotPlayed': '{name} पर “यहाँ चलाएँ” बंद है।',
  'remoteAudio.lane.outOld':
    '{name} को इस कंप्यूटर की आवाज़ चलाने के लिए नवीनतम FluidEQ चाहिए।',
  'remoteAudio.lane.outOneWay':
    'दोनों दिशाओं में भेजने के लिए इस कंप्यूटर पर Windows चाहिए।',
  'remoteAudio.lane.outFailed':
    'इस कंप्यूटर की आवाज़ कैप्चर नहीं हो सकी। फिर से कोशिश करने के लिए “मेरी आवाज़ भेजें” को बंद करके फिर चालू करें।',
  'remoteAudio.another.section': 'एक और कंप्यूटर लिंक करें',
  'remoteAudio.another.hub':
    'इस कंप्यूटर का कोड किसी दूसरे कंप्यूटर पर पेस्ट करें। हर लिंक किए गए कंप्यूटर की ऊपर अपनी पंक्ति होती है।',
  'remoteAudio.another.spoke':
    'तीसरा कंप्यूटर लिंक करने के लिए, उस पर {name} का कोड पेस्ट करें: कंप्यूटर उसी से लिंक होता है जिसका कोड वह इस्तेमाल करता है।',
  'remoteAudio.singlePlayer.title': 'एक समय पर एक प्लेयर',
  'remoteAudio.singlePlayer.body':
    'लिंक किए गए कंप्यूटरों पर भी लागू होता है: एक पर कुछ शुरू करने से दूसरे पर चल रहा रुक जाता है।',
  'remoteAudio.code.copy': 'कोड कॉपी करें',
  'remoteAudio.code.copied': 'कॉपी हो गया',
  'remoteAudio.code.forAddress': '{address} के लिए पेयरिंग कोड',
  'remoteAudio.status.preparing': 'तैयार हो रहा है…',
  'remoteAudio.status.playbackBlocked':
    'ऑडियो सुनने के लिए फिर शुरू करें दबाएँ',
  'remoteAudio.resume': 'ऑडियो फिर शुरू करें',
  'remoteAudio.retry': 'फिर कोशिश करें',
  'remoteAudio.monitor.networkHealthy': 'नेटवर्क स्थिर',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms कतार में',
  'remoteAudio.note.title': 'कम आवाज़ से शुरू करें।',
  'remoteAudio.note.body':
    'एक साथ चल रहे दो कंप्यूटरों की आवाज़ जुड़ जाती है। पहले लिंक से पहले आवाज़ कम करें।',
  'remoteAudio.error.lan':
    'FluidEQ स्थानीय कनेक्शन नहीं खोल सका। सुनिश्चित करें कि दोनों कंप्यूटर एक ही निजी नेटवर्क पर हैं और फ़ायरवॉल FluidEQ को अनुमति देता है।',
  'remoteAudio.error.capture':
    'FluidEQ इस कंप्यूटर का सिस्टम ऑडियो कैप्चर नहीं कर सका। मौजूदा आउटपुट डिवाइस जाँचें, फिर कोशिश करें।',
  'remoteAudio.error.playback':
    'FluidEQ लॉसलेस ऑडियो इंजन शुरू नहीं कर सका। FluidEQ को फिर शुरू करके दोबारा कोशिश करें।',
  'remoteAudio.error.connection':
    'एन्क्रिप्टेड ऑडियो कनेक्शन रुक गया। FluidEQ दूसरे कंप्यूटर को ढूँढता रहता है और उसके लौटने पर अपने-आप फिर जुड़ जाता है।',
};

export default remoteAudio;
