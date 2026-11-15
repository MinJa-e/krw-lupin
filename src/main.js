
import * as THREE from 'three';
import { io } from 'socket.io-client';
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

// 서버 연결 성공
socket.on('connect', () => {
  console.log('멀티플레이 서버 연결 성공!');
  console.log('내 플레이어 ID:', socket.id);
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
scene.background = new THREE.Color(0x9bc8e8);
scene.fog = new THREE.Fog(0x9bc8e8, 25, 100);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.querySelector('#app').appendChild(renderer.domElement);

// 조명
scene.add(new THREE.HemisphereLight(0xffffff, 0x6d805c, 2));

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(10, 20, 10);
sun.castShadow = true;
scene.add(sun);

// 바닥
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x75a96b })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 바닥 격자
const grid = new THREE.GridHelper(200, 100, 0x557d50, 0x668d60);
grid.position.y = 0.02;
scene.add(grid);


// 캐릭터 아바타
const player = new THREE.Group();

// 재질
const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd0ad });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x493126 });
const shirtMat = new THREE.MeshStandardMaterial({ color: 0x5689d8 });
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
  new THREE.CapsuleGeometry(0.34, 0.45, 6, 12),
  shirtMat
);
torso.position.y = 1.05;
torso.castShadow = true;
player.add(torso);

// 목
makeSphere(player, 0.15, [0, 1.53, 0], skinMat);

// 머리
makeSphere(player, 0.42, [0, 1.92, 0], skinMat);

// 머리카락
makeSphere(player, 0.43, [0, 2.12, -0.04], hairMat, [1.02, 0.72, 1]);
makeSphere(player, 0.2, [0, 2.18, 0.34], hairMat, [1.5, 0.65, 0.65]);

// 귀
makeSphere(player, 0.11, [-0.4, 1.91, 0], skinMat);
makeSphere(player, 0.11, [0.4, 1.91, 0], skinMat);

// 눈
const leftEye = makeSphere(player, 0.045, [-0.15, 1.98, 0.365], eyeMat);
const rightEye = makeSphere(player, 0.045, [0.15, 1.98, 0.365], eyeMat);

// 눈 반짝임
makeSphere(player, 0.014, [-0.16, 2.0, 0.402], whiteMat);
makeSphere(player, 0.014, [0.14, 2.0, 0.402], whiteMat);

// 입
makeSphere(player, 0.035, [0, 1.84, 0.408], eyeMat, [1.3, 0.65, 0.5]);

// 팔 생성 함수
function createArm(x) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 1.32, 0);
  player.add(pivot);

  const arm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.42, 4, 8),
    shirtMat
  );

  arm.position.y = -0.27;
  arm.castShadow = true;
  pivot.add(arm);

  makeSphere(pivot, 0.13, [0, -0.52, 0], skinMat);

  return pivot;
}

const leftArm = createArm(-0.42);
const rightArm = createArm(0.42);

// 다리 생성 함수
function createLeg(x) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.67, 0);
  player.add(pivot);

  const leg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.4, 4, 8),
    pantsMat
  );

  leg.position.y = -0.25;
  leg.castShadow = true;
  pivot.add(leg);

  makeSphere(pivot, 0.15, [0, -0.52, 0.07], shoeMat, [1, 0.65, 1.5]);

  return pivot;
}

const leftLeg = createLeg(-0.19);
const rightLeg = createLeg(0.19);

// 장면에 캐릭터 추가
scene.add(player);



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
lunchDog.add(dogBody);

// 머리
const dogHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.48, 20, 20),
  furMaterial
);
dogHead.position.set(0, 1.4, 0.38);
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
function createDogLeg(x, z) {
  const leg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.28, 4, 8),
    furMaterial
  );

  leg.position.set(x, 0.3, z);
  lunchDog.add(leg);
}

createDogLeg(-0.32, -0.35);
createDogLeg(0.32, -0.35);
createDogLeg(-0.32, 0.35);
createDogLeg(0.32, 0.35);

// 꼬리
const dogTail = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.09, 0.3, 4, 8),
  brownMaterial
);
dogTail.position.set(0, 0.95, -0.65);
dogTail.rotation.x = -0.8;
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



// 다른 플레이어 관리
const remotePlayers = {};


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
    position.y += 2.5;
    position.project(camera);

    const x = (position.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-position.y * 0.5 + 0.5) * window.innerHeight;

    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
  });
}


// 상대방 캐릭터 생성
function createRemotePlayer(data) {
  if (remotePlayers[data.id]) return;

  // 내 캐릭터를 복제
  const remotePlayer = player.clone(true);

  remotePlayer.position.set(
    data.x ?? 0,
    data.y ?? 0,
    data.z ?? 0
  );

  scene.add(remotePlayer);

  remotePlayers[data.id] = remotePlayer;

  console.log('상대방 캐릭터 생성:', data.id);
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

  console.log('상대방 캐릭터 제거:', playerId);
});


