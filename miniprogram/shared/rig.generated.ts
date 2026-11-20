// 本文件由 scripts/build-assets.mjs 自动生成，请勿手改。
// 重新生成：npm run assets
/* eslint-disable */
export const RIG_DATA = {
  "version": "skeleton-rig-v1",
  "canvas": {
    "width": 320,
    "height": 480
  },
  "anchors": {
    "head": {
      "x": 50,
      "y": 23.5
    },
    "neck": {
      "x": 50,
      "y": 37.1
    },
    "chest": {
      "x": 50,
      "y": 48.3
    },
    "hip": {
      "x": 50,
      "y": 63.3
    },
    "hand_l": {
      "x": 76.3,
      "y": 61
    },
    "hand_r": {
      "x": 23.8,
      "y": 61
    },
    "knee_l": {
      "x": 60.6,
      "y": 77.5
    },
    "knee_r": {
      "x": 39.4,
      "y": 77.5
    },
    "foot_l": {
      "x": 61.9,
      "y": 88.3
    },
    "foot_r": {
      "x": 38.1,
      "y": 88.3
    },
    "ground": {
      "x": 50,
      "y": 92.5
    }
  },
  "hotspots": {
    "front": [
      {
        "id": "head",
        "label": "头",
        "x": 160,
        "y": 106,
        "r": 50
      },
      {
        "id": "shoulder_l",
        "label": "左肩",
        "x": 212,
        "y": 192,
        "r": 25
      },
      {
        "id": "shoulder_r",
        "label": "右肩",
        "x": 108,
        "y": 192,
        "r": 25
      },
      {
        "id": "wrist_l",
        "label": "左手腕",
        "x": 244,
        "y": 292,
        "r": 24
      },
      {
        "id": "wrist_r",
        "label": "右手腕",
        "x": 76,
        "y": 292,
        "r": 24
      },
      {
        "id": "waist",
        "label": "腰",
        "x": 160,
        "y": 258,
        "r": 23
      },
      {
        "id": "tailbone",
        "label": "尾椎",
        "x": 160,
        "y": 310,
        "r": 22
      },
      {
        "id": "knee_l",
        "label": "左膝",
        "x": 194,
        "y": 372,
        "r": 23
      },
      {
        "id": "knee_r",
        "label": "右膝",
        "x": 126,
        "y": 372,
        "r": 23
      },
      {
        "id": "ankle_l",
        "label": "左脚踝",
        "x": 198,
        "y": 416,
        "r": 21
      },
      {
        "id": "ankle_r",
        "label": "右脚踝",
        "x": 122,
        "y": 416,
        "r": 21
      }
    ],
    "back": [
      {
        "id": "head",
        "label": "头",
        "x": 160,
        "y": 106,
        "r": 50
      },
      {
        "id": "shoulder_l",
        "label": "左肩",
        "x": 212,
        "y": 192,
        "r": 25
      },
      {
        "id": "shoulder_r",
        "label": "右肩",
        "x": 108,
        "y": 192,
        "r": 25
      },
      {
        "id": "wrist_l",
        "label": "左手腕",
        "x": 244,
        "y": 292,
        "r": 24
      },
      {
        "id": "wrist_r",
        "label": "右手腕",
        "x": 76,
        "y": 292,
        "r": 24
      },
      {
        "id": "back",
        "label": "背",
        "x": 160,
        "y": 224,
        "r": 24
      },
      {
        "id": "waist",
        "label": "腰",
        "x": 160,
        "y": 278,
        "r": 22
      },
      {
        "id": "tailbone",
        "label": "尾椎",
        "x": 160,
        "y": 326,
        "r": 20
      },
      {
        "id": "knee_l",
        "label": "左膝",
        "x": 194,
        "y": 372,
        "r": 23
      },
      {
        "id": "knee_r",
        "label": "右膝",
        "x": 126,
        "y": 372,
        "r": 23
      },
      {
        "id": "ankle_l",
        "label": "左脚踝",
        "x": 198,
        "y": 416,
        "r": 21
      },
      {
        "id": "ankle_r",
        "label": "右脚踝",
        "x": 122,
        "y": 416,
        "r": 21
      }
    ]
  },
  "views": {
    "front": [
      {
        "id": "shadow",
        "z": 0,
        "bbox": {
          "x": 58,
          "y": 424,
          "w": 204,
          "h": 40
        },
        "src": "/assets/rigs/front/shadow.png"
      },
      {
        "id": "body",
        "z": 10,
        "bbox": {
          "x": 58,
          "y": 148,
          "w": 204,
          "h": 306
        },
        "src": "/assets/rigs/front/body.png"
      },
      {
        "id": "outfit",
        "z": 20,
        "bbox": {
          "x": 58,
          "y": 170,
          "w": 204,
          "h": 140
        },
        "slot": "outfit",
        "variants": {
          "ski_blue": "/assets/rigs/front/outfit/ski_blue.png",
          "suit_orange": "/assets/rigs/front/outfit/suit_orange.png",
          "vest_mint": "/assets/rigs/front/outfit/vest_mint.png"
        }
      },
      {
        "id": "hip_protector",
        "z": 24,
        "bbox": {
          "x": 116,
          "y": 280,
          "w": 88,
          "h": 62
        },
        "slot": "hip_protector",
        "variants": {
          "basic_hip_protector": "/assets/rigs/front/hip_protector/basic_hip_protector.png",
          "steel_hip_guard": "/assets/rigs/front/hip_protector/steel_hip_guard.png"
        }
      },
      {
        "id": "head",
        "z": 30,
        "bbox": {
          "x": 86,
          "y": 42,
          "w": 148,
          "h": 150
        },
        "slot": "expression",
        "variants": {
          "happy": "/assets/rigs/front/head/happy.png",
          "surprised": "/assets/rigs/front/head/surprised.png",
          "awkward": "/assets/rigs/front/head/awkward.png",
          "comfort": "/assets/rigs/front/head/comfort.png",
          "cool": "/assets/rigs/front/head/cool.png"
        }
      },
      {
        "id": "goggles",
        "z": 34,
        "bbox": {
          "x": 92,
          "y": 96,
          "w": 136,
          "h": 52
        },
        "slot": "goggles",
        "variants": {
          "snow_goggles": "/assets/rigs/front/goggles/snow_goggles.png"
        }
      },
      {
        "id": "headgear",
        "z": 40,
        "bbox": {
          "x": 86,
          "y": 10,
          "w": 148,
          "h": 100
        },
        "slot": "headgear",
        "variants": {
          "beanie_blue": "/assets/rigs/front/headgear/beanie_blue.png",
          "helmet_red": "/assets/rigs/front/headgear/helmet_red.png"
        }
      }
    ],
    "back": [
      {
        "id": "shadow",
        "z": 0,
        "bbox": {
          "x": 58,
          "y": 424,
          "w": 204,
          "h": 40
        },
        "src": "/assets/rigs/back/shadow.png"
      },
      {
        "id": "body",
        "z": 10,
        "bbox": {
          "x": 58,
          "y": 148,
          "w": 204,
          "h": 306
        },
        "src": "/assets/rigs/back/body.png"
      },
      {
        "id": "outfit",
        "z": 20,
        "bbox": {
          "x": 58,
          "y": 170,
          "w": 204,
          "h": 140
        },
        "slot": "outfit",
        "variants": {
          "ski_blue": "/assets/rigs/back/outfit/ski_blue.png",
          "suit_orange": "/assets/rigs/back/outfit/suit_orange.png",
          "vest_mint": "/assets/rigs/back/outfit/vest_mint.png"
        }
      },
      {
        "id": "hip_protector",
        "z": 24,
        "bbox": {
          "x": 116,
          "y": 280,
          "w": 88,
          "h": 62
        },
        "slot": "hip_protector",
        "variants": {
          "basic_hip_protector": "/assets/rigs/back/hip_protector/basic_hip_protector.png",
          "steel_hip_guard": "/assets/rigs/back/hip_protector/steel_hip_guard.png"
        }
      },
      {
        "id": "head",
        "z": 30,
        "bbox": {
          "x": 86,
          "y": 42,
          "w": 148,
          "h": 150
        },
        "src": "/assets/rigs/back/head.png"
      },
      {
        "id": "goggles",
        "z": 34,
        "bbox": {
          "x": 92,
          "y": 96,
          "w": 136,
          "h": 34
        },
        "slot": "goggles",
        "variants": {
          "snow_goggles": "/assets/rigs/back/goggles/snow_goggles.png"
        }
      },
      {
        "id": "headgear",
        "z": 40,
        "bbox": {
          "x": 86,
          "y": 10,
          "w": 148,
          "h": 100
        },
        "slot": "headgear",
        "variants": {
          "beanie_blue": "/assets/rigs/back/headgear/beanie_blue.png",
          "helmet_red": "/assets/rigs/back/headgear/helmet_red.png"
        }
      }
    ]
  }
} as const;
