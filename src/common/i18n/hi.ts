/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  'app.dismiss': 'हटाएँ',

  'tabs.aria': 'साउंड वर्कस्पेस',
  'tabs.eq': 'EQ और ड्राइवर प्रकार',
  'tabs.voicing': 'ध्वनि रंग',
  'tabs.convolution': 'कन्वॉल्यूशन',
  'tabs.video': 'वीडियो',

  'video.sites': 'वीडियो साइटें',
  'video.back': 'पीछे',
  'video.forward': 'आगे',
  'video.reload': 'फिर से लोड करें',
  'video.stop': 'रोकें',
  'video.searchAria': 'मौजूदा साइट पर खोजें',
  'video.searchPlaceholder': 'चलाने के लिए कुछ खोजें',
  'video.adBlock': 'विज्ञापन ब्लॉक करें',
  'video.adBlockHint':
    'YouTube पर वीडियो विज्ञापन छोड़ता है और विज्ञापन की जगह छिपाता है।',
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
  'autoeq.allDatabases.hint':
    'AutoEq आधिकारिक और GadgetryTech दोनों में एक साथ खोजें।',
  'autoeq.pickDevice': 'पहले कोई मॉडल चुनें 🎧',
  'autoeq.noResponses': 'कोई समर्थित माप नहीं 😞',
  'autoeq.pickResponse': 'कोई माप चुनें! 🔊',
  'autoeq.selectSourcePlaceholder': 'स्रोत चुनें…',
  'autoeq.searchSources': 'स्रोत खोजें…',
  'autoeq.noModel': 'आपकी खोज से मेल खाता कोई मापा हुआ मॉडल नहीं है।',
  'autoeq.searchModels': 'ब्रांड या मॉडल से खोजें…',
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
  'eq.smart.fromFlat': 'शून्य से',
  'eq.layers': 'यह भी लागू है',
  'eq.layers.aria': 'इस आउटपुट पर और क्या असर डाल रहा है',
  'eq.layers.convolution': 'कन्वॉल्यूशन',
  'eq.layers.voicing': 'ध्वनि रंग',
  'eq.layers.driver': 'ड्राइवर',
  'eq.layers.headset': 'हेडफ़ोन',
  'eq.layers.smart': 'स्मार्ट EQ',
  'eq.layers.smart.fullRange': 'मापा गया · पूरी रेंज',
  'eq.layers.smart.range': 'मापा गया · {low} से {high} तक',
  'eq.layers.remove': '{layer} परत हटाएँ',
  'eq.layers.clearReference': 'संदर्भ मॉडल और उससे बने बैंड हटाएँ',
  'eq.layers.clearSmart':
    'मापा गया सुधार हटाएँ। आपके बैंड और संदर्भ मॉडल वैसे ही रहेंगे।',
  'eq.fromFlat': 'शून्य से',
  'eq.fromFlat.hint':
    'सुनने से पहले पिछला स्मार्ट EQ सुधार हटा देता है। जब पहले से किया गया कट ठीक उसी हिस्से को ढक रहा हो जिस पर वह असर डालता है, तब यह काम आता है — माप अपनी ही सुधार के पार नहीं देख सकता। आपके बैंड कभी नहीं छुए जाते।',
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
  'voicing.none': 'कोई नहीं',
  'voicing.none.hint': 'सिर्फ़ आपके EQ बैंड, ऊपर कुछ नहीं',
  'voicing.strength': 'मात्रा',
  'voicing.off': 'बंद',
  'voicing.full': 'पूरा',
  'voicing.inert': '0% मात्रा पर यह ध्वनि रंग कुछ नहीं करता।',
  'voicing.headroom':
    '+{peak} dB तक बढ़ाता है। “अपने आप सामान्य करें” यह जगह छोड़कर रखता है; जब तक आप प्रीएम्प खुद तय न कर रहे हों, इसे चालू रहने दें।',

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

  'support.game.shareEuphoria': 'यूफोरिया साझा करें',

  'support.game.shareTitle': 'अपना स्कोर साझा करें',

  'support.game.shareUnlock':
    '×10 तक पहुँचिए और यह कार्ड यूफोरिया मोड बन जाएगा — पूरे रंगपट्ट के साथ।',

  'support.game.shareNote':
    'कार्ड सहेजें और उसे अपनी पोस्ट में जोड़ें — इनमें से कोई भी नेटवर्क लिंक से तस्वीर नहीं निकाल सकता।',

  'support.game.shareSave': 'कार्ड सहेजें',

  'support.game.shareCopyCard': 'कार्ड कॉपी करें',

  'support.game.shareCardCopied': 'कॉपी हुआ — चिपका दें',

  'support.game.shareCopy': 'टेक्स्ट कॉपी करें',

  'support.game.shareCopied': 'कॉपी हो गया',

  'support.game.shareLinkOnly':
    'केवल लिंक साझा होता है — टेक्स्ट स्वयं चिपकाएँ',

  'support.game.euphoria': 'यूफोरिया मोड',

  'support.game.euphoriaToggle': 'यूफोरिया मोड चालू या बंद करें',

  'support.game.perfect': 'बिलकुल सही',

  'support.game.great': 'शानदार',

  'support.game.good': 'अच्छा',

  'support.game.miss': 'चूक गए',
  'support.title': 'इस काम का साथ दें',
  'support.close': 'बंद करें',
  'support.pitch':
    'FluidEQ मुफ़्त और ओपन सोर्स है, और आगे भी रहेगा — यहाँ कुछ भी पैसे की दीवार के पीछे नहीं है और कुछ भी ट्रैक नहीं होता। अगर इसने आपके सेटअप में जगह बना ली है, तो आपका योगदान इसे बनाए रखने का समय और इसी वर्कशॉप से निकलने वाले अगले विचारों को सहारा देता है।',
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

  'language.title': 'भाषा',
  'language.aria': 'इंटरफ़ेस की भाषा',
  'waveform.style': 'मीटर की शैली बदलें',
};

export default hi;
