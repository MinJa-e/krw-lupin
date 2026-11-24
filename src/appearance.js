const STORAGE_KEY = 'krw-lupin-appearance';

export const APPEARANCE_PARTS = ['skin', 'hair', 'shirt', 'pants', 'shoes'];

export const DEFAULT_APPEARANCE = {
  skin: '#ffd0ad',
  hair: '#493126',
  shirt: '#ffffff',
  pants: '#303d59',
  shoes: '#f4f1e9'
};

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeAppearance(raw) {
  const appearance = {};

  for (const part of APPEARANCE_PARTS) {
    if (isHexColor(raw?.[part])) {
      appearance[part] = raw[part];
    }
  }

  return appearance;
}

/** localStorage에서 꾸미기 상태를 불러온다. 손상 시 기본값. */
export function loadAppearance() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return { ...DEFAULT_APPEARANCE };

    return { ...DEFAULT_APPEARANCE, ...normalizeAppearance(JSON.parse(raw)) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/** 꾸미기 상태를 localStorage에 저장한다. 실패해도 치명적이지 않다. */
export function saveAppearance(appearance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAppearance(appearance)));
  } catch {
    // 사파이어 프라이빗 모드 등 저장 불가 환경에서도 게임은 계속된다
  }
}

/**
 * 아바타 모델을 순회하며 공유 템플릿 재질을 부위별 클론으로 교체하고 색을 입힌다.
 * baseMaterialToPart: 템플릿 공유 재질 → 부위 이름 매핑 (main.js에서 생성)
 * 한 번 클론한 메시는 userData.appearancePart로 부위를 기억해 재적용이 가능하다.
 */
export function applyAppearanceToModel(model, appearance, baseMaterialToPart) {
  if (!model?.isObject3D) return false;

  let applied = false;

  model.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;

    let part = obj.userData.appearancePart;

    if (!part) {
      part = baseMaterialToPart.get(obj.material);
      if (!part) return;
      obj.userData.appearancePart = part;
      obj.material = obj.material.clone();
    }

    const color = appearance[part];

    if (color) {
      obj.material.color.set(color);
      applied = true;
    }
  });

  return applied;
}
