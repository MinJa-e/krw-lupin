
import * as THREE from 'three';
import { io } from 'socket.io-client';
import { createStoneTower } from './stoneTower.js';
import './style.css';


// 점심 메뉴 데이터
const lunchMenus = {
  한식: [
    '김치찌개',
    '된장찌개',
    '제육볶음',
    '비빔밥',
    '불고기',
    '순두부찌개',
    '돈까스'
  ],

  양식: [
    '파스타',
    '피자',
    '햄버거',
    '스테이크',
    '리조또'
  ],

  일식: [
    '초밥',
    '라멘',
    '돈카츠',
    '규동',
    '우동'
  ],

  중식: [
    '짜장면',
    '짬뽕',
    '탕수육',
    '마파두부'
  ],

  분류전: [
    '김밥'
  ]
};

// 랜덤 점심 메뉴 추첨 함수
function getRandomLunchMenu(category = '전체') {
  const menus = category === '전체'
    ? Object.values(lunchMenus).flat()
    : lunchMenus[category] || [];

  if (menus.length === 0) {
    return '추천할 메뉴가 없습니다.';
  }

  const randomIndex = Math.floor(Math.random() * menus.length);

  return menus[randomIndex];
}


// 멀티플레이 서버 연결
const socket = io(
  import.meta.env.DEV
    ? 'http://localhost:3000'
    : 'https://krw-lupin.onrender.com'
);


const chatNickname = document.getElementById('chat-nickname');

// 서버 연결 성공
socket.on('connect', () => {
  console.log('멀티플레이 서버 연결 성공!');
  console.log('실제 연결 서버:', socket.io.uri);
  console.log('내 플레이어 ID:', socket.id);


  // 내 닉네임 서버에 등록
  socket.emit('setNickname', {
    nickname: chatNickname.value.trim() || '플레이어'
  });
});


// 다른 플레이어의 닉네임 변경 수신
socket.on('nicknameChanged', (data) => {
  const nicknameLabel = remotePlayerNames[data.id];

  if (!nicknameLabel) return;

  nicknameLabel.textContent = data.nickname;
});


// 닉네임 변경 시 서버에 즉시 전달
chatNickname.addEventListener('input', () => {
  console.log('닉네임 입력:', chatNickname.value);
  console.log('서버 연결 상태:', socket.connected);

  if (!socket.connected) return;

  socket.emit('setNickname', {
    nickname: chatNickname.value.trim() || '플레이어'
  });

  console.log('닉네임 변경 이벤트 전송 완료');
});

// 기존 플레이어 목록 수신
socket.on('currentPlayers', (players) => {
  console.log('현재 접속 중인 플레이어:', players);
});

// 새로운 플레이어 접속
socket.on('newPlayer', (player) => {
  console.log('새로운 플레이어 접속:', player);
});

// 상대방 캐릭터 이동
socket.on('playerMoved', (data) => {
  const remotePlayer = remotePlayers[data.id];

  if (!remotePlayer) return;

  const remoteAvatar = remoteAvatarControllers[data.id];
  if (remoteAvatar && data.avatarType && remoteAvatar.type !== data.avatarType) {
    setRemoteAvatarType(data.id, data.avatarType);
  }

  const currentAvatar = remoteAvatarControllers[data.id];
  if (currentAvatar && data.pose) {
    currentAvatar.pose = data.pose;
  }

  remotePlayer.position.set(
    data.x,
    data.y,
    data.z
  );

  if (data.rotationY !== undefined) {
    remotePlayer.rotation.y = data.rotationY;
  }
});

// 플레이어 퇴장
socket.on('playerDisconnected', (playerId) => {
  console.log('플레이어 퇴장:', playerId);
});

// 서버 연결 종료
socket.on('disconnect', () => {
  console.log('서버 연결이 종료되었습니다.');
});

// 장면 설정
const scene = new THREE.Scene();
const skyColor = 0x9ccfe6;
scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.Fog(skyColor, 55, 180);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#app').appendChild(renderer.domElement);

// 조명
scene.add(new THREE.HemisphereLight(0xe5f6ff, 0x84704f, 1.45));

const sun = new THREE.DirectionalLight(0xfff4dd, 2.4);
sun.position.set(-20, 32, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 48;
sun.shadow.camera.bottom = -48;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.bias = -0.00025;
scene.add(sun);

// 외부 이미지 없이도 표면의 결이 살아나도록 작은 타일 텍스처를 만든다.
function createCanvasTexture(draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext('2d');
  draw(context, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return texture;
}

const sandTexture = createCanvasTexture((context, size) => {
  const base = context.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#e6d5a8');
  base.addColorStop(1, '#d4bf8d');
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 9000; i += 1) {
    const shade = Math.random() > 0.5 ? '255, 245, 214' : '119, 99, 63';
    context.fillStyle = 'rgba(' + shade + ', ' + (Math.random() * 0.12) + ')';
    const dotSize = Math.random() * 2 + 0.4;
    context.fillRect(Math.random() * size, Math.random() * size, dotSize, dotSize);
  }
}, 38, 38);

const plasterTexture = createCanvasTexture((context, size) => {
  context.fillStyle = '#e7deca';
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 4200; i += 1) {
    const light = Math.random() > 0.5;
    context.fillStyle = light
      ? 'rgba(255, 255, 255, ' + (Math.random() * 0.12) + ')'
      : 'rgba(85, 68, 48, ' + (Math.random() * 0.06) + ')';
    context.fillRect(Math.random() * size, Math.random() * size, 2, 4 + Math.random() * 12);
  }
}, 2, 1);

const woodTexture = createCanvasTexture((context, size) => {
  context.fillStyle = '#9a704c';
  context.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 64) {
    context.fillStyle = y % 128 === 0 ? 'rgba(58, 35, 20, 0.18)' : 'rgba(255, 220, 166, 0.08)';
    context.fillRect(0, y, size, 4);

    for (let line = 0; line < 12; line += 1) {
      const lineY = y + Math.random() * 58;
      context.strokeStyle = 'rgba(67, 42, 27, ' + (Math.random() * 0.16) + ')';
      context.lineWidth = 1 + Math.random() * 2;
      context.beginPath();
      context.moveTo(0, lineY);
      context.bezierCurveTo(size * 0.3, lineY - 4, size * 0.7, lineY + 4, size, lineY);
      context.stroke();
    }
  }
}, 2, 1);

const roofTexture = createCanvasTexture((context, size) => {
  context.fillStyle = '#354a50';
  context.fillRect(0, 0, size, size);

  for (let row = 0; row < 12; row += 1) {
    const y = row * 44;
    const offset = row % 2 === 0 ? 0 : 28;

    for (let column = -1; column < 10; column += 1) {
      const x = column * 56 + offset;
      const tone = 56 + Math.floor(Math.random() * 28);
      context.fillStyle = 'rgb(' + tone + ', ' + (tone + 12) + ', ' + (tone + 14) + ')';
      context.strokeStyle = 'rgba(20, 35, 39, 0.72)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y + 3);
      context.quadraticCurveTo(x + 28, y - 5, x + 54, y + 3);
      context.lineTo(x + 50, y + 42);
      context.quadraticCurveTo(x + 27, y + 35, x + 4, y + 42);
      context.closePath();
      context.fill();
      context.stroke();

      context.strokeStyle = 'rgba(194, 207, 198, 0.2)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + 8, y + 8);
      context.quadraticCurveTo(x + 28, y + 2, x + 48, y + 8);
      context.stroke();
    }
  }
}, 3, 5);

const cobbleTexture = createCanvasTexture((context, size) => {
  context.fillStyle = '#9d988b';
  context.fillRect(0, 0, size, size);

  for (let row = 0; row < 12; row += 1) {
    const y = row * 44;
    const offset = row % 2 === 0 ? 0 : 34;

    for (let column = -1; column < 9; column += 1) {
      const x = column * 68 + offset;
      const tone = 137 + Math.floor(Math.random() * 34);
      context.fillStyle = 'rgb(' + tone + ', ' + (tone - 3) + ', ' + (tone - 13) + ')';
      context.strokeStyle = 'rgba(77, 74, 65, 0.4)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x + 4, y + 3);
      context.lineTo(x + 62, y + 5);
      context.lineTo(x + 66, y + 37);
      context.lineTo(x + 7, y + 42);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }
}, 1.5, 12);

const waterTexture = createCanvasTexture((context, size) => {
  const waterGradient = context.createLinearGradient(0, 0, size, size);
  waterGradient.addColorStop(0, '#2d899f');
  waterGradient.addColorStop(0.5, '#4aa8b4');
  waterGradient.addColorStop(1, '#277b94');
  context.fillStyle = waterGradient;
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 150; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 12 + Math.random() * 70;
    context.strokeStyle = 'rgba(210, 242, 232, ' + (Math.random() * 0.22) + ')';
    context.lineWidth = 1 + Math.random() * 2;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + length * 0.3, y - 3, x + length * 0.7, y + 3, x + length, y);
    context.stroke();
  }
}, 8, 18);

function createShopSignTexture(label) {
  return createCanvasTexture((context, size) => {
    context.fillStyle = '#eee1c6';
    context.fillRect(0, 0, size, size);
    context.strokeStyle = '#654936';
    context.lineWidth = 14;
    context.strokeRect(12, 12, size - 24, size - 24);
    context.fillStyle = '#4d382b';
    context.font = 'bold ' + Math.min(150, Math.floor(420 / label.length)) + 'px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, size / 2, size / 2 + 4);
  });
}

// 해변 마을 지형
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ map: sandTexture, color: 0xffffff, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 마을을 관통해 해변으로 이어지는 돌길
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(4.8, 96),
  new THREE.MeshStandardMaterial({ map: cobbleTexture, roughness: 1 })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.025, 22);
