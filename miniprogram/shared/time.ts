/** 时间与周期工具：服务端以自身时区（UTC+8）决定 dayBucket / weekKey，不信任客户端。 */

const CN_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function cnDate(ts: number): Date {
  return new Date(ts + CN_OFFSET);
}

const pad2 = (v: number): string => String(v).padStart(2, '0');

/** 自然日 key（UTC+8），用于每日限频 */
export function dayKey(ts: number = Date.now()): string {
  const d = cnDate(ts);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** ISO 周 key（UTC+8），用于每周补给 */
export function weekKey(ts: number = Date.now()): string {
  const d = cnDate(ts);
  const day = (d.getUTCDay() + 6) % 7; // 周一 = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY));
  return `${thursday.getUTCFullYear()}-W${pad2(week)}`;
}

export function weekStart(ts: number = Date.now()): number {
  const d = cnDate(ts);
  const day = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY;
  return start - CN_OFFSET;
}

export function isoAt(now: number, hoursAgo: number): string {
  return new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
}

export function addDays(ts: number, days: number): string {
  return new Date(ts + days * DAY).toISOString();
}

/** 相对时间：刚刚 / 3 小时前 / 昨天 / 11-18 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = now - ts;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  const d = cnDate(ts);
  const today = cnDate(now);
  const sameDay =
    d.getUTCFullYear() === today.getUTCFullYear() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCDate() === today.getUTCDate();
  if (sameDay) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  const yesterday = cnDate(now - DAY);
  const isYesterday =
    d.getUTCFullYear() === yesterday.getUTCFullYear() &&
    d.getUTCMonth() === yesterday.getUTCMonth() &&
    d.getUTCDate() === yesterday.getUTCDate();
  if (isYesterday) return `昨天 ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  if (diff < 7 * DAY) {
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getUTCDay()];
    return `${week} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export function formatDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const d = cnDate(ts);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function isThisWeek(iso: string, now: number = Date.now()): boolean {
  return weekKey(Date.parse(iso)) === weekKey(now);
}

/** 稳定字符串哈希（用于免重复的随机补给挑选，避免依赖客户端随机数） */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
