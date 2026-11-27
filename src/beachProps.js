import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function mergeStaticBeachMeshes(rootGroup) {
  rootGroup.updateMatrixWorld(true);
  const buckets = new Map();

  rootGroup.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.material) return;
    if (Array.isArray(obj.material)) return;
    const key = `${obj.material.uuid}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: obj.material,
        castShadow: obj.castShadow,
        receiveShadow: obj.receiveShadow,
        geometries: []
      };
      buckets.set(key, bucket);
    }
    const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    g.applyMatrix4(obj.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    for (const attrName of Object.keys(g.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        g.deleteAttribute(attrName);
      }
    }
    bucket.geometries.push(g);
  });

  const oldChildren = [...rootGroup.children];
  for (const child of oldChildren) {
    rootGroup.remove(child);
    child.traverse((o) => {
      if (o.isMesh && o.geometry) o.geometry.dispose();
    });
  }

  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false);
    for (const g of bucket.geometries) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    rootGroup.add(mesh);
  }
}

/**
 * 해변/바다 구역을 현실적으로 꾸미는 오브제를 scene에 추가한다.
 * 정적 오브제는 머티리얼·그림자 단위로 배칭해 드로우콜 렉을 방지한다.
 *
 * @param {THREE.Scene} scene
 * @param {object} opts
 */
export function populateBeachAndOcean(scene, { createCanvasTexture, cobbleTexture, woodTexture }) {
  const staticGroup = new THREE.Group();
  staticGroup.name = 'beach-static-props';
  scene.add(staticGroup);

  // ── 텍스처 생성 (선택적 헬퍼 활용) ──
  const makeStripedTowelTexture = (stripeA, stripeB) => {
    if (!createCanvasTexture) return null;
    return createCanvasTexture((ctx, size) => {
      ctx.fillStyle = stripeA;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = stripeB;
      for (let i = 0; i < 8; i += 2) {
        ctx.fillRect(0, (i * size) / 8, size, size / 8);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(0, 0, size, size / 24);
      ctx.fillRect(0, size - size / 24, size, size / 24);
    }, 1, 1);
  };

  const signFaceTexture = createCanvasTexture
    ? createCanvasTexture((ctx, size) => {
        ctx.fillStyle = '#8b6a44';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#4e3824';
        ctx.lineWidth = 18;
        ctx.strokeRect(18, 18, size - 36, size - 36);
        ctx.fillStyle = '#f5ead6';
        ctx.font = 'bold 132px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('海辺', size / 2, size / 2 + 8);
      })
    : null;

  // ── 공용 재질 (드로우콜 병합용 단일 인스턴스 유지) ──
  const driftMat = new THREE.MeshStandardMaterial({
    map: woodTexture || null,
    color: 0xa89275,
    roughness: 1
  });
  const rockMat = new THREE.MeshStandardMaterial({
    map: cobbleTexture || null,
    color: 0x86847d,
    roughness: 0.94
  });
  const darkRock = new THREE.MeshStandardMaterial({ color: 0x5c5b55, roughness: 0.95 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf4e8d6, roughness: 0.72 });
  const starMat = new THREE.MeshStandardMaterial({ color: 0xe67350, roughness: 0.8 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xbaa377, roughness: 1 });
  const buoyMat1 = new THREE.MeshStandardMaterial({ color: 0xd54040, roughness: 0.55 });
  const buoyMat2 = new THREE.MeshStandardMaterial({ color: 0xf09020, roughness: 0.55 });
  const whiteBandMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.5 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5e8846, roughness: 1, side: THREE.DoubleSide });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0x4f6d5a,
    roughness: 0.95,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide
  });
  const boardMat = new THREE.MeshStandardMaterial({
    map: woodTexture || null,
    color: 0x8d6c47,
    roughness: 0.9
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: woodTexture || null,
    color: 0x674b31,
    roughness: 0.92
  });
  const towelMat1 = new THREE.MeshStandardMaterial({
    map: makeStripedTowelTexture('#3878b8', '#eef3f8'),
    color: 0xffffff,
    roughness: 0.9
  });
  const towelMat2 = new THREE.MeshStandardMaterial({
    map: makeStripedTowelTexture('#c85060', '#f7ece6'),
    color: 0xffffff,
    roughness: 0.9
  });
  const chairMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, roughness: 0.92 });
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xf1ebde, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x707070, roughness: 0.5, metalness: 0.4 });
  const anchorMat = new THREE.MeshStandardMaterial({ color: 0x484848, roughness: 0.6, metalness: 0.5 });
  const kelpMat = new THREE.MeshStandardMaterial({ color: 0x3b5d35, roughness: 1, side: THREE.DoubleSide });
  const wetSandMat = new THREE.MeshStandardMaterial({
    color: 0xbda47a,
    roughness: 0.85,
    transparent: true,
    opacity: 0.55
  });
  const signPostMat = new THREE.MeshStandardMaterial({
    map: woodTexture || null,
    color: 0x705840,
    roughness: 1
  });
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: signFaceTexture,
    color: signFaceTexture ? 0xffffff : 0x7a5e42,
    roughness: 0.9
  });
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x40a0d8, roughness: 0.7 });
  const shovelMat = new THREE.MeshStandardMaterial({ color: 0xe8c030, roughness: 0.7 });
  const coolerMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x3080c0, roughness: 0.6 });
  const castleSandMat = new THREE.MeshStandardMaterial({ color: 0xdcc896, roughness: 1 });
  const castleFlagMat = new THREE.MeshStandardMaterial({ color: 0xe04040, side: THREE.DoubleSide });
  const pineTrunkMat = new THREE.MeshStandardMaterial({
    map: woodTexture || null,
    color: 0x624734,
    roughness: 1
  });
  const pineNeedleMat = new THREE.MeshStandardMaterial({ color: 0x35583a, roughness: 0.95 });
  const lanternStoneMat = new THREE.MeshStandardMaterial({ color: 0x9b978d, roughness: 0.95 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xf7d08a,
    emissive: 0x8a4818,
    emissiveIntensity: 0.45
  });

  // 애니메이션용 거품 재질 (staticGroup 밖에서 개별 관리)
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const foamMat2 = new THREE.MeshStandardMaterial({
    color: 0xe8f9fb,
    roughness: 0.5,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  function setShadow(obj, cast = true, receive = true) {
    obj.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = cast;
        m.receiveShadow = receive;
      }
    });
    return obj;
  }

  // ── 유목 (해변에 떠밀려온 나무 조각, 돌탑 자리 피해서 배치) ──
  function createDriftwood(x, z, rot, len) {
    const g = new THREE.Group();
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, len, 6), driftMat);
    main.rotation.z = Math.PI / 2;
    main.rotation.y = 0.15;
    main.position.y = 0.06;
    g.add(main);

    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, len * 0.4, 5), driftMat);
    branch.position.set(len * 0.15, 0.14, 0.03);
    branch.rotation.z = 0.7;
    g.add(branch);

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, true, true));
  }

  createDriftwood(-18, -18.5, 0.3, 1.8);
  createDriftwood(14.5, -19.2, -0.4, 1.3);
  createDriftwood(-32.5, -19.5, 1.1, 2.0);
  createDriftwood(21.5, -18.5, 0.8, 1.1);
  createDriftwood(-2.5, -22.5, -0.6, 1.5);

  // ── 바위 클러스터 (조간대 및 양쪽 해안) ──
  function createRockCluster(x, z, count, spread) {
    const g = new THREE.Group();
    for (let i = 0; i < count; i += 1) {
      const s = 0.22 + (i % 3) * 0.16;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        i % 2 === 0 ? rockMat : darkRock
      );
      const angle = (i / Math.max(count, 1)) * Math.PI * 2 + x * 0.3;
      const dist = ((i % 2) * 0.45 + 0.15) * spread * 0.5;
      rock.position.set(Math.cos(angle) * dist, s * 0.34, Math.sin(angle) * dist * 0.7);
      rock.rotation.set(i * 0.35, i * 1.1, i * 0.22);
      rock.scale.y = 0.52 + (i % 3) * 0.1;
      g.add(rock);
    }
    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createRockCluster(-24, -24.5, 5, 2.4);
  createRockCluster(29.5, -24.0, 4, 2.0);
  createRockCluster(-35, -22.5, 4, 2.0);
  createRockCluster(35.5, -21.5, 4, 1.9);
  createRockCluster(0, -25.2, 4, 2.1);
  createRockCluster(-15.5, -25.4, 3, 1.4);
  createRockCluster(17, -24.8, 3, 1.6);

  // ── 일본풍 먼바다 부부바위 (시메나와 연결 바위섬) ──
  function createSeaRockStacks(x, z) {
    const g = new THREE.Group();
    const bigRock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), darkRock);
    bigRock.scale.set(1.0, 1.35, 0.9);
    bigRock.position.set(-1.1, 0.95, 0);
    g.add(bigRock);

    const smallRock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), rockMat);
    smallRock.scale.set(0.95, 1.25, 0.9);
    smallRock.position.set(1.35, 0.55, 0.3);
    g.add(smallRock);

    const shimenawa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.55, 6), ropeMat);
    shimenawa.position.set(0.12, 1.55, 0.15);
    shimenawa.rotation.z = Math.PI / 2 - 0.16;
    g.add(shimenawa);

    // 큰 바위 위 작은 도리이 장식
    const miniToriiMat = buoyMat1;
    [-0.22, 0.22].forEach((px) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.65, 6), miniToriiMat);
      post.position.set(-1.1 + px, 2.45, 0);
      g.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.09), miniToriiMat);
    lintel.position.set(-1.1, 2.78, 0);
    g.add(lintel);

    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createSeaRockStacks(-30, -48);
  createSeaRockStacks(32, -52);

  // ── 조개 & 불가사리 (그림자 생략으로 경량화) ──
  function createShell(x, z, rot) {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 7, 5, 0, Math.PI),
      shellMat
    );
    shell.position.set(x, 0.02, z);
    shell.rotation.set(-Math.PI / 2, rot, 0);
    shell.scale.set(1, 0.5, 1);
    shell.castShadow = false;
    shell.receiveShadow = true;
    staticGroup.add(shell);
  }

  function createStarfish(x, z, rot) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      const arm = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), starMat);
      const angle = (i / 5) * Math.PI * 2;
      arm.position.set(Math.cos(angle) * 0.08, 0.018, Math.sin(angle) * 0.08);
      arm.rotation.z = -Math.PI / 2;
      arm.rotation.y = angle;
      g.add(arm);
    }
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 7), starMat);
    center.position.y = 0.018;
    g.add(center);

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, false, true));
  }

  const shellPositions = [
    [-12.5, -19], [5, -21], [-20, -20.5], [18, -18], [-7.5, -22.5],
    [28.5, -19.5], [-30.5, -18.5], [13.5, -23.5], [-5, -20.5], [2, -24],
    [32, -20], [-22, -21.5], [8, -18.5], [-16, -23.5]
  ];
  shellPositions.forEach(([x, z], i) => {
    if (i % 3 === 0) createStarfish(x, z, i * 0.7);
    else createShell(x, z, i * 0.9);
  });

  // ── 해변 풀/갈대 (방파제 근처, 그림자 생략) ──
  function createBeachGrass(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.38 + (i % 2) * 0.18), grassMat);
      blade.position.set((i - 1.5) * 0.07, 0.19, (i % 2 - 0.5) * 0.12);
      blade.rotation.y = i * 0.85;
      blade.rotation.x = -0.18 - (i % 2) * 0.12;
      g.add(blade);
    }
    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, false, true));
  }

  for (let x = -38; x <= 38; x += 3.8) {
    if (Math.abs(x + 20) < 2.2) continue; // 부두 진입로 비움
    createBeachGrass(x + Math.sin(x) * 0.6, -26.4 + Math.cos(x) * 0.15);
  }

  // ── 바다 물거품선 (방파제 z=-27 너머 바다 쪽에 배치해 동적 파도감 표현) ──
  const foamLine = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.5), foamMat);
  foamLine.rotation.x = -Math.PI / 2;
  foamLine.position.set(0, 0.026, -27.9);
  scene.add(foamLine);

  const foamLine2 = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.95), foamMat2);
  foamLine2.rotation.x = -Math.PI / 2;
  foamLine2.position.set(0, 0.024, -29.6);
  scene.add(foamLine2);

  // ── 어망 건조대 (물속이 아닌 모래사장 동쪽에 배치) ──
  function createFishingNet(x, z, rot) {
    const g = new THREE.Group();
    for (const dx of [-0.65, 0.65]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.55, 6), boardMat);
      pole.position.set(dx, 0.775, 0);
      g.add(pole);
    }
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.45, 6), boardMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 1.48, 0);
    g.add(crossbar);

    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 1.05), netMat);
    net.position.set(0, 0.92, 0.03);
    g.add(net);

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, true, true));
  }

  createFishingNet(19.0, -22.8, 0.45);
  createFishingNet(22.2, -24.2, -0.3);

  // ── 부표 (바다 위 애니메이션) ──
  function createBuoy(x, z, mat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 10), mat);
    body.position.y = 0.25;
    g.add(body);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10), whiteBandMat);
    band.position.y = 0.3;
    g.add(band);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 8), metalMat);
    ring.position.y = 0.52;
    g.add(ring);

    g.position.set(x, 0.08, z);
    setShadow(g, true, true);
    scene.add(g);
    return g;
  }

  const buoys = [
    createBuoy(-16, -30, buoyMat1),
    createBuoy(20, -32, buoyMat2),
    createBuoy(-30, -31, buoyMat2),
    createBuoy(32, -29.5, buoyMat1)
  ];

  // ── 목재 부두 (방파제 y=0.42에 맞춘 상판 높이 + 진입 계단 + 계류 말뚝) ──
  function createPier(x, z, plankCount) {
    const g = new THREE.Group();
    const deckY = 0.46;
    const totalLen = plankCount * 0.44;
    const numPiles = Math.max(3, Math.ceil(totalLen / 1.9) + 1);

    for (let i = 0; i < numPiles; i += 1) {
      const pz = -0.2 - i * (totalLen / Math.max(numPiles - 1, 1));
      for (const side of [-0.72, 0.72]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.55, 6), darkWoodMat);
        pile.position.set(side, 0.08, pz);
        g.add(pile);
      }
    }

    // 측면 지지 보
    for (const side of [-0.68, 0.68]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, totalLen + 0.3), darkWoodMat);
      beam.position.set(side, deckY - 0.08, -totalLen / 2);
      g.add(beam);
    }

    // 상판 판자
    for (let i = 0; i < plankCount; i += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.07, 0.38), boardMat);
      plank.position.set(0, deckY, -0.2 - i * 0.44);
      g.add(plank);
    }

    // 모래사장 쪽 나무 계단 2단
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 0.42), boardMat);
    step1.position.set(0, 0.28, 0.25);
    g.add(step1);
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 0.42), boardMat);
    step2.position.set(0, 0.1, 0.65);
    g.add(step2);

    // 한쪽 난간 (낚시·조망용)
    for (const side of [-0.78, 0.78]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, totalLen), boardMat);
      rail.position.set(side, deckY + 0.56, -totalLen / 2 - 0.1);
      g.add(rail);
    }

    // 끝단 계류 볼라드 + 등불 기둥
    const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.25, 6), darkWoodMat);
    lanternPost.position.set(0.72, deckY + 0.62, -totalLen + 0.15);
    g.add(lanternPost);
    const pierLamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), lanternGlowMat);
    pierLamp.position.set(0.72, deckY + 1.32, -totalLen + 0.15);
    g.add(pierLamp);
    const pierLampCap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.14, 4), darkWoodMat);
    pierLampCap.rotation.y = Math.PI / 4;
    pierLampCap.position.set(0.72, deckY + 1.52, -totalLen + 0.15);
    g.add(pierLampCap);

    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createPier(-20, -26.2, 16);

  // ── 닻 (부두 옆 모래사장에 배치) ──
  function createAnchor(x, z, rot) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 7), anchorMat);
    shaft.position.y = 0.4;
    g.add(shaft);
    for (const dir of [-1, 1]) {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), anchorMat);
      hook.position.set(dir * 0.12, 0.08, 0);
      hook.rotation.z = dir * 0.8;
      g.add(hook);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 8), anchorMat);
    ring.position.y = 0.82;
    g.add(ring);

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, true, true));
  }

  createAnchor(-17.8, -25.1, 0.4);

  // ── 밧줄 고리 (부두 위 + 해변 어구 옆) ──
  function createRopeCoil(x, y, z) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 7, 14), ropeMat);
    coil.position.set(x, y, z);
    coil.rotation.x = -Math.PI / 2;
    coil.castShadow = true;
    coil.receiveShadow = true;
    staticGroup.add(coil);
  }

  createRopeCoil(-19.5, 0.52, -31.8);
  createRopeCoil(-17.4, 0.04, -24.7);
  createRopeCoil(17.6, 0.04, -23.5);

  // ── 수건/돗자리 (파라솔 아래) ──
  function createTowel(x, z, rot, mat) {
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), mat);
    towel.rotation.x = -Math.PI / 2;
    towel.position.set(x, 0.022, z);
    towel.rotation.z = rot;
    towel.castShadow = false;
    towel.receiveShadow = true;
    staticGroup.add(towel);
  }

  createTowel(-7, -20.3, 0.1, towelMat1);
  createTowel(7, -19.7, -0.15, towelMat2);

  // ── 비치 의자 (파라솔 옆) ──
  function createBeachChair(x, z, rot) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.9), canvasMat);
    seat.position.set(0, 0.3, 0);
    seat.rotation.x = -0.1;
    g.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.04), canvasMat);
    back.position.set(0, 0.5, -0.42);
    back.rotation.x = -0.3;
    g.add(back);

    for (const [dx, dz] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6), chairMat);
      leg.position.set(dx, 0.14, dz);
      g.add(leg);
    }

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, true, true));
  }

  createBeachChair(-8.5, -20, 0.2);
  createBeachChair(5.5, -20.5, -0.3);

  // ── 해초/다시마 (얕은 물 속, 그림자 생략) ──
  function createKelp(x, z, seed) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const blade = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.55 + (i % 2) * 0.25),
        kelpMat
      );
      blade.position.set((i - 1) * 0.08, 0.22, (i % 2 - 0.5) * 0.08);
      blade.rotation.y = seed + i * 1.1;
      blade.rotation.x = -0.35 - (i % 2) * 0.25;
      g.add(blade);
    }
    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, false, false));
  }

  for (let i = 0; i < 12; i += 1) {
    createKelp(-38 + i * 6.8, -28.4 - (i % 4) * 1.25, i * 0.7);
  }

  // ── 젖은 모래 경계선 (방파제 안쪽 파도 물기 흔적) ──
  const wetSandStrip = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.8), wetSandMat);
  wetSandStrip.rotation.x = -Math.PI / 2;
  wetSandStrip.position.set(0, 0.014, -26.1);
  wetSandStrip.castShadow = false;
  wetSandStrip.receiveShadow = true;
  staticGroup.add(wetSandStrip);

  // ── 나무 간판 (해변 입구) ──
  function createBeachSign(x, z, rot) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 6), signPostMat);
    post.position.y = 0.65;
    g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.46, 0.05), signFaceMat);
    board.position.y = 1.18;
    g.add(board);

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, true, true));
  }

  createBeachSign(-3.6, -14.6, 0.15);

  // ── 해안 석등 (해변 입구 맞은편) ──
  function createCoastalLantern(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.28, 6), lanternStoneMat);
    base.position.y = 0.14;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.85, 6), lanternStoneMat);
    shaft.position.y = 0.7;
    const fireBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), lanternGlowMat);
    fireBox.position.y = 1.26;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.24, 6), lanternStoneMat);
    roof.position.y = 1.52;
    g.add(base, shaft, fireBox, roof);
    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createCoastalLantern(3.8, -14.8);

  // ── 물양동이 & 삽 ──
  function createBucketAndShovel(x, z) {
    const g = new THREE.Group();
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 8, 1, true), bucketMat);
    bucket.position.y = 0.09;
    g.add(bucket);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), bucketMat);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.005;
    g.add(bottom);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), shovelMat);
    handle.position.set(0.18, 0.08, 0);
    handle.rotation.z = 1.2;
    g.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.01), shovelMat);
    blade.position.set(0.28, 0.17, 0);
    blade.rotation.z = 0.5;
    g.add(blade);

    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createBucketAndShovel(-5, -19);
  createBucketAndShovel(9.6, -20.2);

  // ── 아이스박스 (파라솔 옆) ──
  function createCooler(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), coolerMat);
    body.position.y = 0.15;
    g.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.32), lidMat);
    lid.position.y = 0.33;
    g.add(lid);

    g.position.set(x, 0, z);
    g.rotation.y = rot;
    staticGroup.add(setShadow(g, true, true));
  }

  createCooler(-6, -19.5, 0.3);
  createCooler(8.5, -19, -0.2);

  // ── 방파제 보강 돌 ──
  for (let i = 0; i < 24; i += 1) {
    const s = 0.15 + (i % 4) * 0.04;
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      i % 2 === 0 ? rockMat : darkRock
    );
    stone.position.set(
      -42 + i * 3.65,
      0.14 + (i % 3) * 0.04,
      -27.05 + ((i % 2) - 0.5) * 0.35
    );
    stone.scale.y = 0.45 + (i % 3) * 0.1;
    stone.rotation.set(i * 0.4, i * 0.9, i * 0.2);
    stone.castShadow = false;
    stone.receiveShadow = true;
    staticGroup.add(stone);
  }

  // ── 해변 양쪽 소나무 (마을 외곽과 자연스럽게 이어지는 해송) ──
  function createCoastalPine(x, z, scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.3, 7), pineTrunkMat);
    trunk.position.y = 1.1;
    trunk.rotation.z = 0.12;
    g.add(trunk);

    [
      [0.15, 2.25, 0, 1.05],
      [-0.55, 2.55, 0.25, 0.72],
      [0.65, 2.65, -0.2, 0.78]
    ].forEach(([cx, cy, cz, r]) => {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), pineNeedleMat);
      crown.scale.set(1.2, 0.58, 1.15);
      crown.position.set(cx, cy, cz);
      g.add(crown);
    });

    g.scale.setScalar(scale);
    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createCoastalPine(-38, -16.5, 1.05);
  createCoastalPine(37.5, -16.8, 1.1);

  // ── 모래성 ──
  function createSandCastle(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 10), castleSandMat);
    base.position.y = 0.15;
    g.add(base);

    for (const dx of [-0.15, 0.15]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 8), castleSandMat);
      tower.position.set(dx, 0.42, 0);
      g.add(tower);
    }

    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), boardMat);
    flagPole.position.set(0, 0.65, 0);
    g.add(flagPole);

    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), castleFlagMat);
    flag.position.set(0.07, 0.72, 0);
    g.add(flag);

    g.position.set(x, 0, z);
    staticGroup.add(setShadow(g, true, true));
  }

  createSandCastle(3, -18.5);

  // 정적 오브제를 머티리얼/그림자 기준으로 병합해 드로우콜 대폭 절감
  mergeStaticBeachMeshes(staticGroup);

  return {
    buoys,
    foamLine,
    foamLine2,
    update(time) {
      for (let i = 0; i < buoys.length; i += 1) {
        const b = buoys[i];
        b.position.y = 0.08 + Math.sin(time * 1.5 + i * 2) * 0.06;
        b.rotation.z = Math.sin(time * 1.2 + i * 1.5) * 0.08;
      }
      // 해안 거품선 잔잔한 밀물·썰물 움직임
      foamLine.position.z = -27.9 + Math.sin(time * 0.9) * 0.22;
      foamLine2.position.z = -29.6 + Math.cos(time * 0.75) * 0.28;
      foamMat.opacity = 0.3 + Math.sin(time * 0.9) * 0.12;
      foamMat2.opacity = 0.22 + Math.cos(time * 0.75) * 0.08;
    }
  };
}
