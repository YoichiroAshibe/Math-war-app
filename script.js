let scene, camera, renderer;
let player, playerPower = 10;
let enemies = [];
let bullets = [];
let gates = [];
let gateCount = 0;
let score = 0;
let currentQuestion = null;
let gameRunning = false;
let lastShootTime = 0;
let shootInterval = 500;
let bulletDamage = 10;
let bulletSpeed = 0.5;
let playerTargetX = 0;
let enemySpeed = 0.09;
let gateSpeed = 0.09;
let enemySpawnRate = 0.03;
let maxEnemies = 20;
let dualShootEnabled = false;  // 2レーン攻撃フラグ
let tripleShootEnabled = false; // 3レーン攻撃フラグ

// 音声関連の変数
let bgm, shootSound, powerUpSound;
let shootSoundPool = []; // 複数の攻撃音インスタンス
let currentShootSound = 0;

// バランス設定
const powerProgression = [10, 20, 40, 55, 80, 110, 145, 185, 230, 280, 335];
const enemyHPProgression = [10, 15, 20, 30, 45, 65, 90, 120, 155, 195, 240];
const bossHPProgression = [100, 180, 280, 400, 550, 730, 940, 1180, 2100, 3600];

// Three.js初期化
function initThree() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf0f8ff, 20, 100);  // 薄い水色の霧
    
    // 空の背景を明るくする
    scene.background = new THREE.Color(0xf0f8ff);  // 薄い水色の背景

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 12, 25);
    camera.lookAt(0, 0, -10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('gameContainer').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);  // 明るさを上げる
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 20, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    scene.add(directionalLight);

    // 海（グラデーション効果）
    const seaGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    const seaMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            color1: { value: new THREE.Color(0x0099ff) },
            color2: { value: new THREE.Color(0x00ccff) }
        },
        vertexShader: `
            varying vec2 vUv;
            uniform float time;
            void main() {
                vUv = uv;
                vec3 pos = position;
                pos.z += sin(pos.x * 0.1 + time) * 0.5;
                pos.z += sin(pos.y * 0.1 + time * 0.8) * 0.5;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec2 vUv;
            void main() {
                gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
            }
        `
    });
    const sea = new THREE.Mesh(seaGeometry, seaMaterial);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -5;
    scene.add(sea);

    // 橋（モダンなデザイン）
    const bridgeGroup = new THREE.Group();
    
    // メインの橋
    const bridgeGeometry = new THREE.BoxGeometry(12, 0.8, 150);
    const bridgeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x555555,
        emissive: 0x222222,
        emissiveIntensity: 0.1
    });
    const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
    bridge.receiveShadow = true;
    bridgeGroup.add(bridge);

    // スタイリッシュな手すり
    const railGeometry = new THREE.BoxGeometry(0.3, 3, 150);
    const railMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888,
        emissive: 0x444444,
        emissiveIntensity: 0.2
    });
    const leftRail = new THREE.Mesh(railGeometry, railMaterial);
    leftRail.position.set(-6, 1.5, 0);
    bridgeGroup.add(leftRail);
    const rightRail = new THREE.Mesh(railGeometry, railMaterial);
    rightRail.position.set(6, 1.5, 0);
    bridgeGroup.add(rightRail);
    
    // 手すりの光るトップ
    const railTopGeometry = new THREE.BoxGeometry(0.5, 0.2, 150);
    const railTopMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.6
    });
    const leftRailTop = new THREE.Mesh(railTopGeometry, railTopMaterial);
    leftRailTop.position.set(-6, 3, 0);
    bridgeGroup.add(leftRailTop);
    const rightRailTop = new THREE.Mesh(railTopGeometry, railTopMaterial);
    rightRailTop.position.set(6, 3, 0);
    bridgeGroup.add(rightRailTop);
    
    scene.add(bridgeGroup);

    createPlayer();
}