road.receiveShadow = true;
scene.add(road);

const crossRoad = new THREE.Mesh(
  new THREE.PlaneGeometry(38, 3.4),
  new THREE.MeshStandardMaterial({
    map: (() => {
      const texture = cobbleTexture.clone();
      texture.repeat.set(12, 1);
      return texture;
    })(),
    roughness: 1
  })
);
crossRoad.rotation.x = -Math.PI / 2;
crossRoad.position.set(0, 0.026, 9);
crossRoad.receiveShadow = true;
scene.add(crossRoad);

// 모래 해변과 얕은 물, 먼 바다
const beachTexture = sandTexture.clone();
beachTexture.repeat.set(38, 2.5);
const beach = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 13),
  new THREE.MeshStandardMaterial({ map: beachTexture, color: 0xf4e2b4, roughness: 1 })
);
beach.rotation.x = -Math.PI / 2;
beach.position.set(0, 0.012, -20);
beach.receiveShadow = true;
scene.add(beach);

const shallowWater = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 8),
  new THREE.MeshStandardMaterial({
    map: waterTexture,
    color: 0x99dddd,
    roughness: 0.32,
    metalness: 0.02,
    transparent: true,
    opacity: 0.88
  })
);
shallowWater.rotation.x = -Math.PI / 2;
shallowWater.position.set(0, 0.018, -31);
scene.add(shallowWater);

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 162),
  new THREE.MeshPhysicalMaterial({
    map: waterTexture,
    color: 0xffffff,
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32
  })
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(0, 0.014, -116);
scene.add(ocean);

// 해안가 낮은 돌제방
const seawall = new THREE.Mesh(
  new THREE.BoxGeometry(200, 0.42, 0.65),
  new THREE.MeshStandardMaterial({ map: cobbleTexture, color: 0x9ba39a, roughness: 1 })
);
seawall.position.set(0, 0.21, -27);
seawall.receiveShadow = true;
scene.add(seawall);

// 골목을 향해 문이 나 있는 작은 일본식 목조 가옥
function createJapaneseHouse(x, z, facing, wallColor, signLabel) {
  const house = new THREE.Group();
  const width = 5.4;
  const depth = 4.7;
  const wallHeight = 3.1;
  const roofRise = 1.45;
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: plasterTexture,
    color: wallColor,
    roughness: 0.93
  });
  const darkWood = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0x8a6849,
    roughness: 0.88
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    map: roofTexture,
    color: 0xffffff,
    roughness: 0.82
  });
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x4b6870, roughness: 0.65 });
  const paperMaterial = new THREE.MeshStandardMaterial({ color: 0xf4e5c4, roughness: 1 });
  const lanternMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8a45c,
    emissive: 0x6f2c08,
    emissiveIntensity: 0.25
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    wallMaterial
  );
  body.position.y = wallHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-width / 2, 0);
  gableShape.lineTo(width / 2, 0);
  gableShape.lineTo(0, roofRise);
  gableShape.closePath();

  const frontGable = new THREE.Mesh(
    new THREE.ShapeGeometry(gableShape),
    wallMaterial
  );
  frontGable.position.set(0, wallHeight, depth / 2 + 0.012);
  house.add(frontGable);

  const backGable = frontGable.clone();
  backGable.position.z = -depth / 2 - 0.012;
  backGable.rotation.y = Math.PI;
  house.add(backGable);

  const roofAngle = Math.atan2(roofRise, width / 2 + 0.55);
  const roofLength = Math.hypot(width / 2 + 0.55, roofRise);
  const leftRoof = new THREE.Mesh(
    new THREE.BoxGeometry(roofLength, 0.2, depth + 0.8),
    roofMaterial
  );
  leftRoof.position.set(-width / 4, wallHeight + roofRise / 2, 0);
  leftRoof.rotation.z = roofAngle;
  leftRoof.castShadow = true;
  house.add(leftRoof);

  const rightRoof = leftRoof.clone();
  rightRoof.position.x = width / 4;
  rightRoof.rotation.z = -roofAngle;
  house.add(rightRoof);

  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, depth + 1, 8),
    darkWood
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = wallHeight + roofRise;
  house.add(ridge);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 1.8, 0.11),
    darkWood
  );
  door.position.set(0, 0.9, depth / 2 + 0.065);
  house.add(door);

  // 창문(셰) — 창틀·유리·살 대칭 격자를 묶어 방향만 바꿔 모든 벽면에서 재사용
  const windowFrameGeometry = new THREE.BoxGeometry(1.08, 1.05, 0.1);
  const windowPaneGeometry = new THREE.BoxGeometry(0.82, 0.78, 0.035);
  const windowDividerGeometry = new THREE.BoxGeometry(0.055, 0.82, 0.045);
  const windowCrossGeometry = new THREE.BoxGeometry(0.82, 0.055, 0.045);

  const createWindow = (paneMaterial = windowMaterial) => {
    const windowGroup = new THREE.Group();
    windowGroup.add(new THREE.Mesh(windowFrameGeometry, darkWood));

    const pane = new THREE.Mesh(windowPaneGeometry, paneMaterial);
    pane.position.z = 0.06;
    windowGroup.add(pane);

    const divider = new THREE.Mesh(windowDividerGeometry, darkWood);
    divider.position.z = 0.085;
    windowGroup.add(divider);

    const crossDivider = new THREE.Mesh(windowCrossGeometry, darkWood);
    crossDivider.position.z = 0.085;
    windowGroup.add(crossDivider);

    return windowGroup;
  };

  [-1.55, 1.55].forEach((windowX) => {
    const frontWindow = createWindow();
    frontWindow.position.set(windowX, 1.85, depth / 2 + 0.07);
    house.add(frontWindow);
  });

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.45, 0.15),
    new THREE.MeshStandardMaterial({
      map: createShopSignTexture(signLabel),
      roughness: 0.9
    })
  );
  sign.position.set(0, 2.72, depth / 2 + 0.08);
  house.add(sign);

  const noren = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.38, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x9c5547, roughness: 1 })
  );
  noren.position.set(0, 2.38, depth / 2 + 0.1);
  house.add(noren);

  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.24, 0.62, 16),
    lanternMaterial
  );
  lantern.position.set(1.18, 2.45, depth / 2 + 0.24);
  house.add(lantern);

  const lanternCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16),
    darkWood
  );
  lanternCap.position.set(1.18, 2.82, depth / 2 + 0.24);
  house.add(lanternCap);

  [-2.55, 2.55].forEach((postX) => {
    const frontPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, wallHeight, 0.16),
      darkWood
    );
    frontPost.position.set(postX, wallHeight / 2, depth / 2 + 0.08);
    house.add(frontPost);
  });

  const frontBeam = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.35, 0.16, 0.18),
    darkWood
  );
  frontBeam.position.set(0, wallHeight - 0.08, depth / 2 + 0.08);
  house.add(frontBeam);

  // 좌·우 측벽 — 하부 목재 판벽, 상부 보, 가운데 기둥, 커튼 창 2개
  [-1, 1].forEach((side) => {
    const sideX = side * (width / 2);

    [-1.25, 1.25].forEach((offsetZ) => {
      const sideWindow = createWindow();
      sideWindow.rotation.y = side === 1 ? Math.PI / 2 : -Math.PI / 2;
      sideWindow.position.set(sideX + side * 0.07, 1.85, offsetZ);
      house.add(sideWindow);
    });

    const sideBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.62, depth),
      darkWood
    );
    sideBase.position.set(sideX + side * 0.05, 0.31, 0);
    house.add(sideBase);

    const sideBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, depth + 0.16),
      darkWood
    );
    sideBeam.position.set(sideX + side * 0.08, wallHeight - 0.08, 0);
    house.add(sideBeam);

    const sidePost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, wallHeight, 0.16),
      darkWood
    );
    sidePost.position.set(sideX + side * 0.08, wallHeight / 2, 0);
    house.add(sidePost);
  });

  // 뒷면 — 뒷문, 띠창 2개, 판벽, 보, 기둥
  const backDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.65, 0.11),
    darkWood
  );
  backDoor.position.set(0, 0.825, -(depth / 2 + 0.065));
  house.add(backDoor);

  [-1.55, 1.55].forEach((windowX) => {
    const backWindow = createWindow(paperMaterial);
    backWindow.rotation.y = Math.PI;
    backWindow.position.set(windowX, 1.85, -(depth / 2 + 0.07));
    house.add(backWindow);
  });

  const backBase = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.62, 0.1),
    darkWood
  );
  backBase.position.set(0, 0.31, -(depth / 2 + 0.05));
  house.add(backBase);

  const backBeam = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.35, 0.16, 0.18),
    darkWood
  );
  backBeam.position.set(0, wallHeight - 0.08, -(depth / 2 + 0.08));
  house.add(backBeam);

  [-2.55, 2.55].forEach((postX) => {
    const backPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, wallHeight, 0.16),
      darkWood
    );
    backPost.position.set(postX, wallHeight / 2, -(depth / 2 + 0.08));
    house.add(backPost);
  });

  // 박공(삼각 벽) 위의 둥근 창 — 정면과 뒷면 모두
  const roundRingGeometry = new THREE.TorusGeometry(0.36, 0.075, 8, 20);
  const roundPaneGeometry = new THREE.CircleGeometry(0.33, 20);
  const roundSpokeGeometry = new THREE.BoxGeometry(0.66, 0.05, 0.05);
  const roundCrossSpokeGeometry = new THREE.BoxGeometry(0.05, 0.66, 0.05);

  const createRoundWindow = () => {
    const roundGroup = new THREE.Group();
    roundGroup.add(new THREE.Mesh(roundRingGeometry, darkWood));

    const roundPane = new THREE.Mesh(roundPaneGeometry, windowMaterial);
    roundPane.position.z = 0.02;
    roundGroup.add(roundPane);

    const roundSpoke = new THREE.Mesh(roundSpokeGeometry, darkWood);
    roundGroup.add(roundSpoke);

    const roundCrossSpoke = new THREE.Mesh(roundCrossSpokeGeometry, darkWood);
    roundGroup.add(roundCrossSpoke);

    return roundGroup;
  };

  const frontRoundWindow = createRoundWindow();
  frontRoundWindow.position.set(0, wallHeight + roofRise * 0.42, depth / 2 + 0.05);
  house.add(frontRoundWindow);

  const backRoundWindow = createRoundWindow();
  backRoundWindow.rotation.y = Math.PI;
  backRoundWindow.position.set(0, wallHeight + roofRise * 0.42, -(depth / 2 + 0.05));
  house.add(backRoundWindow);

  house.position.set(x, 0, z);
  house.rotation.y = facing;
  house.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  scene.add(house);
}

