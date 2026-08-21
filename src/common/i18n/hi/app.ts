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

/** The shell around everything: menus, tabs, updates, config, notices. */
import { Dictionary } from '../en';

const app: Partial<Dictionary> = {
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
  'app.menu.fix': 'ठीक करें',
  'app.menu.reportProblem': 'समस्या रिपोर्ट करें',
  'app.menu.about': '{product} के बारे में…',
  'app.menu.reinstallApp': '{product} फिर स्थापित करें…',
  'app.menu.fixAudio': 'ऑडियो समस्याएँ ठीक करें…',
  'app.menu.reinstallApo': 'Equalizer APO फिर स्थापित करें…',
  'whatsNew.eyebrow': 'रिलीज़ नोट्स',
  'whatsNew.title': 'FluidEQ में नया क्या है',
  'whatsNew.loading': 'रिलीज़ नोट्स लोड हो रहे हैं…',
  'whatsNew.missing':
    'इस बिल्ड में रिलीज़ नोट्स नहीं मिले। ये GitHub पर भी हैं।',
  'whatsNew.ok': 'ठीक है',
  'app.menu.whatsNew': 'नया क्या है',
  'app.menu.language': 'भाषा',
  'app.window.minimize': 'छोटा करें',
  'app.window.maximize': 'बड़ा करें',
  'app.window.restore': 'पहले जैसा करें',
  'app.window.close': 'बंद करें',
  'app.tray.open': '{product} खोलें',
  'app.tray.quit': '{product} बंद करें',
  'app.tray.tooltip': '{product} — अब भी चल रहा है',
  'app.tray.installUpdate': 'अपडेट इंस्टॉल करें और पुनः प्रारंभ करें',
  'app.tray.checkForUpdates': 'अपडेट की जाँच करें',
  'app.tray.tooltip.updateReady': '{product} — अपडेट स्थापित करने के लिए तैयार',
  'app.notification.updateReady.title': 'FluidEQ अपडेट तैयार है',
  'app.notification.updateReady.body':
    'संस्करण {version} तैयार है। FluidEQ को पुनः प्रारंभ करने के लिए क्लिक करें।',
  'app.notification.updateReady.bodyNoVersion':
    'एक अपडेट तैयार है। FluidEQ को पुनः प्रारंभ करने के लिए क्लिक करें।',
  'app.notification.upToDate.title': 'FluidEQ अद्यतित है',
  'app.notification.upToDate.body': 'आपके पास पहले से नवीनतम संस्करण है।',
  'app.notification.updateFound.title': 'FluidEQ अपडेट मिला',
  'app.notification.updateFound.body':
    'संस्करण {version} डाउनलोड हो रहा है। तैयार होने पर आपको बता दिया जाएगा।',
  'app.notification.checkFailed.title': 'अपडेट की जाँच नहीं हो सकी',
  'app.notification.checkFailed.body':
    'अपडेट सर्वर तक पहुँच नहीं बनी। FluidEQ बाद में फिर कोशिश करेगा।',
  'app.notification.installFailed.title': 'अपडेट इंस्टॉल नहीं हो सका',
  'app.notification.installFailed.body':
    'FluidEQ इंस्टॉलर चालू नहीं कर सका। FluidEQ खोलकर फिर कोशिश करने के लिए क्लिक करें।',
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
  'common.search': 'खोजें…',
  'common.recentSearches': 'हाल की खोजें',
  'common.clearRecentSearches': 'हाल की खोजें मिटाएँ',
  'common.clearSearch': 'खोज मिटाएँ',
  'common.filterOptions': 'विकल्प छाँटें',
  'common.increase': '{item} बढ़ाएँ',
  'common.decrease': '{item} घटाएँ',
  'common.icon.edit': 'संपादित करें',
  'common.icon.delete': 'मिटाएँ',
  'common.icon.trash': 'हटाएँ',
  'common.icon.accept': 'स्वीकार करें',
  'common.icon.cancel': 'रद्द करें',
  'tabs.aria': 'साउंड वर्कस्पेस',
  'tabs.eq': 'EQ',
  'tabs.eqMain': 'बैंड',
  'tabs.presets': 'EQ प्रीसेट',
  'tabs.voicing': 'ध्वनि रंग',
  'tabs.convolution': 'कन्वॉल्यूशन',
  'tabs.config': 'Config',
  'tabs.media': 'मीडिया',
  'tabs.karaoke': 'कराओके',
  'tabs.scrollBack': 'टैब पीछे स्क्रॉल करें',
  'tabs.scrollForward': 'टैब आगे स्क्रॉल करें',
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
  'provenance.heading': 'जाँचें कि यह प्रति कहाँ से आई है',
  'provenance.body':
    'FluidEQ का आधिकारिक हस्ताक्षरित इंस्टॉलर केवल fluideq.com के माध्यम से दिया जाता है। स्रोत से बने बिल्ड आधिकारिक रिपॉज़िटरी से आने चाहिए। GPL तीसरे पक्षों को FluidEQ की नकल करने, उसे बदलने, दोबारा बनाने और बेचने की अनुमति देता है, पर उनके बिल्ड स्वतः FluidEQ द्वारा हस्ताक्षरित, समीक्षित, समर्थित या अनुमोदित नहीं होते। यदि कोई डाउनलोड स्वयं को आधिकारिक बताता है और उसमें वैध Windows डिजिटल हस्ताक्षर नहीं है, तो उसे बंद करें और उसकी सूचना दें।',
  'provenance.site': 'आधिकारिक साइट: fluideq.com',
  'provenance.repository': 'आधिकारिक स्रोत: github.com/StartSWest/FluidEQ',
  'language.title': 'भाषा',
  'language.aria': 'इंटरफ़ेस की भाषा',
};

export default app;