// 音声ファイルの初期化
function initSounds() {
    // BGM
    bgm = new Audio('sounds/bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.15;  // 15%に変更
    
    // パワーアップ音
    powerUpSound = new Audio('sounds/powerUp.mp3');
    powerUpSound.volume = 0.7;
    
    // 攻撃音のプールを作成（音の重なりを制御）
    for (let i = 0; i < 5; i++) {
        const sound = new Audio('sounds/shoot.mp3');
        sound.volume = 0.5;
        shootSoundPool.push(sound);
    }
}

// プレイヤー作成
function createPlayer() {
    const playerGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.CylinderGeometry(0.6, 0.8, 2, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4169E1,
        emissive: 0x4169E1,
        emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    playerGroup.add(body);

    const headGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const headMaterial = new THREE.MeshPhongMaterial({ color: 0xFFE4B5 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.5;
    head.castShadow = true;
    playerGroup.add(head);

    playerGroup.position.set(0, 1.5, 15);
    scene.add(playerGroup);
    player = playerGroup;
}

// 敵を作成
function createEnemy(hp, xPos, zPos, isBoss = false) {
    const enemyGroup = new THREE.Group();
    
    const scale = isBoss ? 2 : 1;
    
    if (isBoss) {
        // ボス（トロール風の岩巨人）
        // 体
        const bodyGeometry = new THREE.BoxGeometry(2 * scale, 2.5 * scale, 1.5 * scale);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8B7355,  // 茶色がかった岩色
            emissive: 0x4A4A4A,
            emissiveIntensity: 0.1,
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        enemyGroup.add(body);
        
        // 頭
        const headGeometry = new THREE.BoxGeometry(1.5 * scale, 1.2 * scale, 1.2 * scale);
        const headMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x7A6B5D,
            roughness: 0.8
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2 * scale;
        enemyGroup.add(head);
        
        // 光る目（左）
        const eyeGeometry = new THREE.SphereGeometry(0.2 * scale, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000
        });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.4 * scale, 2 * scale, 0.6 * scale);
        enemyGroup.add(leftEye);
        
        // 光る目（右）
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.4 * scale, 2 * scale, 0.6 * scale);
        enemyGroup.add(rightEye);
        
        // 腕（簡易的に）
        const armGeometry = new THREE.BoxGeometry(0.8 * scale, 2 * scale, 0.8 * scale);
        const armMaterial = new THREE.MeshPhongMaterial({ color: 0x8B7355, roughness: 0.8 });
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-1.5 * scale, 0.5 * scale, 0);
        enemyGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(1.5 * scale, 0.5 * scale, 0);
        enemyGroup.add(rightArm);
        
    } else {
        // モブ敵（ゴブリン風）
        // 体
        const bodyGeometry = new THREE.ConeGeometry(0.8, 1.5, 6);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x228B22,  // 緑色
            emissive: 0x228B22,
            emissiveIntensity: 0.1
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.75;
        body.castShadow = true;
        enemyGroup.add(body);
        
        // 頭
        const headGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0x32CD32 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.8;
        enemyGroup.add(head);
        
        // 赤い目
        const eyeGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.2, 1.8, 0.4);
        enemyGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.2, 1.8, 0.4);
        enemyGroup.add(rightEye);
    }

    // HPバー（ボスのみ）
    if (isBoss) {
        // デバッグ用ログ
        console.log('ボスのHP表示を作成中...');
        
        // HPバー表示を削除（動作しないため）
        // 代わりにボスの色で体力を表現
        console.log('ボスのHP表示は色で表現します');
    }

    enemyGroup.position.set(xPos, isBoss ? 0 : 0.5, zPos);
    enemyGroup.userData = { 
        hp: hp, 
        maxHp: hp, 
        isBoss: isBoss,
        speed: isBoss ? 0.036 : enemySpeed
    };
    
    scene.add(enemyGroup);
    enemies.push(enemyGroup);
}

