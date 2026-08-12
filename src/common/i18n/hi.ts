/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/**
 * Hindi.
 *
 * Audio terms of art (EQ, WAV, dB, Equalizer APO) stay in Latin script: they
 * are what the labels on the hardware and in every other tool say, and a
 * transliteration would be less recognisable, not more.
 */
const hi: Partial<Dictionary> = {
  'app.tagline': 'आपकी आवाज़। हर डिवाइस पर। अपने आप।',
  'app.actions': 'FluidEQ क्रियाएँ',
  'app.actions.title': 'ऑडियो क्रियाएँ',
  'app.status.ready': 'Equalizer APO से जुड़ा हुआ',
  'app.status.checking': 'Equalizer APO जाँचा जा रहा है…',
  'app.status.error': 'Equalizer APO जवाब नहीं दे रहा',
  'app.menu.importEq': 'EQ सेटिंग आयात करें…',
  'app.menu.importConvolution': 'इंपल्स रिस्पॉन्स आयात करें…',
  'app.menu.restartAudio': 'Windows ऑडियो फिर से चालू करें',
  'app.menu.reconfigure': 'Equalizer APO फिर से सेट करें',
  'app.menu.apoSettings': 'Equalizer APO सेटिंग',
  'app.menu.support': 'प्रोजेक्ट का साथ दें',
  'whatsNew.eyebrow': 'रिलीज़ नोट्स',
  'whatsNew.title': 'FluidEQ में नया क्या है',
  'whatsNew.loading': 'रिलीज़ नोट्स लोड हो रहे हैं…',
  'whatsNew.missing':
    'इस बिल्ड में रिलीज़ नोट्स नहीं मिले। ये GitHub पर भी हैं।',
  'app.menu.whatsNew': 'नया क्या है',
  'app.menu.language': 'भाषा',
  'app.window.minimize': 'छोटा करें',
  'app.window.maximize': 'बड़ा करें',
  'app.window.restore': 'पहले जैसा करें',
  'app.window.close': 'बंद करें',
  'app.window.minimizeApp': 'FluidEQ छोटा करें',
  'app.window.maximizeApp': 'FluidEQ बड़ा करें',
  'app.window.restoreApp': 'FluidEQ पहले जैसा करें',
  'app.window.closeApp': 'FluidEQ बंद करें',
  'app.media.previous': 'पिछला ट्रैक',
  'app.media.playPause': 'चलाएँ या रोकें',
  'app.media.next': 'अगला ट्रैक',
  'app.media.previousAria': 'पिछला ट्रैक, इस कंप्यूटर पर कहीं भी चल रहा हो',
  'app.media.playPauseAria': 'चलाएँ या रोकें, इस कंप्यूटर पर कहीं भी चल रहा हो',
  'app.media.nextAria': 'अगला ट्रैक, इस कंप्यूटर पर कहीं भी चल रहा हो',
  'app.dismiss': 'हटाएँ',

  'tabs.aria': 'साउंड वर्कस्पेस',
  'tabs.eq': 'EQ',
  'tabs.autoeq': 'AutoEQ',
  'tabs.voicing': 'ध्वनि रंग',
  'tabs.convolution': 'कन्वॉल्यूशन',
  'tabs.config': 'Config',
  'tabs.media': 'मीडिया',
  'tabs.karaoke': 'कराओके',

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
    'ऑडियो: MP3, WAV, OGG, FLAC या M4A · बोल: LRC, eLRC या UltraStar TXT',
  'karaoke.import.drop': 'गाने, बोल या फ़ोल्डर यहाँ छोड़ें',
  'karaoke.error.missingAudio': 'इस बोल फ़ाइल के साथ एक ऑडियो फ़ाइल भी जोड़ें।',
  'karaoke.error.ambiguous':
    'एक से अधिक जोड़ियाँ संभव हैं। एक ऑडियो और वैकल्पिक रूप से एक बोल फ़ाइल चुनें।',
  'karaoke.error.unsupported':
    'इनमें से कोई फ़ाइल अभी समर्थित Karaoke ऑडियो या बोल फ़ाइल नहीं है।',
  'karaoke.error.read': 'FluidEQ चुनी गई स्थानीय फ़ाइलें नहीं पढ़ सका।',
  'karaoke.error.playback':
    'यह Chromium संस्करण उस ऑडियो फ़ाइल या कोडेक को नहीं चला सका।',
  'karaoke.warning.lyrics':
    'को पढ़ा नहीं जा सका; ऑडियो समयबद्ध बोल के बिना उपलब्ध रहेगा।',
  'karaoke.song.unknownArtist': 'स्थानीय गाना',
  'karaoke.playlist.title': 'प्लेलिस्ट',
  'karaoke.playlist.select': '{title} चुनें',
  'karaoke.playlist.moveUp': '{title} को ऊपर ले जाएँ',
  'karaoke.playlist.moveDown': '{title} को नीचे ले जाएँ',
  'karaoke.playlist.remove': '{title} हटाएँ',
  'karaoke.playlist.resize': 'प्लेलिस्ट और मंच का आकार बदलें',
  'karaoke.playlist.collapse': 'प्लेलिस्ट समेटें',
  'karaoke.playlist.expand': 'प्लेलिस्ट खोलें',
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
  'karaoke.countIn.ready': 'तैयार हो जाएँ — GO के बाद गाना शुरू होगा',
  'karaoke.chords.aria': 'बैकिंग ट्रैक से अनुमानित गिटार कॉर्ड',
  'karaoke.chords.analyzing': 'कॉर्ड खोजे जा रहे हैं… {percent}%',
  'karaoke.chords.estimate': 'अनुमानित कॉर्ड',
  'karaoke.chords.next': 'अगला',
  'karaoke.chords.in': '{seconds} सेकंड में',
  'karaoke.chords.none': 'कोई स्थिर कॉर्ड नहीं मिला',
  'karaoke.chords.confidence': 'ऑडियो अनुमान विश्वसनीयता: {percent}%',
  'karaoke.transport.title': 'Karaoke प्लेबैक नियंत्रण',
  'karaoke.transport.restart': 'गाना फिर शुरू करें',
  'karaoke.transport.play': 'चलाएँ',
  'karaoke.transport.pause': 'रोकें',
  'karaoke.transport.seek': 'गाने की स्थिति',
  'karaoke.transport.volume': 'आवाज़',
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

  'graph.resize': 'ग्राफ़ का आकार बदलने के लिए खींचें',
  'graph.meter.aria':
    'लाइव आउटपुट स्तर, फ़ुल स्केल से नीचे वास्तविक डेसिबल में',
  'graph.meter.left': 'L',
  'graph.meter.right': 'R',
  'graph.meter.mono': 'M',
  'video.sites': 'वीडियो साइटें',
  'video.back': 'पीछे',
  'video.forward': 'आगे',
  'video.reload': 'फिर से लोड करें',
  'video.stop': 'रोकें',
  'video.searchAria': 'मौजूदा साइट पर खोजें',
  'video.searchOn': '{site} पर खोजें',
  'video.searchGo': 'खोजें',
  'video.searchClear': 'खोज साफ़ करें',
  'video.searchRecent': 'हाल की खोजें',
  'video.searchForget': '“{term}” हटाएँ',
  'video.searchForgetAll': 'हाल की खोजें साफ़ करें',
  'video.adBlock': 'विज्ञापन ब्लॉक करें',
  'video.adBlockHint':
    'YouTube पर वीडियो विज्ञापन छोड़ता है और विज्ञापन की जगह छिपाता है।',
  'video.signOut': 'सभी साइटों से साइन आउट करें',
  'video.signOutBusy': 'साइन आउट हो रहा है…',
  'video.signOutHint':
    'प्लेयर में सहेजी गई सभी कुकीज़, लॉगिन और कैश किए गए पेज मिटा देता है।',
  'video.signOutDone': 'साइन आउट हो गया',
  'video.signOutFailed': 'साइन आउट नहीं हो सका',
  'video.blockedTitle': 'यह लिंक प्लेयर से बाहर ले जाता है',
  'video.openInBrowser': 'ब्राउज़र में खोलें',
  'video.resize': 'प्लेयर का आकार बदलने के लिए खींचें',

  'notice.apoReconfigured':
    'Equalizer APO इंस्टॉल या फिर से सेट हुआ है। अगर आवाज़ न आए तो पूरा PC नहीं, सिर्फ़ Windows ऑडियो फिर से चालू करें।',
  'notice.restartNow': 'ऑडियो अभी फिर चालू करें',
  'notice.importComplete': 'आयात पूरा हुआ',
  'notice.restartConfirm':
    'कुछ सेकंड के लिए आवाज़ रुकेगी और Windows एडमिन अनुमति माँगेगा। जारी रखें?',
  'update.title': 'FluidEQ अपडेट',
  'update.available': 'संस्करण {version} उपलब्ध है। अभी डाउनलोड हो रहा है।',
  'update.downloading': 'अपडेट डाउनलोड हो रहा है… {percent}%',
  'update.ready':
    'संस्करण {version} तैयार है। पूरा करने के लिए FluidEQ फिर से चालू करें।',
  'update.restart': 'अभी फिर चालू करें',
  'update.restarting': 'फिर चालू हो रहा है…',
  'update.mandatory.title': 'यह संस्करण अपडेट करना ज़रूरी है',
  'update.mandatory.body':
    'यह रिलीज़ एक ऐसी गड़बड़ी ठीक करती है जो इतनी गंभीर है कि FluidEQ को इसी हाल में चलते नहीं रहना चाहिए। अपडेट अभी लिया जा रहा है।',
  'update.mandatory.notOptional':
    'यह वैकल्पिक अपडेट नहीं है। आप यह सूचना बंद करके अपना काम पूरा कर सकते हैं — FluidEQ अपडेट होने तक यह फिर से दिखती रहेगी।',
  'update.mandatory.later': 'अभी नहीं',
  'update.mandatory.waiting': 'अपडेट लिया जा रहा है…',
  'update.mandatory.readyPrompt':
    'अपडेट डाउनलोड हो चुका है। इंस्टॉल के दौरान FluidEQ बंद होगा और उसके बाद फिर से खुल जाएगा।',
  'update.mandatory.install': 'इंस्टॉल करें और फिर चालू करें',
  'update.mandatory.installing': 'इंस्टॉल हो रहा है…',
  'update.mandatory.failedDownload':
    'अपडेट डाउनलोड नहीं हो सका। या तो डाउनलोड सर्वर तक पहुँच नहीं बनी, या बीच में कनेक्शन टूट गया।',
  'update.mandatory.failedInstall':
    'अपडेट डाउनलोड तो हो गया, पर इंस्टॉलर चालू नहीं हुआ। हो सकता है Windows ने उसे रोक दिया हो, या डाउनलोड की गई फ़ाइल खराब हो।',
  'update.mandatory.manual':
    'आप इसे खुद भी इंस्टॉल कर सकते हैं: रिलीज़ पेज से नवीनतम संस्करण डाउनलोड करके चलाएँ। आपकी सेटिंग्स और प्रोफ़ाइल बनी रहेंगी।',
  'update.mandatory.releasePage': 'डाउनलोड पेज खोलें',
  'notice.restartDone':
    'Windows ऑडियो फिर से चालू हो गया। जो ऐप अब भी चुप हैं उन्हें दोबारा खोलें।',

  'sidebar.engine': 'इंजन',
  'sidebar.systemEq': 'सिस्टम EQ',
  'sidebar.preamp': 'प्रीएम्प',
  'sidebar.preampAria': 'प्रीएम्प गेन (dB)',
  'sidebar.preampAuto':
    'यह अपने आप तय होता है। खुद बदलने के लिए “अपने आप सामान्य करें” बंद करें।',
  'sidebar.headroom': 'APO हेडरूम',
  'sidebar.autoPreamp': 'अपने आप सामान्य करें',
  'sidebar.visualizer': 'विज़ुअलाइज़र',
  'sidebar.graphView': 'रिस्पॉन्स ग्राफ़',

  'output.eyebrow': 'आपके आउटपुट के साथ चलता है',
  'output.title': 'स्वचालित प्रोफ़ाइल',
  'output.device': 'आउटपुट डिवाइस',
  'output.active': 'चालू',
  'output.none': 'कोई चालू आउटपुट नहीं मिला',
  'output.mapping': 'स्वचालित जोड़',
  'output.mapping.neutral': 'बिना बदलाव वाला आउटपुट',
  'output.mapping.live': 'चालू ट्यूनिंग जुड़ी है',
  'output.mapping.hint':
    'कोई भी EQ कंट्रोल बदलें — वह सेव होकर इसी आउटपुट से अपने आप जुड़ जाएगा।',
  'output.hint':
    'FluidEQ डिवाइस की स्थायी ID याद रखता है, इसलिए Windows जब भी उसे चुनेगा यह आवाज़ उसके साथ रहेगी।',

  'extraOutput.eyebrow': 'दो जगह बजता है',
  'extraOutput.title': 'दूसरा आउटपुट',
  'extraOutput.target': 'यहाँ मिरर करें',
  'extraOutput.off': 'बंद',
  'extraOutput.none': 'कोई दूसरा आउटपुट नहीं मिला',
  'extraOutput.active': 'मिरर हो रहा है',
  'extraOutput.volume': 'आवाज़',
  'extraOutput.latency':
    'मिरर की गई आवाज़ लगभग पाँचवें हिस्से भर सेकंड देर से पहुँचती है। दूसरे कमरे में संगीत के लिए ठीक है, वीडियो या गेम के लिए बेकार, और दोनों एक साथ सुनाई दें तो गूँज बन जाती है।',
  'extraOutput.virtual':
    'एक रूटिंग ड्राइवर पहले से इंस्टॉल है। अपने ऐप्लिकेशन उसी पर भेजें, तो दोनों आउटपुट एक साथ चलेंगे; फिर ऊपर हर एक को अपनी अलग प्रोफ़ाइल दें।',
  'extraOutput.ambiguous':
    'दो आउटपुट का नाम एक ही है, इसलिए FluidEQ यह नहीं समझ पाता कि आपका मतलब किससे है। Windows की साउंड सेटिंग्स में एक का नाम बदलें।',
  'extraOutput.unmatched':
    'Windows इस आउटपुट को दिखाता है, पर FluidEQ उस तक नहीं पहुँच पाता, इसलिए उस पर मिरर नहीं किया जा सकता।',
  'extraOutput.labelsHidden':
    'FluidEQ अभी आउटपुट के नाम नहीं पढ़ पा रहा, इसलिए उन्हें मिला नहीं सकता। FluidEQ को माइक्रोफ़ोन की अनुमति दें और यह पैनल दोबारा खोलें।',
  'extraOutput.hint':
    'मिरर करने पर जो आप पहले से सुन रहे हैं वही एक दूसरे डिवाइस पर भी बजता है। यह तभी चलता है जब FluidEQ खुला हो।',

  'driver.eyebrow': 'आप किस पर सुनते हैं',
  'driver.title': 'ड्राइवर प्रकार',
  'driver.none': 'कोई सुधार नहीं',
  'driver.none.hint': 'सिर्फ़ आपके बैंड और ध्वनि रंग',
  'driver.strength': 'मात्रा',
  'driver.range': '±1.5 dB',

  'profiles.eyebrow': 'आपकी आवाज़',
  'profiles.title': 'सहेजी गई प्रोफ़ाइलें',
  'profiles.name': 'प्रोफ़ाइल का नाम',
  'profiles.nameAria': 'प्रोफ़ाइल का नाम',
  'profiles.new': 'नई प्रोफ़ाइल',
  'profiles.newAria': 'मौजूदा EQ से नई प्रोफ़ाइल बनाएँ',
  'profiles.untitled': 'बिना नाम की प्रोफ़ाइल',
  'profiles.save': 'नई के रूप में सहेजें',
  'profiles.update': 'अपडेट करें',
  'profiles.saveAria': 'सेटिंग प्रोफ़ाइल में सहेजें',
  'profiles.restore': 'वापस लाएँ',
  'profiles.restoring': 'वापस लाया जा रहा है…',
  'profiles.restoreAria':
    'इस प्रोफ़ाइल का आख़िरी बार हाथ से सहेजा गया रूप वापस लाएँ',
  'profiles.attached': 'चालू',
  'profiles.attachedTitle': 'इसी आउटपुट पर बज रहा है',
  'profiles.detecting': 'आपका आउटपुट पहचाना जा रहा है…',
  'profiles.empty': 'अभी कोई प्रोफ़ाइल नहीं है। अपनी पहली आवाज़ बनाइए।',
  'profiles.error.empty': 'प्रोफ़ाइल का नाम खाली नहीं हो सकता।',
  'profiles.error.restricted': 'यह नाम मान्य नहीं है, दूसरा चुनें।',
  'profiles.error.duplicate': 'यह नाम पहले से है, दूसरा चुनें।',
  'profiles.edit': 'प्रोफ़ाइल का नाम बदलें',

  'autoeq.page.eyebrow': 'अपने हेडफ़ोन से मिलाएँ',
  'autoeq.page.title': 'हेडफ़ोन सुधार',
  'autoeq.page.intro':
    'बताइए आप किन हेडफ़ोन पर सुन रहे हैं और FluidEQ उनके लिए प्रकाशित सुधार लगा देगा। यह अपनी अलग परत के रूप में जुड़ता है, अपनी ताक़त और अपने स्विच के साथ, इसलिए आपके EQ बैंड कभी नहीं छुए जाते। यहाँ का हर माप असली रिग पर लिया गया है और किसी ने उसे प्रकाशित किया है — कुछ भी मॉडल के नाम से अंदाज़े में नहीं बनाया गया।',
  'autoeq.source.hint':
    'माप किस डेटाबेस से आए हैं। “सभी डेटाबेस” सब में एक साथ खोजता है।',
  'autoeq.model.hint':
    'ब्रांड या मॉडल से खोजें। अगर आपका मॉडल मापा नहीं गया है, तो उसी श्रेणी का नज़दीकी मॉडल आमतौर पर काफ़ी क़रीब ले आता है।',
  'autoeq.target.hint':
    'ज़्यादातर मॉडल एक से ज़्यादा बार मापे जाते हैं — अलग रिग, अलग लक्ष्य कर्व — और वे एक जैसे नहीं लगते। एक से ज़्यादा आज़माना सही रहता है।',
  'autoeq.eyebrow': 'किसी संदर्भ से शुरू करें',
  'autoeq.title': 'AutoEQ लाइब्रेरी',
  'autoeq.selectSource': 'स्रोत चुनें',
  'autoeq.applied': 'लागू: {name}',
  'autoeq.notApplied': 'कोई संदर्भ लागू नहीं',
  'autoeq.source': 'माप का स्रोत',
  'autoeq.model': 'हेडफ़ोन मॉडल',
  'autoeq.target': 'माप / लक्ष्य',
  'autoeq.apply': 'इस मॉडल का EQ लगाएँ',
  'autoeq.applying': 'लागू किया जा रहा है…',
  'autoeq.applyAria': 'चुने हुए मॉडल का EQ लगाएँ',
  'autoeq.checking': 'आधिकारिक डेटाबेस जाँचा जा रहा है…',
  'autoeq.updateAvailable': 'अपडेट उपलब्ध है ({count} मॉडल)',
  'autoeq.upToDate': 'डेटाबेस अद्यतन है — {count} मॉडल',
  'autoeq.updateUnknown': 'अपडेट जाँच नहीं हो सकी',
  'autoeq.update': 'डेटाबेस अपडेट करें',
  'autoeq.updating': 'अपडेट हो रहा है…',
  'autoeq.updateAria': 'AutoEq डेटाबेस अपडेट करें',
  'autoeq.allDatabases': 'सभी डेटाबेस',
  'autoeq.allDatabases.hint': 'आधिकारिक AutoEq डेटाबेस में खोजें।',
  'autoeq.pickDevice': 'पहले कोई मॉडल चुनें 🎧',
  'autoeq.noResponses': 'कोई समर्थित माप नहीं 😞',
  'autoeq.pickResponse': 'कोई माप चुनें! 🔊',
  'autoeq.selectSourcePlaceholder': 'स्रोत चुनें…',
  'autoeq.searchSources': 'स्रोत खोजें…',
  'autoeq.noModel': 'आपकी खोज से मेल खाता कोई मापा हुआ मॉडल नहीं है।',
  'autoeq.searchModels': 'ब्रांड या मॉडल से खोजें…',
  'squigImport.eyebrow': 'BRING YOUR CURVE WITH YOU',
  'squigImport.title': 'Import a Squiglink EQ',
  'squigImport.intro':
    'Use Squiglink’s calculator, then import its EQ export here.',
  'squigImport.open': 'Open Squiglink',
  'squigImport.stepOne': 'Choose a headset and target',
  'squigImport.stepTwo': 'Export the EQ text',
  'squigImport.stepThree': 'Paste it here and apply',
  'squigImport.pasteLabel': 'EQ export',
  'squigImport.placeholder': 'Paste the ParametricEQ or GraphicEQ text here…',
  'squigImport.fileAria': 'Choose an EQ export text file',
  'squigImport.chooseFile': 'Choose a .txt file',
  'squigImport.applyAria': 'Apply this imported EQ',
  'squigImport.importing': 'Applying…',
  'squigImport.apply': 'Apply imported EQ',
  'squigImport.applied': 'Applied curve',
  'squigImport.livePreview': 'Live preview',
  'squigImport.notApplied': 'Not applied',
  'squigImport.currentText': 'Current EQ text',
  'squigImport.flatPreview': 'Flat preview',
  'squigImport.flatCurve': 'No curve applied · 0 dB',
  'squigImport.bands': 'bands',
  'squigImport.clear': 'Remove import',
  'squigImport.chartAria': 'Frequency response of the imported EQ',
  'squigImport.emptyTitle': 'Your imported curve will appear here',
  'squigImport.emptyHint': 'Paste an export to preview its shape here.',
  'voicing.quickAria': 'ध्वनि रंग: {name}',
  'voicing.quickNone': 'ध्वनि रंग: कोई नहीं',
  'voicing.quickTitle': 'कोई ध्वनि रंग लागू नहीं है',
  'voicing.quickLabel': 'ध्वनि रंग',
  'voicing.quickNoneHint': 'सिर्फ़ आपके EQ बैंड',

  'eq.eyebrow': 'बारीक़ी से सेट करें',
  'eq.title': 'पैरामीट्रिक EQ',
  'eq.smart': 'स्मार्ट EQ',
  'eq.smart.cancel': 'रद्द करें',
  'eq.smart.aria': 'चल रहे आउटपुट से स्मार्ट EQ बनाएँ',
  'eq.smart.cancelAria': 'स्मार्ट EQ माप रद्द करें',
  'eq.smart.continuous': 'निरंतर',
  'eq.smart.continuousAria':
    'संगीत चलते समय स्मार्ट EQ मापता और समायोजित करता रहे',
  'eq.smart.modeAria': 'चुनें कि स्मार्ट EQ कैसे मापे',
  'eq.smart.mode.once.note': 'एक माप, एक ही बार में लागू',
  'eq.smart.mode.detail': 'डिटेल',
  'eq.smart.mode.detail.note': 'मापता रहे · केवल चोटियाँ और गड्ढे',
  'eq.smart.mode.balance': 'संतुलन',
  'eq.smart.mode.balance.note': 'मापता रहे · चमक और गर्माहट भी बराबर करे',
  'eq.smart.mode.target': 'लक्ष्य',
  'eq.smart.mode.target.note': 'मापता रहता है · हर रिकॉर्डिंग को एक ही कर्व पर',
  'eq.layers': 'यह भी लागू है',
  'eq.layers.aria': 'इस आउटपुट पर और क्या असर डाल रहा है',
  'eq.layers.eq': 'EQ',
  'eq.layers.eq.modified': '(बदला हुआ)',
  'eq.layers.eq.bands': '{count} बैंड',
  'eq.layers.convolution': 'कन्वॉल्यूशन',
  'eq.layers.voicing': 'ध्वनि रंग',
  'eq.layers.driver': 'ड्राइवर',
  'eq.layers.headphone': 'हेडफ़ोन',
  'eq.layers.custom': 'कस्टम FX',
  'eq.layers.disable': '{layer} हटाए बिना बंद करें',
  'eq.layers.enable': '{layer} फिर से चालू करें',
  'eq.layers.smart': 'स्मार्ट EQ',
  'eq.layers.smart.fullRange': 'मापा गया · पूरी रेंज',
  'eq.layers.smart.range': 'मापा गया · {low} से {high} तक',
  'eq.layers.remove': '{layer} परत हटाएँ',
  'eq.layers.clearBands': 'सभी बैंड 0 dB पर लौटाएँ',
  'eq.layers.clearReference': 'हेडफ़ोन करेक्शन हटाएँ',
  'eq.layers.clearSmart':
    'मापा गया सुधार हटाएँ। आपके बैंड और संदर्भ मॉडल वैसे ही रहेंगे।',
  'eq.layers.clearCustom': 'कस्टम FX फ़िल्टर और टेक्स्ट साफ़ करें',
  'eq.clear': 'EQ ख़ाली करें',
  'eq.addBand': 'बैंड जोड़ें',
  'eq.addBandAria': 'EQ बैंड जोड़ें',
  'eq.quickLayouts': 'तेज़ लेआउट',
  'eq.bandCount': '{count} बैंड',
  'eq.selected': 'चुना हुआ बैंड',
  'eq.filter': 'फ़िल्टर',
  'eq.frequency': 'आवृत्ति',
  'eq.gain': 'गेन',
  'eq.gainDisabled': 'गेन · लागू नहीं',
  'eq.quality': 'क्वालिटी (Q)',
  'eq.delete': 'बैंड हटाएँ',
  'eq.deleteAria': 'चुना हुआ EQ बैंड हटाएँ',

  // वाक्यांश लेबल की तरह लिखे हैं — रेंज, फिर विसर्ग — ताकि रेंज का नाम अपने
  // मूल रूप में रहे। «हवा बढ़ाई» और «बास बढ़ाया» में क्रिया लिंग के साथ बदलती
  // है, और खाली जगह में सिर्फ़ एक ही रूप डाला जा सकता है; संज्ञा के बाद विसर्ग
  // यह समस्या ही हटा देता है।
  'eq.smart.range.deepBass': 'गहरा बास',
  'eq.smart.range.bass': 'बास',
  'eq.smart.range.lowMids': 'निचले मिड',
  'eq.smart.range.mids': 'मिड',
  'eq.smart.range.upperMids': 'ऊपरी मिड',
  'eq.smart.range.presence': 'प्रेज़ेंस',
  'eq.smart.range.treble': 'ट्रेबल',
  'eq.smart.range.highTreble': 'ऊँचा ट्रेबल',
  'eq.smart.range.air': 'एयर',
  'eq.smart.range.separator': ', ',
  'eq.smart.shape.lifted': '{range}: बढ़त',
  'eq.smart.shape.eased': '{range}: कटौती',
  'eq.smart.need.more': '{range}: और चाहिए',
  'eq.smart.need.less': '{range}: बहुत ज़्यादा',
  'eq.smart.status.listening': 'सुन रहा है',
  'eq.smart.status.listeningPercent': 'सुन रहा है {percent}%',
  'eq.smart.status.settling': 'सुन रहा है {percent}% - स्थिर हो रहा है',
  'eq.smart.status.waitingOn': 'सुन रहा है {percent}% - इंतज़ार: {ranges}',
  'eq.smart.status.waitingOnMore':
    'सुन रहा है {percent}% - इंतज़ार: {ranges} +{count}',
  'eq.smart.status.paused': 'रुका हुआ',
  'eq.smart.status.pausedResume': 'रुका हुआ - पूरा करने के लिए फिर चलाएँ',
  'eq.smart.status.pausedSilent': 'रुका हुआ - कोई आवाज़ नहीं चल रही',
  'eq.smart.status.waitingForSound': 'आवाज़ का इंतज़ार',
  'eq.smart.status.soundChanged': 'आवाज़ बदल गई - फिर से मापा जा रहा है',
  'eq.smart.status.keptChanging': 'आवाज़ बदलती रही - रोक दिया',
  'eq.smart.status.notEnoughRange': 'मापने के लिए पर्याप्त रेंज नहीं',
  'eq.smart.status.alreadyBalanced': 'पहले से संतुलित',
  'eq.smart.status.applying': 'लागू किया जा रहा है…',
  'eq.smart.status.cancelled': 'रद्द - कुछ नहीं बदला',
  'eq.smart.status.failed': 'आउटपुट मापा नहीं जा सका।',
  'eq.smart.result.fullRange': 'संतुलित - पूरी रेंज',
  'eq.smart.result.range': 'संतुलित - केवल {low} से {high} तक',
  'eq.smart.result.withShape': '{result} · {shape}',
  'eq.smart.frequency.hz': '{value} Hz',
  'eq.smart.frequency.khz': '{value} kHz',
  'eq.smart.error.noCapture': 'इस माहौल में ऑडियो कैप्चर उपलब्ध नहीं है।',
  'eq.smart.error.noLoopback':
    'इस माहौल में सिस्टम आउटपुट का कैप्चर उपलब्ध नहीं है।',
  'eq.smart.error.streamStopped': 'माप पूरा होने से पहले आउटपुट रुक गया।',
  'eq.smart.error.analyserPaused':
    'विश्लेषक रुका हुआ है, इसलिए माप रोक दिया गया।',
  'eq.smart.error.noSound': 'कुछ नहीं बज रहा था। संगीत चलाएँ और फिर से मापें।',
  'eq.smart.error.noAudioTrack': 'Windows ने सिस्टम ऑडियो स्ट्रीम नहीं दी।',
  'eq.smart.error.formatChanged':
    'माप के दौरान आउटपुट फ़ॉर्मैट बदल गया। फिर से कोशिश करें।',
  'eq.smart.error.deviceChanged':
    'माप के दौरान ऑडियो डिवाइस बदल गया। फिर से कोशिश करें।',
  'eq.smart.error.captureFailed':
    'प्रोसेस किया गया सिस्टम आउटपुट कैप्चर नहीं हो सका।',
  'eq.smart.error.analyserOff':
    'लाइव आउटपुट विश्लेषक चालू नहीं है, इसलिए मापने को कुछ नहीं है।',
  'eq.smart.error.alreadyRunning': 'एक माप पहले से चल रहा है।',
  'eq.smart.error.timedOut': 'माप का समय पूरा हो गया। फिर से कोशिश करें।',
  'eq.smart.error.closed': 'FluidEQ ने माप बंद कर दिया।',
  // «गिनती नहीं» — क्रिया रेंज के लिंग के साथ नहीं बदलती, इसलिए एक ही रूप
  // हर रेंज के साथ सही रहता है।
  'eq.smart.presence.ignoredBelow': '{db} dB से नीचे नहीं',
  'eq.smart.presence.trustedAbove': '{db} dB से ऊपर भरोसा',
  'eq.smart.presence.reset': 'इस मोड के लिए {range} रीसेट करें',
  'eq.smart.limit.label': 'Smart EQ सीमा {db} dB',
  'eq.smart.gap.title':
    '{range}: कितना अंतर है, कार्रवाई के लिए ज़रूरी मात्रा के सामने',
  'eq.smart.gap.countdown': '{seconds}से॰ में लागू',

  'convolution.eyebrow': 'APO इंपल्स रिस्पॉन्स',
  'convolution.title': 'कन्वॉल्यूशन लाइब्रेरी',
  'convolution.intro':
    'अपने हेडफ़ोन के लिए जाँचा हुआ मिनिमम-फ़ेज़ इंपल्स डाउनलोड करें और उसे पैरामीट्रिक EQ से पहले लगाएँ। नीचे का ग्राफ़ दोनों कर्व दिखाता है।',
  'convolution.import': 'WAV आयात करें…',
  'convolution.importing': 'आयात हो रहा है…',
  'convolution.applied': 'इस आउटपुट पर लागू',
  'convolution.clear': 'हटाएँ',
  'convolution.search': 'हेडफ़ोन मॉडल खोजें',
  'convolution.searchPlaceholder':
    '“Kraken”, “HD 650” या किसी मापने वाले का नाम आज़माएँ',
  'convolution.notice':
    'डाउनलोड करने योग्य सूची AutoEq देता है। फ़ाइलें 48 kHz WAV के रूप में आती हैं, क्योंकि Equalizer APO चाहता है कि इंपल्स रिस्पॉन्स चालू आउटपुट की सैंपल दर से मेल खाए।',
  'convolution.loading': 'आधिकारिक सूची आ रही है…',
  'convolution.empty':
    'कोई मेल खाता इंपल्स रिस्पॉन्स नहीं। छोटा मॉडल नाम आज़माएँ।',
  'convolution.source': 'स्रोत',
  'convolution.apply': 'डाउनलोड करके लगाएँ',
  'convolution.downloading': 'डाउनलोड हो रहा है…',
  'convolution.isApplied': 'लागू है',
  'convolution.none':
    'कोई कन्वॉल्यूशन लोड नहीं है। EQ टैब पूरी तरह अलग काम करता है।',

  'voicing.eyebrow': 'लक्ष्य कर्व',
  'voicing.title': 'ध्वनि रंग',
  'voicing.intro':
    'आप अभी जो कर रहे हैं उसके हिसाब से तय किया गया लक्ष्य। हर एक आपके बैंड के बाद अपनी अलग परत के रूप में लिखा जाता है, इसलिए आपकी अपनी ट्यूनिंग को कभी छुआ नहीं जाता और “कोई नहीं” पर लौटते ही वह हूबहू वापस आ जाती है।',
  'voicing.refused': 'वॉइसिंग नहीं बदल सका',
  'voicing.groupPurpose': 'किसके लिए',
  'voicing.groupGenre': 'शैली',
  'voicing.none': 'कोई नहीं',
  'voicing.none.hint': 'सिर्फ़ आपके EQ बैंड, ऊपर कुछ नहीं',
  'voicing.strength': 'मात्रा',
  'voicing.off': 'बंद',
  'voicing.full': 'पूरा',
  'voicing.inert': '0% मात्रा पर यह ध्वनि रंग कुछ नहीं करता।',
  'voicing.headroom':
    '+{peak} dB तक बढ़ाता है। “अपने आप सामान्य करें” यह जगह छोड़कर रखता है; जब तक आप प्रीएम्प खुद तय न कर रहे हों, इसे चालू रहने दें।',

  'config.eyebrow': 'इंजन असल में क्या पढ़ता है',
  'config.title': 'Equalizer APO कॉन्फ़िग',
  'config.lede': 'अभी डिस्क पर जो है वही, न कि जो FluidEQ चाहता है।',
  'config.reload': 'फिर से पढ़ें',
  'config.reloadTitle': 'कॉन्फ़िग को डिस्क से दोबारा पढ़ें',
  'config.reading': 'पढ़ा जा रहा है…',
  'config.absent':
    'FluidEQ ने इस Equalizer APO इंस्टॉलेशन में अभी तक कुछ नहीं लिखा है।',
  'config.status.notIncluded':
    'Equalizer APO इस कॉन्फ़िग को शामिल नहीं कर रहा। नीचे का कुछ भी लागू नहीं हो रहा।',
  'config.status.engineOff':
    'FluidEQ इंजन बंद है — यह कॉन्फ़िग किसी आउटपुट का नाम नहीं लेता, इसलिए Equalizer APO इसमें से कुछ भी लागू नहीं कर रहा।',
  'config.status.active': 'चालू — Equalizer APO यह कॉन्फ़िग लागू कर रहा है।',
  'config.outputsAria': 'Equalizer APO कॉन्फ़िग के आउटपुट',
  'config.filters.one': '{count} फ़िल्टर',
  'config.filters.many': '{count} फ़िल्टर',
  'config.impulse': 'इंपल्स',
  'config.playingNow': 'अभी बज रहा है',
  'config.liveTitle': 'निरंतर EQ इसे मापता रहता है',
  'config.layer.on': 'चालू',
  'config.layer.off': 'बंद',
  'config.layers.noFile': 'अपनी कोई फ़ाइल नहीं',
  'config.layers.inFile':
    'अपनी अलग फ़ाइल में नहीं, इसी फ़ाइल में लिखा जाता है।',
  'config.empty': 'कुछ भी शामिल नहीं — यह आउटपुट वैसा ही छोड़ा गया है।',
  'config.file.missing': 'नहीं मिली',
  'config.export': 'चेन निर्यात करें',
  'config.import': 'चेन आयात करें',
  'config.import.hint': 'आयात उसी आउटपुट पर लागू होगा जिसे आप सुन रहे हैं।',
  'config.import.customSkipped':
    'भेजने वाले की अपनी फ़ाइल छोड़ दी गई: उसमें मौजूद Include: या Plugin: पंक्ति Windows ऑडियो में कोड लोड कर देती।',
  'config.file.yours': 'आपकी',
  'config.hint.custom': 'यह आपकी है। कभी अधिलेखित नहीं होती।',
  'config.hint.generated': 'अपने आप बनी — अगले बदलाव पर फिर से लिखी जाएगी।',
  'config.hint.saving':
    'सहेजने पर फ़ाइल लिखी जाती है; Equalizer APO उसे उठा लेता है।',
  'config.edit': 'संपादित करें',
  'config.cancel': 'रद्द करें',
  'config.save': 'सहेजें',

  'support.eyebrow': 'पूरी तरह वैकल्पिक',

  'support.petHint': 'इसे उछालने के लिए स्पेस दबाएँ',

  'support.game.hint': 'शिखर रेखा तक पहुँचे तब ताल पर दबाएँ',

  'support.game.howTo':
    'हर बीट पर पेट को टैप करें या स्पेस दबाएँ। लगे रहिए — ×10 पर कुछ होता है।',

  'support.game.thanks':
    'अगर इसमें से कुछ भी आपको अच्छा लगा, तो आपके विचार और सहयोग ही इसे आगे बढ़ाते हैं।',

  'support.game.noAudio': 'कुछ चलाइए, ताल यहाँ दिखेगी',

  'support.game.listening': 'ताल खोजी जा रही है…',

  'support.game.share': 'साझा करें',

  'support.game.shareEuphoria': 'इंद्रधनुष साझा करें',

  'support.game.shareTitle': 'अपना स्कोर साझा करें',

  'support.game.shareUnlock':
    '×10 तक पहुँचिए और यह कार्ड इंद्रधनुष मोड बन जाएगा — पूरे रंगपट्ट के साथ।',

  'support.game.shareNote':
    'कार्ड सहेजें और उसे अपनी पोस्ट में जोड़ें — इनमें से कोई भी नेटवर्क लिंक से तस्वीर नहीं निकाल सकता।',

  'support.game.shareSave': 'कार्ड सहेजें',

  'support.game.shareCopyCard': 'कार्ड कॉपी करें',

  'support.game.shareCardCopied': 'कॉपी हुआ — चिपका दें',

  'support.game.shareCopy': 'टेक्स्ट कॉपी करें',

  'support.game.shareCopied': 'कॉपी हो गया',

  'support.game.shareLinkOnly':
    'केवल लिंक साझा होता है — टेक्स्ट स्वयं चिपकाएँ',

  'support.game.euphoria': 'इंद्रधनुष मोड',

  'support.game.euphoriaToggle': 'इंद्रधनुष मोड चालू या बंद करें',

  'support.game.perfect': 'बिलकुल सही',

  'support.game.great': 'शानदार',

  'support.game.good': 'अच्छा',

  'support.game.miss': 'चूक गए',
  'support.title': 'इस काम का साथ दें',
  'support.close': 'बंद करें',
  'support.pitch':
    'FluidEQ मुफ़्त और ओपन सोर्स है, और आगे भी रहेगा: सोर्स सार्वजनिक है, आप इसे हमेशा खुद बिना कुछ चुकाए बना सकते हैं, और यहाँ कुछ भी ट्रैक नहीं किया जाता। बेचा जाता है वह साइन किया हुआ, चलने को तैयार बिल्ड। अगर इसने आपके सेटअप में जगह बनाई है, तो एक योगदान उस समय को सहारा देता है जो इसे बनाए रखता है, और उन अगले विचारों को जो इसी कार्यशाला से निकलते हैं।',
  'support.craft':
    'यह एक ही व्यक्ति का काम है, बहुत सारे प्यार और हद से ज़्यादा बारीक़ी के साथ बनाया गया। हर पैनल हाथ से बनाया और बार-बार सोचा-समझा गया है: ग्राफ़ एक नज़र में कैसा पढ़ा जाता है, मेन्यू कैसे खुलता है, नॉब धीरे घुमाने पर क्या करता है, बटन पर कौन से शब्द जाएँ। यहाँ कुछ भी बना-बनाया कंपोनेंट नहीं है जिस पर बस रंग चढ़ा दिया गया हो।',
  'support.card': 'कार्ड या वॉलेट',
  'support.card.hint':
    'Stripe पर सुरक्षित भुगतान। आपके ब्राउज़र में खुलेगा — ऐप आपके कार्ड की जानकारी कभी नहीं देखता।',
  'support.coffee': 'मुझे एक कॉफ़ी पिलाइए',
  'support.coffee.hint':
    'एक बार की मदद, खाता बनाने की ज़रूरत नहीं। ब्राउज़र में खोलने के लिए क्लिक करें, या फ़ोन से कोड स्कैन करें।',
  'support.verify': 'भेजने से पहले पता जाँच लें।',
  'support.copy': 'पता कॉपी करें',
  'support.copied': 'कॉपी हो गया',
  'support.openWallet': 'वॉलेट में खोलें',
  'support.contributed': 'मैंने योगदान दिया — सितारा और नाच खोलें',
  'support.thanks': 'धन्यवाद — आपके साथी को सितारा मिल गया, और अब वह नाचता है।',
  'support.releaseNotes': 'इस संस्करण में क्या नया है, देखें',
  'support.footerBefore':
    'समय देकर मदद करना चाहेंगे? Issue और pull request भी उतने ही स्वागत योग्य हैं:',

  'disclaimer.heading': 'कोई वारंटी नहीं, कोई ज़िम्मेदारी नहीं',
  'disclaimer.asIs':
    'FluidEQ जैसा है वैसा दिया जाता है, बिना किसी तरह की वारंटी के। कोई यह वादा नहीं करता कि यह काम करेगा, आपके काम के लिए ठीक रहेगा, या आगे भी चलता रहेगा। GNU General Public License की धारा 15 और 16 यही कहती हैं, और यह तब भी लागू है जब यह प्रति आपको मुफ़्त मिली हो और तब भी जब आपने इसके पैसे दिए हों।',
  'disclaimer.liability':
    'FluidEQ आपके कंप्यूटर पर ऑडियो के प्रोसेस होने का तरीका बदलता है, और Equalizer APO को इंस्टॉल करके चलाता है — वह एक अलग प्रोग्राम है जो एडमिनिस्ट्रेटर अधिकारों के साथ चलता है और Windows के ऑडियो रास्ते में बैठता है। कानून जितनी छूट देता है उस पूरी सीमा तक, {author} इसके इस्तेमाल से हुए किसी नुकसान के लिए ज़िम्मेदार नहीं है — आपकी सुनने की क्षमता, स्पीकर, हेडफ़ोन या दूसरे उपकरण, डेटा या दूसरे सॉफ़्टवेयर, या और कुछ भी, उन नुकसानों समेत जिनका आप अंदाज़ा नहीं लगा सकते थे।',
  'disclaimer.volume':
    'आवाज़ तेज़ हो सकती है, और इक्वलाइज़ेशन उसे मूल रिकॉर्डिंग से भी तेज़ कर सकता है। कोई सेटिंग बदलने से पहले वॉल्यूम कम कर लें, और बाद में बढ़ा लें।',
  'disclaimer.localLaw':
    'कुछ देशों में विक्रेता को कुछ वारंटी या ज़िम्मेदारियाँ हटाने की इजाज़त नहीं है। जहाँ ऐसा है, वहाँ वही नियम लागू होंगे, और यह सूचना आपसे वे अधिकार नहीं छीनती जो कानून आपको देता है।',
  'disclaimer.accepting':
    'FluidEQ का इस्तेमाल करके आप ऊपर लिखी बातें स्वीकार करते हैं।',
  'disclaimer.language':
    'यह सूचना अंग्रेज़ी में लिखी गई थी। अगर अनुवाद अंग्रेज़ी पाठ से अलग हो, तो अंग्रेज़ी पाठ ही लागू होगा।',
  'disclaimer.accept': 'मैं समझता/समझती हूँ और स्वीकार करता/करती हूँ',
  'disclaimer.decline': 'बंद करें',

  'language.title': 'भाषा',
  'language.aria': 'इंटरफ़ेस की भाषा',
  'waveform.style': 'मीटर की शैली बदलें',
};

export default hi;
