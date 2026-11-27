import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function createCanvasTex(renderer, draw, repeatX = 1, repeatY = 1, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (renderer?.capabilities) {
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  return tex;
}

function setShadow(obj, cast = true, receive = true) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return obj;
}

function mergeStaticTownMeshes(rootGroup) {
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
 * 일본풍 해변마을의 생활감과 구역 구성을 채우는 마을 프롭 배치 모듈.
 * 해변(z <= -13.5)은 손대지 않고, 마을 영역(z > -13.5)만 현실적인 구역별로 꾸민다.
 */
export function populateJapaneseTown(scene, {
  renderer,
  plasterTexture,
  woodTexture,
  roofTexture,
  cobbleTexture
}) {
  const townGroup = new THREE.Group();
  townGroup.name = 'japanese-town-props';
  scene.add(townGroup);

  // ---------------------------------------------------------------------------
  // 1. 프로시저럴 텍스처 & 공유 머티리얼 (드로우콜 배칭 친화)
  // ---------------------------------------------------------------------------
  const townEarthTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#b9ad95';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i += 1) {
      const dark = Math.random() > 0.45;
      ctx.fillStyle = dark
        ? `rgba(88, 76, 56, ${Math.random() * 0.14})`
        : `rgba(228, 217, 192, ${Math.random() * 0.16})`;
      const r = 0.8 + Math.random() * 2.2;
      ctx.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
    for (let i = 0; i < 140; i += 1) {
      ctx.fillStyle = `rgba(98, 120, 74, ${Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 26, 16, 256);

  const grassTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#6c8a53';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i += 1) {
      const tone = Math.random();
      ctx.fillStyle = tone < 0.4
        ? `rgba(74, 104, 52, ${0.15 + Math.random() * 0.2})`
        : tone < 0.8
          ? `rgba(132, 162, 92, ${0.12 + Math.random() * 0.16})`
          : `rgba(176, 168, 114, ${Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 3 + Math.random() * 4);
    }
  }, 6, 6, 256);

  const flagstoneTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#a29c8e';
    ctx.fillRect(0, 0, s, s);
    const cols = 4;
    const rows = 8;
    const cw = s / cols;
    const ch = s / rows;
    for (let r = 0; r < rows; r += 1) {
      const shift = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c += 1) {
        const x = c * cw + shift;
        const y = r * ch;
        const v = 148 + Math.floor(Math.random() * 24);
        ctx.fillStyle = `rgb(${v}, ${v - 4}, ${v - 11})`;
        ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        ctx.strokeStyle = 'rgba(72, 68, 60, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      }
    }
  }, 1, 8, 256);

  const zenGravelTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#dbd6ca';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(155, 148, 134, 0.55)';
    ctx.lineWidth = 3;
    for (let y = 8; y < s; y += 12) {
      ctx.beginPath();
      for (let x = 0; x <= s; x += 12) {
        const wave = Math.sin((x / s) * Math.PI * 4) * 3;
        if (x === 0) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
  }, 2, 2, 256);

  const makeStripeTex = (colorA, colorB) => createCanvasTex(renderer, (ctx, s) => {
    const stripes = 8;
    const sw = s / stripes;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.fillRect(i * sw, 0, sw + 1, s);
    }
  }, 1, 1, 128);

  const redStripeTex = makeStripeTex('#b84b39', '#f3e9d3');
  const blueStripeTex = makeStripeTex('#3f6e8f', '#f3e9d3');
  const greenStripeTex = makeStripeTex('#467557', '#f3e9d3');

  const vendingDisplayTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#e8f1f5';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#256099';
    ctx.fillRect(0, 0, s, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DRINK', s / 2, 25);
    const colors = ['#d94545', '#3488c7', '#4aa85b', '#e69c35', '#7856b8', '#2eb3b3', '#e05d8c'];
    for (let row = 0; row < 3; row += 1) {
      const ry = 48 + row * 62;
      ctx.fillStyle = '#c8d6df';
      ctx.fillRect(12, ry + 39, s - 24, 5);
      for (let col = 0; col < 6; col += 1) {
        const cx = 21 + col * 37;
        ctx.fillStyle = colors[(row * 6 + col) % colors.length];
        ctx.fillRect(cx, ry, 24, 36);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(cx + 4, ry + 6, 6, 22);
        ctx.fillStyle = row === 0 ? '#d84545' : '#2a78c2';
        ctx.fillRect(cx + 3, ry + 46, 18, 7);
      }
    }
  }, 1, 1, 256);

  const busSignTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#f5f2ea';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#23598c';
    ctx.fillRect(0, 0, s, 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px serif';
    ctx.textAlign = 'center';
    ctx.fillText('バス停', s / 2, 54);
    ctx.fillStyle = '#1f2e3d';
    ctx.font = 'bold 38px serif';
    ctx.fillText('海浜町', s / 2, 148);
    ctx.fillStyle = '#c44637';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('BUS STOP', s / 2, 198);
  }, 1, 1, 256);

  const noticeBoardTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#8b6844';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#a88459';
    ctx.fillRect(12, 12, s - 24, s - 24);
    const flyers = [
      { x: 24, y: 26, w: 85, h: 105, bg: '#f5ecd7', hdr: '#b94435', txt: '夏祭り' },
      { x: 122, y: 24, w: 108, h: 78, bg: '#eef4f7', hdr: '#2e6a99', txt: '海辺案内' },
      { x: 128, y: 115, w: 98, h: 110, bg: '#f7f2dc', hdr: '#4c7a49', txt: '町内会' },
      { x: 27, y: 145, w: 82, h: 82, bg: '#fae8de', hdr: '#c96f32', txt: '花火大会' }
    ];
    for (const f of flyers) {
      ctx.fillStyle = f.bg;
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle = f.hdr;
      ctx.fillRect(f.x, f.y, f.w, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.txt, f.x + f.w / 2, f.y + 15);
      ctx.fillStyle = 'rgba(60,50,40,0.45)';
      for (let line = 0; line < 4; line += 1) {
        ctx.fillRect(f.x + 8, f.y + 30 + line * 11, f.w - 16, 4);
      }
    }
  }, 1, 1, 256);

  const shrineSignTex = createCanvasTex(renderer, (ctx, s) => {
    ctx.fillStyle = '#dfd0b2';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#5a3e28';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, s - 20, s - 20);
    ctx.fillStyle = '#2d2219';
    ctx.font = 'bold 52px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('海浜神社', s / 2, s / 2);
  }, 1, 1, 256);

  const colorMatCache = new Map();
  function getColorMat(hex, roughness = 0.85, metalness = 0.05) {
    const key = `${hex}|${roughness}|${metalness}`;
    if (!colorMatCache.has(key)) {
      colorMatCache.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness, metalness }));
    }
    return colorMatCache.get(key);
  }

  const mats = {
    townEarth: new THREE.MeshStandardMaterial({ map: townEarthTex, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.98 }),
    flagstone: new THREE.MeshStandardMaterial({ map: flagstoneTex, roughness: 0.95 }),
    zenGravel: new THREE.MeshStandardMaterial({ map: zenGravelTex, roughness: 0.98 }),
    stone: new THREE.MeshStandardMaterial({ map: cobbleTexture, color: 0xa4a096, roughness: 0.95 }),
    granite: new THREE.MeshStandardMaterial({ color: 0x99958c, roughness: 0.92 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x6f6d67, roughness: 0.92 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x8e6744, roughness: 0.88 }),
    darkWood: new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x5c3f28, roughness: 0.9 }),
    weatheredWood: new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x7d6e5d, roughness: 0.95 }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0x6d934e, roughness: 0.82 }),
    bambooDry: new THREE.MeshStandardMaterial({ color: 0xb09b63, roughness: 0.88 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterTexture, color: 0xebe3d0, roughness: 0.94 }),
    roof: new THREE.MeshStandardMaterial({ map: roofTexture, color: 0xffffff, roughness: 0.82 }),
    vermilion: new THREE.MeshStandardMaterial({ color: 0xab4130, roughness: 0.8 }),
    redCloth: new THREE.MeshStandardMaterial({ color: 0xb63d34, roughness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.6, metalness: 0.35 }),
    poleConcrete: new THREE.MeshStandardMaterial({ color: 0x9c9d98, roughness: 0.9 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.7 }),
    paperWarm: new THREE.MeshStandardMaterial({
      color: 0xf4cc85,
      emissive: 0x824212,
      emissiveIntensity: 0.35,
      roughness: 0.85
    }),
    water: new THREE.MeshStandardMaterial({
      color: 0x5ca4b5,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82
    }),
    pineTrunk: new THREE.MeshStandardMaterial({ color: 0x654632, roughness: 0.98 }),
    pineLeafA: new THREE.MeshStandardMaterial({ color: 0x38664e, roughness: 0.95 }),
    pineLeafB: new THREE.MeshStandardMaterial({ color: 0x45785b, roughness: 0.95 }),
    sakuraTrunk: new THREE.MeshStandardMaterial({ color: 0x4f382e, roughness: 0.95 }),
    sakuraA: new THREE.MeshStandardMaterial({ color: 0xf4b6c8, roughness: 0.92 }),
    sakuraB: new THREE.MeshStandardMaterial({ color: 0xf9cddb, roughness: 0.92 }),
    sakuraC: new THREE.MeshStandardMaterial({ color: 0xe69ab2, roughness: 0.92 }),
    mapleLeaf: new THREE.MeshStandardMaterial({ color: 0xc95a38, roughness: 0.9 }),
    hedgeLeaf: new THREE.MeshStandardMaterial({ color: 0x477043, roughness: 0.94 }),
    soilDark: new THREE.MeshStandardMaterial({ color: 0x4f3d2b, roughness: 1 }),
    crateBlue: new THREE.MeshStandardMaterial({ color: 0x3b76a8, roughness: 0.75 }),
    crateOrange: new THREE.MeshStandardMaterial({ color: 0xd4763b, roughness: 0.75 }),
    crateWood: new THREE.MeshStandardMaterial({ color: 0xb99162, roughness: 0.88 }),
    potTerracotta: new THREE.MeshStandardMaterial({ color: 0xb06346, roughness: 0.85 }),
    potBlue: new THREE.MeshStandardMaterial({ color: 0x3e6885, roughness: 0.55 }),
    whiteMetal: new THREE.MeshStandardMaterial({ color: 0xe8ecee, roughness: 0.45, metalness: 0.2 }),
    yellowCaution: new THREE.MeshStandardMaterial({ color: 0xdfb133, roughness: 0.65 }),
    mirrorGlass: new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.12, metalness: 0.85 }),
    wisteria: new THREE.MeshStandardMaterial({ color: 0x9b7bc4, roughness: 0.88 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc4ad7c, roughness: 0.98 }),
    redAwning: new THREE.MeshStandardMaterial({ map: redStripeTex, roughness: 0.88 }),
    blueAwning: new THREE.MeshStandardMaterial({ map: blueStripeTex, roughness: 0.88 }),
    greenAwning: new THREE.MeshStandardMaterial({ map: greenStripeTex, roughness: 0.88 }),
    vendingFront: new THREE.MeshStandardMaterial({
      map: vendingDisplayTex,
      emissive: 0xffffff,
      emissiveMap: vendingDisplayTex,
      emissiveIntensity: 0.18,
      roughness: 0.35
    }),
    busSign: new THREE.MeshStandardMaterial({ map: busSignTex, roughness: 0.5 }),
    noticeBoard: new THREE.MeshStandardMaterial({ map: noticeBoardTex, roughness: 0.9 }),
    shrineSign: new THREE.MeshStandardMaterial({ map: shrineSignTex, roughness: 0.85 })
  };

  // ---------------------------------------------------------------------------
  // 2. 마을 바닥, 보도, 연석, 잔디 구역 (해변 z <= -13.5 제외)
  // ---------------------------------------------------------------------------
  const townGround = new THREE.Mesh(new THREE.PlaneGeometry(200, 110), mats.townEarth);
  townGround.rotation.x = -Math.PI / 2;
  townGround.position.set(0, 0.008, 41.6);
  townGround.receiveShadow = true;
  townGroup.add(townGround);

  [
    [-29, 11, 20, 22],
    [-25, -3.5, 17, 15],
    [-27, 31, 20, 21],
    [27.5, 9.5, 15.6, 15.6],
    [28, -5, 17, 14],
    [27, 30, 18, 19]
  ].forEach(([x, z, w, d]) => {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.grass);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(x, 0.013, z);
    lawn.receiveShadow = true;
    townGroup.add(lawn);
  });

  [
    { zCenter: -2.85, len: 19.7 },
    { zCenter: 46.5, len: 71.0 }
  ].forEach(({ zCenter, len }) => {
    [-1, 1].forEach((side) => {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(1.55, len), mats.flagstone);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(side * 3.22, 0.019, zCenter);
      walk.receiveShadow = true;
      townGroup.add(walk);

      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, len), mats.granite);
      curb.position.set(side * 2.46, 0.04, zCenter);
      curb.receiveShadow = true;
      townGroup.add(curb);
    });
  });

  [
    { xCenter: -10.8, len: 16.4 },
    { xCenter: 10.8, len: 16.4 }
  ].forEach(({ xCenter, len }) => {
    [-1, 1].forEach((side) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.2), mats.granite);
      curb.position.set(xCenter, 0.04, 9 + side * 1.75);
      curb.receiveShadow = true;
      townGroup.add(curb);
    });
  });

  const shrineApproach = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.7), mats.flagstone);
  shrineApproach.rotation.x = -Math.PI / 2;
  shrineApproach.position.set(-25.5, 0.022, 9);
  shrineApproach.receiveShadow = true;
  townGroup.add(shrineApproach);

  const parkApproach = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.7), mats.flagstone);
  parkApproach.rotation.x = -Math.PI / 2;
  parkApproach.position.set(24.5, 0.022, 9);
  parkApproach.receiveShadow = true;
  townGroup.add(parkApproach);

  [-16.5, 16.5].forEach((xPos) => {
    [
      { zc: -2.0, len: 16.5 },
      { zc: 26.5, len: 30.0 }
    ].forEach(({ zc, len }) => {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, len), mats.stone);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(xPos, 0.017, zc);
      lane.receiveShadow = true;
      townGroup.add(lane);
    });
  });

  function addSteppingPath(fromX, toX, z) {
    const dir = toX > fromX ? 1 : -1;
    const dist = Math.abs(toX - fromX);
    const steps = Math.max(2, Math.floor(dist / 0.85));
    for (let i = 0; i < steps; i += 1) {
      const sx = fromX + dir * (0.45 + i * (dist / steps));
      const sz = z + (i % 2 === 0 ? -0.09 : 0.09);
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.04, 6), mats.granite);
      stone.position.set(sx, 0.024, sz);
      stone.rotation.y = i * 0.7;
      stone.receiveShadow = true;
      townGroup.add(stone);
    }
  }

  [
    [-4.0, -7.4, -6], [4.0, 7.4, -6],
    [-4.0, -8.4, 2], [4.0, 8.4, 2],
    [-4.0, -7.4, 17], [4.0, 7.4, 17],
    [-4.0, -10.4, 29], [4.0, 10.4, 29],
    [-4.0, -7.4, 42], [4.0, 7.4, 42],
    [-4.0, -8.4, 50], [4.0, 8.4, 50],
    [-4.0, -7.4, 65], [4.0, 7.4, 65],
    [-4.0, -10.4, 77], [4.0, 10.4, 77]
  ].forEach(([fx, tx, z]) => addSteppingPath(fx, tx, z));

  // ---------------------------------------------------------------------------
  // 3. 공용 조형물 빌더 함수들
  // ---------------------------------------------------------------------------
  function addStoneLantern(x, z, style = 'tall') {
    const g = new THREE.Group();
    if (style === 'yukimi') {
      [[-0.22, -0.22], [0.22, -0.22], [0, 0.25]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 0.14), mats.granite);
        leg.position.set(lx, 0.175, lz);
        g.add(leg);
      });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.14, 6), mats.granite);
      base.position.y = 0.4;
      g.add(base);
      const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 6), mats.paperWarm);
      fire.position.y = 0.61;
      g.add(fire);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.28, 6), mats.granite);
      cap.position.y = 0.88;
      g.add(cap);
    } else {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.62), mats.granite);
      base.position.y = 0.1;
      g.add(base);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.9, 6), mats.granite);
      post.position.y = 0.65;
      g.add(post);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), mats.granite);
      mid.position.y = 1.15;
      g.add(mid);
      const fire = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), mats.paperWarm);
      fire.position.y = 1.38;
      g.add(fire);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.26, 4), mats.granite);
      cap.rotation.y = Math.PI / 4;
      cap.position.y = 1.67;
      g.add(cap);
    }
    g.position.set(x, 0, z);
    townGroup.add(setShadow(g, true, true));
  }

  function addWoodenBench(x, z, rotY = 0) {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.9), mats.granite);
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    g.add(pad);

    [-0.72, 0.72].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.54), mats.iron);
      leg.position.set(lx, 0.24, 0);
      leg.castShadow = true;
      g.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.52), mats.wood);
      arm.position.set(lx, 0.62, -0.02);
      g.add(arm);
    });

    [-0.14, 0.04, 0.22].forEach((sz) => {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.05, 0.14), mats.wood);
      slat.position.set(0, 0.46, sz);
      slat.castShadow = true;
      slat.receiveShadow = true;
      g.add(slat);
    });
    [0.64, 0.82].forEach((by) => {
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.13, 0.05), mats.wood);
      back.position.set(0, by, -0.25);
      back.rotation.x = -0.14;
      back.castShadow = true;
      g.add(back);
    });

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addRedTeaBench(x, z, rotY = 0, withTeaSet = true) {
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.14, 0.79), mats.redCloth);
    cloth.position.y = 0.41;
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    g.add(cloth);
    [[-0.72, -0.26], [0.72, -0.26], [-0.72, 0.26], [0.72, 0.26]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.08), mats.darkWood);
      leg.position.set(lx, 0.19, lz);
      g.add(leg);
    });
    if (withTeaSet) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.32), mats.darkWood);
      tray.position.set(0.18, 0.5, 0);
      g.add(tray);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.11, 8), mats.potBlue);
      pot.position.set(0.1, 0.57, -0.02);
      g.add(pot);
      [-0.08, 0.06].forEach((cx) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.05, 6), mats.plaster);
        cup.position.set(0.24 + cx * 0.5, 0.54, 0.06);
        g.add(cup);
      });
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addVendingMachine(x, z, rotY = 0, bodyColor = 0xd93d38) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.88, 0.72), getColorMat(bodyColor, 0.48));
    body.position.y = 0.94;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.98), mats.vendingFront);
    display.position.set(-0.04, 1.24, 0.365);
    g.add(display);

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.05), mats.iron);
    slot.position.set(-0.04, 0.42, 0.35);
    g.add(slot);

    const coinPanel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.04), mats.whiteMetal);
    coinPanel.position.set(0.39, 1.0, 0.36);
    g.add(coinPanel);

    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.52), mats.whiteMetal);
    bin.position.set(0.76, 0.425, 0);
    bin.castShadow = true;
    g.add(bin);
    const binTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.54), mats.crateBlue);
    binTop.position.set(0.76, 0.86, 0);
    g.add(binTop);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addUtilityPole(x, z, rotY = 0) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 6.4, 8), mats.poleConcrete);
    pole.position.y = 3.2;
    pole.castShadow = true;
    g.add(pole);

    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 1.4, 8), mats.yellowCaution);
    guard.position.y = 0.9;
    g.add(guard);

    [5.85, 5.35].forEach((ay, idx) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3 - idx * 0.2, 0.08, 0.08), mats.iron);
      arm.position.y = ay;
      g.add(arm);
    });

    const xfmr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.58, 8), mats.poleConcrete);
    xfmr.position.set(0.26, 4.75, 0);
    g.add(xfmr);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
    return new THREE.Vector3(x, 5.85, z);
  }

  function connectWireSpan(p1, p2, sag = 0.45) {
    [-0.36, 0.36].forEach((offset) => {
      const a = new THREE.Vector3(p1.x + offset * 0.4, p1.y, p1.z + offset * 0.4);
      const b = new THREE.Vector3(p2.x + offset * 0.4, p2.y, p2.z + offset * 0.4);
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= sag;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const geo = new THREE.TubeGeometry(curve, 6, 0.016, 4, false);
      const wire = new THREE.Mesh(geo, mats.cable);
      townGroup.add(wire);
    });
  }

  function addCurvedMirror(x, z, rotY = 0) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.5, 6), mats.yellowCaution);
    pole.position.y = 1.25;
    pole.castShadow = true;
    g.add(pole);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12), mats.crateOrange);
    hood.rotation.x = Math.PI / 2;
    hood.position.set(0, 2.45, 0.04);
    g.add(hood);
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.29, 12), mats.mirrorGlass);
    mirror.position.set(0, 2.45, 0.115);
    g.add(mirror);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addPostbox(x, z, rotY = 0) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.45, 8), mats.iron);
    base.position.y = 0.225;
    g.add(base);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.72, 10), mats.redCloth);
    drum.position.y = 0.8;
    drum.castShadow = true;
    g.add(drum);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.redCloth);
    cap.position.y = 1.16;
    g.add(cap);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.05), mats.iron);
    slot.position.set(0, 0.96, 0.23);
    g.add(slot);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addBusStop(x, z, rotY = 0) {
    const g = new THREE.Group();
    const signBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8), mats.granite);
    signBase.position.set(-1.15, 0.07, 0.55);
    g.add(signBase);
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.05, 6), mats.whiteMetal);
    signPole.position.set(-1.15, 1.05, 0.55);
    g.add(signPole);
    const signDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 12), mats.busSign);
    signDisc.rotation.x = Math.PI / 2;
    signDisc.position.set(-1.15, 1.98, 0.55);
    g.add(signDisc);

    [-0.85, 0.95].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.25, 0.11), mats.darkWood);
      post.position.set(px, 1.125, -0.45);
      post.castShadow = true;
      g.add(post);
    });
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 0.06), mats.wood);
    backPanel.position.set(0.05, 1.35, -0.45);
    g.add(backPanel);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.12, 1.35), mats.roof);
    roof.position.set(0.05, 2.3, 0.05);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    g.add(roof);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.45), mats.wood);
    bench.position.set(0.05, 0.45, -0.15);
    g.add(bench);
    [-0.65, 0.75].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), mats.iron);
      leg.position.set(lx, 0.225, -0.15);
      g.add(leg);
    });

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addNoticeBoard(x, z, rotY = 0) {
    const g = new THREE.Group();
    [-0.7, 0.7].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.05, 0.1), mats.darkWood);
      post.position.set(px, 1.025, 0);
      post.castShadow = true;
      g.add(post);
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.95, 0.08), mats.noticeBoard);
    board.position.set(0, 1.35, 0);
    board.castShadow = true;
    g.add(board);
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.42), mats.roof);
    roofL.position.set(0, 2.08, 0.15);
    roofL.rotation.x = 0.35;
    const roofR = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.42), mats.roof);
    roofR.position.set(0, 2.08, -0.15);
    roofR.rotation.x = -0.35;
    g.add(roofL, roofR);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addBicycle(x, z, rotY = 0, frameColor = 0x3b6c88) {
    const g = new THREE.Group();
    const frameMat = getColorMat(frameColor, 0.45, 0.3);
    [-0.5, 0.5].forEach((wx) => {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.038, 6, 12), mats.iron);
      tire.position.set(wx, 0.31, 0);
      g.add(tire);
    });
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.65, 5), frameMat);
    crossbar.rotation.z = Math.PI / 2 - 0.15;
    crossbar.position.set(0, 0.62, 0);
    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 5), frameMat);
    seatPost.rotation.z = 0.22;
    seatPost.position.set(-0.22, 0.58, 0);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), mats.darkWood);
    saddle.position.set(-0.28, 0.87, 0);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.64, 5), frameMat);
    fork.rotation.z = 0.24;
    fork.position.set(0.36, 0.62, 0);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 5), mats.whiteMetal);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.3, 0.94, 0);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), mats.iron);
    basket.position.set(0.52, 0.76, 0);
    g.add(crossbar, seatPost, saddle, fork, handle, basket);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addSakeBarrels(x, z, rotY = 0) {
    const g = new THREE.Group();
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.6), mats.darkWood);
    pallet.position.y = 0.06;
    g.add(pallet);
    [[-0.27, 0.34, 0], [0.27, 0.34, 0], [0, 0.78, 0]].forEach(([bx, by, bz]) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.46, 8), mats.rope);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(bx, by, bz);
      drum.castShadow = true;
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.244, 0.244, 0.2, 8), mats.plaster);
      label.rotation.x = Math.PI / 2;
      label.position.set(bx, by, bz);
      g.add(drum, label);
    });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addPottedPlant(x, z, potMat = mats.potTerracotta, leafMat = mats.hedgeLeaf, scale = 1) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 8), potMat);
    pot.position.y = 0.16;
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), leafMat);
    bush.position.y = 0.46;
    g.add(pot, bush);
    g.scale.setScalar(scale);
    g.position.set(x, 0, z);
    townGroup.add(g);
  }

  function addHydrangeaBush(x, z, flowerColor = 0x6f8fd6, scale = 1) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mats.hedgeLeaf);
    base.scale.set(1.2, 0.75, 1.1);
    base.position.y = 0.34;
    g.add(base);
    const flowerMat = getColorMat(flowerColor, 0.88);
    [[-0.3, 0.56, 0.2], [0.28, 0.6, 0.16], [0, 0.68, -0.15]].forEach(([fx, fy, fz]) => {
      const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), flowerMat);
      bloom.position.set(fx, fy, fz);
      g.add(bloom);
    });
    g.scale.setScalar(scale);
    g.position.set(x, 0, z);
    townGroup.add(g);
  }

  function addAwning(x, z, rotY, width, texMat) {
    const g = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.95), texMat);
    canopy.position.set(0, 2.38, 0.42);
    canopy.rotation.x = 0.32;
    canopy.castShadow = true;
    g.add(canopy);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addAFrameSign(x, z, rotY = 0, boardColor = 0x2f3b35) {
    const g = new THREE.Group();
    const boardMat = getColorMat(boardColor, 0.9);
    [-0.18, 0.18].forEach((sz, idx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.86, 0.04), mats.darkWood);
      leg.position.set(0, 0.42, sz);
      leg.rotation.x = idx === 0 ? 0.22 : -0.22;
      g.add(leg);
    });
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.05), boardMat);
    face.position.set(0, 0.48, 0.2);
    face.rotation.x = 0.22;
    g.add(face);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  function addCourtyardWall(x1, z1, x2, z2, type = 'plaster') {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return;
    const g = new THREE.Group();
    if (type === 'plaster') {
      const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(len, 0.42, 0.28), mats.stone);
      stoneBase.position.y = 0.21;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 0.72, 0.22), mats.plaster);
      wall.position.y = 0.78;
      wall.castShadow = true;
      wall.receiveShadow = true;
      const coping = new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, 0.14, 0.34), mats.roof);
      coping.position.y = 1.2;
      coping.castShadow = true;
      g.add(stoneBase, wall, coping);
    } else if (type === 'bamboo') {
      const posts = Math.max(2, Math.floor(len / 1.4) + 1);
      for (let i = 0; i < posts; i += 1) {
        const px = -len / 2 + (i / (posts - 1)) * len;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.95, 5), mats.bambooDry);
        p.position.set(px, 0.475, 0);
        g.add(p);
      }
      [0.32, 0.72].forEach((ry) => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 5), mats.bambooDry);
        rail.rotation.z = Math.PI / 2;
        rail.position.y = ry;
        g.add(rail);
      });
    } else if (type === 'park') {
      const posts = Math.max(2, Math.floor(len / 2.2) + 1);
      for (let i = 0; i < posts; i += 1) {
        const px = -len / 2 + (i / (posts - 1)) * len;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.85, 0.11), mats.wood);
        p.position.set(px, 0.425, 0);
        g.add(p);
      }
      [0.4, 0.75].forEach((ry) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.05), mats.wood);
        rail.position.y = ry;
        g.add(rail);
      });
    }
    g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    g.rotation.y = -Math.atan2(dz, dx);
    townGroup.add(g);
  }

  function addHedge(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.72, 0.55), mats.hedgeLeaf);
    hedge.position.set((x1 + x2) / 2, 0.36, (z1 + z2) / 2);
    hedge.rotation.y = -Math.atan2(dz, dx);
    hedge.castShadow = true;
    townGroup.add(hedge);
  }

  function addACAndGas(x, z, rotY = 0) {
    const g = new THREE.Group();
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.54, 0.28), mats.whiteMetal);
    ac.position.set(-0.35, 0.27, 0);
    g.add(ac);
    [0.24, 0.52].forEach((gx) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.94, 8), mats.poleConcrete);
      tank.position.set(gx, 0.47, 0);
      g.add(tank);
    });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    townGroup.add(g);
  }

  // ---------------------------------------------------------------------------
  // 4. 일본식 가로수·조경 식재 빌더
  // ---------------------------------------------------------------------------
  function addBlackPine(x, z, scale = 1, rotY = 0) {
    const g = new THREE.Group();
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6), mats.pineTrunk);
    lower.position.set(0, 0.72, 0);
    lower.rotation.z = 0.08;
    lower.castShadow = true;
    g.add(lower);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.45, 6), mats.pineTrunk);
    upper.position.set(-0.14, 1.95, 0.05);
    upper.rotation.z = -0.18;
    g.add(upper);

    [
      { p: [-0.65, 2.25, 0.1], s: [1.15, 0.34, 0.88], m: mats.pineLeafA, cast: true },
      { p: [0.55, 2.52, -0.18], s: [1.05, 0.32, 0.82], m: mats.pineLeafB, cast: false },
      { p: [-0.08, 2.95, 0.08], s: [1.22, 0.36, 0.92], m: mats.pineLeafA, cast: true },
      { p: [0.22, 3.32, -0.05], s: [0.85, 0.28, 0.7], m: mats.pineLeafB, cast: false }
    ].forEach(({ p, s, m, cast }) => {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m);
      pad.position.set(...p);
      pad.scale.set(...s);
      pad.castShadow = cast;
      g.add(pad);
    });

    g.scale.setScalar(scale);
    g.rotation.y = rotY;
    g.position.set(x, 0, z);
    townGroup.add(g);
  }

  function addSakuraTree(x, z, scale = 1, rotY = 0) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 1.85, 6), mats.sakuraTrunk);
    trunk.position.y = 0.92;
    trunk.castShadow = true;
    g.add(trunk);

    [
      { p: [-0.55, 2.55, 0.25], r: 1.05, m: mats.sakuraA, cast: true },
      { p: [0.58, 2.65, -0.2], r: 0.98, m: mats.sakuraB, cast: false },
      { p: [0.0, 3.15, 0.0], r: 1.15, m: mats.sakuraA, cast: true },
      { p: [-0.2, 2.85, -0.45], r: 0.88, m: mats.sakuraC, cast: false },
      { p: [0.28, 2.92, 0.45], r: 0.86, m: mats.sakuraB, cast: false }
    ].forEach(({ p, r, m, cast }) => {
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m);
      crown.scale.y = 0.72;
      crown.position.set(...p);
      crown.castShadow = cast;
      g.add(crown);
    });

    g.scale.setScalar(scale);
    g.rotation.y = rotY;
    g.position.set(x, 0, z);
    townGroup.add(g);
  }

  function addMapleOrEvergreen(x, z, isMaple = false, scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.55, 6), mats.sakuraTrunk);
    trunk.position.y = 0.77;
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = isMaple ? mats.mapleLeaf : mats.hedgeLeaf;
    [
      [0, 2.15, 0, 0.88, true], [-0.45, 1.95, 0.25, 0.65, false], [0.45, 2.02, -0.2, 0.68, false]
    ].forEach(([cx, cy, cz, r, cast]) => {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), leafMat);
      puff.scale.y = 0.75;
      puff.position.set(cx, cy, cz);
      puff.castShadow = cast;
      g.add(puff);
    });
    g.scale.setScalar(scale);
    g.position.set(x, 0, z);
    townGroup.add(g);
  }

  function addBambooClump(x, z, count = 6) {
    const g = new THREE.Group();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + i * 0.4;
      const dist = 0.18 + (i % 3) * 0.24;
      const h = 3.2 + (i % 4) * 0.65;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, h, 5), mats.bamboo);
      stalk.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
      stalk.rotation.z = Math.sin(i * 2.1) * 0.06;
      g.add(stalk);

      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mats.hedgeLeaf);
      tuft.scale.set(1.2, 0.55, 1.2);
      tuft.position.set(stalk.position.x, h - 0.15, stalk.position.z);
      tuft.castShadow = i % 2 === 0;
      g.add(tuft);
    }
    g.position.set(x, 0, z);
    townGroup.add(g);
  }

  // ---------------------------------------------------------------------------
  // 5. 거리 인프라 배치
  // ---------------------------------------------------------------------------
  const westPoles = [
    addUtilityPole(-4.9, -10.5, Math.PI / 2),
    addUtilityPole(-4.9, 6.2, Math.PI / 2),
    addUtilityPole(-4.9, 22.0, Math.PI / 2),
    addUtilityPole(-4.9, 38.0, Math.PI / 2),
    addUtilityPole(-4.9, 54.0, Math.PI / 2),
    addUtilityPole(-4.9, 70.0, Math.PI / 2)
  ];
  for (let i = 0; i < westPoles.length - 1; i += 1) {
    connectWireSpan(westPoles[i], westPoles[i + 1], 0.48);
  }

  const eastPoles = [
    addUtilityPole(4.9, -10.5, -Math.PI / 2),
    addUtilityPole(4.9, 6.2, -Math.PI / 2),
    addUtilityPole(4.9, 22.0, -Math.PI / 2),
    addUtilityPole(4.9, 38.0, -Math.PI / 2),
    addUtilityPole(4.9, 54.0, -Math.PI / 2),
    addUtilityPole(4.9, 70.0, -Math.PI / 2)
  ];
  for (let i = 0; i < eastPoles.length - 1; i += 1) {
    connectWireSpan(eastPoles[i], eastPoles[i + 1], 0.48);
  }

  const westCrossPole = addUtilityPole(-15.5, 6.4, 0);
  const eastCrossPole = addUtilityPole(15.5, 11.6, Math.PI);
  connectWireSpan(westPoles[1], westCrossPole, 0.35);
  connectWireSpan(eastPoles[1], eastCrossPole, 0.35);
  connectWireSpan(westPoles[1], eastPoles[1], 0.25);

  addCurvedMirror(-3.2, 6.6, Math.PI / 4);
  addCurvedMirror(3.2, 11.4, -Math.PI * 0.75);
  addPostbox(-3.35, 11.55, Math.PI / 2);
  addBusStop(5.55, 12.2, Math.PI);
  addNoticeBoard(-4.5, -10.8, Math.PI * 0.35);

  [
    [-3.35, -8.2, Math.PI / 2],
    [3.35, -8.2, -Math.PI / 2],
    [-3.35, 3.0, Math.PI / 2],
    [3.35, 3.3, -Math.PI / 2],
    [-3.35, 22.5, Math.PI / 2],
    [3.35, 22.5, -Math.PI / 2],
    [-3.35, 34.5, Math.PI / 2],
    [3.35, 34.5, -Math.PI / 2],
    [-3.35, 58.0, Math.PI / 2],
    [3.35, 58.0, -Math.PI / 2]
  ].forEach(([x, z, r]) => addWoodenBench(x, z, r));

  addVendingMachine(-7.2, 13.0, Math.PI / 2, 0xd83b36);
  addVendingMachine(7.2, 5.7, -Math.PI / 2, 0x2c6ca8);
  addVendingMachine(-7.2, 36.2, Math.PI / 2, 0xe4e8ec);
  addVendingMachine(7.2, -9.8, -Math.PI / 2, 0xd83b36);

  // 도리이 안쪽 마을 입구 석등 & 소나무 한 쌍 (z = -11.5, 해변 침범 없음)
  addStoneLantern(-3.25, -11.4);
  addStoneLantern(3.25, -11.4);
  addBlackPine(-6.8, -11.6, 0.95, 0.3);
  addBlackPine(6.8, -11.6, 0.95, -0.4);

  // ---------------------------------------------------------------------------
  // 6. 각 상점 앞마당 특화 꾸미기
  // ---------------------------------------------------------------------------
  // [浜屋 -10, -6]
  addAFrameSign(-7.1, -4.3, Math.PI * 0.4);
  addPottedPlant(-7.1, -6.9, mats.potTerracotta, mats.hedgeLeaf, 1.05);
  addPottedPlant(-7.1, -5.0, mats.potBlue, mats.hedgeLeaf, 1.0);
  addWoodenBench(-6.8, -7.7, Math.PI / 2);
  addACAndGas(-12.6, -7.4, -Math.PI / 2);

  // [海の家 10, -6] (등롱 z=-7.18 피해서 오른쪽 창 z=-4.45 위에 차양 배치)
  const umiDeck = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 4.5), mats.wood);
  umiDeck.position.set(6.85, 0.07, -6);
  umiDeck.receiveShadow = true;
  townGroup.add(umiDeck);
  addAwning(7.55, -4.45, -Math.PI / 2, 1.6, mats.blueAwning);
  [
    { x: 7.75, z: -3.1, c: 0xe6845c, rz: -0.18 },
    { x: 8.12, z: -3.05, c: 0x4b9ab8, rz: -0.12 }
  ].forEach(({ x, z, c, rz }) => {
    const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.15, 4, 6), getColorMat(c, 0.4));
    board.scale.set(0.25, 1, 1);
    board.position.set(x, 0.8, z);
    board.rotation.set(0, 0.15, rz);
    board.castShadow = true;
    townGroup.add(board);
  });
  const patioTable = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), mats.wood);
  patioTable.position.set(5.45, 0.65, -4.4);
  patioTable.castShadow = true;
  const patioLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.15, 0.64, 6), mats.iron);
  patioLeg.position.set(5.45, 0.32, -4.4);
  townGroup.add(patioTable, patioLeg);
  [[5.45, -5.1], [5.45, -3.7]].forEach(([sx, sz]) => {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.42, 8), mats.wood);
    stool.position.set(sx, 0.21, sz);
    townGroup.add(stool);
  });
  addACAndGas(12.6, -7.2, Math.PI / 2);

  // [みなと -11, 2]
  addSakeBarrels(-8.0, 3.8, Math.PI / 2);
  addBicycle(-8.1, 0.15, Math.PI / 2 + 0.06, 0x3b6c88);
  addPottedPlant(-8.1, 3.0, mats.potBlue, mats.hedgeLeaf, 1.1);
  addPottedPlant(-8.1, 1.0, mats.potTerracotta, mats.hedgeLeaf, 0.95);
  addACAndGas(-13.6, 3.2, -Math.PI / 2);

  // [魚屋 11, 2] (등롱 z=0.82 피해서 z=3.55 창 위에 차양 배치)
  addAwning(8.55, 3.55, -Math.PI / 2, 1.6, mats.blueAwning);
  [0.6, 3.4].forEach((fz) => {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 1.3), mats.weatheredWood);
    stand.position.set(7.95, 0.275, fz);
    stand.castShadow = true;
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.48), mats.crateBlue);
    crate1.position.set(7.95, 0.66, fz - 0.3);
    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.48), mats.whiteMetal);
    crate2.position.set(7.95, 0.66, fz + 0.3);
    townGroup.add(stand, crate1, crate2);
  });
  const cart = new THREE.Group();
  const cartBed = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 1.25), mats.weatheredWood);
  cartBed.position.y = 0.42;
  cartBed.castShadow = true;
  cart.add(cartBed);
  [-0.5, 0.5].forEach((wx) => {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 10), mats.iron);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(wx, 0.28, 0);
    cart.add(wheel);
  });
  const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 5), mats.iron);
  handleL.rotation.x = Math.PI / 2 - 0.25;
  handleL.position.set(-0.32, 0.36, 0.92);
  const handleR = handleL.clone();
  handleR.position.x = 0.32;
  const load = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.72), mats.crateWood);
  load.position.set(0, 0.66, -0.1);
  load.castShadow = true;
  cart.add(handleL, handleR, load);
  cart.position.set(7.4, 0, 5.2);
  cart.rotation.y = -0.35;
  townGroup.add(cart);
  addACAndGas(13.6, 3.2, Math.PI / 2);

  // [民宿 -10, 17]
  addCourtyardWall(-5.2, 14.0, -5.2, 16.0, 'plaster');
  addCourtyardWall(-5.2, 18.0, -5.2, 20.0, 'plaster');
  addCourtyardWall(-7.6, 14.0, -5.2, 14.0, 'bamboo');
  addCourtyardWall(-7.6, 20.0, -5.2, 20.0, 'bamboo');
  addStoneLantern(-6.3, 15.0, 'yukimi');
  addBlackPine(-6.5, 18.8, 0.72, 0.8);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.35, 8), mats.granite);
  basin.position.set(-6.8, 0.175, 15.6);
  const waterTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 8), mats.water);
  waterTop.position.set(-6.8, 0.355, 15.6);
  townGroup.add(basin, waterTop);
  addACAndGas(-12.6, 18.2, -Math.PI / 2);

  // [おみやげ 10, 17]
  addAwning(7.55, 18.55, -Math.PI / 2, 1.6, mats.redAwning);
  [15.4, 18.5].forEach((sz) => {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.68, 1.2), mats.wood);
    rack.position.set(7.0, 0.34, sz);
    rack.castShadow = true;
    townGroup.add(rack);
    [0xcf4e45, 0x4586c2, 0xe8b546].forEach((col, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.28), getColorMat(col, 0.7));
      box.position.set(7.0, 0.8, sz - 0.36 + i * 0.36);
      townGroup.add(box);
    });
  });
  [14.1, 14.6].forEach((gz, i) => {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.42), mats.whiteMetal);
    stand.position.set(7.0, 0.275, gz);
    const globe = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.44, 0.38),
      getColorMat(i === 0 ? 0xe56055 : 0x569bd9, 0.35)
    );
    globe.position.set(7.0, 0.77, gz);
    globe.castShadow = true;
    townGroup.add(stand, globe);
  });
  addHydrangeaBush(7.0, 19.6, 0x7094db, 0.85);
  addACAndGas(12.6, 18.2, Math.PI / 2);

  // [浜の宿 -13, 29]
  addCourtyardWall(-5.0, 25.0, -5.0, 27.6, 'plaster');
  addCourtyardWall(-5.0, 30.4, -5.0, 33.0, 'plaster');
  addCourtyardWall(-10.6, 25.0, -5.0, 25.0, 'plaster');
  addCourtyardWall(-10.6, 33.0, -5.0, 33.0, 'plaster');
  const gate = new THREE.Group();
  [-1.15, 1.15].forEach((gz) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.35, 0.24), mats.darkWood);
    p.position.set(0, 1.175, gz);
    gate.add(p);
  });
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 2.9), mats.darkWood);
  gateBeam.position.set(0, 2.32, 0);
  const gateRoof = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 3.2), mats.roof);
  gateRoof.position.set(0, 2.52, 0);
  gate.add(gateBeam, gateRoof);
  gate.position.set(-5.0, 0, 29);
  townGroup.add(setShadow(gate, true, true));

  const zenBed = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.5), mats.zenGravel);
  zenBed.rotation.x = -Math.PI / 2;
  zenBed.position.set(-7.8, 0.02, 26.8);
  zenBed.receiveShadow = true;
  townGroup.add(zenBed);
  [[-8.3, 26.7, 0.42], [-7.4, 27.1, 0.3], [-7.8, 26.4, 0.25]].forEach(([rx, rz, rs]) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), mats.darkStone);
    rock.scale.y = 0.72;
    rock.position.set(rx, rs * 0.35, rz);
    townGroup.add(rock);
  });
  addStoneLantern(-6.2, 31.2, 'tall');
  addMapleOrEvergreen(-8.6, 31.3, true, 1.0);
  addSakuraTree(-11.4, 24.4, 0.85, 0.5);
  addACAndGas(-15.6, 29.8, -Math.PI / 2);

  // [しおさい 13, 29]
  addCourtyardWall(5.2, 25.2, 5.2, 27.6, 'bamboo');
  addCourtyardWall(5.2, 30.4, 5.2, 32.8, 'bamboo');
  addCourtyardWall(5.2, 25.2, 10.6, 25.2, 'bamboo');
  addCourtyardWall(5.2, 32.8, 10.6, 32.8, 'bamboo');
  const pergola = new THREE.Group();
  [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.35, 0.14), mats.darkWood);
    post.position.set(px, 1.175, pz);
    post.castShadow = true;
    pergola.add(post);
  });
  for (let b = -1.2; b <= 1.2; b += 0.6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.1), mats.darkWood);
    beam.position.set(0, 2.38, b);
    pergola.add(beam);
  }
  const vineTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 2.4), mats.hedgeLeaf);
  vineTop.position.y = 2.52;
  vineTop.castShadow = true;
  pergola.add(vineTop);
  for (let w = 0; w < 6; w += 1) {
    const drop = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), mats.wisteria);
    drop.rotation.x = Math.PI;
    drop.position.set(-0.9 + (w % 3) * 0.9, 2.15, w < 3 ? -0.5 : 0.5);
    pergola.add(drop);
  }
  pergola.position.set(7.6, 0, 26.8);
  townGroup.add(pergola);
  addRedTeaBench(7.6, 26.8, -Math.PI / 2, true);
  addHydrangeaBush(6.4, 31.3, 0x8675d1, 0.9);
  addHydrangeaBush(8.5, 31.5, 0x6c96db, 0.8);
  addStoneLantern(6.0, 30.2, 'yukimi');
  addACAndGas(15.6, 29.8, Math.PI / 2);

  // [북쪽 상점 구역 z = 42, 50, 65, 77]
  addPottedPlant(-7.1, 40.7, mats.potBlue, mats.hedgeLeaf, 1.0);
  addPottedPlant(-7.1, 43.3, mats.potTerracotta, mats.hedgeLeaf, 1.0);
  addHedge(-7.5, 39.2, -5.2, 39.2);
  addRedTeaBench(6.9, 40.5, -Math.PI / 2, true);
  addAFrameSign(6.8, 43.3, -Math.PI * 0.4);
  addSakuraTree(-6.2, 46.2, 0.9, 0.2);
  addBlackPine(6.2, 46.2, 0.9, -0.3);

  addBicycle(-8.0, 48.5, Math.PI / 2, 0xc25546);
  addAwning(8.55, 51.55, -Math.PI / 2, 1.6, mats.greenAwning);
  addAFrameSign(-7.1, 63.6, Math.PI / 2);
  addRedTeaBench(-7.0, 66.5, Math.PI / 2, false);
  addAwning(7.55, 66.55, -Math.PI / 2, 1.6, mats.redAwning);
  addSakeBarrels(-10.1, 75.2, Math.PI / 2);
  addWoodenBench(9.8, 75.5, -Math.PI / 2);

  // ---------------------------------------------------------------------------
  // 7. 서쪽 구역 (해변 마을 신사 + 텃밭/뒤뜰 + 전통 창고 + 대나무숲)
  // ---------------------------------------------------------------------------
  const shrineTorii = new THREE.Group();
  [-1.95, 1.95].forEach((tz) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 3.2, 8), mats.vermilion);
    p.position.set(0, 1.6, tz);
    shrineTorii.add(p);
    const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.35, 8), mats.darkStone);
    pBase.position.set(0, 0.175, tz);
    shrineTorii.add(pBase);
  });
  const sTop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.34, 5.4), mats.vermilion);
  sTop.position.y = 3.25;
  const sCap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 5.65), mats.iron);
  sCap.position.y = 3.45;
  const sNuki = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 4.3), mats.vermilion);
  sNuki.position.y = 2.55;
  const sPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.44), mats.shrineSign);
  sPlaque.position.set(0.14, 2.9, 0);
  shrineTorii.add(sTop, sCap, sNuki, sPlaque);
  shrineTorii.position.set(-21.5, 0, 9);
  townGroup.add(setShadow(shrineTorii, true, true));

  addStoneLantern(-24.2, 6.8, 'tall');
  addStoneLantern(-24.2, 11.2, 'tall');

  // 수세사 (手水舎)
  const chozuya = new THREE.Group();
  [[-0.95, -0.7], [0.95, -0.7], [-0.95, 0.7], [0.95, 0.7]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.2, 6), mats.darkWood);
    post.position.set(px, 1.1, pz);
    chozuya.add(post);
  });
  const cRoofL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.25), mats.roof);
  cRoofL.position.set(0, 2.45, 0.5);
  cRoofL.rotation.x = 0.42;
  const cRoofR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.25), mats.roof);
  cRoofR.position.set(0, 2.45, -0.5);
  cRoofR.rotation.x = -0.42;
  const cTrough = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.56, 0.7), mats.granite);
  cTrough.position.y = 0.28;
  const cWater = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.5), mats.water);
  cWater.position.y = 0.55;
  chozuya.add(cRoofL, cRoofR, cTrough, cWater);
  chozuya.position.set(-25.6, 0, 13.4);
  townGroup.add(setShadow(chozuya, true, true));

  // 에마 걸이대
  const emaRack = new THREE.Group();
  [-0.9, 0.9].forEach((px) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.1), mats.darkWood);
    p.position.set(px, 0.875, 0);
    emaRack.add(p);
  });
  const eRoof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.6), mats.roof);
  eRoof.position.set(0, 1.82, 0);
  eRoof.castShadow = true;
  emaRack.add(eRoof);
  [1.38, 1.02].forEach((ry) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.06), mats.darkWood);
    bar.position.set(0, ry, 0);
    emaRack.add(bar);
    for (let e = -0.68; e <= 0.68; e += 0.27) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.03), mats.crateWood);
      tile.position.set(e, ry - 0.16, 0.03);
      emaRack.add(tile);
    }
  });
  emaRack.position.set(-25.6, 0, 4.9);
  emaRack.rotation.y = 0.25;
  townGroup.add(emaRack);

  // 신사 본전
  const shrine = new THREE.Group();
  const podium = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 5.4), mats.granite);
  podium.position.y = 0.225;
  shrine.add(podium);
  [0, 1, 2].forEach((step) => {
    const sMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 2.2), mats.granite);
    sMesh.position.set(2.35 + (2 - step) * 0.34, 0.075 + step * 0.15, 0);
    shrine.add(sMesh);
  });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.45, 4.2), mats.wood);
  hall.position.set(-0.2, 1.675, 0);
  shrine.add(hall);
  const lattice = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 2.4), mats.plaster);
  lattice.position.set(1.52, 1.35, 0);
  shrine.add(lattice);
  [-1.95, 1.95].forEach((pz) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 2.55, 6), mats.vermilion);
    pillar.position.set(1.85, 1.72, pz);
    shrine.add(pillar);
  });
  const saisen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 1.15), mats.darkWood);
  saisen.position.set(1.75, 0.7, 0);
  const bellRope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.35, 6), mats.rope);
  bellRope.position.set(1.75, 2.15, 0);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mats.yellowCaution);
  bell.position.set(1.75, 2.82, 0);
  shrine.add(saisen, bellRope, bell);
  const sRoofA = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 5.4), mats.roof);
  sRoofA.position.set(-1.1, 3.35, 0);
  sRoofA.rotation.z = 0.42;
  const sRoofB = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 5.4), mats.roof);
  sRoofB.position.set(1.15, 3.32, 0);
  sRoofB.rotation.z = -0.4;
  const sRidge = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.6, 6), mats.darkWood);
  sRidge.rotation.x = Math.PI / 2;
  sRidge.position.set(-0.05, 3.98, 0);
  shrine.add(sRoofA, sRoofB, sRidge);
  shrine.position.set(-31.8, 0, 9);
  townGroup.add(setShadow(shrine, true, true));

  addCourtyardWall(-23.0, 3.5, -35.5, 3.5, 'park');
  addCourtyardWall(-23.0, 14.5, -35.5, 14.5, 'park');
  addCourtyardWall(-35.5, 3.5, -35.5, 14.5, 'park');
  addBlackPine(-28.0, 4.4, 1.15, 0.4);
  addBlackPine(-34.5, 4.2, 1.25, -0.5);
  addBlackPine(-34.8, 13.8, 1.2, 0.9);
  addSakuraTree(-28.8, 14.6, 1.1, 0.3);
  addBambooClump(-36.5, 8.8, 7);
  addBambooClump(-23.5, 16.5, 5);

  // 지장보살 사당
  const jizo = new THREE.Group();
  const jBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.9), mats.granite);
  jBase.position.y = 0.125;
  jizo.add(jBase);
  [-0.22, 0.22].forEach((jx) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.38, 8), mats.granite);
    body.position.set(jx, 0.44, 0);
    const bib = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 6), mats.redCloth);
    bib.rotation.x = Math.PI;
    bib.position.set(jx, 0.5, 0.03);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mats.granite);
    head.position.set(jx, 0.72, 0);
    jizo.add(body, bib, head);
  });
  [-0.45, 0.45].forEach((px) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), mats.darkWood);
    p.position.set(px, 0.65, -0.25);
    jizo.add(p);
  });
  const jRoof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.95), mats.roof);
  jRoof.position.set(0, 1.25, -0.05);
  jRoof.rotation.x = 0.22;
  jRoof.castShadow = true;
  jizo.add(jRoof);
  jizo.position.set(-16.5, 0, 5.7);
  townGroup.add(jizo);

  // 빨래 건조대
  const laundry = new THREE.Group();
  [-1.0, 1.0].forEach((lz) => {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.55, 5), mats.iron);
    stand.position.set(0, 0.775, lz);
    laundry.add(stand);
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 5), mats.bambooDry);
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0, 1.48, 0);
  laundry.add(pole);
  [
    { z: -0.55, w: 0.42, h: 0.52, c: 0xf4f0e8 },
    { z: 0.0, w: 0.36, h: 0.48, c: 0x7baad4 },
    { z: 0.52, w: 0.34, h: 0.42, c: 0xe69582 }
  ].forEach(({ z, w, h, c }) => {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, w), getColorMat(c, 0.95));
    cloth.position.set(0, 1.48 - h / 2 - 0.02, z);
    cloth.rotation.z = 0.08;
    cloth.castShadow = true;
    laundry.add(cloth);
  });
  laundry.position.set(-15.0, 0, -4.5);
  townGroup.add(laundry);

  // 가정 텃밭
  addCourtyardWall(-27.8, -8.8, -19.2, -8.8, 'bamboo');
  addCourtyardWall(-27.8, -0.4, -19.2, -0.4, 'bamboo');
  addCourtyardWall(-27.8, -8.8, -27.8, -0.4, 'bamboo');
  addCourtyardWall(-19.2, -8.8, -19.2, -5.4, 'bamboo');
  addCourtyardWall(-19.2, -3.2, -19.2, -0.4, 'bamboo');
  for (let row = 0; row < 4; row += 1) {
    const rz = -7.3 + row * 1.8;
    const furrow = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.14, 0.78), mats.soilDark);
    furrow.position.set(-23.5, 0.07, rz);
    furrow.receiveShadow = true;
    townGroup.add(furrow);
    for (let col = 0; col < 6; col += 1) {
      const cx = -26.0 + col * 1.0;
      const veg = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22, 0),
        row % 2 === 0 ? mats.bamboo : mats.hedgeLeaf
      );
      veg.position.set(cx, 0.24, rz);
      townGroup.add(veg);
      if (row >= 2 && col % 2 === 0) {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 4), mats.bambooDry);
        stake.position.set(cx, 0.55, rz);
        townGroup.add(stake);
      }
    }
  }

  // 정원 창고
  const gardenShed = new THREE.Group();
  const gsBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 3.0), mats.weatheredWood);
  gsBody.position.y = 1.0;
  const gsRoof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 3.4), mats.roof);
  gsRoof.position.y = 2.08;
  gsRoof.rotation.z = -0.15;
  const gsDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.65, 1.0), mats.darkWood);
  gsDoor.position.set(1.22, 0.825, 0);
  gardenShed.add(gsBody, gsRoof, gsDoor);
  gardenShed.position.set(-31.0, 0, -5.0);
  townGroup.add(setShadow(gardenShed, true, true));

  // 전통 흙벽 창고(蔵)
  const kura = new THREE.Group();
  const kBase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.95, 4.6), mats.iron);
  kBase.position.y = 0.475;
  const kWall = new THREE.Mesh(new THREE.BoxGeometry(3.7, 2.65, 4.5), mats.plaster);
  kWall.position.y = 2.25;
  const kDoor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.85, 1.2), mats.iron);
  kDoor.position.set(1.88, 0.925, 0);
  const kRoofL = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.22, 5.2), mats.roof);
  kRoofL.position.set(-1.05, 4.05, 0);
  kRoofL.rotation.z = 0.45;
  const kRoofR = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.22, 5.2), mats.roof);
  kRoofR.position.set(1.05, 4.05, 0);
  kRoofR.rotation.z = -0.45;
  const kRidge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 5.35), mats.roof);
  kRidge.position.y = 4.68;
  kura.add(kBase, kWall, kDoor, kRoofL, kRoofR, kRidge);
  kura.position.set(-24.2, 0, 24.5);
  townGroup.add(setShadow(kura, true, true));

  addBambooClump(-30.5, 29.0, 7);
  addBambooClump(-32.2, 34.0, 6);
  addBambooClump(-26.8, 36.2, 6);
  addWoodenBench(-23.2, 33.5, Math.PI / 4);
  addStoneLantern(-21.8, 34.5, 'tall');
  addBlackPine(-34.5, 22.0, 1.2, 0.3);
  addSakuraTree(-22.0, 39.5, 1.05, -0.4);

  // ---------------------------------------------------------------------------
  // 8. 동쪽 구역 (조풍 공원 + 어민 어구 창고 + 다실/주륜장)
  // ---------------------------------------------------------------------------
  addCourtyardWall(20.0, 2.0, 20.0, 7.2, 'park');
  addCourtyardWall(20.0, 10.8, 20.0, 17.0, 'park');
  addCourtyardWall(20.0, 17.0, 35.0, 17.0, 'park');
  addCourtyardWall(35.0, 2.0, 35.0, 17.0, 'park');
  addCourtyardWall(20.0, 2.0, 26.2, 2.0, 'park');
  addCourtyardWall(29.2, 2.0, 35.0, 2.0, 'park');

  const clockTower = new THREE.Group();
  const ctPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.2, 6), mats.darkWood);
  ctPole.position.y = 1.6;
  ctPole.castShadow = true;
  const ctHead = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10), mats.iron);
  ctHead.rotation.x = Math.PI / 2;
  ctHead.position.y = 3.25;
  const ctFace = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), mats.plaster);
  ctFace.position.set(0, 3.25, 0.12);
  clockTower.add(ctPole, ctHead, ctFace);
  clockTower.position.set(22.0, 0, 11.4);
  townGroup.add(clockTower);

  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.85, 8), mats.granite);
  fountain.position.set(22.2, 0.425, 6.8);
  townGroup.add(fountain);

  // 그네
  const swings = new THREE.Group();
  [[-1.4, -0.7, -0.25], [-1.4, 0.7, 0.25], [1.4, -0.7, -0.25], [1.4, 0.7, 0.25]].forEach(([px, pz, rx]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.5, 6), mats.crateBlue);
    leg.position.set(px, 1.2, pz);
    leg.rotation.x = rx;
    swings.add(leg);
  });
  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.1, 6), mats.yellowCaution);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.y = 2.38;
  topBar.castShadow = true;
  swings.add(topBar);
  [-0.6, 0.6].forEach((sx) => {
    [-0.18, 0.18].forEach((cx) => {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.85, 4), mats.iron);
      chain.position.set(sx + cx, 1.45, 0);
      swings.add(chain);
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.24), mats.crateOrange);
    seat.position.set(sx, 0.52, 0);
    swings.add(seat);
  });
  swings.position.set(25.0, 0, 5.2);
  townGroup.add(swings);

  // 미끄럼틀
  const slide = new THREE.Group();
  const sPlat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), mats.crateBlue);
  sPlat.position.set(-0.7, 1.45, 0);
  slide.add(sPlat);
  [[-1.1, -0.4], [-1.1, 0.4], [-0.3, -0.4], [-0.3, 0.4]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), mats.crateBlue);
    post.position.set(px, 0.75, pz);
    slide.add(post);
  });
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.65, 0.72), mats.yellowCaution);
  ladder.position.set(-1.35, 0.78, 0);
  ladder.rotation.z = -0.35;
  const chute = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.1, 0.72), mats.crateOrange);
  chute.position.set(0.65, 0.78, 0);
  chute.rotation.z = -0.58;
  chute.castShadow = true;
  slide.add(ladder, chute);
  slide.position.set(31.2, 0, 5.4);
  slide.rotation.y = -Math.PI / 5;
  townGroup.add(slide);

  // 공원 정자
  const gazebo = new THREE.Group();
  const gzFloor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 3.2), mats.wood);
  gzFloor.position.y = 0.08;
  gazebo.add(gzFloor);
  [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]].forEach(([px, pz]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.35, 6), mats.darkWood);
    p.position.set(px, 1.25, pz);
    gazebo.add(p);
  });
  const gzRoof = new THREE.Mesh(new THREE.ConeGeometry(2.65, 1.15, 4), mats.roof);
  gzRoof.rotation.y = Math.PI / 4;
  gzRoof.position.y = 2.95;
  gazebo.add(gzRoof);
  const gzBenchA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.45), mats.wood);
  gzBenchA.position.set(0, 0.48, -1.1);
  const gzBenchB = gzBenchA.clone();
  gzBenchB.position.z = 1.1;
  gazebo.add(gzBenchA, gzBenchB);
  gazebo.position.set(29.0, 0, 13.8);
  townGroup.add(setShadow(gazebo, true, true));

  addWoodenBench(24.5, 13.8, 0);
  addSakuraTree(22.2, 15.2, 1.05, 0.4);
  addSakuraTree(33.2, 14.5, 1.1, -0.6);
  addBlackPine(33.4, 3.6, 1.0, 0.2);
  addHydrangeaBush(21.2, 3.5, 0x7094db, 0.9);
  addHydrangeaBush(21.2, 15.6, 0xd47da0, 0.85);

  // 어민 어구 창고
  const barn = new THREE.Group();
  const bBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.7, 5.2), mats.weatheredWood);
  bBody.position.y = 1.35;
  const bRoofL = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 5.8), mats.roof);
  bRoofL.position.set(-1.1, 3.15, 0);
  bRoofL.rotation.z = 0.38;
  const bRoofR = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 5.8), mats.roof);
  bRoofR.position.set(1.1, 3.15, 0);
  bRoofR.rotation.z = -0.38;
  const bDoor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.05, 1.8), mats.darkWood);
  bDoor.position.set(-2.12, 1.025, 0);
  barn.add(bBody, bRoofL, bRoofR, bDoor);
  barn.position.set(24.2, 0, -5.5);
  townGroup.add(setShadow(barn, true, true));

  const dryRack = new THREE.Group();
  [-1.2, 1.2].forEach((rx) => {
    const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5), mats.bambooDry);
    legA.position.set(rx, 0.78, -0.28);
    legA.rotation.x = 0.2;
    const legB = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5), mats.bambooDry);
    legB.position.set(rx, 0.78, 0.28);
    legB.rotation.x = -0.2;
    dryRack.add(legA, legB);
  });
  const topPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.7, 5), mats.bambooDry);
  topPole.rotation.z = Math.PI / 2;
  topPole.position.y = 1.48;
  const netShelf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.85), mats.rope);
  netShelf.position.y = 0.95;
  dryRack.add(topPole, netShelf);
  for (let fx = -0.9; fx <= 0.9; fx += 0.36) {
    const fish = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.05), mats.plaster);
    fish.position.set(fx, 1.22, 0);
    dryRack.add(fish);
  }
  dryRack.position.set(18.5, 0, -7.2);
  townGroup.add(dryRack);

  [[18.8, -2.2], [20.6, -8.5]].forEach(([cx, cz]) => {
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.65), mats.crateBlue);
    box1.position.set(cx, 0.21, cz);
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.36, 0.58), mats.crateWood);
    box2.position.set(cx + 0.08, 0.6, cz - 0.05);
    box2.rotation.y = 0.25;
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 8), mats.rope);
    spool.position.set(cx - 0.72, 0.21, cz + 0.3);
    const floatBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mats.crateOrange);
    floatBall.position.set(cx + 0.72, 0.22, cz + 0.35);
    townGroup.add(box1, box2, spool, floatBall);
  });
  addBlackPine(31.5, -9.0, 1.2, 0.3);
  addBlackPine(34.0, -3.5, 1.15, -0.5);

  // 자전거 보관소
  const bikeShelter = new THREE.Group();
  [-1.7, 1.7].forEach((bz) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.05, 5), mats.iron);
    post.position.set(-0.7, 1.025, bz);
    bikeShelter.add(post);
  });
  const bsRoof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 4.1), mats.crateBlue);
  bsRoof.position.set(0.05, 2.05, 0);
  bsRoof.rotation.z = -0.15;
  bsRoof.castShadow = true;
  bikeShelter.add(bsRoof);
  bikeShelter.position.set(18.8, 0, 19.5);
  townGroup.add(bikeShelter);
  [-1.2, -0.4, 0.4, 1.2].forEach((oz, i) => {
    const cols = [0x3b6c88, 0xc25546, 0x4f7d58, 0xd4a442];
    addBicycle(18.8, 19.5 + oz, 0, cols[i]);
  });

  const trashBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 2.2), mats.iron);
  trashBox.position.set(16.6, 0.475, 24.5);
  const trashLid = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 2.3), mats.crateBlue);
  trashLid.position.set(16.6, 0.98, 24.5);
  townGroup.add(trashBox, trashLid);

  const teaHouse = new THREE.Group();
  const thDeck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.28, 4.2), mats.wood);
  thDeck.position.y = 0.14;
  const thBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.15, 3.2), mats.plaster);
  thBody.position.y = 1.35;
  const thShoji = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 1.8), mats.paperWarm);
  thShoji.position.set(-1.62, 1.25, 0);
  const thRoof = new THREE.Mesh(new THREE.ConeGeometry(3.45, 1.3, 4), mats.roof);
  thRoof.rotation.y = Math.PI / 4;
  thRoof.position.y = 3.05;
  teaHouse.add(thDeck, thBody, thShoji, thRoof);
  teaHouse.position.set(27.0, 0, 29.5);
  townGroup.add(setShadow(teaHouse, true, true));
  addRedTeaBench(23.5, 29.5, -Math.PI / 2, true);
  addStoneLantern(23.6, 26.8, 'yukimi');
  addMapleOrEvergreen(24.0, 33.2, true, 1.1);
  addBambooClump(32.5, 33.8, 7);
  addSakuraTree(32.5, 24.5, 1.05, 0.3);

  // ---------------------------------------------------------------------------
  // 9. 마을 외곽 및 배경 나무·수목 프레이밍
  // ---------------------------------------------------------------------------
  [
    [-19.0, -11.5, 1.1, 0.2], [-34.0, -10.5, 1.2, -0.4],
    [-36.5, 2.0, 1.15, 0.7], [-37.0, 19.0, 1.2, -0.2],
    [-36.5, 39.0, 1.15, 0.5], [-19.5, 41.0, 1.0, 0.1],
    [19.5, -11.5, 1.05, -0.3], [36.0, -11.0, 1.2, 0.6],
    [37.2, 21.0, 1.2, -0.4], [36.5, 39.0, 1.15, 0.8],
    [19.5, 41.0, 1.0, -0.2], [-18.0, 56.0, 1.15, 0.3],
    [18.0, 56.0, 1.15, -0.4], [-18.0, 72.0, 1.2, 0.1],
    [18.0, 72.0, 1.2, -0.2]
  ].forEach(([x, z, sc, r]) => addBlackPine(x, z, sc, r));

  [
    [-15.5, 12.2, 0.88, 0.1], [15.5, 5.4, 0.9, -0.2],
    [-16.0, 36.5, 0.95, 0.6], [16.5, 36.5, 0.95, -0.5]
  ].forEach(([x, z, sc, r]) => addSakuraTree(x, z, sc, r));

  [
    [-16.2, -9.8, 0.85], [16.2, -9.8, 0.9],
    [-6.0, 33.8, 0.9], [6.0, 33.8, 0.85]
  ].forEach(([x, z, sc]) => addMapleOrEvergreen(x, z, false, sc));

  // 모든 정적 마을 프롭을 머티리얼/그림자 기준으로 배칭해 드로우콜 대폭 절감
  mergeStaticTownMeshes(townGroup);
}