// ボスのHP表示更新（改善版）
function updateBossHPDisplay(boss) {
    if (!boss.userData.hpCanvas) {
        console.error('HPキャンバスが存在しません');
        return;
    }
    
    const canvas = boss.userData.hpCanvas;
    const context = canvas.getContext('2d');
    
    // キャンバスをクリア
    context.clearRect(0, 0, 512, 64);
    
    // 背景（濃い色で見やすく）
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(20, 8, 472, 48);
    
    // HP枠
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    context.strokeRect(26, 14, 460, 36);
    
    // HPバーの背景
    context.fillStyle = '#333333';
    context.fillRect(28, 16, 456, 32);
    
    // HPバー
    const hpPercent = boss.userData.hp / boss.userData.maxHp;
    let barColor;
    if (hpPercent > 0.6) {
        barColor = '#00ff00';
    } else if (hpPercent > 0.3) {
        barColor = '#ffff00';
    } else {
        barColor = '#ff0000';
    }
    
    context.fillStyle = barColor;
    context.fillRect(28, 16, 456 * hpPercent, 32);
    
    // HPテキスト（中央に配置）
    context.fillStyle = 'white';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.strokeText(`HP: ${boss.userData.hp}/${boss.userData.maxHp}`, 256, 32);
    context.fillText(`HP: ${boss.userData.hp}/${boss.userData.maxHp}`, 256, 32);
    
    // テクスチャを更新
    boss.userData.hpTexture.needsUpdate = true;
    
    console.log('HP表示更新完了:', boss.userData.hp + '/' + boss.userData.maxHp);
}

// 弾を作成（位置オフセット付き）
function createBulletWithOffset(xOffset = 0, xVelocity = 0) {
    const bulletGroup = new THREE.Group();
    
    let bulletColor;
    let bulletSize = 0.2;
    if (playerPower < 50) {
        bulletColor = 0xffff00;
    } else if (playerPower < 200) {
        bulletColor = 0x00ffff;
        bulletSize = 0.25;
    } else {
        bulletColor = 0xff00ff;
        bulletSize = 0.3;
    }
    
    const bulletGeometry = new THREE.SphereGeometry(bulletSize, 8, 8);
    const bulletMaterial = new THREE.MeshPhongMaterial({ 
        color: bulletColor,
        emissive: bulletColor,
        emissiveIntensity: 0.8
    });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bulletGroup.add(bulletMesh);
    
    if (playerPower >= 80) {
        const glowGeometry = new THREE.SphereGeometry(bulletSize * 2, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
            color: bulletColor,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        bulletGroup.add(glow);
    }
    
    bulletGroup.position.copy(player.position);
    bulletGroup.position.x += xOffset;  // 横位置をオフセット
    bulletGroup.position.y = 2;
    bulletGroup.userData = { 
        damage: bulletDamage,
        xVelocity: xVelocity  // 横方向の速度
    };
    
    scene.add(bulletGroup);
    bullets.push(bulletGroup);
    
    createParticleEffect(bulletGroup.position, bulletColor);
}

// 弾を作成
function createBullet() {
    if (tripleShootEnabled) {
        // 3レーン攻撃（扇状に発射）- 角度を狭める
        createBulletWithOffset(0, 0);        // 中央
        createBulletWithOffset(-0.8, -0.08); // 左（角度を狭めた）
        createBulletWithOffset(0.8, 0.08);   // 右（角度を狭めた）
    } else if (dualShootEnabled) {
        // 2レーン攻撃（左右に弾を発射）
        createBulletWithOffset(-0.8, 0);  // 左側
        createBulletWithOffset(0.8, 0);   // 右側
    } else {
        // 通常の単発
        createBulletWithOffset(0, 0);
    }
    
    // 攻撃音を再生（プールから順番に使用）
    const sound = shootSoundPool[currentShootSound];
    sound.currentTime = 0;
    sound.play().catch(e => console.log('攻撃音再生エラー:', e));
    currentShootSound = (currentShootSound + 1) % shootSoundPool.length;
}

// ゲート破壊エフェクト
function createGateBreakEffect(gate) {
    for (let i = 0; i < 20; i++) {
        const fragmentGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
        const fragmentMaterial = new THREE.MeshPhysicalMaterial({
            color: gate.mesh.material.color,
            transparent: true,
            opacity: 0.6,
            metalness: 0.5,
            roughness: 0.1
        });
        const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
        
        fragment.position.copy(gate.mesh.position);
        fragment.position.x += (Math.random() - 0.5) * 2;
        fragment.position.y += Math.random() * 3;
        
        fragment.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                Math.random() * 0.3 + 0.1,
                Math.random() * 0.2 - 0.1
            ),
            rotationSpeed: new THREE.Vector3(
                Math.random() * 0.2,
                Math.random() * 0.2,
                Math.random() * 0.2
            ),
            lifetime: 60
        };
        
        scene.add(fragment);
        
        const animateFragment = () => {
            fragment.position.add(fragment.userData.velocity);
            fragment.userData.velocity.y -= 0.01;
            fragment.rotation.x += fragment.userData.rotationSpeed.x;
            fragment.rotation.y += fragment.userData.rotationSpeed.y;
            fragment.rotation.z += fragment.userData.rotationSpeed.z;
            fragment.material.opacity -= 0.01;
            
            fragment.userData.lifetime--;
            if (fragment.userData.lifetime > 0 && fragment.material.opacity > 0) {
                requestAnimationFrame(animateFragment);
            } else {
                scene.remove(fragment);
            }
        };
        animateFragment();
    }
    
    gate.mesh.visible = false;
    gate.textMesh.visible = false;
}

