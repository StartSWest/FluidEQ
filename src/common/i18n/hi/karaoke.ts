/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** The Karaoke tab, its player and the Maker. */
import { Dictionary } from '../en';

const karaoke: Partial<Dictionary> = {
  'karaoke.eyebrow': 'स्थानीय कराओके',
  'karaoke.title': 'आपके संगीत के लिए बना मंच',
  'karaoke.intro':
    'यह कार्यक्षेत्र गाने, समयबद्ध बोल, माइक्रोफ़ोन मॉनिटरिंग और सुर मार्गदर्शन को आपके पीसी पर स्थानीय रूप से एक साथ रखेगा।',
  'karaoke.fullscreen.enter': 'पूर्ण स्क्रीन खोलें',
  'karaoke.fullscreen.exit': 'पूर्ण स्क्रीन से बाहर निकलें',
  'karaoke.fullscreen.hideHeader': 'FluidEQ हेडर छिपाएँ',
  'karaoke.fullscreen.showHeader': 'FluidEQ हेडर दिखाएँ',
  'karaoke.actions': 'कराओके क्रियाएँ',
  'karaoke.readiness.resize': 'माइक्रोफ़ोन और सुर पैनल का आकार बदलें',
  'karaoke.empty.title': 'आपका मंच तैयार है',
  'karaoke.empty.body':
    'वैकल्पिक बोल के साथ ऑडियो खोलें या पूरा फ़ोल्डर जोड़ें। FluidEQ समान नाम वाली फ़ाइलों को प्लेलिस्ट में जोड़ता है।',
  'karaoke.import.pending': 'अगला: गाने आयात करें',
  'karaoke.import.open': 'गाना खोलें',
  'karaoke.import.replace': 'गाना बदलें',
  'karaoke.import.addFiles': 'फ़ाइलें जोड़ें',
  'karaoke.import.folder': 'फ़ोल्डर जोड़ें',
  'karaoke.import.clear': 'हटाएँ',
  'karaoke.import.loading': 'गाना तैयार हो रहा है…',
  'karaoke.import.formats':
    'ऑडियो: MP3, WAV, OGG, Opus, FLAC, M4A या AAC · बोल: LRC, eLRC या UltraStar TXT · कवर आर्ट और वीडियो भी जोड़ें',
  'karaoke.import.drop': 'गाने, बोल या फ़ोल्डर यहाँ छोड़ें',
  'karaoke.error.missingAudio': 'इस बोल फ़ाइल के साथ एक ऑडियो फ़ाइल भी जोड़ें।',
  'karaoke.error.ambiguous':
    'एक से अधिक जोड़ियाँ संभव हैं। एक ऑडियो और वैकल्पिक रूप से एक बोल फ़ाइल चुनें।',
  'karaoke.error.unsupported':
    'इनमें से कोई फ़ाइल अभी समर्थित Karaoke ऑडियो या बोल फ़ाइल नहीं है। कवर आर्ट और वीडियो के साथ एक गाना भी चाहिए।',
  'karaoke.error.read': 'FluidEQ चुनी गई स्थानीय फ़ाइलें नहीं पढ़ सका।',
  'karaoke.error.playback':
    'यह Chromium संस्करण उस ऑडियो फ़ाइल या कोडेक को नहीं चला सका।',
  'karaoke.warning.lyrics': 'को पढ़ा नहीं जा सका।',
  'karaoke.warning.lyricsEmpty': 'खाली है।',
  'karaoke.warning.lyricsMissingTiming':
    'में ऐसा कोई समय नहीं है जिसे FluidEQ पढ़ सके।',
  'karaoke.warning.lyricsMissingBpm':
    'में BPM घोषित नहीं है, जो UltraStar फ़ाइल के लिए ज़रूरी है।',
  'karaoke.warning.lyricsInvalidBpm':
    'में घोषित BPM उपयोग योग्य संख्या नहीं है।',
  'karaoke.warning.lyricsMalformedNote':
    'में एक नोट पंक्ति है जिसे FluidEQ पढ़ नहीं सका।',
  'karaoke.warning.lyricsUnsupportedVariant':
    'ऐसा कराओके रूप उपयोग करती है जिसे FluidEQ अभी नहीं गा सकता, जैसे युगल गीत।',
  'karaoke.warning.lyricsAtLine': 'पंक्ति {line}।',
  'karaoke.warning.lyricsAudioIntact':
    'ऑडियो समयबद्ध बोल के बिना उपलब्ध रहेगा।',
  'karaoke.warning.setAside':
    'FluidEQ इन फ़ाइलों को अभी कराओके के रूप में नहीं पढ़ सकता, इसलिए उन्हें अलग रखा गया: {formats}।',
  'karaoke.warning.unpairedLyrics':
    'इन बोल फ़ाइलों से कोई ऑडियो फ़ाइल मेल नहीं खाती, इसलिए उनका उपयोग नहीं हुआ: {files}।',
  'karaoke.warning.ambiguousLyrics':
    'दो बोल फ़ाइलें एक ही गाने से मेल खाईं, इसलिए किसी का उपयोग नहीं हुआ: {files}।',
  'karaoke.warning.andMore': 'और {count} अन्य',
  'karaoke.countdown.sing': 'गाओ',
  'karaoke.song.unknownArtist': 'स्थानीय गाना',
  'karaoke.stage.videoUnsupported': '{format} वीडियो यहाँ नहीं चल सकता',
  'karaoke.stage.videoFailed': '{format} वीडियो यहाँ डिकोड नहीं हो सका',
  'karaoke.stage.hideArt': 'कवर आर्ट छिपाएँ',
  'karaoke.stage.showArt': 'कवर आर्ट दिखाएँ',
  'karaoke.stage.noArt': 'इस गाने में कवर आर्ट नहीं है',
  'karaoke.playlist.title': 'प्लेलिस्ट',
  'karaoke.playlist.groupFolders': 'फ़ोल्डर के अनुसार समूहित करें',
  'karaoke.playlist.looseFiles': 'असमूहीकृत फ़ाइलें',
  'karaoke.playlist.resize': 'प्लेलिस्ट और मंच का आकार बदलें',
  'karaoke.playlist.collapse': 'प्लेलिस्ट समेटें',
  'karaoke.playlist.expand': 'प्लेलिस्ट खोलें',
  'karaoke.playlist.select': '{title} चुनें',
  'karaoke.playlist.moveUp': '{title} को ऊपर ले जाएँ',
  'karaoke.playlist.moveDown': '{title} को नीचे ले जाएँ',
  'karaoke.playlist.remove': '{title} हटाएँ',
  'karaoke.source.audioOnly': 'केवल ऑडियो',
  'karaoke.source.lrc': 'LRC · पंक्ति समय',
  'karaoke.source.elrc': 'eLRC · शब्द समय',
  'karaoke.source.ultrastar': 'UltraStar · अक्षर + सुर',
  'karaoke.lyrics.none':
    'समयबद्ध बोल नहीं चुने गए। प्लेबैक और लाइव ट्यूनर फिर भी काम करेंगे।',
  'karaoke.lyrics.line': 'बोल पंक्ति {number}',
  'karaoke.lyrics.previous': 'पिछली बोल पंक्ति',
  'karaoke.lyrics.next': 'अगली बोल पंक्ति',
  'karaoke.lyrics.follow': 'गीत के बोलों का अनुसरण करें',
  'karaoke.lyrics.textSize': 'गीत के बोलों का आकार',
  'karaoke.transport.title': 'Karaoke प्लेबैक नियंत्रण',
  'karaoke.transport.restart': 'गाना फिर शुरू करें',
  'karaoke.transport.play': 'चलाएँ',
  'karaoke.transport.pause': 'रोकें',
  'karaoke.transport.spaceShortcut': '{action} · स्पेस',
  'karaoke.transport.seek': 'गाने की स्थिति',
  'karaoke.transport.volume': 'आवाज़',
  'karaoke.transport.vocalLevel': 'गाइड वोकल',
  'karaoke.transport.vocalOff': 'केवल बैकिंग',
  'karaoke.transport.vocalFull': 'मूल',
  'karaoke.transport.mixSettings': 'मिक्स सेटिंग',
  'karaoke.transport.openMixSettings': '{channel} की मिक्स सेटिंग खोलें',
  'karaoke.mic.title': 'माइक्रोफ़ोन',
  'karaoke.mic.settings': 'माइक्रोफ़ोन सेटिंग्स',
  'karaoke.mic.off': 'बंद',
  'karaoke.mic.hint':
    'इनपुट चुनें। FluidEQ माइक्रोफ़ोन चालू करने पर ही उसकी अनुमति माँगता है।',
  'karaoke.mic.select': 'माइक्रोफ़ोन इनपुट',
  'karaoke.mic.default': 'सिस्टम डिफ़ॉल्ट',
  'karaoke.mic.unnamed': 'माइक्रोफ़ोन {number}',
  'karaoke.mic.turnOn': 'माइक्रोफ़ोन चालू करें',
  'karaoke.mic.turnOff': 'माइक्रोफ़ोन बंद करें',
  'karaoke.mic.requesting': 'कनेक्ट हो रहा है…',
  'karaoke.mic.live': 'चालू',
  'karaoke.mic.denied': 'अनुमति अस्वीकृत',
  'karaoke.mic.unavailable': 'माइक्रोफ़ोन नहीं मिला',
  'karaoke.mic.disconnected': 'डिस्कनेक्ट हो गया',
  'karaoke.mic.error': 'चालू नहीं हो सका',
  'karaoke.mic.level': 'माइक्रोफ़ोन इनपुट स्तर',
  'karaoke.mic.levelValue': 'माइक्रोफ़ोन इनपुट स्तर: {percent}%',
  'karaoke.mic.privacy':
    'केवल स्थानीय स्तर और सुर विश्लेषण। FluidEQ माइक्रोफ़ोन रिकॉर्ड नहीं करता और उसे स्पीकर से नहीं चलाता।',
  'karaoke.mic.volume': 'माइक वॉल्यूम',
  'karaoke.mic.volumeValue': 'माइक वॉल्यूम: {percent}%',
  'karaoke.pitch.title': 'सुर लेन',
  'karaoke.pitch.resize': 'सुर लेन का आकार बदलें',
  'karaoke.pitch.show': 'पिच गाइड दिखाएँ',
  'karaoke.pitch.hide': 'पिच गाइड छिपाएँ',
  'karaoke.pitch.guide': 'धुन मार्गदर्शक',
  'karaoke.pitch.toneGuide': 'धुन स्वर',
  'karaoke.pitch.toneEnable': 'धुन स्वर चलाएँ',
  'karaoke.pitch.toneDisable': 'धुन स्वर रोकें',
  'karaoke.pitch.toneVolume': 'धुन स्वर का वॉल्यूम',
  'karaoke.pitch.scrubHint':
    'गाने में आगे या पीछे जाने के लिए बाएँ या दाएँ खींचें; छोड़ने पर गाना रुका रहेगा।',
  'karaoke.pitch.viewSelector': 'सुर दृश्य',
  'karaoke.pitch.viewNotes': 'नोट्स',
  'karaoke.pitch.viewWave': 'कर्व',
  'karaoke.pitch.waveCanvas': 'गाने के नोट्स पर गायक के सुर का रीयल-टाइम कर्व',
  'karaoke.pitch.waveSong': 'गाने का सुर',
  'karaoke.pitch.waveVoice': 'आपकी आवाज़',
  'karaoke.pitch.waveFooter':
    'नीले ब्लॉक गाने के नोट हैं; पतली लाइव रेखा माइक्रोफ़ोन से आ रहा सुर दिखाती है।',
  'karaoke.pitch.review': 'प्रदर्शन समीक्षा',
  'karaoke.pitch.reviewCount': 'अभ्यास के लिए {count} भाग',
  'karaoke.pitch.issueHigh': '{time} पर पिच ऊंची है। इस भाग का अभ्यास करें।',
  'karaoke.pitch.issueLow': '{time} पर पिच नीची है। इस भाग का अभ्यास करें।',
  'karaoke.pitch.issueMissed': '{time} पर छूटे हुए नोट। इस भाग का अभ्यास करें।',
  'karaoke.practice.go': 'शुरू',
  'karaoke.practice.ready': 'फिर से गाने के लिए तैयार हो जाएं',
  'karaoke.countIn.ready': 'तैयार हो जाएँ — GO के बाद गाना शुरू होगा',
  'karaoke.pitch.canvas': 'माइक्रोफ़ोन और लक्षित सुरों की लाइव पिच लेन',
  'karaoke.pitch.micOff': 'अपना सुर देखने के लिए माइक्रोफ़ोन चालू करें।',
  'karaoke.pitch.loading': 'सुर विश्लेषण शुरू हो रहा है…',
  'karaoke.pitch.unavailable':
    'सुर विश्लेषण उपलब्ध नहीं है। माइक्रोफ़ोन स्तर अभी भी काम करता है।',
  'karaoke.pitch.noSignal': 'अपना सुर देखने के लिए माइक्रोफ़ोन में गाएँ।',
  'karaoke.pitch.empty':
    'लक्षित सुर तभी दिखेंगे जब आयात किए गए गाने में वे वास्तव में मौजूद हों।',
  'karaoke.pitch.high': 'ऊँचा',
  'karaoke.pitch.tuned': 'सुर में',
  'karaoke.pitch.low': 'नीचा',
  'karaoke.pitch.ultrastar':
    'नीली पट्टियाँ लक्षित सुर हैं; रेखा बताती है कि आपकी आवाज़ ऊँची, सुर में या नीची है।',
  'karaoke.chords.aria': 'बैकिंग ट्रैक से अनुमानित गिटार कॉर्ड',
  'karaoke.chords.analyzing': 'कॉर्ड खोजे जा रहे हैं… {percent}%',
  'karaoke.chords.estimate': 'अनुमानित कॉर्ड',
  'karaoke.chords.next': 'अगला',
  'karaoke.chords.in': '{seconds} सेकंड में',
  'karaoke.chords.none': 'कोई स्थिर कॉर्ड नहीं मिला',
  'karaoke.chords.confidence': 'ऑडियो अनुमान विश्वसनीयता: {percent}%',
  'karaoke.maker.open': 'बनाएँ',
  'karaoke.maker.openTitle': 'इस कराओके को बनाएँ या संपादित करें',
  'karaoke.maker.dialog': 'कराओके मेकर',
  'karaoke.maker.eyebrow': 'FLUIDEQ कराओके मेकर',
  'karaoke.maker.close': 'मेकर बंद करें',
  'karaoke.maker.exitBusy':
    'एक लोकल मॉडल अभी भी चल रहा है। एडिटर से बाहर जाने से पहले उसे रद्द करें या पूरा होने तक प्रतीक्षा करें।',
  'karaoke.maker.songTitle': 'गीत का शीर्षक',
  'karaoke.maker.untitled': 'बिना शीर्षक का कराओके',
  'karaoke.maker.undo': 'पूर्ववत',
  'karaoke.maker.redo': 'फिर करें',
  'karaoke.maker.preview': 'पूर्वावलोकन · 1, 2, 3',
  'karaoke.maker.apply': 'प्लेयर में उपयोग करें',
  'karaoke.maker.applyHint':
    'इन बदलावों को प्लेयर में उपयोग करें। मूल कराओके फ़ाइल नहीं बदलेगी; निर्यात नई फ़ाइल बनाएगा।',
  'karaoke.maker.lyrics': 'बोल',
  'karaoke.maker.toolsEdit': 'संपादन उपकरण',
  'karaoke.maker.toolsAnalysis': 'विश्लेषण उपकरण',
  'karaoke.maker.lyricsTiming': 'बोल का समय',
  'karaoke.maker.timingAll': 'पूरा गीत',
  'karaoke.maker.timingFromWord': 'चुने हुए शब्द से',
  'karaoke.maker.timingAllHint':
    'सभी समयबद्ध शब्दों और सुरों को एक साथ खिसकाता है।',
  'karaoke.maker.timingFromWordHint':
    '“{word}” और उसके बाद सब कुछ खिसकाता है। पहले का समय स्थिर रहता है।',
  'karaoke.maker.earlier': 'पूरे बोल पहले करें',
  'karaoke.maker.later': 'पूरे बोल बाद में करें',
  'karaoke.maker.openProject': 'कराओके आयात करें',
  'karaoke.maker.projectLoaded': 'प्रोजेक्ट लोड हुआ। मौजूदा ऑडियो जुड़ा रहेगा।',
  'karaoke.maker.karaokeImported':
    'कराओके समय आयात हुआ। मौजूदा ऑडियो जुड़ा रहेगा।',
  'karaoke.maker.tapWords': 'शब्द टैप करें',
  'karaoke.maker.recordLines': 'पंक्ति आरंभ रिकॉर्ड करें',
  'karaoke.maker.syncLinesFromHere': 'यहाँ से पंक्तियाँ सिंक करें',
  'karaoke.maker.syncWordsFromHere': 'यहाँ से शब्द सिंक करें',
  'karaoke.maker.syncNow': 'अभी',
  'karaoke.maker.syncNext': 'अगला: {item}',
  'karaoke.maker.markLine': 'पंक्ति आरंभ चिह्नित करें',
  'karaoke.maker.markLineEnd': 'पंक्ति अंत चिह्नित करें',
  'karaoke.maker.captureEnd': 'अंत की प्रतीक्षा',
  'karaoke.maker.capturePressStart': 'चरण 1 · आरंभ पर Enter',
  'karaoke.maker.captureReplaceStart':
    'अगली पंक्ति तैयार · Enter आरंभ बदलता है',
  'karaoke.maker.captureStartSaved': '{time} पर आरंभ सहेजा · अंत पर Enter',
  'karaoke.maker.captureAutomaticStart': 'स्वचालित आरंभ {time} · अंत पर Enter',
  'karaoke.maker.captureAutomaticSuggestion':
    'सुझाया आरंभ {time} · Enter आरंभ रिकॉर्ड करता है',
  'karaoke.maker.captureFixEnd': 'पंक्ति रिकॉर्ड हुई · Enter अंत सुधारता है',
  'karaoke.maker.captureStartPoint': 'आरंभ',
  'karaoke.maker.captureEndPoint': 'अंत',
  'karaoke.maker.captureGuideTitle': 'पंक्ति समय',
  'karaoke.maker.captureSetupTitle':
    'बोल का समय रिकॉर्ड करने के लिए तैयार हैं?',
  'karaoke.maker.captureSetupBody':
    'गायक को सुनें। पंक्ति शुरू होते ही Enter दबाएँ, चाहें तो हर नए शब्द पर Tab दबाएँ, फिर पंक्ति समाप्त होने पर Enter दबाएँ। इससे आखिरी लंबा शब्द अपनी पूरी अवधि रखता है।',
  'karaoke.maker.captureSetupStatus':
    'लाइव पूर्वावलोकन में मार्गदर्शिका पढ़ें, फिर रिकॉर्डिंग शुरू करें।',
  'karaoke.maker.captureStartRecording': 'रिकॉर्डिंग शुरू करें',
  'karaoke.maker.captureMoveGuide':
    'मार्गदर्शिका को खींचकर ले जाएँ। स्थिति रीसेट करने के लिए डबल-क्लिक करें।',
  'karaoke.maker.selectionPanel': 'चयन उपकरण',
  'karaoke.maker.selectionMoveGuide':
    'चयन उपकरणों को खींचकर ले जाएँ। स्थिति रीसेट करने के लिए डबल-क्लिक करें।',
  'karaoke.maker.dismissSelection': 'चयन उपकरण बंद करें',
  'karaoke.maker.captureCountdownReady': 'पहली पंक्ति के लिए तैयार रहें',
  'karaoke.maker.captureGuideNext': 'अगली पंक्ति',
  'karaoke.maker.captureGuideAudio': 'ऑडियो 2 सेकंड चलाएँ · Shift: 1 सेकंड',
  'karaoke.maker.captureGuideLyrics': 'बोल की पंक्ति चुनें',
  'karaoke.maker.captureGuidePlayback': 'चलाएँ या रोकें',
  'karaoke.maker.captureGuideWords': 'अगला शब्द चिह्नित करें',
  'karaoke.maker.captureGuideUndo': 'पिछला चिह्न पूर्ववत करें',
  'karaoke.maker.stopRecording': 'रिकॉर्डिंग रोकें',
  'karaoke.maker.markWord': 'शब्द चिह्नित करें',
  'karaoke.maker.markNextWord': 'अगला शब्द',
  'karaoke.maker.done': 'पूर्ण',
  'karaoke.maker.ignoreLine': 'पंक्ति छोड़ें',
  'karaoke.maker.lineTimingComplete':
    'पंक्ति समय पूरा हुआ। समीक्षा करके प्लेयर में उपयोग करने के लिए तैयार है।',
  'karaoke.maker.recordLinesHint':
    'ENTER आरंभ/अंत चिह्नित करता है · ↑/↓ पंक्ति चुनता है · ←/→ केवल ऑडियो 2 सेकंड चलाता है · SPACE चलाता/रोकता है · Backspace पूर्ववत करता है',
  'karaoke.maker.panView': 'हाथ · टाइमलाइन खिसकाएँ',
  'karaoke.maker.panHint':
    'हाथ टूल: बिना संपादन किए गीत में घूमने के लिए कैनवास पर खींचें।',
  'karaoke.maker.scrubHint':
    'गीत में जाने के लिए प्लेहेड पर क्लिक करें या उसे खींचें।',
  'karaoke.maker.addNote': 'स्वर',
  'karaoke.maker.selectNotes': 'सुर चुनें',
  'karaoke.maker.paintNotes': 'सुर बनाएँ',
  'karaoke.maker.selectNotesHint':
    'सुरों के चारों ओर बॉक्स खींचें। पूरे समूह को ले जाने के लिए चुना हुआ सुर खींचें। जोड़ने के लिए Ctrl दबाकर उसे शब्द या अक्षरांश पर खींचें।',
  'karaoke.maker.paintNotesHint':
    'सुर बनाने के लिए पिच ग्रिड पर खींचें। कई सुर जोड़ने के लिए उपकरण सक्रिय रहता है।',
  'karaoke.maker.notesSelected': 'सुर चुने गए',
  'karaoke.maker.copyNotes': 'चुने हुए सुर कॉपी करें',
  'karaoke.maker.pasteNotes': 'प्लेबैक स्थिति पर सुर चिपकाएँ',
  'karaoke.maker.notePasted': 'प्लेबैक स्थिति पर सुर चिपकाया गया।',
  'karaoke.maker.notesPasted': 'प्लेबैक स्थिति पर {count} सुर चिपकाए गए।',
  'karaoke.maker.attachNotesByTime': 'बोल से जोड़ें',
  'karaoke.maker.detachNotes': 'बोल से अलग करें',
  'karaoke.maker.noteAttachHelp':
    'Ctrl दबाकर सुर को शब्द या अक्षरांश पर खींचें। जुड़े सुर बोल के समय के साथ चलते हैं और लॉक रहते हैं।',
  'karaoke.maker.noteCopyHelp':
    'Ctrl+C चयन कॉपी करता है · Ctrl+V पहला सुर प्लेबैक स्थिति पर चिपकाता है।',
  'karaoke.maker.attachedTo': '“{word}” से जुड़ा',
  'karaoke.maker.noteUnattached': 'किसी बोल से नहीं जुड़ा',
  'karaoke.maker.splitWordSyllables': 'शब्द को अक्षरांशों में बाँटें',
  'karaoke.maker.syllableEditorEyebrow': 'अक्षरांश संपादक',
  'karaoke.maker.syllableEditorTitle': '“{word}” को बाँटें',
  'karaoke.maker.syllableEditorHint':
    'अक्षरांश सीमा जोड़ने या हटाने के लिए अक्षरों के बीच क्लिक करें।',
  'karaoke.maker.syllableSplitPoint': '“{text}” के बाद विभाजन बदलें',
  'karaoke.maker.syllableEditorPreview': 'बने हुए अक्षरांश',
  'karaoke.maker.applySyllableSplit': 'अक्षरांश विभाजन लागू करें',
  'karaoke.maker.hearNote': 'स्वर सुनें',
  'karaoke.maker.split': 'विभाजित करें',
  'karaoke.maker.delete': 'हटाएँ',
  'karaoke.maker.analyze': 'धुन का विश्लेषण',
  'karaoke.maker.prepare': 'कराओके तैयार करें',
  'karaoke.maker.advanced': 'उन्नत',
  'karaoke.maker.prepared': 'इस कराओके में पहले से समयबद्ध धुन के नोट हैं।',
  'karaoke.maker.repairLyrics': 'बोल का समय फिर पहचानें',
  'karaoke.maker.repairMelody': 'धुन के सुर फिर पहचानें',
  'karaoke.maker.rebuildKaraoke': 'बोल और धुन फिर बनाएँ',
  'karaoke.maker.autoAlign': 'स्वतः मिलाएँ',
  'karaoke.maker.aiMelody': 'AI धुन',
  'karaoke.maker.transcribe': 'लिप्यंतरण',
  'karaoke.maker.vocalStem': 'वोकल स्टेम उपयोग करें',
  'karaoke.maker.vocalStemLoaded': 'वोकल स्टेम लोड हुआ',
  'karaoke.maker.groupVoice': 'आवाज़ और संगीत',
  'karaoke.maker.stemsTitle': 'अलग किए गए ट्रैक',
  'karaoke.maker.stemBacking': 'बैकिंग ट्रैक',
  'karaoke.maker.stemSaveAs': '{name} इस रूप में सहेजें',
  'karaoke.maker.stemSaveFormat': '{name} को {format} में सहेजें',
  'karaoke.maker.stemMp3Encoding': 'MP3 एन्कोड हो रहा है…',
  'karaoke.maker.stemMp3Saved': 'MP3 सहेजा गया।',
  'karaoke.maker.stemMp3Failed': 'MP3 एन्कोड नहीं हो सका।',
  'karaoke.maker.stemVoice': 'आवाज़',
  'karaoke.maker.stemSave': 'सहेजें',
  'karaoke.maker.groupLyrics': 'बोल और टाइमिंग',
  'karaoke.maker.removeBackground': 'आवाज़ को संगीत से अलग करें',
  'karaoke.maker.removeBackgroundDone': 'आवाज़ पहले ही अलग हो चुकी है',
  'karaoke.maker.separationDownloading':
    'सेपरेशन मॉडल डाउनलोड हो रहा है ({percent}%) · एक बार, लगभग 700 MB',
  'karaoke.maker.separationReading': 'गाना पढ़ा जा रहा है',
  'karaoke.maker.separating': 'आवाज़ को संगीत से अलग किया जा रहा है',
  'karaoke.maker.separationDone': 'आवाज़ अलग हो गई। लिरिक पहचान तैयार है।',
  'karaoke.maker.separationSlow':
    'इस मशीन पर ग्राफ़िक्स एक्सेलेरेशन नहीं है, इसलिए इसमें एक मिनट से कम के बजाय कुछ मिनट लगेंगे।',
  'karaoke.maker.separationRequired':
    'पहले आवाज़ अलग करें — लिरिक पहचान अलग की गई आवाज़ को पढ़ती है।',
  'karaoke.maker.separationRequiredMelody':
    'पहले आवाज़ अलग करें — नोट पहचान एक ही स्वर का पीछा करती है, और मिश्रण में वह आमतौर पर कोई वाद्य होता है।',
  'karaoke.maker.wizardTitle': 'इस गाने को अपने आप तैयार करें',
  'karaoke.maker.wizardIntro':
    'इस गाने में अभी लिरिक टाइमिंग नहीं है। FluidEQ आवाज़ को संगीत से अलग कर सकता है, फिर उसमें से शब्द और उनकी टाइमिंग पढ़ सकता है। सब कुछ इसी कंप्यूटर पर चलता है।',
  'karaoke.maker.wizardStepSeparate': 'आवाज़ अलग करें',
  'karaoke.maker.wizardStepTranscribe': 'शब्द और टाइमिंग पढ़ें',
  'karaoke.maker.wizardLanguage': 'बोल की भाषा',
  'karaoke.maker.wizardLanguageAuto': 'अपने आप पहचानें',
  'karaoke.maker.wizardStart': 'अपने आप तैयार करें',
  'karaoke.maker.wizardSkip': 'मैं खुद करूँगा',
  'karaoke.maker.wizardCancel': 'रोकें',
  'karaoke.maker.wizardHide': 'बैकग्राउंड में जारी रखें',
  'karaoke.maker.wizardCancelled': 'रोक दिया गया। जो पूरा हुआ वह रखा गया है।',
  'karaoke.maker.vocalFocus': 'केंद्रीय आवाज़ पर ध्यान',
  'karaoke.maker.export': 'निर्यात',
  'karaoke.maker.exportProject': 'FluidEQ प्रोजेक्ट',
  'karaoke.maker.exportUltraStar': 'UltraStar TXT',
  'karaoke.maker.exportLrc': 'LRC',
  'karaoke.maker.exportElrc': 'उन्नत LRC',
  'karaoke.maker.exportInstrumental': 'बैकिंग ट्रैक (बिना आवाज़)',
  'karaoke.maker.tapHint':
    '“{word}” के लिए SPACE या ENTER दबाएँ · Backspace पूर्ववत करता है',
  'karaoke.maker.editHint':
    'स्वर/समय बदलने के लिए नोट खींचें। आकार के लिए किनारा खींचें। Ctrl + व्हील ज़ूम करता है।',
  'karaoke.maker.stats': '{notes} स्वर · {words} शब्द · {checks} जाँच',
  'karaoke.maker.wordStateLegend': 'गीत समय-निर्धारण की स्थिति',
  'karaoke.maker.userAdjustedWords': '{count} समायोजित',
  'karaoke.maker.pendingWords': '{count} लंबित',
  'karaoke.maker.artist': 'कलाकार',
  'karaoke.maker.bpm': 'BPM',
  'karaoke.maker.zoom': 'ज़ूम',
  'karaoke.maker.songPosition': 'गीत में स्थान',
  'karaoke.maker.previousView': 'पिछला भाग',
  'karaoke.maker.nextView': 'अगला भाग',
  'karaoke.maker.resetZoom': 'गीत फिट करने के लिए डबल-क्लिक करें',
  'karaoke.maker.livePreview': 'लाइव पूर्वावलोकन',
  'karaoke.maker.showPreview': 'पूर्वावलोकन दिखाएँ',
  'karaoke.maker.hidePreview': 'पूर्वावलोकन छिपाएँ',
  'karaoke.maker.previewEmpty':
    'लाइव पूर्वावलोकन के लिए समयबद्ध गीत जोड़ें या संरेखित करें।',
  'karaoke.maker.noteNormal': 'स्वर',
  'karaoke.maker.noteGolden': 'गोल्डन',
  'karaoke.maker.noteFree': 'मुक्त',
  'karaoke.maker.untimed': 'बिना समय',
  'karaoke.maker.applyUntimed':
    '{count} बोल शब्दों का सत्यापित आवाज़ समय अभी नहीं है। इस कराओके को प्लेयर में उपयोग करने से पहले उन्हें पहचानें या रखें।',
  'karaoke.maker.selectHint': 'जाँचने के लिए कोई बोल या धुन का स्वर चुनें।',
  'karaoke.maker.rights':
    'मुझे इस ऑडियो और बोल का उपयोग और निर्यात करने की अनुमति है।',
  'karaoke.maker.cancel': 'रद्द करें',
  'karaoke.maker.localAnalysis': 'स्थानीय विश्लेषण',
  'karaoke.maker.lyricsEyebrow': 'बोल',
  'karaoke.maker.lyricsTitle':
    'हर पंक्ति में बोल की एक पंक्ति चिपकाएँ या संपादित करें',
  'karaoke.maker.lyricsWarning':
    'टेक्स्ट बदलने पर शब्द लिंक मिटते हैं ताकि उन्हें सुरक्षित रूप से फिर टैप या मिलाया जा सके।',
  'karaoke.maker.lyricsReferenceHint':
    '[Verse] या [Chorus] जैसे चिह्न और दोहराई गई पंक्तियों सहित पूरे बोल दें। FluidEQ इस पाठ को रखता है और स्थानीय वाणी पहचान से उसका समय खोजता है।',
  'karaoke.maker.referenceLyrics': 'संदर्भ बोल',
  'karaoke.maker.wordTiming': 'शब्द का समय',
  'karaoke.maker.lyricsWordCount': 'संदर्भ में {count} शब्द',
  'karaoke.maker.lyricsTimedCount': '{total} में से {timed} का समय तय',
  'karaoke.maker.lyricsApplyBeforeTiming':
    'शब्द का समय संपादित करने से पहले नए बोल पहचानें',
  'karaoke.maker.lyricsNoTimedWords': 'अभी कोई समयबद्ध शब्द नहीं',
  'karaoke.maker.lyricsTimingEditorHint':
    'पहचान के बाद किसी शब्द का पाठ, आरंभ या लंबाई सुधारने के लिए उसे चुनें।',
  'karaoke.maker.lyricsSelectWord': 'समय संपादित करने के लिए एक शब्द चुनें।',
  'karaoke.maker.lyricsSelectedWord': 'चुना हुआ शब्द',
  'karaoke.maker.lyricsWordNavigation': 'शब्द नेविगेशन',
  'karaoke.maker.previousWord': 'पिछला शब्द',
  'karaoke.maker.nextWord': 'अगला शब्द',
  'karaoke.maker.lyricsPlaceholder':
    'पूरे बोल यहाँ चिपकाएँ…\n\n[Verse]\nपहली पंक्ति\nदूसरी पंक्ति',
  'karaoke.maker.loadLyricsFile': 'बोल फ़ाइल लोड करें',
  'karaoke.maker.lyricsFileLoaded': '{file} से बोल लोड किए गए।',
  'karaoke.maker.lyricsRequired':
    'समय और धुन पहचानने से पहले पूरे बोल जोड़ें या चिपकाएँ।',
  'karaoke.maker.detectTimingMelody': 'समय और धुन पहचानें',
  'karaoke.maker.acceptLyrics': 'बोल स्वीकारें',
  'karaoke.maker.acceptAndRecordLines': 'स्वीकारें और समय रिकॉर्ड करें',
  'karaoke.maker.continueInBackground': 'पृष्ठभूमि में जारी रखें',
  'karaoke.maker.clearLyrics': 'बोल साफ़ करें',
  'karaoke.maker.clearLyricsTitle': 'सभी बोल साफ़ करें?',
  'karaoke.maker.clearLyricsBody':
    'यह सभी बोल और उनका समय हटाता है। धुन के सुर रहते हैं, लेकिन शब्दों से उनके लिंक हट जाते हैं। बाद में पूर्ववत किया जा सकता है।',
  'karaoke.maker.clearNotes': 'सुर साफ़ करें',
  'karaoke.maker.clearNotesTitle': 'धुन के सभी सुर साफ़ करें?',
  'karaoke.maker.clearNotesBody':
    'यह बोल और शब्द समय रखते हुए धुन के सभी सुर हटाता है। बाद में पूर्ववत किया जा सकता है।',
  'karaoke.maker.notesCleared': 'धुन के सभी सुर साफ़ कर दिए गए।',
  'karaoke.maker.lyricsCleared':
    'सभी बोल साफ़ कर दिए गए। मौजूदा सुर शब्द लिंक के बिना रखे गए।',
  'karaoke.maker.restore': 'मूल पुनर्स्थापित करें',
  'karaoke.maker.restoreTitle': 'मूल कराओके पुनर्स्थापित करें?',
  'karaoke.maker.restoreBody':
    'इससे इस सत्र के सभी संपादन हट जाते हैं और कराओके वैसा ही बन जाता है जैसा आयात किया गया था, इसके सहेजे गए ड्राफ़्ट सहित। पुनर्स्थापित करने के बाद पूर्ववत करना उपलब्ध है।',
  'karaoke.maker.restored': 'आयात किया गया मूल पुनर्स्थापित कर दिया गया।',
  'karaoke.maker.replaceLyricsWarning':
    'शब्द बदल गए हैं। बदलने पर शब्द ID और स्वचालित समय फिर बनेंगे; मौजूदा मैन्युअल सुधार भरोसे से स्थानांतरित नहीं हो सकते। सुर रहेंगे और फिर लिंक किए जाएँगे।',
  'karaoke.maker.replaceAndDetect': 'बदलें और पहचानें',
  'karaoke.maker.wordText': 'शब्द',
  'karaoke.maker.wordStart': 'आरंभ (ms)',
  'karaoke.maker.wordPosition': 'स्थिति',
  'karaoke.maker.wordDuration': 'लंबाई (ms)',
  'karaoke.maker.wordTimingSliderHint':
    'साझा सीमा समायोजित करता है; पंक्ति की सीमा स्थिर रखते हुए पड़ोसी शब्द समय देता या लेता है।',
  'karaoke.maker.usePlayhead': 'प्लेबैक स्थिति उपयोग करें',
  'karaoke.maker.playWord': 'शब्द चलाएँ',
  'karaoke.maker.allowAutoTiming': 'स्वचालित समय की अनुमति दें',
  'karaoke.maker.replaceLyrics': 'बोल बदलें',
  'karaoke.maker.lyricsAutoAligned':
    'नए गीत लागू हुए और उपलब्ध धुन से संरेखित किए गए।',
  'karaoke.maker.lyricsNeedPreparation':
    'नए बोल लागू किए गए। उनका समय पहचानने के लिए कराओके तैयार करें चुनें।',
  'karaoke.maker.transcriptionEyebrow': 'वैकल्पिक स्थानीय लिप्यंतरण',
  'karaoke.maker.transcriptionTitle': 'स्थानीय वॉइस मॉडल डाउनलोड करें?',
  'karaoke.maker.transcriptionBody':
    'FluidEQ, Hugging Face से MIT-लाइसेंस वाला {model} मॉडल डाउनलोड करके इसी PC पर रखेगा — एक बार, ग्राफ़िक्स एक्सेलेरेशन के साथ लगभग 570 MB और उसके बिना लगभग 1.1 GB। आपका ऑडियो कभी इस कंप्यूटर से बाहर नहीं जाता। पहली बार कुछ मिनट लगते हैं और काफ़ी मेमोरी लगती है।',
  'karaoke.maker.transcriptionReview':
    'पहचान केवल शुरुआती बिंदु है। मौजूदा बोल मिलाते समय FluidEQ आपकी वर्तनी रखता है और सभी समय संपादन योग्य रहते हैं।',
  'karaoke.maker.notNow': 'अभी नहीं',
  'karaoke.maker.downloadTranscribe': 'डाउनलोड और लिप्यंतरण करें',
  'karaoke.maker.downloadPrepare': 'डाउनलोड कर बोल तैयार करें',
  'karaoke.maker.downloadingWhisper': 'Whisper मॉडल डाउनलोड हो रहा है',
  'karaoke.maker.downloadOverall': 'कुल डाउनलोड',
  'karaoke.maker.downloadFiles': '{total} में से {complete} फ़ाइलें',
  'karaoke.maker.loadingWhisper': 'Whisper मॉडल लोड हो रहा है',
  'karaoke.maker.analysisRunning': 'पिच का स्थानीय विश्लेषण हो रहा है',
  'karaoke.maker.analysisAligned':
    'बिना बदले शब्दों को मिले {count} स्वर क्षेत्रों से मिलाया गया। मैन्युअल समय सुरक्षित रखा गया।',
  'karaoke.maker.analysisFound': 'विश्लेषण में {count} स्वर क्षेत्र मिले।',
  'karaoke.maker.basicPitchRunning': 'मेलोडी नोट्स का पता लगाया जा रहा है',
  'karaoke.maker.basicPitchFound':
    'आवाज़ से {count} संपादन-योग्य मेलोडी नोट्स मिले।',
  'karaoke.maker.whisperPreparing': 'Whisper तैयार हो रहा है',
  'karaoke.maker.whisperDecoding': 'ऑडियो स्थानीय रूप से डिकोड हो रहा है',
  'karaoke.maker.whisperTranscribing': 'स्थानीय लिप्यंतरण हो रहा है',
  'karaoke.maker.whisperTranscribingProgress':
    'बोल का समय पहचाना जा रहा है · चरण {pass}/{passes} · खंड {chunk}/{chunks}',
  'karaoke.maker.whisperAligning': 'गीत को गायन से मिलाया जा रहा है',
  'karaoke.maker.whisperComplete': 'लिप्यंतरण पूरा हुआ',
  'karaoke.maker.whisperMatched':
    'Whisper ने {count} पहचाने शब्द मिलाए। निर्यात से पहले उनके संपादन योग्य समय की जाँच करें।',
  'karaoke.maker.autoAlignComplete':
    'बिना बदले बोल पहचानी गई धुन से मिलाए गए। मैन्युअल समय सुरक्षित रखा गया।',
  'karaoke.maker.speechMemory': 'AI मॉडल मेमोरी',
  'karaoke.maker.speechMemoryReady': 'RAM में तैयार',
  'karaoke.maker.speechMemoryCached': 'डिस्क पर कैश',
  'karaoke.maker.speechMemoryMissing': 'डाउनलोड नहीं हुआ',
  'karaoke.maker.modelWhisper': 'वाणी (Whisper)',
  'karaoke.maker.modelPitch': 'स्वरमान (RMVPE)',
  'karaoke.maker.modelSeparation': 'पृथक्करण (RoFormer)',
  'karaoke.maker.freeMemory': 'अभी RAM खाली करें',
  'karaoke.maker.memoryReleased':
    'वाणी मॉडल RAM से हटा दिया गया। डाउनलोड फ़ाइलें कैश में रहती हैं।',
  'karaoke.maker.memoryReleaseBusy':
    'वाणी मॉडल व्यस्त है और अभी खाली नहीं किया जा सकता।',
  'karaoke.maker.memoryAfterUse': 'निष्क्रिय होने पर',
  'karaoke.maker.memoryPolicy.ask': 'मुझसे पूछें',
  'karaoke.maker.memoryPolicy.auto': 'अपने आप खाली करें',
  'karaoke.maker.memoryPolicy.keep': 'लोड रखा जाए',
  'karaoke.maker.memoryAfter': 'इसके बाद',
  'karaoke.maker.memoryMinutes': '{count} मिनट',
  'karaoke.maker.memoryPromptTitle': 'वाणी मॉडल की मेमोरी खाली करें?',
  'karaoke.maker.memoryPromptBody':
    'स्थानीय वाणी मॉडल निष्क्रिय है। उसे हटाने से RAM बचती है; तेज़ पुनः लोड के लिए फ़ाइलें कैश में रहती हैं।',
  'karaoke.maker.keepLoaded': 'लोड रखें',
  'karaoke.maker.exported': '{file} निर्यात किया गया',
  'karaoke.maker.exportedPartialLrc':
    '{file} निर्यात किया गया, पर बोल की {lines} पंक्तियों के बिना: LRC को पंक्ति पर या उसके किसी शब्द पर समय चाहिए, और इनके पास दोनों में से कुछ नहीं है। उन्हें मेकर में समय दें और पूरी फ़ाइल के लिए फिर से निर्यात करें।',
  'karaoke.maker.exportedPartialUltraStar':
    '{file} निर्यात किया गया, पर बोल के {words} शब्दों के बिना: UltraStar किसी शब्द को तभी रखता है जब धुन में उसका स्वर हो, और इनका कोई स्वर नहीं है। उनके स्वर पहचानें या बनाएँ और पूरी फ़ाइल के लिए फिर से निर्यात करें।',
  'karaoke.maker.exportFallback': 'कराओके फ़ाइल',
  'karaoke.maker.projectTooLarge': 'प्रोजेक्ट 16 MB से बड़ा है।',
  'karaoke.maker.previewResize': 'लाइव पूर्वावलोकन का आकार बदलें',
  'karaoke.maker.seekBack': '{seconds} सेकंड पीछे जाएँ',
  'karaoke.maker.seekForward': '{seconds} सेकंड आगे जाएँ',
  'karaoke.maker.jumpToStart': 'गीत की शुरुआत पर जाएँ',
  'karaoke.maker.jumpToEnd': 'गीत के अंत पर जाएँ',
  'karaoke.maker.errorAudioLimits':
    'स्थानीय विश्लेषण 1 GB तक की ऑडियो फ़ाइल और 30 मिनट से छोटी रिकॉर्डिंग समर्थित करता है।',
  'karaoke.maker.errorComponentUnavailable':
    'स्थानीय विश्लेषण का आवश्यक घटक उपलब्ध नहीं है। FluidEQ फिर शुरू करें और दोबारा प्रयास करें।',
  'karaoke.maker.errorAnalysis':
    'FluidEQ इस ऑडियो का स्थानीय विश्लेषण नहीं कर सका।',
  'karaoke.maker.errorExportNeedsNotes':
    'UltraStar निर्यात के लिए कम से कम एक धुन का स्वर चाहिए।',
  'karaoke.maker.errorExport': 'FluidEQ यह कराओके निर्यात नहीं कर सका।',
  'karaoke.maker.errorProjectVersion':
    'यह प्रोजेक्ट FluidEQ के असमर्थित संस्करण में बनाया गया था।',
  'karaoke.maker.errorImport':
    'FluidEQ यह कराओके या प्रोजेक्ट आयात नहीं कर सका।',
  'karaoke.maker.errorParse': 'चुनी गई बोल या कराओके फ़ाइल पढ़ी नहीं जा सकी।',
  'karaoke.maker.downloadFailed': 'Whisper मॉडल डाउनलोड विफल',
  'karaoke.maker.localAnalysisFailed': 'स्थानीय विश्लेषण विफल',
  'karaoke.maker.whisperDownloadError':
    'FluidEQ Hugging Face से मॉडल डाउनलोड नहीं कर सका। इंटरनेट या फ़ायरवॉल जाँचें और फिर प्रयास करें।',
  'karaoke.maker.tryAgain': 'फिर प्रयास करें',
  'karaoke.maker.dismiss': 'त्रुटि बंद करें',
  'karaoke.maker.analysisSource':
    '“{file}” को केवल स्थानीय विश्लेषण स्रोत के रूप में उपयोग किया जा रहा है।',
  'karaoke.maker.rightsRequired':
    'निर्यात प्रकाशित करने से पहले ऑडियो और बोल के अधिकारों की पुष्टि करें।',
  'karaoke.maker.draftRestored': 'ड्राफ़्ट बहाल हुआ',
  'karaoke.maker.playerTimingLoaded':
    'प्लेयर का मौजूदा समय उपयोग हो रहा है। पूर्ववत करने पर सहेजा ड्राफ़्ट वापस आएगा।',
};

export default karaoke;