// 나무 만들기
function createTree(x, z) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x795438 })
  );
  trunk.position.y = 0.75;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x267d43 })
  );
  leaves.position.y = 2;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  tree.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });

  scene.add(tree);
}

[
  [-5, -5], [5, -7], [-8, 3], [8, 4],
  [-12, -10], [12, -12], [0, -15],
  [-15, 8], [15, 9]
].forEach(([x, z]) => createTree(x, z));

// 키보드 입력
const keys = {};

// 점프 상태
let verticalVelocity = 0;
let isJumping = false;

const gravity = 20;
const jumpPower = 8;
let landingTimer = 0;

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

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

  if (e.code === 'Space') {
    e.preventDefault();

    if (!isJumping) {
      verticalVelocity = jumpPower;
      isJumping = true;
    }
  }
});

// 눈 깜빡임
let blinkTimer = 0;
let nextBlink = 3;
let isBlinking = false;

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
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
const chatNickname = document.getElementById('chat-nickname');
// 점심추천 강아지 상호작용 UI
const dogInteraction = document.getElementById('dog-interaction');

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  // 눈 깜빡임 애니메이션
  blinkTimer += delta;

  if (!isBlinking && blinkTimer >= nextBlink) {
    isBlinking = true;
    blinkTimer = 0;
  }

  if (isBlinking) {
    const blinkProgress = blinkTimer / 0.15;
    const eyeScale = Math.abs(1 - blinkProgress * 2);

    leftEye.scale.y = Math.max(0.1, eyeScale);
    rightEye.scale.y = Math.max(0.1, eyeScale);

    if (blinkTimer >= 0.15) {
      isBlinking = false;
      blinkTimer = 0;
      nextBlink = 2 + Math.random() * 3;
      leftEye.scale.y = 1;
      rightEye.scale.y = 1;
    }
  }

  // 점프 물리
  verticalVelocity -= gravity * delta;
  player.position.y += verticalVelocity * delta;

  // 바닥에 착지
  if (player.position.y <= 0) {
    if (isJumping) {
      landingTimer = 0.18;
    }

    player.position.y = 0;
    verticalVelocity = 0;
    isJumping = false;
  }

  // 착지 순간 몸을 살짝 웅크리는 모션
  if (landingTimer > 0) {
    landingTimer = Math.max(0, landingTimer - delta);

    const progress = 1 - landingTimer / 0.18;

    torso.scale.y = 1 - Math.sin(progress * Math.PI) * 0.2;
  } else {
    torso.scale.y = 1;
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



  if (direction.length() > 0) {
    direction.normalize();

    // 캐릭터 이동
    player.position.addScaledVector(direction, speed * delta);
    player.rotation.y = Math.atan2(direction.x, direction.z);

    // 걷기와 달리기 애니메이션
    const gaitSpeed = isRunning ? 16 : 10;
    const gaitPower = isRunning ? 0.9 : 0.55;

    const swing = Math.sin(clock.elapsedTime * gaitSpeed) * gaitPower;

    // 다리 움직임
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;

    // 팔 움직임
    leftArm.rotation.x = -swing * 0.7;
    rightArm.rotation.x = swing * 0.7;

    // 달릴 때 몸이 더 크게 위아래로 움직임
    torso.position.y = 1.05 + Math.abs(Math.sin(clock.elapsedTime * gaitSpeed * 2)) * (isRunning ? 0.09 : 0.035);

  } else {
    // 대기 애니메이션
    const idleTime = clock.elapsedTime;

    // 다리는 자연스럽게 유지
    leftLeg.rotation.x = 0;
    rightLeg.rotation.x = 0;

    // 팔을 조금 더 크게 움직임
    leftArm.rotation.x = Math.sin(idleTime * 1.5) * 0.12;
    rightArm.rotation.x = Math.sin(idleTime * 1.5 + 0.5) * 0.12;

    // 숨 쉬는 동작
    torso.position.y = 1.05 + Math.sin(idleTime * 2) * 0.035;
    torso.scale.y = 1 + Math.sin(idleTime * 2) * 0.035;

    // 몸 전체가 살짝 좌우로 흔들림
    player.rotation.z = Math.sin(idleTime * 1.2) * 0.025;

    // 머리 움직임
    player.children[2].rotation.z = Math.sin(idleTime * 0.8) * 0.04;
  }

  // 플레이어와 강아지 사이의 거리 계산
  const dogDistance = Math.sqrt(
    Math.pow(player.position.x - lunchDog.position.x, 2) +
    Math.pow(player.position.z - lunchDog.position.z, 2)
  );

  // 강아지와 가까우면 상호작용 안내 표시
  isNearLunchDog = dogDistance <= 2.5;

  dogInteraction.style.display = isNearLunchDog ? 'block' : 'none';

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
      nickname: chatNickname.value.trim() || '플레이어'
    });
  }

  updateRemoteSpeechBubbles();
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
    player.position.y + 2.7,
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
    player.position.y + 2.7,
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