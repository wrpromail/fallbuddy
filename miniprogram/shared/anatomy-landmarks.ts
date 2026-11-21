import { BODY_PART_LABEL, type BodyPart } from './enums';

const LANDMARKS = {
  head: ['颅骨、下颌骨', '颞肌、咬肌'],
  shoulder: ['锁骨、肩胛骨、肱骨近端', '三角肌覆盖肩部外侧'],
  wrist: ['桡骨与尺骨远端、腕骨', '前臂肌腱跨过腕部'],
  back: ['胸椎、肋骨后段和肩胛骨', '斜方肌、背阔肌'],
  waist: ['腰椎和髂嵴', '后腰两侧为竖脊肌，侧腹可见腹外斜肌'],
  tailbone: ['尾骨位于骶骨下方', '尾骨处于臀部正中深面，浅层图展示周围软组织'],
  knee: ['髌骨在膝前方，股骨远端与胫骨近端相接', '大腿前侧股四头肌经肌腱与髌骨相连'],
  ankle: ['胫骨内踝、腓骨外踝与距骨', '跟腱位于踝后方'],
} as const;

export function landmarkLabels(parts: BodyPart[], mode: string) {
  return parts.flatMap((part) => {
    const key = part.replace(/_[lr]$/, '') as keyof typeof LANDMARKS;
    if (!Object.prototype.hasOwnProperty.call(LANDMARKS, key)) return [];
    return [BODY_PART_LABEL[part] + ' · ' + LANDMARKS[key][mode === 'muscles' ? 1 : 0]];
  });
}
