/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const termsNotice = {
  'termsNotice.title': '條款已更改',
  'termsNotice.read': '閱讀條款',
  'termsNotice.gotIt': '明白了',
  'termsNotice.change.2':
    '由於付款服務 Buy Me a Coffee 的要求，建立帳戶的最低年齡已從 16 歲提高至 18 歲。',
  'termsNotice.change.3':
    '您在工作室中製作的場景始終屬於您自己：透過檔案共享一個場景可以讓其他成員播放，按讚即可為您贏得排行榜積分。',
  'termsNotice.change.4':
    '視覺化工具，新的相簿：您在其中發布的場景會向 Plus 會員顯示，直到您取消釋出為止，並且條款列出了瀏覽、新增和報告傳送的內容。',
  'termsNotice.change.5':
    'Plus 現在可以按年付費，也可以按月付費，並且會員資格會在您付費的任何期限結束時續訂。現在，任何登入的人都可以看到您在視覺化工具中發布的場景，他們可以觀看該場景播放幾秒鐘；只有 Plus 會員才能完整播放並新增它。 Plus 一次最多可在 5 臺電腦上執行，排行榜會匯總電腦的聆聽情況，而不會讓時間過得比時鐘快。',
  'termsNotice.change.6':
    '這些條款現在還涵蓋免費帳戶可以嘗試的內容 - FluidEQ 的示例場景，而不是會員場景 - 報告和刪除、共享限制、對 FluidEQ 場景副本的檢查、版本說明、Plus 的禮物以及 FluidEQ 連線的所有其他位置。',
  'termsNotice.change.7':
    '排行榜現在僅對具有 Plus 的帳戶進行排名，報告問題還可以向 FluidEQ 的製造者開啟私人電子郵件。',
  'termsNotice.change.8':
    '十四天的退款被撤回。取消後，Plus 仍可在您付費的期限結束前繼續使用，且不再收取任何費用。',
  'termsNotice.change.9':
    '現在，FluidEQ 的製作者會在其他人看到之前閱讀 Visualizers 中發布的每個場景。 Plus 可以無需付款即可到達：新帳戶可以免費試用一次，並且透過批准的場景可以賺取一個月的時間。兩者都不會續訂，也不會收取任何費用。',
  'termsNotice.change.10':
    'FluidEQ 還可以在應用程式中宣佈新場景。新功能還可以播放 fluideq.com 上的應用程式短片，而無需任何關於您的資訊。',
  'termsNotice.change.11':
    '現在，場景將永遠屬於您：每個場景都可從在 Stripe 上支付過一次的包中獲得一個點數，並且經過確認的帳戶可在開始時免費獲得一些點數。每個場景都可以先觀看幾秒鐘。每個帳戶的工作室和發布都是免費的，您自己的場景一旦發布就可以隨處播放。 FluidEQ還可以將自己的一些場景免費提供給大家。 Plus 會員資格不再出售：已經執行的會員資格將繼續有效，直到 FluidEQ 將其會員轉為點數，並且會員新增的場景仍屬於他們。',
} satisfies Partial<Dictionary>;

export default termsNotice;