// パーティクルエフェクト
function createParticleEffect(position, color) {
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
        
        const screenPos = toScreenPosition(position);
        particle.style.left = screenPos.x + 'px';
        particle.style.top = screenPos.y + 'px';
        
        document.getElementById('gameUI').appendChild(particle);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 50;
        
        let opacity = 1;
        const interval = setInterval(() => {
            opacity -= 0.05;
            particle.style.opacity = opacity;
            particle.style.left = (parseFloat(particle.style.left) + Math.cos(angle) * speed * 0.01) + 'px';
            particle.style.top = (parseFloat(particle.style.top) + Math.sin(angle) * speed * 0.01) + 'px';
            
            if (opacity <= 0) {
                clearInterval(interval);
                particle.remove();
            }
        }, 16);
    }
}

// 3D座標をスクリーン座標に変換
function toScreenPosition(position) {
    const vector = position.clone();
    vector.project(camera);
    
    return {
        x: (vector.x + 1) / 2 * window.innerWidth,
        y: -(vector.y - 1) / 2 * window.innerHeight
    };
}

// ゲート作成
function createGates() {
    gates.forEach(gate => {
        scene.remove(gate.mesh);
        scene.remove(gate.textMesh);
    });
    gates = [];

    const questionData = generateQuestion();
    currentQuestion = questionData;
    document.getElementById('question').textContent = questionData.question;

    const answers = Math.random() > 0.5 
        ? [questionData.correct, questionData.incorrect]
        : [questionData.incorrect, questionData.correct];

    [-3, 3].forEach((xPos, index) => {
        const gateGeometry = new THREE.BoxGeometry(5, 6, 0.5);
        const gateMaterial = new THREE.MeshPhysicalMaterial({
            color: index === 0 ? 0x00ffff : 0x00ff00,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1,
            metalness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            transmission: 0.7,
            emissive: index === 0 ? 0x00ffff : 0x00ff00,
            emissiveIntensity: 0.2
        });
        const gateMesh = new THREE.Mesh(gateGeometry, gateMaterial);
        gateMesh.position.set(xPos, 3, -30);
        gateMesh.castShadow = true;
        scene.add(gateMesh);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.strokeStyle = 'black';
        context.lineWidth = 8;
        context.font = 'bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeText(answers[index], 256, 128);
        context.fillText(answers[index], 256, 128);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(xPos, 3, -29.5);
        sprite.scale.set(8, 4, 1);
        scene.add(sprite);

        gates.push({
            mesh: gateMesh,
            textMesh: sprite,
            answer: answers[index],
            xPos: xPos,
            passed: false
        });
    });

    // ボス配置（毎ゲート後に確定で出現）
    createEnemy(bossHPProgression[gateCount], 0, -40, true);
}