[
  [-10, -6, Math.PI / 2, 0xe3d4b7, '浜屋'],
  [10, -6, -Math.PI / 2, 0xd6c5a6, '海の家'],
  [-11, 2, Math.PI / 2, 0xe9dfc9, 'みなと'],
  [11, 2, -Math.PI / 2, 0xdcc9a9, '魚屋'],
  [-10, 17, Math.PI / 2, 0xd8c8aa, '民宿'],
  [10, 17, -Math.PI / 2, 0xe5d8bd, 'おみやげ'],
  [-13, 29, Math.PI / 2, 0xe0d1b3, '浜の宿'],
  [13, 29, -Math.PI / 2, 0xd6c5a7, 'しおさい'],
  // 북쪽 루프 구역 (겹침 없이 간격과 배치가 깔끔하도록 조정)
  [-10, -6 + 48, Math.PI / 2, 0xe3d4b7, '呉服店'],
  [10, -6 + 48, -Math.PI / 2, 0xd6c5a6, '茶屋'],
  [-11, 2 + 48, Math.PI / 2, 0xe9dfc9, '文具店'],
  [11, 2 + 48, -Math.PI / 2, 0xdcc9a9, '果物屋'],
  [-10, 17 + 48, Math.PI / 2, 0xd8c8aa, '和菓子'],
  [10, 17 + 48, -Math.PI / 2, 0xe5d8bd, '雑貨店'],
  [-13, 29 + 48, Math.PI / 2, 0xe0d1b3, '酒屋'],
  [13, 29 + 48, -Math.PI / 2, 0xd6c5a7, '食堂']
].forEach(([x, z, facing, wallColor, signLabel]) => {
  createJapaneseHouse(x, z, facing, wallColor, signLabel);
});

// 마을에서 해변으로 이어지는 붉은 도리이
const torii = new THREE.Group();
const toriiMaterial = new THREE.MeshStandardMaterial({ color: 0xa94332, roughness: 0.85 });

[-2.65, 2.65].forEach((x) => {
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, 3.5, 8),
    toriiMaterial
  );
  pillar.position.set(x, 1.75, 0);
  pillar.castShadow = true;
  torii.add(pillar);
});

const toriiTop = new THREE.Mesh(
  new THREE.BoxGeometry(7.1, 0.48, 0.62),
  toriiMaterial
);
toriiTop.position.set(0, 3.55, 0);
toriiTop.castShadow = true;
torii.add(toriiTop);

const toriiCrossbar = new THREE.Mesh(
  new THREE.BoxGeometry(5.3, 0.24, 0.48),
  toriiMaterial
);
toriiCrossbar.position.set(0, 2.72, 0);
torii.add(toriiCrossbar);
torii.position.z = -13.5;
scene.add(torii);

// 돌길을 밝히는 목재 등롱
function createVillageLantern(x, z) {
  const post = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x604a35, roughness: 1 });
  const paper = new THREE.MeshStandardMaterial({
    color: 0xf0bd74,
    emissive: 0x6a3210,
    emissiveIntensity: 0.3
  });

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 2.25, 16),
    wood
  );
  pole.position.y = 1.125;
  post.add(pole);

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.58), paper);
  lamp.position.y = 2.62;
  post.add(lamp);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.82), wood);
  cap.position.y = 3.02;
  post.add(cap);

  post.position.set(x, 0, z);
  post.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  scene.add(post);
}

[
  [-4.1, -5], [4.1, -5],
  [-4.1, 5], [4.1, 5],
  [-4.1, 19], [4.1, 19],
  [-4.1, -12], [4.1, -12],
  [-4.1, 12], [4.1, 12],
  [-4.1, 26], [4.1, 26],
  [-4.1, 38], [4.1, 38],
  [-4.1, 50], [4.1, 50]
].forEach(([x, z]) => createVillageLantern(x, z));

// 마을 풍성함을 위한 벤치, 자판기, 가로수 추가
function createVillageBench(x, z, rotationY = 0) {
  const bench = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.6), woodMat);
  seat.position.y = 0.45;
  bench.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), woodMat);
  back.position.set(0, 0.75, -0.26);
  bench.add(back);

  [-0.7, 0.7].forEach((bx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.5), ironMat);
    leg.position.set(bx, 0.225, 0);
    bench.add(leg);
  });

  bench.position.set(x, 0, z);
  bench.rotation.y = rotationY;
  bench.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  scene.add(bench);
}

function createVillageVendingMachine(x, z, rotationY = 0) {
  const vm = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd93838, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.2, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.7), bodyMat);
  body.position.y = 0.9;
  vm.add(body);

  const windowPanel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.05), glassMat);
  windowPanel.position.set(0, 1.05, 0.36);
  vm.add(windowPanel);

  vm.position.set(x, 0, z);
  vm.rotation.y = rotationY;
  vm.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  scene.add(vm);
}

function createVillageTree(x, z) {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1 });
  const leavesMat = new THREE.MeshStandardMaterial({ color: 0x3d7a49, roughness: 0.9 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 8), trunkMat);
  trunk.position.y = 1.1;
  tree.add(trunk);

  const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 12), leavesMat);
  leaves.position.y = 2.6;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  tree.traverse((obj) => { if (obj.isMesh) obj.castShadow = true; });
  scene.add(tree);
}

// 배치 실행
createVillageBench(-3.2, 3, Math.PI / 2);
createVillageBench(3.2, 3, -Math.PI / 2);
createVillageBench(-3.2, -8, Math.PI / 2);
createVillageBench(3.2, -8, -Math.PI / 2);

createVillageVendingMachine(-6.2, 8, Math.PI / 2);
createVillageVendingMachine(6.2, -3, -Math.PI / 2);

[
  [-8, -12], [8, -12],
  [-9, 8], [9, 8],
  [-8, 22], [8, 22]
].forEach(([x, z]) => createVillageTree(x, z));

// 해변 파라솔
function createBeachUmbrella(x, z, canopyColor) {
  const umbrella = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 1.75, 16),
    new THREE.MeshStandardMaterial({ color: 0x76553a, roughness: 1 })
  );
  pole.position.y = 0.9;
  umbrella.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.45, 0.48, 32),
    new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 0.9 })
  );
  canopy.position.y = 1.88;
  umbrella.add(canopy);

  umbrella.position.set(x, 0, z);
  umbrella.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  scene.add(umbrella);
}

createBeachUmbrella(-7, -20, 0xe98b6d);
createBeachUmbrella(7, -20, 0x628fa0);

// 해안 가까이에 정박한 작은 어선
const fishingBoat = new THREE.Group();
const boatWood = new THREE.MeshStandardMaterial({
  map: woodTexture,
  color: 0x875a37,
  roughness: 0.82
});
const boatShape = new THREE.Shape();
boatShape.moveTo(-2.35, -0.55);
boatShape.quadraticCurveTo(-2.65, 0, -2.35, 0.55);
boatShape.lineTo(1.7, 0.55);
boatShape.quadraticCurveTo(2.55, 0.34, 2.65, 0);
boatShape.quadraticCurveTo(2.55, -0.34, 1.7, -0.55);
boatShape.closePath();

const boatHull = new THREE.Mesh(
  new THREE.ExtrudeGeometry(boatShape, {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 3,
    curveSegments: 12
  }),
  boatWood
);
boatHull.rotation.x = -Math.PI / 2;
boatHull.position.y = 0.08;
fishingBoat.add(boatHull);

const boatCabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.25, 0.82, 1.05),
  new THREE.MeshStandardMaterial({ color: 0xf0e5cf, roughness: 0.95 })
);
boatCabin.position.set(-0.65, 0.9, 0);
fishingBoat.add(boatCabin);

fishingBoat.position.set(10, 0, -40);
fishingBoat.rotation.y = -0.12;
fishingBoat.traverse((object) => {
  if (object.isMesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});
scene.add(fishingBoat);


// 플레이어 위치/방향을 담당하는 루트와 외형 모델을 분리합니다.
const player = new THREE.Group();
const humanAvatarTemplate = new THREE.Group();

// 재질
const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd0ad });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x493126 });
const shirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x303d59 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e9 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x252525 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

// 구체 생성 함수
function makeSphere(parent, radius, position, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    material
  );

  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

// 몸통
const torso = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.26, 0.45, 6, 12),
  shirtMat
);
torso.position.y = 1.05;
torso.scale.set(1.3, 1, 1);
torso.name = 'avatar-torso';
torso.castShadow = true;
humanAvatarTemplate.add(torso);

