/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const store = {
  'store.credit.one': '{count} 點數',
  'store.credit.few': '{count} 點數',
  'store.credit.many': '{count} 點數',
  'store.credit.other': '{count} 點數',
  'store.credits.unit.one': '點數',
  'store.credits.unit.few': '點數',
  'store.credits.unit.many': '點數',
  'store.credits.unit.other': '點數',
  'store.credits.title': '點數',
  'store.credits.buyTitle': '獲得點數',
  'store.credits.lead': '一個點數永久保留一個場景。只需付款一次，不會續訂。',
  'store.credits.what':
    '每個點數都會永久保留相簿中的一個場景：在圖表、桌面和燈光上。',
  'store.credits.half':
    '一半的點數正在等待：您用付費點數獲得的下一個場景使其完整。',
  'store.credits.buy': '獲得點數',
  'store.credits.getFree': '索取免費點數',
  'store.error.offline': '無法到達 FluidEQ。檢查您的連線並重試。',
  'store.error.signedOut': '再次登入以使用您的點數。',
  'store.error.unavailable': '場景商店還沒開業。稍後再試。',
  'store.error.server': '我們這邊出了點問題。什麼也沒花；稍後再試。',
  'store.error.unconfirmed':
    '首先確認您的電子郵件地址。該程式碼位於您的收件匣中。',
  'store.error.notOnSale': '該包目前不發售。選擇另一個。',
  'store.error.noCredits': '你的點數已經用完了。',
  'store.error.alreadyOwned': '這個場景已經是你的了。',
  'store.error.gone': '這個場景已經不在畫廊了。',
  'store.error.negative': '退款使您的餘額低於零。一個包包就能把它帶回來。',
  'store.error.banned': '該帳戶無法取得場景。',
  'store.pack.each': '{price} 場景',
  'store.pack.best': '最優惠的價格',
  'store.buy.title': '永久保留 {name} 嗎？',
  'store.buy.lead':
    '它成為您的：在圖表上、您的桌面和燈光上、在您登入的每臺電腦上。',
  'store.buy.keep': '其製造商發布的每一次更新都將永遠屬於您。',
  'store.buy.balance': '您有 {credits}。之後：{after}。',
  'store.buy.final': '這無法撤消。點數將在您確認後立即使用。',
  'store.buy.buying': '得到它...',
  'store.buy.use': '使用 {credits}',
  'store.loading': '正在閱讀您的點數...',
  'store.packs.title': '你需要點數',
  'store.packs.lead':
    '每個點數都會永久保留一個場景。取得一個套裝，{name} 只需點選一下即可獲得。',
  'store.packs.negative':
    '退款收回了您已使用的點數，因此您的餘額為 {credits}。一包可以讓它回到零以上。',
  'store.packs.choose': '選擇一個包',
  'store.packs.waiting':
    '在瀏覽器中完成付款。付款完成後，您的點數就會顯示在此。',
  'store.packs.fine':
    '透過 Stripe 安全支付。一次付款；沒有任何更新。點數沒有現金價值。付款即表示您同意 FluidEQ 的條款。',
  'store.packs.arrived': '新增了 {credits}。謝謝你！',
  'store.packs.again': '再次開啟付款頁面',
  'store.packs.pay': '支付{price}',
  'store.packs.none': '目前沒有包裝出售。稍後再試。',
  'store.cancel': '取消',
  'store.done': '完成',
  'store.starter.title': '{credits} 免費啟動',
  'store.starter.body': '每個帳號一次，用於確認的電子郵件地址。',
  'store.starter.claim': '索賠 {credits}',
  'store.get': '取得·{credits}',
  'store.scene.tasted': '那是 {seconds} 的第二個味道。讓它繼續觀看，永遠。',
  'store.scene.locked': '獲取它以檢視它在您的音樂中播放。',
  'store.scene.yours': '永遠屬於你',
  'store.scene.keep': '永遠保留它',
  'store.scene.fine': '你得到的場景永遠屬於你，由你負責。沒有人可以轉售它。',
  'store.official.fine': 'FluidEQ 系列的一部分：一旦獲得，就永遠屬於您。',
  'store.like.ownersOnly': '{count} 讚。讓場景變得喜歡。',
  'store.scene.free': '所有人免費',
  'store.error.termsOutdated':
    '條款已更改。更新 FluidEQ 以在購買點數之前閱讀新版本。',
} satisfies Partial<Dictionary>;

export default store;
