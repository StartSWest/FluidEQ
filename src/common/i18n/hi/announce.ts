/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const announce = {
  'announce.eyebrow': 'विज़ुअलाइज़र में नया · {count} सीन',
  'announce.try': 'अभी आज़माएँ',
  'announce.later': 'बाद में',
  'announce.previewNote': 'पूर्वावलोकन। न कुछ भेजा गया, न कुछ दर्ज किया गया।',
  'announce.untitled': 'नए सीन',
  'announce.tab': 'घोषणाएँ',
  'announce.pageHint':
    'हर व्यक्ति एक घोषणा एक बार देखता है, बड़े आकार में, जो कुछ भी उसने खोल रखा हो उसके ऊपर। जिन सदस्यों का ट्रायल दो दिन के भीतर ख़त्म होता है, उन्हें सदस्यता रखने के बारे में एक पंक्ति भी दिखती है।',
  'announce.field.title': 'शीर्षक',
  'announce.field.titlePlaceholder': 'उदाहरण के लिए: नाइट ड्राइव',
  'announce.field.body': 'यह क्या है',
  'announce.field.bodyPlaceholder':
    'उदाहरण के लिए: रात के शहर के छह नए सीन, जो आपके बास और ट्रेबल के साथ हिलते हैं।',
  'announce.field.scenes':
    'इसमें सीन: {most} में से {count}। पहला सीन बड़ा फ़्रेम है।',
  'announce.field.noScenes':
    'FluidEQ के सीन अभी लोड नहीं हुए हैं। एक बार विज़ुअलाइज़र खोलें, फिर वापस आएँ।',
  'announce.field.when': 'कब जाएगी',
  'announce.field.audience': 'कौन देखेगा',
  'announce.audience.everyone': 'साइन इन किए सभी लोग',
  'announce.audience.everyoneLine':
    'सदस्य, ट्रायल और मुफ़्त खाते। मुफ़्त खातों को सीन आज़माने के लिए विज़ुअलाइज़र में भेजा जाता है।',
  'announce.audience.members': 'सदस्य और ट्रायल',
  'announce.audience.membersLine': 'वे सभी जो अभी सीन चला सकते हैं।',
  'announce.audience.trialEnding':
    'सिर्फ़ 2 दिन के भीतर ख़त्म होने वाले ट्रायल',
  'announce.audience.trialEndingLine':
    'वे सदस्य जो जल्द तय करने वाले हैं कि भुगतान करें या नहीं।',
  'announce.trials.dayAfter':
    'अगले दिन, {date} को, {count} ट्रायल ख़त्म होते हैं।',
  'announce.trials.twoAfter': 'उसके अगले दिन {count} और।',
  'announce.preview': 'पूर्वावलोकन',
  'announce.schedule': 'शेड्यूल करें',
  'announce.saveChanges': 'बदलाव सहेजें',
  'announce.stopEditing': 'संपादन बंद करें',
  'announce.done': 'शेड्यूल हो गई। यह {date} को जाएगी।',
  'announce.listTitle': 'शेड्यूल की गई और दिख रही',
  'announce.listEmpty': 'कुछ भी शेड्यूल नहीं है।',
  'announce.state.out': 'दिख रही है',
  'announce.state.later': 'शेड्यूल की गई',
  'announce.edit': 'संपादित करें',
  'announce.cancel': 'इसे रद्द करें',
  'announce.cancelAsk': 'यह घोषणा रद्द करें?',
  'announce.cancelOut':
    'जिन्होंने इसे अभी तक नहीं देखा, उन्हें दिखाना बंद करें?',
  'announce.keep': 'इसे रखें',
} as const;

export default announce;