// 머리와 목을 하나의 피벗으로 묶어 앉을 때 어깨와 함께 낮아지게 합니다.
const humanHeadGroup = new THREE.Group();
humanHeadGroup.position.y = 1.53;
humanHeadGroup.name = 'avatar-head-group';
humanAvatarTemplate.add(humanHeadGroup);

// 목
makeSphere(humanHeadGroup, 0.15, [0, 0, 0], skinMat);

// 머리
const avatarHead = makeSphere(humanHeadGroup, 0.42, [0, 0.39, 0], skinMat);
avatarHead.name = 'avatar-head';

// 머리카락
makeSphere(humanHeadGroup, 0.43, [0, 0.59, -0.04], hairMat, [1.02, 0.72, 1]);
makeSphere(humanHeadGroup, 0.2, [0, 0.65, 0.34], hairMat, [1.5, 0.65, 0.65]);

// 귀
makeSphere(humanHeadGroup, 0.11, [-0.4, 0.38, 0], skinMat);
makeSphere(humanHeadGroup, 0.11, [0.4, 0.38, 0], skinMat);

// 눈
const leftEye = makeSphere(humanHeadGroup, 0.045, [-0.15, 0.45, 0.365], eyeMat);
const rightEye = makeSphere(humanHeadGroup, 0.045, [0.15, 0.45, 0.365], eyeMat);
leftEye.name = 'avatar-left-eye';
rightEye.name = 'avatar-right-eye';

// 눈 반짝임
makeSphere(humanHeadGroup, 0.014, [-0.16, 0.47, 0.402], whiteMat);
makeSphere(humanHeadGroup, 0.014, [0.14, 0.47, 0.402], whiteMat);

// 입
makeSphere(humanHeadGroup, 0.035, [0, 0.31, 0.408], eyeMat, [1.3, 0.65, 0.5]);

// 팔 생성 함수
function createArm(x) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 1.32, 0);
  pivot.name = x < 0 ? 'avatar-left-arm' : 'avatar-right-arm';
  humanAvatarTemplate.add(pivot);

  const arm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.09, 0.42, 4, 8),
    shirtMat
  );

  arm.position.y = -0.27;
  arm.castShadow = true;
  pivot.add(arm);

  makeSphere(pivot, 0.13, [0, -0.52, 0], skinMat);

  return pivot;
}

const leftArm = createArm(-0.37);
const rightArm = createArm(0.37);

// 다리 생성 함수
function createLeg(x) {
  const side = x < 0 ? 'left' : 'right';
  const hip = new THREE.Group();
  hip.position.set(x, 0.67, 0);
  hip.name = `avatar-${side}-leg`;
  humanAvatarTemplate.add(hip);

  const thigh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.12, 4, 8),
    pantsMat
  );
  thigh.position.y = -0.18;
  thigh.castShadow = true;
  hip.add(thigh);

  const knee = new THREE.Group();
  knee.position.y = -0.36;
  knee.name = `avatar-${side}-knee`;
  hip.add(knee);

  const shin = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.08, 4, 8),
    pantsMat
  );
  shin.position.y = -0.12;
  shin.castShadow = true;
  knee.add(shin);

  const foot = new THREE.Group();
  foot.position.set(0, -0.21, 0.12);
  foot.name = `avatar-${side}-foot`;
  knee.add(foot);
  makeSphere(foot, 0.16, [0, 0, 0], shoeMat, [1, 0.65, 1.5]);

  return hip;
}

const leftLeg = createLeg(-0.19);
const rightLeg = createLeg(0.19);

// 외형 템플릿은 모델 등록소에서 복제해 플레이어와 원격 플레이어가 공유합니다.



// 점심추천 강아지
const lunchDog = new THREE.Group();

// 털 색상
const furMaterial = new THREE.MeshStandardMaterial({
  color: 0xf2d6a5,
  roughness: 0.9
});

const brownMaterial = new THREE.MeshStandardMaterial({
  color: 0x93603e,
  roughness: 0.9
});

const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x29201c
});

const whiteMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff
});

// 몸통
const dogBody = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 16, 16),
  furMaterial
);
dogBody.scale.set(0.85, 0.8, 1.25);
dogBody.position.set(0, 0.75, 0);
dogBody.name = 'dog-body';
lunchDog.add(dogBody);

// 머리
const dogHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.48, 20, 20),
  furMaterial
);
dogHead.position.set(0, 1.4, 0.38);
dogHead.name = 'dog-head';
lunchDog.add(dogHead);

// 귀 만들기
function createDogEar(x) {
  const ear = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    brownMaterial
  );

  ear.scale.set(0.65, 1.3, 0.55);
  ear.position.set(x, 1.35, 0.3);
  ear.rotation.z = x < 0 ? -0.25 : 0.25;

  lunchDog.add(ear);
}

createDogEar(-0.4);
createDogEar(0.4);

// 주둥이
const muzzle = new THREE.Mesh(
  new THREE.SphereGeometry(0.23, 16, 16),
  whiteMaterial
);
muzzle.scale.set(1.15, 0.75, 0.8);
muzzle.position.set(0, 1.22, 0.79);
lunchDog.add(muzzle);

// 코
const dogNose = new THREE.Mesh(
  new THREE.SphereGeometry(0.075, 12, 12),
  darkMaterial
);
dogNose.position.set(0, 1.3, 0.98);
lunchDog.add(dogNose);

// 눈
function createDogEye(x) {
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 12),
    darkMaterial
  );

  eye.position.set(x, 1.48, 0.79);
  lunchDog.add(eye);
}

createDogEye(-0.17);
createDogEye(0.17);

// 다리
function createDogLeg(x, z, name) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.3, z);
  pivot.name = `dog-leg-${name}`;
  lunchDog.add(pivot);

  const leg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.28, 4, 8),
    furMaterial
  );

  pivot.add(leg);
  return pivot;
}

createDogLeg(-0.32, -0.35, 'hind-left');
createDogLeg(0.32, -0.35, 'hind-right');
createDogLeg(-0.32, 0.35, 'front-left');
createDogLeg(0.32, 0.35, 'front-right');

// 꼬리
const dogTail = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.09, 0.3, 4, 8),
  brownMaterial
);
dogTail.position.set(0, 0.95, -0.65);
dogTail.rotation.x = -0.8;
dogTail.name = 'dog-tail';
lunchDog.add(dogTail);

// 위치
lunchDog.position.set(3, 0, 0);

// 그림자
lunchDog.traverse((obj) => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }
});

// 장면에 추가
scene.add(lunchDog);

// 해변 돌탑 쌓기 콘텐츠
const stoneTower = createStoneTower();
scene.add(stoneTower.group);


// 아바타는 외형 판별기와 포즈 애니메이터를 조합합니다.
// 새 모델은 userData.avatarType을 지정하거나 matches로 판별 규칙을 등록하면 전용 포즈가 자동 적용됩니다.
const avatarRegistry = new Map();

function registerAvatarType(type, definition) {
  if (!type || typeof definition?.create !== 'function' || typeof definition?.createAnimator !== 'function') {
    throw new Error(`아바타 '${type}'에는 create와 createAnimator 구현이 필요합니다.`);
  }

  avatarRegistry.set(type, definition);
}

function detectAvatarType(model) {
  const declaredType = model.userData?.avatarType;
  if (avatarRegistry.has(declaredType)) return declaredType;

  for (const [type, definition] of avatarRegistry) {
    if (typeof definition.matches === 'function' && definition.matches(model)) {
      return type;
    }
  }

  return 'human';
}

function createAvatarController(typeOrModel = 'human') {
  const suppliedModel = typeOrModel?.isObject3D ? typeOrModel : null;
  const selectedType = suppliedModel
    ? detectAvatarType(suppliedModel)
    : avatarRegistry.has(typeOrModel) ? typeOrModel : 'human';
  const definition = avatarRegistry.get(selectedType);
  const model = suppliedModel || definition.create();
  model.userData.avatarType = selectedType;
  const updateAnimation = definition.createAnimator(model);

  return {
    type: selectedType,
    label: definition.label,
    get height() {
      const sitHeight = definition.sitHeight ?? definition.height;
      return THREE.MathUtils.lerp(
        definition.height,
        sitHeight,
        model.userData.poseProgress ?? 0
      );
    },
    model,
    pose: 'idle',
    update(pose, time, delta, running = false) {
      this.pose = pose;
      updateAnimation({ pose, time, delta, running });
    }
  };
}

