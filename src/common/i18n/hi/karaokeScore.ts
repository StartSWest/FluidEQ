/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'स्कोर',
  'karaoke.score.verdictPerfect': 'परफ़ेक्ट',
  'karaoke.score.verdictGood': 'अच्छा',
  'karaoke.score.verdictLate': 'देर से',
  'karaoke.score.verdictLow': 'नीचा',
  'karaoke.score.verdictHigh': 'ऊँचा',
  'karaoke.score.verdictMissed': 'छूटा',
  'karaoke.score.verdictSkipped': 'अंक नहीं',
  'karaoke.score.octaveMark': '{verdict} · 8va',
  'karaoke.score.ratingExcellent': 'उत्कृष्ट',
  'karaoke.score.ratingGreat': 'बहुत अच्छा',
  'karaoke.score.ratingGood': 'अच्छा',
  'karaoke.score.ratingFair': 'ठीक-ठाक',
  'karaoke.score.ratingPractice': 'अभ्यास करें',
  'karaoke.score.lineNumber': 'पंक्ति {number}',
  'karaoke.score.lineWithText': '{line}, “{text}”',
  'karaoke.score.practiseLine': '{line}: फिर से गाएं',
  'karaoke.score.outOf': '{max} में से',
  'karaoke.score.streak': 'लगातार',
  'karaoke.score.openReport': 'परिणाम देखें',
  'karaoke.score.close': 'परिणाम बंद करें',
  'karaoke.score.recapTitle': 'सारांश',
  'karaoke.score.bestFirst': 'इस गाने पर आपका पहला स्कोर',
  'karaoke.score.bestNew': 'नया रिकॉर्ड · +{delta}',
  'karaoke.score.bestTied': 'आपके रिकॉर्ड के बराबर',
  'karaoke.score.bestBehind': 'आपके रिकॉर्ड से {delta} कम',
  'karaoke.score.inTune': 'सुर',
  'karaoke.score.inTuneNote': 'नोट के भीतर गाए गए समय का हिस्सा',
  'karaoke.score.onTime': 'समय पर',
  'karaoke.score.onTimeNote': '{total} में से {count} नोट समय पर शुरू हुए',
  'karaoke.score.notes': 'नोट',
  'karaoke.score.notesNote': 'सही',
  'karaoke.score.hardestTitle': 'सबसे कठिन हिस्सा',
  'karaoke.score.hardestLow': '{line}: आप लगभग {cents} सेंट नीचे रहे।',
  'karaoke.score.hardestHigh': '{line}: आप लगभग {cents} सेंट ऊपर रहे।',
  'karaoke.score.hardestLate': '{line}: आपने इसके नोट देर से शुरू किए।',
  'karaoke.score.hardestMissed': '{line}: इसके कुछ नोट गाए नहीं गए।',
  'karaoke.score.hardestLowest': '{line} का स्कोर सबसे कम रहा, {percent}।',
  'karaoke.score.tipTitle': 'अगली बार के लिए',
  'karaoke.score.tipLow':
    'गाने से पहले नोट को थोड़ा ऊँचा सोचें, और अंत तक साँस बनाए रखें ताकि वह नीचे न गिरे।',
  'karaoke.score.tipHigh':
    'गले को ढीला छोड़ें और थोड़ा धीमे गाएँ: ज़ोर लगाकर ऊँची आवाज़ निकालना ही नोट को ऊपर ले जाता है।',
  'karaoke.score.tipLate':
    'पंक्ति के पहले शब्द पर नहीं, उससे पहले साँस लें, ताकि पहला नोट ताल पर शुरू हो।',
  'karaoke.score.tipMissed':
    'छूटी हुई पंक्तियों के बोल याद करें और पूरी आवाज़ में गाने से पहले रिकॉर्डिंग के साथ धीरे-धीरे गाएँ।',
  'karaoke.score.tipOctave':
    'आपने काफ़ी हिस्सा एक सप्तक के अंतर पर गाया, और वह भी गिना जाता है। रिकॉर्डिंग से मिलाने के लिए कुछ पंक्तियाँ उसी के सप्तक में गाकर देखें।',
  'karaoke.score.tipClean':
    'शुरू से अंत तक साफ़ गायन। कोई कठिन गाना आज़माएँ, या यही गाना मेलोडी टोन बंद करके।',
  'karaoke.score.practisePassage': 'वह हिस्सा अभ्यास करें',
  'karaoke.score.singAgain': 'फिर से गाएं',
  'karaoke.score.mapTitle': 'गाने का नक्शा',
  'karaoke.score.mapSummary': '{points} अंक · {inTune} सुर में',
  'karaoke.score.mapCanvas': 'गाने का हर नोट उसके परिणाम के रंग में',
  'karaoke.score.deltaTitle': 'आपके सबसे अच्छे प्रयास की तुलना में',
  'karaoke.score.historyTitle': 'आपके पिछले प्रयास',
  'karaoke.score.historyNow': 'अभी',
  'karaoke.score.historyBest': 'सबसे अच्छा',
  'karaoke.score.progressTitle': 'आपकी प्रगति',
  'karaoke.score.progressFirst':
    'इस गाने को आप पहली बार गा रहे हैं: यही स्कोर अब पार करना है।',
  'karaoke.score.progressSame':
    'हर पंक्ति वहीं रही जहाँ आपके सबसे अच्छे प्रयास में थी।',
  'karaoke.score.progressUp':
    'सबसे अच्छे प्रयास के बाद सबसे ज़्यादा सुधार {line} में हुआ ({delta} अंक)।',
  'karaoke.score.progressDown':
    '{line} आपके सबसे अच्छे प्रयास से पीछे रही ({delta})। इसे अकेले दो-तीन बार अभ्यास करें, फिर पूरा गाना दोबारा गाएँ।',
  'karaoke.score.progressUpDown':
    'सबसे अच्छे प्रयास के बाद सबसे ज़्यादा सुधार {up} में हुआ ({delta} अंक)। {down} पीछे रही: इसे अकेले दो-तीन बार अभ्यास करें, फिर पूरा गाना दोबारा गाएँ।',
};

export default karaokeScore;