// 問題生成
function generateQuestion() {
    const patterns = [
        () => {
            const coef1 = Math.floor(Math.random() * 5) + 1;
            const coef2 = Math.floor(Math.random() * 5) + 1;
            const sign = Math.random() > 0.5 ? 1 : -1;
            const question = `${coef1 === 1 ? '' : coef1}a × ${sign > 0 ? coef2 : '(' + (-coef2) + ')'}`;
            const answer = coef1 * coef2 * sign;
            let correctAnswer = '';
            let incorrectAnswer = '';
            
            if (answer === 0) {
                correctAnswer = '0';
                incorrectAnswer = 'a';
            } else if (answer === 1) {
                correctAnswer = 'a';
                incorrectAnswer = '2a';
            } else if (answer === -1) {
                correctAnswer = '-a';
                incorrectAnswer = 'a';
            } else {
                correctAnswer = answer + 'a';
                incorrectAnswer = (-answer) + 'a';
            }
            
            return { 
                question: question + ' = ?', 
                correct: correctAnswer,
                incorrect: incorrectAnswer
            };
        },
        () => {
            const coef1 = Math.floor(Math.random() * 10) + 1;
            const coef2 = Math.floor(Math.random() * 10) + 1;
            const operation = Math.random() > 0.5 ? '+' : '-';
            const c1Display = coef1 === 1 ? '' : coef1;
            const c2Display = coef2 === 1 ? '' : coef2;
            const question = `${c1Display}a ${operation} ${c2Display}a`;
            const answer = operation === '+' ? coef1 + coef2 : coef1 - coef2;
            let correctAnswer = '';
            let incorrectAnswer = '';
            
            if (answer === 0) {
                correctAnswer = '0';
                incorrectAnswer = 'a';
            } else if (answer === 1) {
                correctAnswer = 'a';
                incorrectAnswer = '2a';
            } else if (answer === -1) {
                correctAnswer = '-a';
                incorrectAnswer = 'a';
            } else {
                correctAnswer = answer + 'a';
                const wrongAnswer = operation === '+' ? coef1 - coef2 : coef1 + coef2;
                if (wrongAnswer === 0) {
                    incorrectAnswer = '0';
                } else if (wrongAnswer === 1) {
                    incorrectAnswer = 'a';
                } else if (wrongAnswer === -1) {
                    incorrectAnswer = '-a';
                } else {
                    incorrectAnswer = wrongAnswer + 'a';
                }
            }
            
            return { 
                question: question + ' = ?', 
                correct: correctAnswer,
                incorrect: incorrectAnswer
            };
        },
        () => {
            const coef = Math.floor(Math.random() * 4) + 2;
            const term1 = Math.floor(Math.random() * 5) + 1;
            const term2 = Math.floor(Math.random() * 5) + 1;
            const t1Display = term1 === 1 ? '' : term1;
            const question = `${coef}(${t1Display}a + ${term2})`;
            const answer1 = coef * term1;
            const answer2 = coef * term2;
            let a1Display = '';
            
            if (answer1 === 1) {
                a1Display = 'a';
            } else if (answer1 === -1) {
                a1Display = '-a';
            } else {
                a1Display = answer1 + 'a';
            }
            
            return { 
                question: question + ' = ?', 
                correct: `${a1Display} + ${answer2}`,
                incorrect: `${a1Display} + ${term2}`
            };
        }
    ];

    const maxPattern = Math.min(patterns.length, Math.ceil((gateCount + 1) / 3));
    const selectedPattern = patterns[Math.floor(Math.random() * maxPattern)];
    return selectedPattern();
}

// マウス移動ハンドラー
function onMouseMove(event) {
    if (!gameRunning) return;
    // カーソル位置を直接主人公の位置に変換（-6から6の範囲）
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    playerTargetX = x * 6;  // 橋の幅に合わせて調整
}

