/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const creator = {
  'creator.title': '創作者支出',
  'creator.badge.active': '活躍',
  'creator.badge.checking': '檢查',
  'creator.invite':
    '將場景釋出到相簿並在會員購買時獲得報酬：每筆銷售的 {share}%，由 Stripe 傳送到您的銀行。',
  'creator.unfinished': '您的 Stripe 註冊尚未完成。從上次停下的地方繼續。',
  'creator.newTerms': '建立者條款已更改。閱讀並接受它們以繼續獲得報酬。',
  'creator.checking':
    'Stripe 正在檢查您的詳細資料。通常需要幾分鐘，有時需要幾天。',
  'creator.paidLine': '到目前為止的場景 {sales}。',
  'creator.sales.one': '{count} 銷售',
  'creator.sales.few': '{count} 銷售',
  'creator.sales.many': '{count} 銷售',
  'creator.sales.other': '{count} 銷售',
  'creator.ready': '準備付款',
  'creator.held': '暫停',
  'creator.paid': '到目前為止已付款',
  'creator.paidHint':
    '每筆銷售將保留 {days} 天，以防退款。一旦 {amount} 準備就緒，創作者將每隔 {every} 天獲得報酬。',
  'creator.opened':
    'Stripe 的頁面已在您的瀏覽器中開啟。完成那裡；當您回來時，這張卡會更新。',
  'creator.setUp': '設定付款',
  'creator.finish': '完成設定',
  'creator.readTerms': '閱讀新條款',
  'creator.checkAgain': '再次檢查',
  'creator.dashboard': 'Stripe 管理面板',
  'creator.dialog.title': '為您的場景獲得報酬',
  'creator.dialog.lead':
    'Stripe 向您付款並保留您的身分、銀行和稅務詳細資料。 FluidEQ 從未見過它們。',
  'creator.dialog.step1': '選擇您所在的國家/地區並接受此處的條款。',
  'creator.dialog.step2': '在瀏覽器中註冊 Stripe 頁面。',
  'creator.dialog.step3': '返回 FluidEQ：此處顯示您的收入。',
  'creator.dialog.country': '您居住的國家/地區',
  'creator.dialog.search': '搜尋國家',
  'creator.dialog.choose': '選擇一個國家',
  'creator.dialog.countryHint':
    'Stripe 可以向美國、英國、加拿大、瑞士和歐洲經濟區的創作者付款，並且無法在以後更改。不在清單中？會員仍然可以購買您的場景，並且每銷售兩次即可獲得點數。',
  'creator.dialog.cancel': '取消',
  'creator.dialog.go': '同意並繼續使用 Stripe',
  'creator.dialog.opening': '正在開啟 Stripe…',
  'creator.terms.title': '創作者條款',
  'creator.terms.share':
    '扣除 Stripe 費用後，每次銷售場景所帶來的收入，您將獲得 {share}%。 FluidEQ 保留其餘部分。',
  'creator.terms.paidCredits':
    '只有用付費點數購買的場景才能賺錢。免費的點數和FluidEQ自己的場景，一無所獲。',
  'creator.terms.hold':
    '每筆收入都會保留 {days} 天，因此退款或爭議仍可撤銷。收到款項後撤銷的一項將從您的下一次付款中扣除。',
  'creator.terms.minimum':
    '一旦 {amount} 或更多準備就緒，FluidEQ 每 {every} 天就會向創作者付款。然後 Stripe 按照您自己的時間表將其傳送到您的銀行。',
  'creator.terms.stripe':
    'Stripe 會詢問您的身分、銀行和稅務詳細資訊，並向您顯示其自己的條款。如果 Stripe 無法再向您付款，則付款將停止。',
  'creator.terms.rights':
    '場景中的所有東西都必須是你可以出售的。場景仍在審查中，違反條款的場景可能會被刪除。',
  'creator.terms.taxes': '您所賺取的收入的稅款歸您所有，用於申報您的居住地。',
  'creator.terms.changes':
    '這些條款可能會發生變化。應用程式會告訴您，並要求您在再次付款之前接受新的。',
  'creator.error.signedOut': '再次登入以管理您的付款。',
  'creator.error.unconfirmed':
    '首先確認您的電子郵件地址。該程式碼位於您的收件匣中。',
  'creator.error.offline': '無法到達 FluidEQ。檢查您的連線並重試。',
  'creator.error.unavailable': '創作者付款尚未開放。稍後再試。',
  'creator.error.agreementOutdated': '建立者條款已更改。再次閱讀並接受。',
  'creator.error.country': 'Stripe 目前還無法向該國的創作者付款。',
  'creator.error.banned': '此帳戶無法支付場景費用。',
  'creator.error.server': '我們這邊出了點問題。一切都沒有改變；稍後再試。',
} satisfies Partial<Dictionary>;

export default creator;
