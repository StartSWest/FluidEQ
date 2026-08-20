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

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.edit': 'रूप संपादित करें',
  'look.create': 'रूप बनाएँ',
  'look.new': 'नया रूप',
  'look.close': 'रूप संपादक बंद करें',
  'look.closeHint': 'बिना सहेजे बंद करें (Esc)',
  'look.pickForm': 'ऊपर चयनक से आकार चुनें या Space दबाएँ।',
  'look.colourBy': 'रंग का आधार',
  'look.palette.cycle': 'रंग-योजना',
  'look.palette.flat': 'एक रंग',
  'look.palette.flatHint': 'पूरी आकृति के लिए एक रंग',
  'look.palette.frequency': 'आवृत्ति',
  'look.palette.frequencyHint':
    'रंग अक्ष पर चलता है और हर पट्टी की स्थिति दिखाता है।',
  'look.palette.level': 'स्तर',
  'look.palette.levelHint':
    'रंग अक्ष पर ऊपर जाता है और हर पट्टी की तीव्रता दिखाता है।',
  'look.palette.heat': 'ताप',
  'look.palette.heatHint': 'रंग तेज़ी के साथ बदलता है, ठंडे से लाल तक।',
  'look.colours': 'रंग',
  'look.colourValue': 'रंग {number}: {colour}',
  'look.removeColour': 'रंग {number} हटाएँ',
  'look.custom': 'कस्टम',
  'look.customColour': 'कोई दूसरा रंग',
  'look.reset': 'रीसेट',
  'look.addColour': 'रंग जोड़ें',
  'look.addColourHint': 'ग्रेडिएंट के अंत में रंग जोड़ें',
  'look.pieces': 'खंड',
  'look.continuous': 'यह आकार एक लगातार आकृति के रूप में बनता है',
  'look.attack': 'अटैक',
  'look.release': 'रिलीज़',
  'look.releaseHint': 'गिरने से पहले पीक कितनी देर ठहरे',
  'look.drawnAs': 'चित्रण',
  'look.filled': 'भरा हुआ',
  'look.stroked': 'रेखांकित',
  'look.fill': 'भराव',
  'look.weight': 'मोटाई',
  'look.rainbow': 'रेनबो',
  'look.glow': 'चमक',
  'look.off': 'बंद',
  'look.glowHint': 'बीट पर आकृति कितनी फैलती और चमकती है।',
  'look.glowNeedsRainbow':
    'रेनबो मोड चाहिए। बंद होने पर चमक चित्र को नहीं बदलती।',
  'look.needsRainbow': 'रेनबो मोड चाहिए।',
  'look.rainbowBorder': 'रेनबो बॉर्डर',
  'look.rainbowBorderHint':
    'पूरे रंग चक्र में घूमते रंग से ग्राफ़ को घेरता है।',
  'look.borderWeight': 'बॉर्डर की मोटाई',
  'look.litPeaks': 'चमकते पीक',
  'look.litPeakWeight': 'शिखर की मोटाई',
  'look.noLitPeaks': 'इस आकार में चमकने वाले सिरे नहीं हैं',
  'look.name': 'नाम',
  'look.resetAll': 'सभी सेटिंग रीसेट करें',
  'look.resetAllHint': 'इस आकार की मूल सेटिंग वापस लाएँ',
  'look.export': 'इस रूप को फ़ाइल में निर्यात करें',
  'look.exportHint': 'साझा करने योग्य फ़ाइल में इस रूप को सहेजें',
  'look.import': 'फ़ाइल से रूप आयात करें',
  'look.delete': 'यह रूप हटाएँ',
  'look.save': 'सहेजें',
  'look.saveHint': 'इस रूप को सहेजकर चुनें',
  'look.full': 'सूची भर गई है — जगह बनाने के लिए कोई रूप हटाएँ',
  'look.error.emptyFile': 'इस फ़ाइल में कोई रूप नहीं मिला।',
  'look.error.readFile': 'FluidEQ इस रूप फ़ाइल को पढ़ नहीं सका।',
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
};

export default look;
