import * as THREE from 'three';

const STONE_COLOR = 0x9a9186;
const MARKER_COLOR = 0xffd54f;
const DEFAULT_MAX_HEIGHT = 7;
const INTERACT_RADIUS = 3.2;

function createStone(material, size) {
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * 0.6, size),
    material
  );

  stone.castShadow = true;
  stone.receiveShadow = true;
  stone.rotation.y = Math.random() * Math.PI * 2;
  stone.rotation.z = (Math.random() - 0.5) * 0.15;

  return stone;
}

/**
 * 해변 돌탑 쌓기 콘텐츠.
 * 그룹 생성 / 돌 추가 / 근접 판정 / 상태 조회를 한곳에 묶어
 * 전역 스코프 오염 없이 재사용할 수 있게 한다.
 */
export function createStoneTower({
  position = { x: -10, z: -23 },
  maxHeight = DEFAULT_MAX_HEIGHT
} = {}) {
  const group = new THREE.Group();
  group.name = 'stone-tower';
  group.position.set(position.x, 0.15, position.z);

  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: STONE_COLOR,
    roughness: 0.95
  });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: MARKER_COLOR });

  // 쌓기 자리를 알리는 원형 패드
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.06, 24),
    markerMaterial
  );
  pad.position.y = 0.03;
  group.add(pad);

  // 위에서 내려다보아도 보일 수 있는 안내 마커
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.9, 12),
    markerMaterial
  );
  marker.name = 'stone-tower-marker';
  marker.rotation.x = Math.PI;
  marker.position.y = 2.6;
  group.add(marker);

  const stones = [];

  function addStone() {
    if (stones.length >= maxHeight) return false;

    const index = stones.length;
    const size = 1.1 - index * 0.08;
    const stone = createStone(stoneMaterial, size);

    stone.position.set(
      (Math.random() - 0.5) * 0.12,
      0.12 + index * 0.5,
      (Math.random() - 0.5) * 0.12
    );

    group.add(stone);
    stones.push(stone);

    return true;
  }

  function reset() {
    for (const stone of stones) {
      group.remove(stone);
      stone.geometry.dispose();
    }
    stones.length = 0;
  }

  function isNear(playerPosition) {
    if (!playerPosition) return false;

    const dx = playerPosition.x - group.position.x;
    const dz = playerPosition.z - group.position.z;

    return Math.hypot(dx, dz) <= INTERACT_RADIUS;
  }

  function update(elapsedTime) {
    marker.position.y = 2.4 + Math.sin(elapsedTime * 2) * 0.15;
    marker.rotation.y = elapsedTime * 1.2;
  }

  function getState() {
    return { height: stones.length, maxHeight };
  }

  return {
    group,
    addStone,
    reset,
    isNear,
    update,
    getState,
    maxHeight,
    interactRadius: INTERACT_RADIUS
  };
}