function createHumanoidAnimator(model) {
  const torso = model.getObjectByName('avatar-torso');
  const head = model.getObjectByName('avatar-head-group');
  const leftArm = model.getObjectByName('avatar-left-arm');
  const rightArm = model.getObjectByName('avatar-right-arm');
  const leftLeg = model.getObjectByName('avatar-left-leg');
  const rightLeg = model.getObjectByName('avatar-right-leg');
  const leftKnee = model.getObjectByName('avatar-left-knee');
  const rightKnee = model.getObjectByName('avatar-right-knee');
  const leftFoot = model.getObjectByName('avatar-left-foot');
  const rightFoot = model.getObjectByName('avatar-right-foot');
  const leftEye = model.getObjectByName('avatar-left-eye');
  const rightEye = model.getObjectByName('avatar-right-eye');
  let sitBlend = 0;

  return ({ pose, time, delta, running }) => {
    sitBlend = THREE.MathUtils.damp(sitBlend, pose === 'sit' ? 1 : 0, 9, delta);
    const moving = pose === 'walk' || pose === 'run';
    const isRunning = pose === 'run' || running;
    const gaitSpeed = isRunning ? 16 : 10;
    const gaitPower = isRunning ? 0.9 : 0.55;
    const swing = moving ? Math.sin(time * gaitSpeed) * gaitPower : 0;
    const breathing = moving
      ? Math.abs(Math.sin(time * gaitSpeed * 2)) * (isRunning ? 0.09 : 0.035)
      : Math.sin(time * 2) * 0.035;

    model.position.y = THREE.MathUtils.lerp(0, -0.035, sitBlend);
    // d58802d에서 몸통 캡슐 반경이 0.34→0.26으로 줄어 하단이 0.078만큼 떠서,
    // 앉은 상체 목표를 0.08 낮춰 바닥에 붙은 이전 자세(하단 ≈0.04)를 유지한다.
    torso.position.y = THREE.MathUtils.lerp(1.05 + breathing, 0.55, sitBlend);
    torso.scale.y = THREE.MathUtils.lerp(1 + (moving ? 0 : Math.sin(time * 2) * 0.035), 0.98, sitBlend);
    torso.rotation.x = THREE.MathUtils.lerp(pose === 'jump' ? -0.12 : 0, 0.08, sitBlend);

    leftLeg.position.x = THREE.MathUtils.lerp(-0.19, -0.24, sitBlend);
    rightLeg.position.x = THREE.MathUtils.lerp(0.19, 0.24, sitBlend);
    leftLeg.position.y = THREE.MathUtils.lerp(0.67, 0.31, sitBlend);
    rightLeg.position.y = THREE.MathUtils.lerp(0.67, 0.31, sitBlend);
    const legPose = pose === 'jump' ? -0.45 : swing;
    leftLeg.rotation.x = THREE.MathUtils.lerp(legPose, -1.4, sitBlend);
    rightLeg.rotation.x = THREE.MathUtils.lerp(-legPose, -1.4, sitBlend);
    leftKnee.rotation.x = THREE.MathUtils.lerp(pose === 'jump' ? 0.35 : 0, 0, sitBlend);
    rightKnee.rotation.x = THREE.MathUtils.lerp(pose === 'jump' ? 0.35 : 0, 0, sitBlend);
    leftFoot.position.z = THREE.MathUtils.lerp(0.12, -0.075, sitBlend);
    rightFoot.position.z = THREE.MathUtils.lerp(0.12, -0.075, sitBlend);
    leftFoot.rotation.x = THREE.MathUtils.lerp(0, 1.4, sitBlend);
    rightFoot.rotation.x = THREE.MathUtils.lerp(0, 1.4, sitBlend);

    const idleArmSwing = Math.sin(time * 1.5) * 0.12;
    const jumpArmPose = pose === 'jump' ? 0.65 : 0;
    leftArm.position.y = THREE.MathUtils.lerp(1.32, 0.91, sitBlend);
    rightArm.position.y = THREE.MathUtils.lerp(1.32, 0.91, sitBlend);
    leftArm.rotation.x = THREE.MathUtils.lerp(moving ? -swing * 0.7 : idleArmSwing + jumpArmPose, -0.45, sitBlend);
    rightArm.rotation.x = THREE.MathUtils.lerp(moving ? swing * 0.7 : idleArmSwing + jumpArmPose, -0.45, sitBlend);

    head.position.y = THREE.MathUtils.lerp(1.53, 1.16, sitBlend);
    head.rotation.x = THREE.MathUtils.lerp(0, 0.06, sitBlend);
    head.rotation.z = Math.sin(time * 0.8) * 0.04 * (1 - sitBlend);
    model.rotation.z = Math.sin(time * 1.2) * 0.025 * (1 - sitBlend);

    const blinkPhase = time % 4.2;
    const eyeOpen = blinkPhase < 0.16 ? Math.max(0.1, Math.abs(1 - blinkPhase / 0.08)) : 1;
    leftEye.scale.y = eyeOpen;
    rightEye.scale.y = eyeOpen;
    model.userData.poseProgress = sitBlend;
  };
}

function createDogAnimator(model) {
  const body = model.getObjectByName('dog-body');
  const head = model.getObjectByName('dog-head');
  const tail = model.getObjectByName('dog-tail');
  const legs = {
    hindLeft: model.getObjectByName('dog-leg-hind-left'),
    hindRight: model.getObjectByName('dog-leg-hind-right'),
    frontLeft: model.getObjectByName('dog-leg-front-left'),
    frontRight: model.getObjectByName('dog-leg-front-right')
  };
  let sitBlend = 0;

  return ({ pose, time, delta }) => {
    sitBlend = THREE.MathUtils.damp(sitBlend, pose === 'sit' ? 1 : 0, 9, delta);
    const moving = pose === 'walk' || pose === 'run';
    const gait = moving ? Math.sin(time * (pose === 'run' ? 16 : 10)) * 0.35 : 0;
    const bob = moving ? Math.abs(Math.sin(time * 14)) * 0.05 : Math.sin(time * 2) * 0.012;

    body.position.y = THREE.MathUtils.lerp(0.75 + bob, 0.58, sitBlend);
    body.scale.y = THREE.MathUtils.lerp(0.8, 0.68, sitBlend);
    head.position.y = THREE.MathUtils.lerp(1.4 + bob * 0.5, 1.2, sitBlend);
    head.rotation.x = THREE.MathUtils.lerp(Math.sin(time * 1.4) * 0.035, -0.08, sitBlend);
    tail.rotation.y = Math.sin(time * 5) * 0.28;

    legs.frontLeft.rotation.x = gait;
    legs.frontRight.rotation.x = -gait;
    legs.hindLeft.rotation.x = THREE.MathUtils.lerp(-gait, -1.05, sitBlend);
    legs.hindRight.rotation.x = THREE.MathUtils.lerp(gait, -1.05, sitBlend);
    legs.frontLeft.position.y = THREE.MathUtils.lerp(0.3, 0.26, sitBlend);
    legs.frontRight.position.y = THREE.MathUtils.lerp(0.3, 0.26, sitBlend);
    model.userData.poseProgress = sitBlend;
  };
}

registerAvatarType('human', {
  label: '사람',
  height: 2.7,
  sitHeight: 2.4,
  matches: (model) => Boolean(model.getObjectByName('avatar-torso')),
  create: () => humanAvatarTemplate.clone(true),
  createAnimator: createHumanoidAnimator
});

const dogAvatarTemplate = lunchDog.clone(true);
dogAvatarTemplate.position.set(0, 0, 0);
registerAvatarType('dog', {
  label: '강아지',
  height: 1.95,
  matches: (model) => Boolean(model.getObjectByName('dog-body') && model.getObjectByName('dog-head')),
  create: () => dogAvatarTemplate.clone(true),
  createAnimator: createDogAnimator
});

let activeAvatarController = createAvatarController(humanAvatarTemplate.clone(true));
player.add(activeAvatarController.model);
scene.add(player);

// 외부 모델이 들어오면 등록된 matches/메타데이터로 타입을 판별해 해당 애니메이터를 붙입니다.
function setPlayerAvatarModel(model) {
  if (!model?.isObject3D) {
    throw new TypeError('플레이어 아바타는 Three.js Object3D여야 합니다.');
  }

  player.remove(activeAvatarController.model);
  activeAvatarController = createAvatarController(model);
  player.add(activeAvatarController.model);

  return activeAvatarController.type;
}

let isSitting = false;

const avatarControlsStyle = document.createElement('style');
avatarControlsStyle.textContent = `
  #avatar-controls-wrapper {
    position: fixed;
    right: 16px;
    bottom: 72px;
    z-index: 3900;
  }
  #avatar-controls-toggle {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: rgba(18, 45, 55, 0.78);
    color: white;
    font-size: 17px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    backdrop-filter: blur(8px);
    touch-action: manipulation;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  #avatar-controls-toggle:active { transform: scale(0.93); }
`;
document.head.appendChild(avatarControlsStyle);

const avatarControlsWrapper = document.createElement('div');
avatarControlsWrapper.id = 'avatar-controls-wrapper';

const avatarControlsToggle = document.createElement('button');
avatarControlsToggle.id = 'avatar-controls-toggle';
avatarControlsToggle.type = 'button';
avatarControlsToggle.setAttribute('aria-label', '앉기');
avatarControlsToggle.setAttribute('aria-pressed', 'false');
avatarControlsToggle.textContent = '🪑';

avatarControlsWrapper.appendChild(avatarControlsToggle);
document.body.appendChild(avatarControlsWrapper);

// sitButton 참조가 필요한 코드와의 호환성을 위해 별칭 설정
const sitButton = avatarControlsToggle;
sitButton.dataset.companionAvatarType = detectAvatarType(lunchDog);

function setSitting(sitting) {
  isSitting = sitting;
  if (isSitting) {
    player.position.y = 0;
    verticalVelocity = 0;
    isJumping = false;
    isMovingToTarget = false;
    Object.keys(keys).forEach((key) => { keys[key] = false; });
  }

  avatarControlsToggle.textContent = isSitting ? '🧍' : '🪑';
  avatarControlsToggle.setAttribute('aria-label', isSitting ? '일어서기' : '앉기');
  avatarControlsToggle.setAttribute('aria-pressed', String(isSitting));
}

avatarControlsToggle.addEventListener('click', (event) => {
  event.preventDefault();
  setSitting(!isSitting);
});

if (import.meta.env.MODE === 'e2e') {
  window.__krwLupinE2E = {
    getAvatarState: () => ({
      type: activeAvatarController.type,
      pose: activeAvatarController.pose,
      sitProgress: activeAvatarController.model.userData.poseProgress ?? 0
    }),
    detectCompanionType: () => detectAvatarType(lunchDog),
    teleportPlayer: (x, z) => {
      player.position.set(x, 0, z);
      isMovingToTarget = false;
    },
    getStoneTowerState: () => stoneTower.getState()
  };
}



