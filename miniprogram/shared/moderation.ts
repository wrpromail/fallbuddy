/** V0 本地内容检查：只做规则提示，不代替平台审核。 */

const RULES: { label: string; test: RegExp }[] = [
  { label: '手机号', test: /(?:^|\D)1[3-9]\d{9}(?:\D|$)/ },
  { label: '身份证号', test: /(?:^|\D)\d{17}[\dXx](?:\D|$)/ },
  { label: '银行卡号', test: /(?:^|\D)\d{16,19}(?:\D|$)/ },
];

export function findSensitiveInfo(text: string): string[] {
  const hits: string[] = [];
  for (const rule of RULES) {
    if (rule.test.test(text)) hits.push(rule.label);
  }
  return hits;
}

export function sensitiveWarning(text: string): string {
  const hits = findSensitiveInfo(text);
  if (!hits.length) return '';
  return `文中疑似包含${hits.join('、')}，发布前请删除。我们不会保存这类信息。`;
}
