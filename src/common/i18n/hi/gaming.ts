/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'गेमिंग लैब',
  'gaming.view.games': 'गेम',
  'gaming.view.profiles': 'गेमिंग प्रोफ़ाइलें',
  'gaming.switch': 'गेम सामने होने पर बदलें',
  'gaming.switch.hint':
    'बंद होने पर आपके गेम आपकी संगीत वाली साउंड पर ही रहते हैं और कुछ भी अपने-आप नहीं बदलता।',
  'gaming.add': 'गेम जोड़ें',
  'gaming.list.show': 'गेम के नाम दिखाएँ',
  'gaming.list.hide': 'गेम के आइकन दिखाएँ',
  'gaming.list.resize': 'गेम की सूची का आकार बदलें',
  'gaming.list.count': 'आपके गेम · {count}',
  'gaming.list.from': '{profile} से',
  'gaming.list.tuned': 'ट्यून किया गया',
  'gaming.list.playing': 'चल रहा है',
  'gaming.empty.title': 'अभी कोई गेम नहीं',
  'gaming.empty.more':
    'गेम जोड़ें और उसे अपनी साउंड मिलती है, जो उसके लिए बनी गेमिंग प्रोफ़ाइल से कॉपी होती है। आप यहाँ कॉपी को ट्यून करते हैं; प्रोफ़ाइल जैसी थी वैसी ही रहती है।',
  'gaming.game.where': '{source} · {output} पर',
  'gaming.profile.label': 'गेमिंग प्रोफ़ाइल',
  'gaming.profile.kind.title': 'इस गेम के लिए',
  'gaming.profile.kind.kind': 'प्रकार के अनुसार',
  'gaming.profile.kind.yours': 'आपकी',
  'gaming.profile.kind.chain': 'DSP प्रीसेट',
  'gaming.profile.gone': 'एक प्रोफ़ाइल जो अब नहीं है',
  'gaming.profile.pickHint':
    'दूसरी प्रोफ़ाइल चुनने पर इस गेम को उसकी नई कॉपी मिलती है।',
  'gaming.save': 'प्रोफ़ाइल के रूप में सहेजें',
  'gaming.save.new': 'नई प्रोफ़ाइल के रूप में सहेजें…',
  'gaming.save.newHint':
    'यह “आपकी” में जाती है, ताकि दूसरे गेम इससे शुरू कर सकें। फिर {game} इससे शुरू होता है।',
  'gaming.save.update': '{profile} अपडेट करें',
  'gaming.save.updateHint':
    'आपकी प्रोफ़ाइल ये बदलाव ले लेती है। जो गेम इससे शुरू हुए थे, उनकी अपनी कॉपी बनी रहती है।',
  'gaming.save.reset': '{profile} पर वापस जाएँ',
  'gaming.save.resetHint':
    'इस गेम की ट्यूनिंग हटाकर प्रोफ़ाइल से फिर से शुरू करता है।',
  'gaming.save.rename': 'इस कॉपी का नाम बदलें…',
  'gaming.save.delete': 'यह कॉपी हटाएँ',
  'gaming.save.deleteHint':
    'यह गेम और उसकी ट्यूनिंग हटाता है। प्रोफ़ाइल जैसी है वैसी ही रहती है।',
  'gaming.action.unload': 'अनलोड करें',
  'gaming.action.unloadHint': 'आपकी संगीत वाली साउंड अभी वापस आती है।',
  'gaming.action.try': 'अभी आज़माएँ',
  'gaming.action.tryHint':
    '{game} की अपनी साउंड अभी चालू करता है, ताकि आप उसे सुनकर ट्यून कर सकें।',
  'gaming.status.tuned':
    'इस गेम की {profile} की कॉपी। ट्यून किया गया: {parts}। प्रोफ़ाइल ख़ुद नहीं बदली।',
  'gaming.status.tunedNamed':
    '{copy}: इस गेम की {profile} की कॉपी। ट्यून किया गया: {parts}। प्रोफ़ाइल ख़ुद नहीं बदली।',
  'gaming.status.same':
    'प्रोफ़ाइल जैसा ही। आप यहाँ जो भी बदलें, वह इसी गेम के साथ रहता है; प्रोफ़ाइल ख़ुद कभी नहीं बदलती।',
  'gaming.rail.game': 'गेम',
  'gaming.rail.sound': 'साउंड',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': 'ट्यून किया गया',
  'gaming.stage.footsteps': 'गेम फ़िल्टर',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'कर्व',
  'gaming.curve.any': 'कोई भी गेम',
  'gaming.editor.notLoaded': '{game} की अपनी साउंड नहीं चल रही',
  'gaming.editor.notLoadedMore':
    'इसे सुनने और यहीं ट्यून करने के लिए अभी आज़माएँ। आपकी संगीत वाली साउंड अनलोड करने पर या गेम बंद होने पर वापस आती है।',
  'gaming.editor.eqNote':
    'इस गेम के अपने बैंड, जो ऊपर ग्राफ़ दिखने पर उस पर बनते हैं।',
  'gaming.editor.curveNote':
    'यह गेम जो हेडफ़ोन सुधार चलाता है, आपके कर्व से या किसी हेडफ़ोन का, और उसके साथ लगा हर कर्व — हर एक का अपना × उसे हटाने के लिए।',
  'gaming.saveDialog.title': 'गेमिंग प्रोफ़ाइल के रूप में सहेजें',
  'gaming.saveDialog.hint':
    'गेमिंग प्रोफ़ाइलों की सूची में, दूसरे गेम इससे शुरू कर सकते हैं।',
  'gaming.saveDialog.placeholder': 'प्रोफ़ाइल का नाम',
  'gaming.renameDialog.title': 'इस कॉपी का नाम बदलें',
  'gaming.renameDialog.hint': 'नाम सिर्फ़ इस गेम की कॉपी को मिलता है।',
  'gaming.renameDialog.placeholder': 'कॉपी का नाम',
  'gaming.addDialog.title': 'गेम जोड़ें',
  'gaming.addDialog.intro':
    'गेम चुनें। यह एक गेमिंग प्रोफ़ाइल से शुरू होता है और इसे अपनी कॉपी मिलती है: आप इस गेम के लिए कॉपी को ट्यून करते हैं, प्रोफ़ाइल ख़ुद कभी नहीं बदलती।',
  'gaming.addDialog.running': 'अभी चल रहे',
  'gaming.addDialog.installed': 'इस PC पर मिले',
  'gaming.addDialog.startsFrom': 'शुरुआत',
  'gaming.addDialog.browse': 'यहाँ नहीं है? गेम का प्रोग्राम ढूँढें…',
  'gaming.addDialog.later':
    'आप कभी भी इसके लिए दूसरी गेमिंग प्रोफ़ाइल चुन सकते हैं।',
  'gaming.addDialog.add': '{game} जोड़ें',
  'gaming.addDialog.cancel': 'रद्द करें',
  'gaming.addDialog.loading': 'आपके गेम ढूँढे जा रहे हैं…',
  'gaming.addDialog.none':
    'आपके किसी लॉन्चर में ऐसा कोई गेम नहीं है जो यहाँ पहले से न हो। इसके बजाय गेम का प्रोग्राम ढूँढें।',
  'gaming.addDialog.close': 'बंद करें',
  'gaming.profiles.intro':
    'हर गेम को प्रोफ़ाइल की अपनी कॉपी मिलती है। आप कॉपी को ट्यून करते हैं; प्रोफ़ाइल कभी नहीं बदलती।',
  'gaming.profiles.search': 'प्रोफ़ाइल और गेम खोजें',
  'gaming.profiles.searchClear': 'खोज साफ़ करें',
  'gaming.profiles.noMatch':
    '“{query}” से मेल खाती कोई गेमिंग प्रोफ़ाइल नहीं है।',
  'gaming.profiles.filterLabel': 'दिखाएँ',
  'gaming.profiles.noCurve': 'कोई कर्व नहीं: गेम जैसा मिक्स हुआ था',
  'gaming.profiles.filter.all': 'सभी',
  'gaming.profiles.filter.yours': 'आपकी',
  'gaming.profiles.yours': 'आपकी · किसी गेम की कॉपी से सहेजी गई',
  'gaming.profiles.yoursEmpty':
    'अभी कोई नहीं। किसी गेम को ट्यून करें और उसकी साउंड यहाँ रखने के लिए “प्रोफ़ाइल के रूप में सहेजें” इस्तेमाल करें।',
  'gaming.profiles.readyGroup': 'तैयार · {group}',
  'gaming.profiles.savedFrom': '{game} की कॉपी से सहेजी गई',
  'gaming.profiles.usedBy': '{games} इससे शुरू हुआ',
  'gaming.profiles.use': 'किसी गेम के लिए इस्तेमाल करें',
  'gaming.profiles.rename': 'नाम बदलें',
  'gaming.profiles.delete': 'हटाएँ',
  'gaming.profiles.confirmDelete': 'हटाएँ? गेम अपनी कॉपी रखते हैं।',
  'gaming.profiles.keep': 'रखें',
  'gaming.profiles.renameTitle': 'गेमिंग प्रोफ़ाइल का नाम बदलें',
  'gaming.profiles.renameHint':
    'जो गेम इससे शुरू हुए, उनकी कॉपी बनी रहती है; सिर्फ़ नाम बदलता है।',
  'gaming.toast.loaded': 'गेम प्रोफ़ाइल लोड हुई',
  'gaming.toast.restored': 'संगीत प्रोफ़ाइल बहाल हुई',
  'gaming.paused.notice': 'रुका हुआ: {game} की अपनी साउंड चल रही है',
  'gaming.paused.tune': '{game} ट्यून करें',
  'gaming.paused.title': 'आपका संगीत रैक इंतज़ार कर रहा है',
  'gaming.paused.body':
    'जब तक {game} चलता है, उसकी अपनी साउंड चालू रहती है और यह रैक रुका रहता है। गेम बंद होने पर, या अभी अनलोड करने पर, यह ठीक वैसा ही लौटता है जैसा था।',
  'gaming.paused.stages': '{preset} · जो वापस आएगा',
  'gaming.paused.none': 'इसका हर चरण बंद है।',
  'gaming.profileSelect.game': '{game} · गेम साउंड',
  'gaming.preset.tuned': '{game} (कस्टम)',
  'gaming.preset.openHint':
    '{game} की अपनी साउंड लोड है। इसका प्रीसेट गेमिंग लैब में बदलें।',
  'gaming.now.hint': '{game} की अपनी साउंड चल रही है। गेम दिखाएँ।',
} as const;