// 다른 플레이어 관리
const remotePlayers = {};
const remoteAvatarControllers = {};
// 상대방 닉네임 HTML 요소 관리
const remotePlayerNames = {};


// 상대방 말풍선 관리
const remoteSpeechBubbles = {};

// 상대방 말풍선 표시
function showRemoteSpeechBubble(playerId, message) {
  console.log('말풍선 대상 ID:', playerId);
  console.log('등록된 플레이어 ID:', Object.keys(remotePlayers));

  const remotePlayer = remotePlayers[playerId];

  if (!remotePlayer) {
    console.log('오류: 상대방 캐릭터를 찾을 수 없음');
    return;
  }

  console.log('상대방 캐릭터 확인 성공');

  let bubble = remoteSpeechBubbles[playerId];

  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'remote-speech-bubble';
    document.body.appendChild(bubble);
    remoteSpeechBubbles[playerId] = bubble;
  }

  bubble.textContent = message;
  bubble.style.display = 'block';

  clearTimeout(bubble.timer);

  bubble.timer = setTimeout(() => {
    bubble.style.display = 'none';
  }, 4000);
}


// 상대방 말풍선 위치 갱신
function updateRemoteSpeechBubbles() {
  Object.entries(remoteSpeechBubbles).forEach(([playerId, bubble]) => {
    const remotePlayer = remotePlayers[playerId];

    if (!remotePlayer || bubble.style.display === 'none') return;

    const position = remotePlayer.position.clone();
    position.y += remoteAvatarControllers[playerId]?.height ?? 2.5;
    position.project(camera);

    const x = (position.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-position.y * 0.5 + 0.5) * window.innerHeight;

    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
  });
}


// 상대방 닉네임 위치 갱신
function updateRemotePlayerNames() {
  Object.entries(remotePlayerNames).forEach(([playerId, label]) => {
    const remotePlayer = remotePlayers[playerId];

    if (!remotePlayer) return;

    const position = new THREE.Vector3(
      remotePlayer.position.x,
      remotePlayer.position.y + (remoteAvatarControllers[playerId]?.height ?? 2.7),
      remotePlayer.position.z
    );

    position.project(camera);

    const rect = renderer.domElement.getBoundingClientRect();

    const x = rect.left + (position.x + 1) * rect.width / 2;
    const y = rect.top + (1 - position.y) * rect.height / 2;

    const visible =
      position.z < 1 &&
      position.z > -1 &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom;

    label.style.display = visible ? 'block' : 'none';

    if (visible) {
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    }
  });
}




// 닉네임 표시 생성 및 크기 조절
function createNicknameLabel(nickname) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;

  const context = canvas.getContext('2d');

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: false
    })
  );

  sprite.position.set(0, 2.5, 0);

  sprite.userData.nicknameContext = context;
  sprite.userData.nicknameTexture = sprite.material.map;

  updateNicknameLabel(sprite, nickname);

  return sprite;
}


// 닉네임 표시 업데이트
function updateNicknameLabel(sprite, nickname) {
  const context = sprite.userData.nicknameContext;
  const texture = sprite.userData.nicknameTexture;
  const canvas = context.canvas;

  const name = (nickname || '플레이어').slice(0, 12);

  // 글자 크기 설정
  let fontSize = 48;
  context.font = `bold ${fontSize}px Arial`;

  while (
    context.measureText(name).width > 440 &&
    fontSize > 28
  ) {
    fontSize -= 2;
    context.font = `bold ${fontSize}px Arial`;
  }

  const textWidth = context.measureText(name).width;

  // 닉네임 길이에 맞춰 캔버스 너비 변경
  const padding = 60;
  canvas.width = Math.ceil(textWidth + padding);
  canvas.height = 128;

  const centerX = canvas.width / 2;

  // 배경
  context.fillStyle = 'rgba(0, 0, 0, 0.65)';
  context.beginPath();
  context.roundRect(
    0,
    19,
    canvas.width,
    90,
    22
  );
  context.fill();

  // 글자
  context.font = `bold ${fontSize}px Arial`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'white';
  context.fillText(name, centerX, 64);

  // 캔버스 비율에 맞춰 Sprite 크기 조절
  const height = 0.45;
  const width = (canvas.width / canvas.height) * height;

  sprite.scale.set(width, height, 1);

  texture.needsUpdate = true;
}


// 상대방 캐릭터 생성
function createRemotePlayer(data) {
  if (remotePlayers[data.id]) return;

  const remotePlayer = new THREE.Group();
  const remoteAvatar = createAvatarController(data.avatarType || 'human');
  remoteAvatar.pose = data.pose || 'idle';
  remotePlayer.add(remoteAvatar.model);

  remotePlayer.position.set(
    data.x ?? 0,
    data.y ?? 0,
    data.z ?? 0
  );

  scene.add(remotePlayer);

  // 내 캐릭터와 동일한 HTML 닉네임 생성
  const nicknameLabel = document.createElement('div');
  nicknameLabel.className = 'remote-player-name';
  nicknameLabel.textContent = data.nickname || '플레이어';

  document.body.appendChild(nicknameLabel);

  remotePlayers[data.id] = remotePlayer;
  remoteAvatarControllers[data.id] = remoteAvatar;
  remotePlayerNames[data.id] = nicknameLabel;

  console.log('상대방 캐릭터 생성:', data.id);
}

function setRemoteAvatarType(playerId, type) {
  const remotePlayer = remotePlayers[playerId];
  const currentAvatar = remoteAvatarControllers[playerId];
  if (!remotePlayer || !currentAvatar || !avatarRegistry.has(type)) return;

  const nextAvatar = createAvatarController(type);
  nextAvatar.pose = currentAvatar.pose;
  remotePlayer.remove(currentAvatar.model);
  remotePlayer.add(nextAvatar.model);
  remoteAvatarControllers[playerId] = nextAvatar;
}


// 기존 접속자 불러오기
socket.on('currentPlayers', (players) => {
  Object.values(players).forEach((data) => {
    createRemotePlayer(data);
  });
});

// 새로운 플레이어 접속
socket.on('newPlayer', (data) => {
  createRemotePlayer(data);
});

// 플레이어 퇴장
socket.on('playerDisconnected', (playerId) => {
  if (!remotePlayers[playerId]) return;

  scene.remove(remotePlayers[playerId]);
  delete remotePlayers[playerId];
  delete remoteAvatarControllers[playerId];

  // 상대방 닉네임 제거
  if (remotePlayerNames[playerId]) {
    remotePlayerNames[playerId].remove();
    delete remotePlayerNames[playerId];
  }

  console.log('상대방 캐릭터 제거:', playerId);
});


// 나무 만들기
function createTree(x, z) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.8, 16),
    new THREE.MeshStandardMaterial({ color: 0x76523a, roughness: 1 })
  );
  trunk.position.y = 0.75;
  tree.add(trunk);

  const pineMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x477d68, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x3e735f, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x54836c, roughness: 0.98 })
  ];
  [
    { position: [-0.48, 2.05, 0], scale: [1.35, 0.38, 0.82], material: 0 },
    { position: [0.42, 2.22, -0.12], scale: [1.28, 0.34, 0.76], material: 1 },
    { position: [-0.05, 2.52, 0.1], scale: [1.12, 0.34, 0.74], material: 2 },
    { position: [0.36, 2.82, 0], scale: [0.9, 0.3, 0.6], material: 0 }
  ].forEach(({ position, scale, material }) => {
    const branchLayer = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      pineMaterials[material]
    );
    branchLayer.position.set(...position);
    branchLayer.scale.set(...scale);
    branchLayer.castShadow = true;
    tree.add(branchLayer);
  });

  tree.position.set(x, 0, z);
  tree.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  scene.add(tree);
}

[
  [-24, -6], [24, -5],
  [-25, 5], [25, 6],
  [-24, 17], [24, 18],
  [-27, 30], [27, 31]
].forEach(([x, z]) => createTree(x, z));

// 키보드 입력
const keys = {};

// 점프 상태
let verticalVelocity = 0;
let isJumping = false;

const gravity = 20;
const jumpPower = 8;



// 강아지 상호작용 버튼
const dogInteractionButtons = document.getElementById('dog-interaction-buttons');
const dogInteractionButton = document.getElementById('dog-interaction-button');
const lottoInteractionButton = document.getElementById('lotto-interaction-button');

// 점심 메뉴 추천
dogInteractionButton.addEventListener('click', () => {
  if (!isNearLunchDog) return;

  const menu = getRandomLunchMenu();
  alert(`🐶 오늘의 점심 메뉴는...\n\n${menu} 입니다!`);
});

// 로또 번호 추천
lottoInteractionButton.addEventListener('click', () => {
  if (!isNearLunchDog) return;

  const numbers = new Set();

  while (numbers.size < 6) {
    numbers.add(Math.floor(Math.random() * 45) + 1);
  }

  const lottoNumbers = [...numbers].sort((a, b) => a - b);

  alert(`🐶 행운의 로또 번호는...\n\n${lottoNumbers.join(', ')} 🍀`);
});


// 해변 돌탑 쌓기 버튼
const stoneTowerButtons = document.getElementById('stone-tower-buttons');
const stoneTowerButton = document.getElementById('stone-tower-button');
const stoneTowerCounter = document.getElementById('stone-tower-counter');

function refreshStoneTowerCounter() {
  stoneTowerCounter.textContent = `${stoneTower.getState().height}`;
}

let stoneTowerFlashTimer = null;

