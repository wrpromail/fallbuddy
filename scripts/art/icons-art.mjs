/** 图标素材：tabBar 与道具图标（同样为原创几何图形） */
import { C } from './rig-art.mjs';

const n = (v) => (Math.round(v * 10) / 10).toString();

function stroke(color, w = 5) {
  return `stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
}

/* tabBar 81×81：skull / avatar / bell */
export function tabIcon(kind, color) {
  const body = (() => {
    switch (kind) {
      case 'atlas':
        return `
          <path d="M40.5,14 C54,14 64,24 64,37 C64,45 60,51 55,55 C53,62 47,67 40.5,67 C34,67 28,62 26,55 C21,51 17,45 17,37 C17,24 27,14 40.5,14 Z" ${stroke(color, 4.6)} fill="${color}" fill-opacity="0.12"/>
          <ellipse cx="32.5" cy="38" rx="5.4" ry="6" fill="${color}"/>
          <ellipse cx="48.5" cy="38" rx="5.4" ry="6" fill="${color}"/>
          <path d="M36,52 L45,52 M40.5,48 L40.5,56" ${stroke(color, 3.6)}/>
        `;
      case 'avatar':
        return `
          <circle cx="40.5" cy="30" r="14" ${stroke(color, 4.6)} fill="${color}" fill-opacity="0.12"/>
          <path d="M16,68 C18,55 28,48 40.5,48 C53,48 63,55 65,68" ${stroke(color, 4.6)} fill="${color}" fill-opacity="0.12"/>
          <path d="M35,30 Q40.5,34 46,30" ${stroke(color, 3.4)}/>
        `;
      default:
        return `
          <path d="M40.5,14 C41,22 48,24 54,28 C60,32 62,39 58,46 L54,52 L27,52 L23,46 C19,39 21,32 27,28 C33,24 40,22 40.5,14 Z" ${stroke(color, 4.6)} fill="${color}" fill-opacity="0.12"/>
          <path d="M40.5,52 L40.5,58 M30,58 Q40.5,68 51,58" ${stroke(color, 4.6)}/>
          <path d="M27,40 L54,40" ${stroke(color, 3)} opacity="0.5"/>
        `;
    }
  })();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81" shape-rendering="geometricPrecision">${body}</svg>`;
}

/* 道具图标 96×96 */
export function itemIcon(kind) {
  const ink = C.ink;
  let body = '';
  switch (kind) {
    case 'hot_cocoa':
      body = `
        <path d="M30,38 L66,38 L62,72 C61,76 58,78 54,78 L42,78 C38,78 35,76 34,72 Z" fill="#FFF3E0" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M66,46 C76,44 80,56 68,60" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
        <path d="M34,46 L62,46 L60,56 L36,56 Z" fill="#C97B4A" stroke="${ink}" stroke-width="3"/>
        <path d="M40,30 C38,24 43,21 41,15 M52,30 C50,24 55,21 53,15" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" opacity="0.7"/>
        <circle cx="48" cy="34" r="5" fill="#FFFFFF" opacity="0.85"/>
      `;
      break;
    case 'steel_hip_guard':
      body = `
        <path d="M22,32 Q48,20 74,32 L78,58 Q48,86 18,58 Z" fill="#B9C3D4" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M30,38 Q48,30 66,38" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.6" stroke-linecap="round"/>
        <circle cx="30" cy="56" r="3.6" fill="#8A96AC" stroke="${ink}" stroke-width="2"/>
        <circle cx="66" cy="56" r="3.6" fill="#8A96AC" stroke="${ink}" stroke-width="2"/>
        <path d="M48,44 L48,66 M40,52 L56,52" stroke="${ink}" stroke-width="3" opacity="0.5"/>
      `;
      break;
    case 'comfort_patch':
      body = `
        <rect x="18" y="40" width="60" height="26" rx="9" fill="#FFE2B8" stroke="${ink}" stroke-width="4" transform="rotate(-12 48 53)"/>
        <rect x="35" y="22" width="26" height="60" rx="9" fill="#FFD3A1" stroke="${ink}" stroke-width="4" transform="rotate(-12 48 52)"/>
        <path d="M43,44 L53,44 M48,39 L48,49" stroke="${ink}" stroke-width="3" opacity="0.55" transform="rotate(-12 48 44)"/>
      `;
      break;
    case 'basic_helmet_blue':
      body = `
        <path d="M20,54 C20,34 32,22 48,22 C64,22 76,34 76,54 L70,58 C58,50 38,50 26,58 Z" fill="#4C8DFF" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M42,26 C48,40 48,50 45,56" fill="none" stroke="#FFFFFF" stroke-width="5" opacity="0.7" stroke-linecap="round"/>
        <path d="M26,58 L70,58" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
      `;
      break;
    case 'basic_hip_protector':
    default:
      body = `
        <path d="M24,30 Q48,20 72,30 L76,56 Q48,82 20,56 Z" fill="#5ED6B3" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M32,38 Q48,30 64,38" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.65" stroke-linecap="round"/>
        <path d="M28,56 L36,56 M60,56 L68,56" stroke="${ink}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
      `;
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" shape-rendering="geometricPrecision">${body}</svg>`;
}
