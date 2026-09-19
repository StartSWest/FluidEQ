/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const review = {
  'review.tab': '待审核',
  'review.tabCount': '等待审核：{count}',
  'review.badge': '等你处理：{count}',
  'review.hint':
    '会员发布的每个场景，以及每个场景的新版本，都会在这里等你审核通过。在此之前，其他人都看不到。',
  'review.empty.title': '没有待审核的内容',
  'review.empty.hint': '会员发布新场景或新版本时，会出现在这里。',
  'review.kind.new': '新场景',
  'review.kind.update': '更新 · v{from} → v{to}',
  'review.sent': '提交于 {date}',
  'review.open': '审核',
  'review.back': '全部待审核',
  'review.flag.takenDown': '已从图库下架',
  'review.flag.takenDownHint':
    '已从图库下架：请先在“被举报”中恢复，才能通过新版本',
  'review.flag.reports': '对当前发布版本的未处理举报：{count}',
  'review.note.title': '作者说明的新内容',
  'review.note.none': '作者没有为这个版本写说明。',
  'review.sceneFailed': '无法打开这个场景进行观看。',
  'review.changed':
    '你观看时场景发生了变化：作者提交了更新的版本或撤回了它。列表显示现在等待的内容。',
  'review.approve': '通过并发布',
  'review.approving': '正在通过…',
  'review.reject': '不通过',
  'review.reject.title': '为什么不通过？',
  'review.reject.lead': '作者会收到原因，以及你写的留言（如有）。',
  'review.reject.noteLabel': '给作者的一句话（可选）',
  'review.reject.notePlaceholder': '例如：高潮处的白色闪光太强了',
  'review.reject.cancel': '返回',
  'review.reject.send': '发送答复',
  'review.reject.sending': '正在发送…',
  'review.reason.flashing': '闪光或频闪',
  'review.reason.rights': '他人的作品',
  'review.reason.offensive': '令人反感',
  'review.reason.broken': '无法运行或过于吃性能',
  'review.reason.other': '其他原因',
  'review.done.approved': '{name} 已进入图库。',
  'review.done.rejected': '{name} 未通过。作者会收到原因。',
  'review.failed': '答复没有发出。请重试。',
  'review.versionRaised': '图库中已有这个版本或更新的版本。',
  'review.takenDown':
    '它在此期间已被下架，因此不能接受新版本。请先在“被举报”中恢复。',
  'review.deleted': '它已被永久删除，因此不能接受新版本。',
  'review.filesFailed':
    '已通过，但文件未能进入图库。请再次点击“通过并发布”完成。',
  'review.forbidden': '只有 FluidEQ 管理员可以审核场景。',
  'review.fine.new':
    '通过后，它会以版本 {version} 进入图库：所有登录用户都能看到，Plus 会员可以添加。',
  'review.fine.update':
    '通过后，所有拥有这个场景的人都会从版本 {version} 更新。不通过则版本 {version} 保持不变。',
  'review.state.pending': '审核中',
  'review.state.pendingUpdate': '版本 {version} 审核中',
  'review.state.rejected': '未通过',
  'review.state.rejectedUpdate': '版本 {version} 未通过',
  'review.withdraw': '撤回',
  'review.withdrawConfirm': '从审核中撤回？',
  'review.remove': '移除',
  'review.removeConfirm': '从这个列表中移除？',
  'review.withdrawn': '已撤回 {name}。',
  'review.notice.waitingOne': '有一个场景等待你审核',
  'review.notice.waitingMany': '有 {count} 个场景等待你审核',
  'review.notice.waitingWho': '{name}，作者：{maker}',
  'review.notice.waitingNewest': '最新：{name}，作者：{maker}',
  'review.notice.later': '稍后',
  'review.notice.review': '立即审核',
  'review.notice.approved': '{name} 已进入图库',
  'review.notice.approvedBody': '已审核通过。Plus 会员现在可以添加它。',
  'review.notice.approvedUpdate': '{name} 的版本 {version} 已进入图库',
  'review.notice.approvedUpdateBody':
    '已审核通过。拥有这个场景的人都会获得新版本。',
  'review.notice.rejected': '{name} 未通过审核',
  'review.notice.rejectedUpdate': '{name} 的版本 {version} 未通过审核',
  'review.notice.keepsLive': '已拥有它的人保留版本 {version}。',
  'review.notice.gotIt': '知道了',
  'review.notice.openStudio': '打开 Studio',
  'review.notice.openMine': '你的场景',
} as const;

export default review;