// ゲート通過チェック
function checkGatePass() {
    gates.forEach((gate, index) => {
        if (!gate.passed && gate.mesh.position.z > player.position.z - 2 && gate.mesh.position.z < player.position.z + 2) {
            const playerX = player.position.x;
            const gateX = gate.xPos;
            
            if (Math.abs(playerX - gateX) < 2.5) {
                gate.passed = true;
                const isCorrect = gate.answer === currentQuestion.correct;
                
                if (isCorrect) {
                    // 滑らかな戦力上昇
                    const nextPower = powerProgression[gateCount + 1];
                    const powerIncrease = nextPower - playerPower;
                    
                    // 特定のゲートでの強化
                    let upgradeMessage = `正解！+${powerIncrease}戦力`;
                    
                    if (gateCount === 0) {
                        // 1ゲート目：発射速度2倍
                        shootInterval = shootInterval / 2;
                        upgradeMessage += "＆発射速度2倍！";
                    } else if (gateCount === 1) {
                        // 2ゲート目：攻撃力2倍
                        bulletDamage = bulletDamage * 2;
                        upgradeMessage += "＆攻撃力2倍！";
                    } else if (gateCount === 2) {
                        // 3ゲート目：2レーン攻撃開始！
                        dualShootEnabled = true;
                        shootInterval = shootInterval / 1.2;
                        upgradeMessage += "＆2レーン攻撃開始！";
                    } else if (gateCount === 3) {
                        // 4ゲート目：さらに攻撃力アップ
                        bulletDamage = Math.floor(bulletDamage * 1.5);
                        upgradeMessage += "＆攻撃力1.5倍！";
                    } else if (gateCount === 4) {
                        // 5ゲート目：発射速度アップ
                        shootInterval = Math.max(50, shootInterval * 0.8);
                        upgradeMessage += "＆発射速度UP！";
                    } else if (gateCount === 5) {
                        // 6ゲート目：3レーン攻撃！
                        dualShootEnabled = false;
                        tripleShootEnabled = true;
                        upgradeMessage += "＆3レーン扇状攻撃！";
                    } else if (gateCount === 6) {
                        // 7ゲート目：攻撃力大幅アップ
                        bulletDamage = Math.floor(bulletDamage * 1.8);
                        upgradeMessage += "＆攻撃力大幅UP！";
                    } else if (gateCount % 2 === 0) {
                        // その後は交互に強化
                        shootInterval = Math.max(50, shootInterval * 0.85);
                        upgradeMessage += "＆発射速度UP！";
                    } else {
                        bulletDamage = Math.floor(bulletDamage * 1.3);
                        upgradeMessage += "＆攻撃力UP！";
                    }
                    
                    playerPower = nextPower;
                    score += 100 * (gateCount + 1);
                    showEffect(upgradeMessage, 'correct-effect');
                    
                    // パワーアップ音を再生
                    powerUpSound.currentTime = 0;
                    powerUpSound.play().catch(e => console.log('パワーアップ音再生エラー:', e));
                } else {
                    showEffect(`不正解... 正解は ${currentQuestion.correct}`, 'incorrect-effect');
                }
                
                // 通過したゲートのみ破壊エフェクト
                createGateBreakEffect(gate);
                
                // 通過しなかったゲートは単純に消す
                gates.forEach(otherGate => {
                    if (otherGate !== gate && !otherGate.passed) {
                        otherGate.mesh.visible = false;
                        otherGate.textMesh.visible = false;
                        otherGate.passed = true; // 重複処理を防ぐ
                    }
                });
                
                document.getElementById('powerDisplay').textContent = `戦力: ${playerPower}`;
                document.getElementById('score').textContent = score;
                
                gateCount++;
                document.getElementById('gateCount').textContent = gateCount;
                
                // 10ゲート目クリア後は敵を生成しない
                if (gateCount < 10) {
                    enemySpawnRate = Math.min(0.15, 0.03 + gateCount * 0.012);
                    maxEnemies = Math.min(50, 20 + gateCount * 3);
                    setTimeout(() => createGates(), 2000);
                } else {
                    // 10ゲート目クリア後は敵の生成を停止
                    enemySpawnRate = 0;
                    // 残りの敵を全て倒したらクリア
                    checkForGameClear();
                }
            }
        }
    });
}

