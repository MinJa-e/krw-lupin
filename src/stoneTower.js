import * as THREE from 'three';

const STONE_SHADES = [0x9a9186, 0x837c73, 0xa89f92];
const PAD_STONE_COLOR = 0xb9b0a1;
const PAD_RIM_COLOR = 0x746d63;
const MARKER_COLOR = 0xe9be56;
const INTERACT_RADIUS = 3.2;
const COLLAPSE_CHANCE_PER_LAYER = 0.10;
const COLLAPSE_CHANCE_CEILING = 0.50;

/**
 * n층(1-based)을 쌓을 때 무너질 확률.
 * 1층 0% (100% 안전), 2층부터 10%씩 증가하지만 6층부터는 50%로 고정.
 */
function collapseChanceForLayer(layer) {
  const raw = COLLAPSE_CHANCE_PER_LAYER * (layer - 1);
  // 5층 이하이면 위 계산, 그 이상이면 50%로 고정
  return Math.min(COLLAPSE_CHANCE_CEILING, raw);
}

const GRAVITY = 9.8;

function createStone(materials, index, size) {
  const material = materials[index % materials.length];
  const stone = new THREE.Mesh(
    new THREE.DodecahedronGeometry(size * 0.56, 0),
    material
  );

  stone.scale.set(1.06, 0.54, 0.92);
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
 * - 쌓을 때 층별로 무너질 확률이 달라진다 (1층 0%, 2층부터 10%씩 증가, 6층부터는 50% 고정)
 * - 무너지면 돌들이 물리적으로 튕기며 떨어지는 애니메이션 후 제거된다
 */
export function createStoneTower({
  position = { x: -10, z: -23 }
} = {}) {
  const group = new THREE.Group();
  group.name = 'stone-tower';
  group.position.set(position.x, 0.02, position.z);

  const stoneMaterials = STONE_SHADES.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.93
  }));
  const padMaterial = new THREE.MeshStandardMaterial({ color: PAD_STONE_COLOR, roughness: 0.95 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: PAD_RIM_COLOR, roughness: 0.95 });
  const markerMaterial = new THREE.MeshBasicMaterial({ color: MARKER_COLOR });

  // 돌탑 쌓기 자리를 알리는 자연석 받침대와 테두리 링
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.12, 1.18, 0.06, 24),
    padMaterial
  );
  pad.position.y = 0.03;
  pad.receiveShadow = true;
  group.add(pad);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.13, 0.055, 6, 24),
    rimMaterial
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.05;
  rim.receiveShadow = true;
  group.add(rim);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.88, 24),
    markerMaterial
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.062;
  group.add(innerRing);

  const stones = [];
  let falling = [];

  function addStone() {
    const index = stones.length;
    // 돌 시작 크기 0.65 → 층수 ↑할수록 0.06씩 줄어듦, 최소 0.03
    const size = Math.max(0.03, 0.65 - index * 0.06);
    const stone = createStone(stoneMaterials, index, size);
    const stoneHeight = size * 0.6;

    // 아래 쌓인 돌들의 실제 높이 합 위에 얹는다 (살짝 겹치게 해서 틈 없이)
    let baseY = 0.08;
    for (const s of stones) {
      baseY += s.userData.size * 0.6 * 0.92;
    }

    stone.position.set(
      (Math.random() - 0.5) * 0.12,
      baseY + stoneHeight / 2,
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
        restY: ((stone.userData.size * 0.5) / 2) + 0.04
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

  function update(delta) {
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
