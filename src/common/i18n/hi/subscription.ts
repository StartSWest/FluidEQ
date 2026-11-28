/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Dictionary } from '../en';

const subscription: Partial<Dictionary> = {
  'subscription.name': 'Plus',
  'subscription.get': 'Plus लें',
  'subscription.getAgain': 'Plus फिर से लें',
  'subscription.manage': 'Plus प्रबंधित करें',
  'subscription.included': 'Plus में शामिल',

  'subscription.plan.monthly': 'मासिक',
  'subscription.plan.yearly': 'वार्षिक',
  'subscription.plan.perMonth': '{price} प्रति माह',
  'subscription.plan.perYear': '{price} प्रति वर्ष',
  'subscription.plan.both': '{monthly} प्रति माह या {yearly} प्रति वर्ष',
  'subscription.plan.cancelAnytime': 'कभी भी रद्द करें।',
  'subscription.plan.monthlyEquivalent': 'यानी {price} प्रति माह।',
  'subscription.plan.save': '{percent}% बचाएँ',

  'subscription.status.grace':
    'FluidEQ सर्वर से आपके Plus की जाँच नहीं कर पाया। यह {date} तक चलता रहेगा।',
  'subscription.status.waiting':
    'Stripe के भुगतान की पुष्टि का इंतज़ार है। Plus यहाँ अपने आप चालू हो जाएगा।',

  'subscription.ways.title': 'Plus या क्रेडिट?',
  'subscription.ways.credits.each': 'एक बार में एक सीन, हर एक {credits}',
  'subscription.ways.credits.keep': 'हमेशा के लिए आपका, Plus के बिना भी',
  'subscription.ways.plus.every': 'सीन का हर सीन, नए भी',
  'subscription.ways.plus.while': 'सदस्य रहने तक',

  'subscription.scene.twoWays': 'इसे पाने के दो तरीके',
  'subscription.scene.keep.title': 'यह सीन रखें',
  'subscription.scene.keep.body':
    'हर अपडेट के साथ, हमेशा के लिए आपका। {credits}।',
  'subscription.scene.plus.title': 'Plus के साथ हर सीन',
  'subscription.scene.plus.body':
    'यह और बाकी सब, जब तक आप सदस्य हैं। {prices}।',
  'subscription.scene.member.note':
    'जब तक आपके पास Plus है, यह आपके ग्राफ़, डेस्कटॉप और लाइटों पर चलता है।',
  'subscription.scene.member.keep':
    'Plus खत्म होने के बाद भी चाहिए? इसे एक क्रेडिट से रखें, हमेशा के लिए आपका।',
  'subscription.scene.member.keepButton': 'हमेशा रखें · {credits}',

  'subscription.lapse.title': 'आपकी Plus सदस्यता समाप्त हो गई',
  'subscription.lapse.body':
    'ये सीन Plus से चलते थे, और इनके डाउनलोड इस कंप्यूटर से हटा दिए गए। हमेशा रखने के लिए किसी एक को क्रेडिट से लें, या हर सीन के लिए Plus फिर से लें।',
  'subscription.lapse.more': '+{count} और',
  'subscription.lapse.find': 'खोजें',
  'subscription.lapse.notNow': 'अभी नहीं',

  'subscription.sheet.eyebrow': 'सीन',
  'subscription.sheet.description':
    'सीन का हर सीन, FluidEQ के अपने और समुदाय के।',
  'subscription.sheet.heading': 'जब तक आपके पास Plus है, हर सीन',
  'subscription.sheet.lead':
    'ये आपके ग्राफ़, डेस्कटॉप और लाइटों पर चलते हैं, यहाँ और FluidWallpapers में, हर उस कंप्यूटर पर जहाँ आप साइन इन करते हैं।',
  'subscription.sheet.choose': 'भुगतान कैसे करें',
  'subscription.sheet.renews':
    'Plus रद्द करने तक नवीनीकृत होता रहता है। Stripe के पेज पर कभी भी रद्द करें।',
  'subscription.sheet.ends':
    'Plus समाप्त होने पर इससे चलने वाले सीन रुक जाते हैं, और उनके डाउनलोड इस कंप्यूटर से हटा दिए जाते हैं।',
  'subscription.sheet.pay': 'भुगतान पर जाएँ · {price}',
  'subscription.sheet.again': 'Stripe का पेज फिर से खोलें',
  'subscription.sheet.waiting':
    'अपने ब्राउज़र में Stripe के पेज पर पूरा करें। Plus यहाँ अपने आप चालू हो जाएगा।',
  'subscription.sheet.fine':
    'जारी रखने पर शर्तों के प्रति आपकी सहमति दर्ज होती है। भुगतान Stripe के पेज पर होता है; FluidEQ आपका कार्ड कभी नहीं देखता।',
  'subscription.sheet.notNow': 'अभी नहीं',
  'subscription.sheet.done.title': 'Plus चालू है',
  'subscription.sheet.done.body': 'अब सीन का हर सीन आपके लिए चलता है।',
  'subscription.sheet.done.see': 'सीन देखें',

  'subscription.error.termsChanged':
    'शर्तें अपडेट हो गई हैं। उन्हें पढ़ें, फिर जारी रखें।',
  'subscription.error.needsEmail':
    'पहले अपना ईमेल पता पुष्टि करें, फिर से कोशिश करें।',
  'subscription.error.needsUpdate': 'Plus लेने के लिए FluidEQ अपडेट करें।',
  'subscription.error.alreadySubscribed': 'इस खाते के पास पहले से Plus है।',
  'subscription.error.notOnSale': 'Plus अभी बिक्री पर नहीं है।',
  'subscription.error.banned': 'यह खाता अभी Plus नहीं ले सकता।',
  'subscription.error.signedOut': 'Plus लेने के लिए फिर से साइन इन करें।',
  'subscription.error.failed':
    'Stripe का पेज नहीं खुल सका। अपना कनेक्शन जाँचें और फिर से कोशिश करें।',

  'subscription.manage.opened': 'Stripe का पेज आपके ब्राउज़र में खुल गया।',
  'subscription.manage.none':
    'इस खाते के पास प्रबंधित करने के लिए कोई Plus सदस्यता नहीं है।',
  'subscription.manage.signedOut':
    'Plus प्रबंधित करने के लिए फिर से साइन इन करें।',
  'subscription.manage.failed':
    'Stripe का पेज नहीं खुल सका। अपना कनेक्शन जाँचें और फिर से कोशिश करें।',

  'subscription.cardGet': 'पाएँ',
  'subscription.makeScenes': 'FluidWallpapers में अपने सीन बनाएँ',
  'subscription.banner.title': 'Plus: गैलरी का हर सीन',
  'subscription.banner.body':
    'सब चलाएँ और जोड़ें, नए भी। FluidEQ और FluidWallpapers के लिए एक ही सदस्यता।',
  'subscription.banner.credit':
    'Plus के बिना भी कोई सीन चाहिए? उसे क्रेडिट से लें, वह हमेशा आपका रहेगा।',
  'subscription.banner.or': 'या {price}',
  'subscription.line.renews':
    'हर सीन आपके लिए · {date} को नवीनीकरण · FluidWallpapers में भी',
  'subscription.line.ends':
    '{date} तक हर सीन आपके लिए · FluidWallpapers में भी',
  'subscription.line.plain': 'हर सीन आपके लिए · FluidWallpapers में भी',
  'subscription.sheet.both':
    'FluidEQ और FluidWallpapers के लिए एक ही सदस्यता: किसी भी ऐप में लें, दोनों में चलेगी।',
  'subscription.sheet.keepOne':
    'या Plus के बिना भी सिर्फ़ {name} को हमेशा के लिए रखें:',

  'subscription.account.yours': 'गैलरी का हर सीन आपके लिए',
  'subscription.account.renews': '{date} को नवीनीकरण · FluidWallpapers में भी',
  'subscription.account.ends': '{date} को समाप्त · FluidWallpapers में भी',
  'subscription.welcome.title': 'या Plus के साथ हर सीन',
  'subscription.welcome.body':
    'सदस्य रहने तक गैलरी का हर सीन, नए भी। FluidEQ और FluidWallpapers के लिए एक ही सदस्यता।',
  'subscription.welcome.signIn': 'Plus लेने के लिए साइन इन करें',
  'subscription.renew': 'Plus नवीनीकृत करें',
  'subscription.pass.member': 'सदस्य',
  'subscription.pass.ending': 'रद्द · तब तक आपका ही',
  'subscription.chip.until': 'Plus {date} तक',
};

export default subscription;