function flashStoneTowerCounter(text) {
  stoneTowerCounter.textContent = text;

  if (stoneTowerFlashTimer) clearTimeout(stoneTowerFlashTimer);

  stoneTowerFlashTimer = setTimeout(() => {
    refreshStoneTowerCounter();
  }, 900);
}

function buildStoneTowerStone() {
  if (!stoneTower.isNear(player.position)) return;

  stoneTower.addStone();
  refreshStoneTowerCounter();

  // 쌓을 때마다 일정 확률로 돌탑이 무너진다
  if (Math.random() < stoneTower.collapseChance) {
    stoneTower.collapse();
    flashStoneTowerCounter('💥');
  }
}

function collapseStoneTower() {
  if (!stoneTower.isNear(player.position)) return;

  stoneTower.collapse();
  flashStoneTowerCounter('💥');
}

stoneTowerButton.addEventListener('click', (event) => {
  event.preventDefault();
  buildStoneTowerStone();
  // 클릭 후 버튼 포커스를 해제해 E/Space 등 키보드 입력이 막히지 않게 한다
  event.currentTarget.blur();
});

const stoneTowerCollapseButton = document.getElementById('stone-tower-collapse-button');
stoneTowerCollapseButton.addEventListener('click', (event) => {
  event.preventDefault();
  collapseStoneTower();
  event.currentTarget.blur();
});



window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  // 앉기/일어서기: C키 또는 Ctrl
  if (
    !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName) &&
    !e.repeat &&
    (e.key.toLowerCase() === 'c' || e.code === 'ControlLeft' || e.code === 'ControlRight')
  ) {
    e.preventDefault();
    setSitting(!isSitting);
  }

  // 해변 돌탑 쌓기 (E 키)
  if (
    e.key.toLowerCase() === 'e' &&
    !e.repeat &&
    !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName) &&
    stoneTower.isNear(player.position)
  ) {
    e.preventDefault();
    buildStoneTowerStone();
    return;
  }

  // 해변 돌탑 리셋 (R 키) → 무너뜨리기
  if (
    e.key.toLowerCase() === 'r' &&
    !e.repeat &&
    !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName) &&
    stoneTower.isNear(player.position)
  ) {
    e.preventDefault();
    collapseStoneTower();
    return;
  }

  // 강아지에게 점심 메뉴 추천받기
  if (
    e.key.toLowerCase() === 'e' &&
    isNearLunchDog &&
    !e.repeat &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
  ) {
    const menu = getRandomLunchMenu();
    alert(`🐶 오늘의 점심 메뉴는...\n\n${menu} 입니다!`);
  }

  if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();

    if (!isJumping) {
      setSitting(false);
      verticalVelocity = jumpPower;
      isJumping = true;
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// 모바일 이동 패드 입력
const moveButtons = document.querySelectorAll('.move-btn');

moveButtons.forEach((button) => {
  const key = button.dataset.key;

  // 버튼을 누르면 이동 시작
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keys[key] = true;
    button.setPointerCapture(e.pointerId);
  });

  // 버튼에서 손을 떼면 이동 중지
  const stopMoving = (e) => {
    e.preventDefault();
    keys[key] = false;
  };

  button.addEventListener('pointerup', stopMoving);
  button.addEventListener('pointercancel', stopMoving);
  button.addEventListener('lostpointercapture', () => {
    keys[key] = false;
  });
});

// 카메라 설정
let cameraAngle = 0;
let cameraPitch = 0.3;
let cameraDistance = 8;

// 마우스 휠로 카메라 거리 조절
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();

  cameraDistance += e.deltaY * 0.01;
  cameraDistance = Math.max(3, Math.min(15, cameraDistance));
}, { passive: false });

let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  isDragging = true;
  previousMouseX = e.clientX;
  previousMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - previousMouseX;
  const deltaY = e.clientY - previousMouseY;

  cameraAngle -= deltaX * 0.005;
  cameraPitch += deltaY * 0.005;

  cameraPitch = Math.max(-0.2, Math.min(1.2, cameraPitch));

  previousMouseX = e.clientX;
  previousMouseY = e.clientY;
});



// 모바일 터치 이동 및 카메라 회전
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchLastX = 0;
let touchLastY = 0;
let touchMoved = false;
let isTouchCamera = false;

// 두 손가락 확대/축소 상태
let isPinching = false;
let lastPinchDistance = 0;

// 이동 목적지
const moveTarget = new THREE.Vector3();
let isMovingToTarget = false;

// 바닥에 터치한 위치를 3D 좌표로 변환
const touchRaycaster = new THREE.Raycaster();
const touchPointer = new THREE.Vector2();

const groundPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0),
  0
);

function setTouchDestination(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();

  touchPointer.x = ((x - rect.left) / rect.width) * 2 - 1;
  touchPointer.y = -((y - rect.top) / rect.height) * 2 + 1;

  touchRaycaster.setFromCamera(touchPointer, camera);

  const destination = new THREE.Vector3();

  if (touchRaycaster.ray.intersectPlane(groundPlane, destination)) {
    moveTarget.set(
      THREE.MathUtils.clamp(destination.x, -44, 44),
      0,
      THREE.MathUtils.clamp(destination.z, -26, 44)
    );
    isMovingToTarget = true;
  }
}

renderer.domElement.style.touchAction = 'none';


// 두 손가락 사이의 거리 계산
function getPinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;

  return Math.hypot(dx, dy);
}

// 터치 시작
renderer.domElement.addEventListener('touchstart', (e) => {
  e.preventDefault();

  // 두 손가락 터치 시작
  if (e.touches.length === 2) {
    isPinching = true;
    lastPinchDistance = getPinchDistance(e.touches);
    isTouchCamera = false;
    return;
  }

  if (e.touches.length > 2) return;

  const touch = e.changedTouches[0];

  touchStartTime = Date.now();
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchLastX = touch.clientX;
  touchLastY = touch.clientY;

  touchMoved = false;
  isTouchCamera = false;
}, { passive: false });

// 터치 이동
renderer.domElement.addEventListener('touchmove', (e) => {
  e.preventDefault();

  // 두 손가락 확대 / 축소
  if (e.touches.length === 2 && isPinching) {
    const currentDistance = getPinchDistance(e.touches);
    const deltaDistance = currentDistance - lastPinchDistance;

    cameraDistance -= deltaDistance * 0.025;
    cameraDistance = Math.max(3, Math.min(15, cameraDistance));

    lastPinchDistance = currentDistance;
    return;
  }

  if (isPinching) return;

  const touch = e.changedTouches[0];
  if (!touch) return;

  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  // 길게 누르고 움직이면 카메라 회전
  if (
    !isTouchCamera &&
    Date.now() - touchStartTime >= 300 &&
    Math.hypot(deltaX, deltaY) > 8
  ) {
    isTouchCamera = true;
    touchMoved = true;
  }

  if (isTouchCamera) {
    const moveX = touch.clientX - touchLastX;
    const moveY = touch.clientY - touchLastY;

    cameraAngle -= moveX * 0.005;
    cameraPitch += moveY * 0.005;

    cameraPitch = Math.max(-0.2, Math.min(1.2, cameraPitch));
  }

  touchLastX = touch.clientX;
  touchLastY = touch.clientY;
}, { passive: false });

// 터치 종료
function finishTouch(e) {
  // 핀치 동작 중 손가락을 떼면 확대/축소 종료
  if (isPinching) {
    if (e.touches.length < 2) {
      isPinching = false;
      lastPinchDistance = 0;
    }

    isTouchCamera = false;
    return;
  }

  const touch = e.changedTouches[0];
  if (!touch) return;

  const elapsed = Date.now() - touchStartTime;
  const distance = Math.hypot(
    touch.clientX - touchStartX,
    touch.clientY - touchStartY
  );

  if (
    !isTouchCamera &&
    elapsed < 300 &&
    distance < 15
  ) {
    setTouchDestination(touch.clientX, touch.clientY);
  }

  isTouchCamera = false;
}

renderer.domElement.addEventListener('touchend', finishTouch);
renderer.domElement.addEventListener('touchcancel', finishTouch);




// 게임 루프
const clock = new THREE.Clock();
const direction = new THREE.Vector3();
const cameraOffset = new THREE.Vector3(0, 5, 8);

// 강아지와 상호작용 가능한 상태인지
let isNearLunchDog = false;

// 캐릭터 머리 위 말풍선
const speechBubble = document.getElementById('speech-bubble');
let speechBubbleTimer = 0;

// 캐릭터 닉네임
const playerNameLabel = document.getElementById('player-name');

// 채팅 기능
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
// 점심추천 강아지 상호작용 UI
const dogInteraction = document.getElementById('dog-interaction');
// 채팅창 열기 / 닫기
const chatToggle = document.getElementById('chat-toggle');

