import * as THREE from 'three';

const STONE_COLOR = 0x9a9186;
const MARKER_COLOR = 0xffd54f;
const INTERACT_RADIUS = 3.2;
const COLLAPSE_CHANCE_PER_LAYER = 0.05;
const GRAVITY = 9.8;

/**
 * n층(1-based)을 쌀 때 무너질 확률.
 * 1층은 100% 안전(0%), 2층부터 층마다 5%씩 증가, 100%를 넘지 않는다.
 */
function collapseChanceForLayer(layer) {
  return Math.min(1, COLLAPSE_CHANCE_PER_LAYER * (layer - 1));
}

function createStone(material, size) {
  const stone = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * 0.6, size),
    material
  );

  stone.castShadow = true;
  stone.receiveShadow = true;
  stone.rotation.y = Math.random() * Math.PI * 2;
  stone.rotation.z = (Math.random() - 0.5) * 0.15;
  stone.userData.size = size;

  return stone;
}

/**
 * 해변 돌탑 쌓기 콘텐츠.
 * - 돌은 제한 없이 쌓인다 (높이 제한 없음)
 * - 쌓을 때 층별로 무너질 확률이 달라진다 (1층 0%, 층마다 +5%, 최대 100%)
 * - 무너지면 돌들이 물리적으로 튕기며 떨어지는 애니메이션 후 제거된다
 */
export function createStoneTower({
  position = { x: -10, z: -23 }
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
  let falling = [];

  function addStone() {
    const index = stones.length;
    // 높이 제한 없이 쌓되, 돌 크기는 점점 줄어들고 최소 크기에서 멈춘다
    const size = Math.max(0.45, 1.1 - index * 0.08);
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

  /**
   * 탑을 무너뜨린다. 쌓인 돌 전체가 랜덤한 방향으로 튕기며 떨어지고,
   * 애니메이션이 끝나면 제거된다. 높이는 즉시 0이 된다.
   */
  function collapse() {
    for (const stone of stones) {
      falling.push({
        mesh: stone,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 3.2,
          1.5 + Math.random() * 2.5,
          (Math.random() - 0.5) * 3.2
        ),
        angVel: new THREE.Vector3(
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 7
        ),
        restY: ((stone.userData.size * 0.6) / 2) + 0.16
      });
    }

    stones.length = 0;
    return true;
  }

  function isNear(playerPosition) {
    if (!playerPosition) return false;

    const dx = playerPosition.x - group.position.x;
    const dz = playerPosition.z - group.position.z;

    return Math.hypot(dx, dz) <= INTERACT_RADIUS;
  }

  function update(delta, elapsedTime) {
    marker.position.y = 2.4 + Math.sin(elapsedTime * 2) * 0.15;
    marker.rotation.y = elapsedTime * 1.2;

    // 무너지는 돌 물리 애니메이션
    if (falling.length > 0) {
      for (let i = falling.length - 1; i >= 0; i -= 1) {
        const f = falling[i];

        f.vel.y -= GRAVITY * delta;
        f.mesh.position.addScaledVector(f.vel, delta);
        f.mesh.rotation.x += f.angVel.x * delta;
        f.mesh.rotation.y += f.angVel.y * delta;
        f.mesh.rotation.z += f.angVel.z * delta;

        if (f.mesh.position.y <= f.restY) {
          group.remove(f.mesh);
          f.mesh.geometry.dispose();
          falling.splice(i, 1);
        }
      }
    }
  }

  function getState() {
    return { height: stones.length, collapsing: falling.length > 0 };
  }

  return {
    group,
    addStone,
    collapse,
    isNear,
    update,
    getState,
    getCollapseChance: collapseChanceForLayer,
    interactRadius: INTERACT_RADIUS
  };
}