// エフェクト表示
function showEffect(text, className) {
    const effect = document.createElement('div');
    effect.className = 'effect ' + className;
    effect.textContent = text;
    document.getElementById('gameUI').appendChild(effect);

    setTimeout(() => {
        effect.remove();
    }, 1000);
}

// 衝突判定（当たり判定の調整）
function checkCollisions() {
    bullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
            // 当たり判定の距離を敵のタイプによって調整
            const hitDistance = enemy.userData.isBoss ? 2.5 : 1.5;
            const distance = bullet.position.distanceTo(enemy.position);
            
            if (distance < hitDistance) {
                enemy.userData.hp -= bullet.userData.damage;
                
                if (enemy.userData.isBoss) {
                    console.log('ボスにダメージ！残りHP:', enemy.userData.hp);
                    // ボスの全パーツの色を体力に応じて変更
                    const hpPercent = enemy.userData.hp / enemy.userData.maxHp;
                    let bodyColor;
                    
                    // 茶色から徐々に赤に変化
                    if (hpPercent > 0.8) {
                        bodyColor = 0x8B7355;  // 通常の茶色
                    } else if (hpPercent > 0.6) {
                        bodyColor = 0x9B6355;  // 少し赤みがかった茶色
                    } else if (hpPercent > 0.4) {
                        bodyColor = 0xAB5355;  // さらに赤みが強い
                    } else if (hpPercent > 0.2) {
                        bodyColor = 0xBB4355;  // かなり赤い
                    } else {
                        bodyColor = 0xCC0000;  // 真っ赤（もうすぐ倒せる！）
                    }
                    
                    // ボスの全てのパーツの色を更新
                    enemy.children.forEach((child) => {
                        if (child.material && child.material.color) {
                            // 目以外のパーツの色を変更
                            if (child.material.color.getHex() !== 0xff0000) {  // 赤い目は除外
                                child.material.color.setHex(bodyColor);
                                child.material.emissive.setHex(bodyColor);
                                child.material.emissiveIntensity = 0.2 * (1 - hpPercent); // HPが減るほど光る
                            }
                        }
                    });
                }
                
                if (enemy.userData.hp <= 0) {
                    scene.remove(enemy);
                    enemies.splice(enemyIndex, 1);
                    score += enemy.userData.isBoss ? 1000 : 10;
                    document.getElementById('score').textContent = score;
                    
                    // 10ゲート目クリア後、全ての敵を倒したらクリア
                    if (gateCount >= 10 && enemies.length === 0) {
                        gameWin();
                    }
                }
                
                scene.remove(bullet);
                bullets.splice(bulletIndex, 1);
                
                createParticleEffect(bullet.position, 0xff0000);
            }
        });
    });

    enemies.forEach(enemy => {
        if (enemy.position.z > player.position.z - 1) {
            gameOver();
        }
    });
}

// 10ゲート目クリア後のクリアチェック
function checkForGameClear() {
    if (enemies.length === 0) {
        gameWin();
    }
}

// ゲームオーバー
function gameOver() {
    gameRunning = false;
    document.getElementById('gameOverText').textContent = 'ゲームオーバー';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
    
    // BGMを停止
    bgm.pause();
    bgm.currentTime = 0;
}

// ゲームクリア
function gameWin() {
    gameRunning = false;
    document.getElementById('gameOverText').textContent = '素晴らしい！全ステージクリア！';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
    
    // BGMを停止
    bgm.pause();
    bgm.currentTime = 0;
}