chatToggle.addEventListener('click', () => {
  chat.classList.toggle('hidden');

  if (chat.classList.contains('hidden')) {
    chatToggle.textContent = '💬 채팅 열기';
  } else {
    chatToggle.textContent = '💬 채팅 숨기기';
  }
});

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  waterTexture.offset.x = (waterTexture.offset.x + delta * 0.012) % 1;

  // 점프 물리
  verticalVelocity -= gravity * delta;
  player.position.y += verticalVelocity * delta;

  // 바닥에 착지
  if (player.position.y <= 0) {
    player.position.y = 0;
    verticalVelocity = 0;
    isJumping = false;
  }

  // 걷기와 달리기 속도
  const isRunning = keys['shift'];
  const speed = isRunning ? 9 : 5;

  // 카메라 기준 이동 방향 계산
  let forward = 0;
  let right = 0;

  if (keys['w'] || keys['arrowup']) forward += 1;
  if (keys['s'] || keys['arrowdown']) forward -= 1;
  if (keys['a'] || keys['arrowleft']) right -= 1;
  if (keys['d'] || keys['arrowright']) right += 1;

  direction.set(
    -Math.sin(cameraAngle) * forward + Math.cos(cameraAngle) * right,
    0,
    -Math.cos(cameraAngle) * forward - Math.sin(cameraAngle) * right
  );

  if (isSitting && (direction.lengthSq() > 0 || isMovingToTarget)) {
    setSitting(false);
  }

  // 모바일 터치 목적지 이동
  let touchMoveDistance = 0;

  // 키보드 입력이 있으면 자동 이동 취소
  if (direction.lengthSq() > 0) {
    isMovingToTarget = false;
  }

  // 키보드 입력이 없으면 터치 목적지로 이동
  if (direction.lengthSq() === 0 && isMovingToTarget) {
    direction.subVectors(moveTarget, player.position);
    direction.y = 0;

    touchMoveDistance = direction.length();

    if (touchMoveDistance <= 0.15) {
      player.position.x = moveTarget.x;
      player.position.z = moveTarget.z;
      isMovingToTarget = false;
      direction.set(0, 0, 0);
    } else {
      direction.normalize();
    }
  }

  let playerPose = 'idle';

  if (direction.length() > 0) {
    direction.normalize();
    playerPose = isRunning ? 'run' : 'walk';

    // 캐릭터 이동
    if (isMovingToTarget && touchMoveDistance > 0) {
      const step = Math.min(speed * delta, touchMoveDistance);

      player.position.addScaledVector(direction, step);

      if (step >= touchMoveDistance) {
        player.position.x = moveTarget.x;
        player.position.z = moveTarget.z;
        isMovingToTarget = false;
      }
    } else {
      player.position.addScaledVector(direction, speed * delta);
    }

    // 이동 방향으로 캐릭터 회전
    player.rotation.y = Math.atan2(direction.x, direction.z);

  }

  if (isJumping) playerPose = 'jump';
  if (isSitting) playerPose = 'sit';
  activeAvatarController.update(playerPose, clock.elapsedTime, delta, isRunning);
  const avatarModel = activeAvatarController.model;
  const headAnchor = avatarModel.getObjectByName('avatar-head-group')
    || avatarModel.getObjectByName('dog-head');
  const torso = avatarModel.getObjectByName('avatar-torso');
  const leftLeg = avatarModel.getObjectByName('avatar-left-leg');
  const rightLeg = avatarModel.getObjectByName('avatar-right-leg');
  const leftKnee = avatarModel.getObjectByName('avatar-left-knee');
  const rightKnee = avatarModel.getObjectByName('avatar-right-knee');
  sitButton.dataset.avatarType = activeAvatarController.type;
  sitButton.dataset.pose = playerPose;
  sitButton.dataset.sitProgress = (avatarModel.userData.poseProgress ?? 0).toFixed(3);
  sitButton.dataset.headY = (avatarModel.position.y + (headAnchor?.position.y ?? 0)).toFixed(3);
  if (torso) {
    const torsoHalfHeight = torso.geometry.parameters.radius + torso.geometry.parameters.height / 2;
    sitButton.dataset.torsoBottomY = (
      avatarModel.position.y + torso.position.y - torsoHalfHeight * torso.scale.y
    ).toFixed(3);
  } else {
    delete sitButton.dataset.torsoBottomY;
  }
  if (leftLeg && rightLeg && leftKnee && rightKnee) {
    sitButton.dataset.leftLegAngle = leftLeg.rotation.x.toFixed(3);
    sitButton.dataset.rightLegAngle = rightLeg.rotation.x.toFixed(3);
    sitButton.dataset.leftKneeAngle = leftKnee.rotation.x.toFixed(3);
    sitButton.dataset.rightKneeAngle = rightKnee.rotation.x.toFixed(3);
  } else {
    delete sitButton.dataset.leftLegAngle;
    delete sitButton.dataset.rightLegAngle;
    delete sitButton.dataset.leftKneeAngle;
    delete sitButton.dataset.rightKneeAngle;
  }

  Object.values(remoteAvatarControllers).forEach((avatar) => {
    avatar.update(avatar.pose || 'idle', clock.elapsedTime, delta);
  });

  // 마을과 해변 안에서만 이동하고 바다로 들어가지 않도록 경계 설정
  player.position.x = THREE.MathUtils.clamp(player.position.x, -44, 44);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -26, 44);

  // 플레이어와 강아지 사이의 거리 계산
  const dogDistance = Math.sqrt(
    Math.pow(player.position.x - lunchDog.position.x, 2) +
    Math.pow(player.position.z - lunchDog.position.z, 2)
  );

  // 강아지와 가까우면 상호작용 안내 표시
  isNearLunchDog = dogDistance <= 2.5;

  dogInteractionButtons.style.display =
    isNearLunchDog ? 'flex' : 'none';

  // 해변 돌탑: 마커 애니메이션 및 근접 시 버튼 표시
  stoneTower.update(delta, clock.elapsedTime);
  stoneTowerButtons.style.display =
    stoneTower.isNear(player.position) ? 'flex' : 'none';

  // 마우스 방향에 따라 카메라 회전
  const target = player.position.clone();
  target.y += 1;

  const horizontalDistance = cameraDistance * Math.cos(cameraPitch);

  const targetCamera = new THREE.Vector3(
    target.x + horizontalDistance * Math.sin(cameraAngle),
    target.y + cameraDistance * Math.sin(cameraPitch),
    target.z + horizontalDistance * Math.cos(cameraAngle)
  );

  camera.position.lerp(targetCamera, 0.12);
  camera.lookAt(target);

  updateSpeechBubble(delta);
  updatePlayerName();

  // 내 캐릭터 위치를 서버로 전송
  if (socket.connected) {
    socket.emit('playerMovement', {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotationY: player.rotation.y,
      avatarType: activeAvatarController.type,
      pose: activeAvatarController.pose,
      nickname: chatNickname.value.trim() || '플레이어'
    });
  }

  updateRemoteSpeechBubbles();
  updateRemotePlayerNames();

  renderer.render(scene, camera);
}

animate();

// 화면 크기 대응
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const message = chatInput.value.trim();

  if (!message) return;

  // 서버로 채팅 메시지 전송
  socket.emit('chatMessage', {
    nickname: chatNickname.value.trim() || '익명',
    message: message
  });

  chatInput.value = '';
  chatInput.style.height = 'auto';
});


// 서버에서 받은 채팅 메시지 표시
socket.on('chatMessage', (data) => {
  console.log('채팅 수신:', data);
  console.log('내 ID:', socket.id);
  console.log('상대방 캐릭터 목록:', remotePlayers);

  const messageElement = document.createElement('div');
  messageElement.className = 'chat-message';

  const name = document.createElement('strong');
  name.textContent = data.nickname + ': ';

  const content = document.createElement('span');
  content.textContent = data.message;

  messageElement.append(name, content);
  chatMessages.appendChild(messageElement);

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // 보낸 사람에 따라 말풍선 표시
  if (data.id === socket.id) {
    showSpeechBubble(data.message);
  } else {
    console.log('상대방 말풍선 호출:', data.id);
    showRemoteSpeechBubble(data.id, data.message);
  }
});



// Enter 전송 / Shift + Enter 줄바꿈
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// 말풍선 표시
function showSpeechBubble(message) {
  speechBubble.textContent = message;
  speechBubble.style.display = 'block';
  speechBubbleTimer = 4;
}

// 말풍선 위치 업데이트
function updateSpeechBubble(delta) {
  if (speechBubbleTimer <= 0) {
    speechBubble.style.display = 'none';
    return;
  }

  speechBubbleTimer -= delta;

  // 캐릭터 머리 위 3D 좌표
  const bubblePosition = new THREE.Vector3(
    player.position.x,
    player.position.y + activeAvatarController.height,
    player.position.z
  );

  // 3D 좌표를 카메라 화면 좌표로 변환
  bubblePosition.project(camera);

  const rect = renderer.domElement.getBoundingClientRect();

  const screenX = rect.left + (bubblePosition.x + 1) * rect.width / 2;
  const screenY = rect.top + (1 - bubblePosition.y) * rect.height / 2;

  // 카메라 뒤에 있거나 화면 밖이면 숨김
  const visible =
    bubblePosition.z < 1 &&
    bubblePosition.z > -1 &&
    screenX >= rect.left &&
    screenX <= rect.right &&
    screenY >= rect.top &&
    screenY <= rect.bottom;

  speechBubble.style.display = visible ? 'block' : 'none';

  if (visible) {
    speechBubble.style.left = `${screenX}px`;
    speechBubble.style.top = `${screenY}px`;
  }
}

// 캐릭터 닉네임 위치 업데이트
function updatePlayerName() {
  const nickname = chatNickname.value.trim() || '익명';

  playerNameLabel.textContent = nickname;

  const namePosition = new THREE.Vector3(
    player.position.x,
    player.position.y + activeAvatarController.height,
    player.position.z
  );

  namePosition.project(camera);

  const rect = renderer.domElement.getBoundingClientRect();

  const screenX = rect.left + (namePosition.x + 1) * rect.width / 2;
  const screenY = rect.top + (1 - namePosition.y) * rect.height / 2;

  const visible =
    namePosition.z < 1 &&
    namePosition.z > -1 &&
    screenX >= rect.left &&
    screenX <= rect.right &&
    screenY >= rect.top &&
    screenY <= rect.bottom;

  playerNameLabel.style.display = visible ? 'block' : 'none';

  if (visible) {
    playerNameLabel.style.left = `${screenX}px`;
    playerNameLabel.style.top = `${screenY}px`;
  }
}