// ゲーム開始
function startGame() {
    playerPower = 10;
    gateCount = 0;
    score = 0;
    gameRunning = true;
    shootInterval = 385;  // 500 / 1.3 ≈ 385（初期攻撃速度1.3倍）
    bulletDamage = 10;
    playerTargetX = 0;
    enemySpawnRate = 0.02;  // さらに少し下げる
    maxEnemies = 15;
    dualShootEnabled = false;  // 2レーン攻撃をリセット
    tripleShootEnabled = false; // 3レーン攻撃をリセット
    
    document.getElementById('powerDisplay').textContent = `戦力: ${playerPower}`;
    document.getElementById('gateCount').textContent = gateCount;
    document.getElementById('score').textContent = score;
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('startScreen').style.display = 'none';

    enemies.forEach(enemy => scene.remove(enemy));
    enemies = [];
    bullets.forEach(bullet => scene.remove(bullet));
    bullets = [];
    gates.forEach(gate => {
        scene.remove(gate.mesh);
        scene.remove(gate.textMesh);
    });
    gates = [];

    for (let i = 0; i < 2; i++) {  // 3体から2体に減らす
        createEnemy(enemyHPProgression[0], (Math.random() - 0.5) * 10, -40 - i * 5);
    }

    createGates();
    
    // BGMを再生
    bgm.play().catch(e => {
        console.log('BGM再生エラー:', e);
        // ユーザーインタラクション後に再生を試みる
        document.addEventListener('click', () => {
            bgm.play().catch(e => console.log('BGM再生再試行エラー:', e));
        }, { once: true });
    });
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);

    if (gameRunning) {
        if (Math.abs(player.position.x - playerTargetX) > 0.1) {
            player.position.x += (playerTargetX - player.position.x) * 0.1;
        }

        const currentTime = Date.now();
        if (currentTime - lastShootTime > shootInterval) {
            createBullet();
            lastShootTime = currentTime;
            
            // パワーアップ後の追加攻撃（powerが128以上でさらに強化）
            if (playerPower >= 128 && !dualShootEnabled) {
                // 2レーン攻撃がまだの場合は3発同時
                setTimeout(() => {
                    const originalX = player.position.x;
                    player.position.x -= 0.5;
                    createBullet();
                    player.position.x = originalX + 0.5;
                    createBullet();
                    player.position.x = originalX;
                }, 50);
            }
        }

        bullets.forEach((bullet, index) => {
            bullet.position.z -= bulletSpeed;
            // 扇状攻撃の場合は横方向にも移動
            if (bullet.userData.xVelocity) {
                bullet.position.x += bullet.userData.xVelocity;
            }
            // 攻撃距離を1.5倍に延長（-30まで）
            if (bullet.position.z < -30) {
                scene.remove(bullet);
                bullets.splice(index, 1);
            }
        });

        enemies.forEach(enemy => {
            enemy.position.z += enemy.userData.speed;
            enemy.position.x += Math.sin(Date.now() * 0.001 + enemy.position.z) * 0.01;
            
            // ボスと敵の簡単なアニメーション
            if (enemy.userData.isBoss) {
                // ボスは重そうに揺れる
                enemy.rotation.z = Math.sin(Date.now() * 0.0005) * 0.05;
                enemy.position.y = Math.sin(Date.now() * 0.0008) * 0.2;
            } else {
                // ゴブリンは小刻みに跳ねる
                enemy.position.y = 0.5 + Math.abs(Math.sin(Date.now() * 0.005 + enemy.position.x)) * 0.3;
                enemy.rotation.y = Math.sin(Date.now() * 0.003) * 0.3;
            }
        });

        gates.forEach(gate => {
            gate.mesh.position.z += gateSpeed;
            gate.textMesh.position.z += gateSpeed;
        });

        if (enemies.length < maxEnemies && Math.random() < enemySpawnRate && gateCount < 10) {
            // 序盤は敵のHPも少し低めに
            let baseHP = enemyHPProgression[gateCount];
            if (gateCount < 3) {
                baseHP = Math.floor(baseHP * 0.8);  // 3ゲート目までは敵のHPを20%減
            }
            const enemyHP = Math.random() < 0.2 ? baseHP * 2 : baseHP;
            createEnemy(enemyHP, (Math.random() - 0.5) * 10, -50);
        }

        checkGatePass();
        checkCollisions();
    }

    renderer.render(scene, camera);
}

// ウィンドウリサイズ
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 初期化
initThree();
initSounds();

// イベントリスナー
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('resize', onWindowResize);
document.getElementById('startBtn').onclick = startGame;
document.getElementById('restartBtn').onclick = startGame;

// アニメーション開始
animate();
