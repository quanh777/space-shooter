const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 800, H = 600;

let gameRunning = false;
let score = 0, wave = 0, playerHealth = 100, maxHealth = 100;
let playerMoney = 0, energy = 100, energyRegen = 10;
let invincible = false, invTime = 0, screenShake = 0;
let doubleShotCount = 0, tripleShotCount = 0;
let isResting = false, restStart = 0, bossSpawned = false;
let isShop = false, selectedItems = [], itemsToSell = [];
let skillUpBoughtThisShop = false;
let bossKills = 0, keys = {};
let neededSpawn = false;
let tutorialCircle = null;
let tutorialProgress = 0;

let comboKills = 0;
let comboTimer = 0;
let maxCombo = 0;
let comboMultiplier = 1;

const CRIT_CHANCE = 0.15;
const CRIT_MULTIPLIER = 2;

let powerUps = [];
let activeBuffs = {};
const POWER_UP_TYPES = {
    'speed': { color: '#00ff00', duration: 5000, desc: 'SPEED BOOST' },
    'rapid': { color: '#ffff00', duration: 4000, desc: 'RAPID FIRE' },
    'damage': { color: '#ff6600', duration: 5000, desc: 'DAMAGE UP' },
    'magnet': { color: '#ff00ff', duration: 6000, desc: 'MONEY MAGNET' }
};

let waveStartTime = 0;
let waveBonusEarned = 0;

const PW = 50, PH = 50;
let playerX = 375, playerY = 275, playerSpeed = 2.5;
let dirX = 0, dirY = 0, isSliding = false, lastSlide = 0;

let bullets = [], bulletSpeed = 5, bulletCooldown = 400;
let bulletDamage = 25, canShoot = true, lastShot = 0;

let enemies = [], particles = [];
let bombProjectiles = [];

const skill = { level: 1, maxLvl: 999, cooldown: 6000, lastUse: 0, radius: 100, damage: 100, cost: 20 };

let shieldCooldown = 0;
const SHIELD_COOLDOWN_BASE = 10000;

const shopItems = {
    "Health Upgrade": { price: 50, max: -1, b: 0, desc: "Heal 25 HP instantly", descVI: "Hồi 25 HP ngay" },
    "Max Health": { price: 100, max: -1, b: 0, desc: "+25 Max HP", descVI: "+25 HP tối đa" },
    "Shield": { price: 60, max: -1, b: 0, desc: "Auto shield +duration -CD", descVI: "Khiên tự động +thời gian -CD" },
    "Regen": { price: 120, max: -1, b: 0, desc: "+0.5 HP/sec regen", descVI: "+0.5 HP/giây" },
    "Energy Upgrade": { price: 30, max: -1, b: 0, desc: "+5 energy regen", descVI: "+5 hồi năng lượng" },
    "Speed Boost": { price: 80, max: -1, b: 0, desc: "+0.3 move speed", descVI: "+0.3 tốc độ di chuyển" },
    "Dash Cooldown": { price: 100, max: -1, b: 0, desc: "-0.5s dash cooldown", descVI: "-0.5s CD dash" },
    "Bullet Speed": { price: 20, max: -1, b: 0, desc: "+2 bullet speed", descVI: "+2 tốc độ đạn" },
    "Bullet Damage": { price: 80, max: -1, b: 0, desc: "+10 bullet damage", descVI: "+10 sát thương đạn" },
    "Fire Rate": { price: 60, max: -1, b: 0, desc: "-60ms fire delay", descVI: "-60ms thời gian bắn" },
    "Double Shot": { price: 80, max: -1, b: 0, desc: "Fire +2 parallel bullets", descVI: "Bắn thêm 2 đạn song song" },
    "Triple Shot": { price: 130, max: -1, b: 0, desc: "Fire +2 spread bullets", descVI: "Bắn thêm 2 đạn hình quạt" },
    "Piercing": { price: 180, max: -1, b: 0, desc: "Bullets pierce enemies", descVI: "Đạn xuyên địch" },
    "Skill Up": { price: 50, max: -1, b: 0, desc: "Upgrade bomb skill", descVI: "Nâng cấp skill bomb" },
    "Luck": { price: 60, max: -1, b: 0, desc: "+15% drop chance", descVI: "+15% tỉ lệ rơi đồ" },
    "Magnet": { price: 80, max: -1, b: 0, desc: "+50 pickup range", descVI: "+50 tầm nhặt đồ" },
    "Greed": { price: 100, max: -1, b: 0, desc: "+20% money drops", descVI: "+20% tiền rơi" }
};

let shopRefreshCount = 0;
let shopRefreshPrice = 20;

const bgCanvas = document.createElement('canvas');
bgCanvas.width = W; bgCanvas.height = H;
const bgCtx = bgCanvas.getContext('2d');

const spaceGrad = bgCtx.createLinearGradient(0, 0, 0, H);
spaceGrad.addColorStop(0, '#020010');
spaceGrad.addColorStop(0.3, '#050520');
spaceGrad.addColorStop(0.6, '#0a0a2e');
spaceGrad.addColorStop(1, '#030318');
bgCtx.fillStyle = spaceGrad;
bgCtx.fillRect(0, 0, W, H);

const nebulaColors = [
    { r: 60, g: 20, b: 120 },
    { r: 20, g: 40, b: 100 },
    { r: 100, g: 15, b: 60 },
    { r: 15, g: 60, b: 80 },
    { r: 80, g: 30, b: 90 },
    { r: 20, g: 30, b: 70 },
];
for (let n = 0; n < 6; n++) {
    const nx = Math.random() * W, ny = Math.random() * H;
    const ns = Math.random() * 140 + 80;
    const nc = nebulaColors[n % nebulaColors.length];
    const nebGrad = bgCtx.createRadialGradient(nx, ny, 0, nx, ny, ns);
    nebGrad.addColorStop(0, `rgba(${nc.r},${nc.g},${nc.b},0.25)`);
    nebGrad.addColorStop(0.4, `rgba(${nc.r},${nc.g},${nc.b},0.12)`);
    nebGrad.addColorStop(0.7, `rgba(${nc.r},${nc.g},${nc.b},0.04)`);
    nebGrad.addColorStop(1, 'transparent');
    bgCtx.fillStyle = nebGrad;
    bgCtx.beginPath(); bgCtx.ellipse(nx, ny, ns * 1.2, ns * 0.8, Math.random() * Math.PI, 0, Math.PI * 2); bgCtx.fill();
}

for (let i = 0; i < 200; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = Math.random() * 0.8 + 0.3;
    const b = Math.floor(Math.random() * 60 + 130);
    bgCtx.globalAlpha = Math.random() * 0.4 + 0.2;
    bgCtx.fillStyle = `rgb(${b},${b},${b + 20})`;
    bgCtx.beginPath(); bgCtx.arc(x, y, r, 0, Math.PI * 2); bgCtx.fill();
}

for (let i = 0; i < 60; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = Math.random() * 1.2 + 0.5;
    const colors = ['180,200,255', '255,220,180', '200,180,255', '180,255,220'];
    const c = colors[Math.floor(Math.random() * colors.length)];
    bgCtx.globalAlpha = Math.random() * 0.5 + 0.3;
    bgCtx.fillStyle = `rgb(${c})`;
    bgCtx.beginPath(); bgCtx.arc(x, y, r, 0, Math.PI * 2); bgCtx.fill();

    bgCtx.globalAlpha *= 0.3;
    bgCtx.beginPath(); bgCtx.arc(x, y, r * 3, 0, Math.PI * 2); bgCtx.fill();
}

bgCtx.globalAlpha = 1;
for (let i = 0; i < 12; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = Math.random() * 1.5 + 1;
    const brightness = Math.floor(Math.random() * 55 + 200);

    bgCtx.fillStyle = `rgb(${brightness},${brightness},255)`;
    bgCtx.beginPath(); bgCtx.arc(x, y, r, 0, Math.PI * 2); bgCtx.fill();

    bgCtx.strokeStyle = `rgba(${brightness},${brightness},255,0.4)`;
    bgCtx.lineWidth = 0.5;
    const spikeLen = r * 5;
    bgCtx.beginPath();
    bgCtx.moveTo(x - spikeLen, y); bgCtx.lineTo(x + spikeLen, y);
    bgCtx.moveTo(x, y - spikeLen); bgCtx.lineTo(x, y + spikeLen);
    bgCtx.stroke();

    const haloGrad = bgCtx.createRadialGradient(x, y, 0, x, y, r * 6);
    haloGrad.addColorStop(0, `rgba(${brightness},${brightness},255,0.15)`);
    haloGrad.addColorStop(1, 'transparent');
    bgCtx.fillStyle = haloGrad;
    bgCtx.beginPath(); bgCtx.arc(x, y, r * 6, 0, Math.PI * 2); bgCtx.fill();
}

const planetPalettes = [
    { c1: '#2a4a7a', c2: '#1a2a4a', c3: '#0d1525', atmo: 'rgba(80,140,255,0.08)' },
    { c1: '#7a3a2a', c2: '#4a2215', c3: '#2a1008', atmo: 'rgba(255,120,60,0.06)' },
    { c1: '#3a5a3a', c2: '#1a3a2a', c3: '#0a1a0a', atmo: 'rgba(60,200,120,0.05)' },
    { c1: '#5a3a5a', c2: '#3a1a3a', c3: '#1a0a1a', atmo: 'rgba(180,80,200,0.06)' },
    { c1: '#5a5a3a', c2: '#3a3a1a', c3: '#1a1a0a', atmo: 'rgba(200,200,80,0.05)' },
    { c1: '#3a4a5a', c2: '#1a2a3a', c3: '#0a1520', atmo: 'rgba(100,160,220,0.06)' },
];
const planetCount = 3 + Math.floor(Math.random() * 5);
const planetData = [];
for (let pi = 0; pi < planetCount; pi++) {
    const pal = planetPalettes[Math.floor(Math.random() * planetPalettes.length)];
    const pr = 8 + Math.random() * 50;
    planetData.push({
        x: Math.random() * W, y: Math.random() * H, r: pr,
        c1: pal.c1, c2: pal.c2, c3: pal.c3,
        ring: Math.random() < 0.3,
        ringColor: `rgba(${100 + Math.floor(Math.random() * 120)},${100 + Math.floor(Math.random() * 120)},${100 + Math.floor(Math.random() * 120)},${0.1 + Math.random() * 0.15})`,
        atmo: pal.atmo
    });
}

planetData.sort((a, b) => a.r - b.r);
bgCtx.globalAlpha = 1;
planetData.forEach(p => {

    const atmoGrad = bgCtx.createRadialGradient(p.x, p.y, p.r, p.x, p.y, p.r * 2.5);
    atmoGrad.addColorStop(0, p.atmo);
    atmoGrad.addColorStop(1, 'transparent');
    bgCtx.fillStyle = atmoGrad;
    bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2); bgCtx.fill();

    if (p.ring) {
        bgCtx.save();
        bgCtx.strokeStyle = p.ringColor;
        bgCtx.lineWidth = 3;
        bgCtx.beginPath();
        bgCtx.ellipse(p.x, p.y, p.r * 1.8, p.r * 0.35, 0.15, Math.PI, Math.PI * 2);
        bgCtx.stroke();
        bgCtx.restore();
    }

    const planetGrad = bgCtx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
    planetGrad.addColorStop(0, p.c1);
    planetGrad.addColorStop(0.6, p.c2);
    planetGrad.addColorStop(1, p.c3);
    bgCtx.fillStyle = planetGrad;
    bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bgCtx.fill();

    bgCtx.save();
    bgCtx.globalAlpha = 0.1;
    bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); bgCtx.clip();
    for (let b = -p.r; b < p.r; b += p.r * 0.3) {
        bgCtx.fillStyle = b % 2 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        bgCtx.fillRect(p.x - p.r, p.y + b, p.r * 2, p.r * 0.15);
    }
    bgCtx.restore();

    for (let c = 0; c < 3; c++) {
        const cx = p.x + (Math.random() - 0.5) * p.r * 1.2;
        const cy = p.y + (Math.random() - 0.5) * p.r * 1.2;
        const cr = p.r * 0.08 + Math.random() * p.r * 0.06;
        if (Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2) + cr < p.r) {
            bgCtx.globalAlpha = 0.15;
            bgCtx.fillStyle = '#000';
            bgCtx.beginPath(); bgCtx.arc(cx, cy, cr, 0, Math.PI * 2); bgCtx.fill();
            bgCtx.globalAlpha = 0.1;
            bgCtx.fillStyle = '#fff';
            bgCtx.beginPath(); bgCtx.arc(cx - cr * 0.3, cy - cr * 0.3, cr * 0.4, 0, Math.PI * 2); bgCtx.fill();
        }
    }
    bgCtx.globalAlpha = 1;

    bgCtx.strokeStyle = `rgba(200,220,255,0.08)`;
    bgCtx.lineWidth = 1.5;
    bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r, -0.8, 0.8); bgCtx.stroke();

    if (p.ring) {
        bgCtx.save();
        bgCtx.strokeStyle = p.ringColor;
        bgCtx.lineWidth = 3;
        bgCtx.beginPath();
        bgCtx.ellipse(p.x, p.y, p.r * 1.8, p.r * 0.35, 0.15, 0, Math.PI);
        bgCtx.stroke();
        bgCtx.restore();
    }
});

bgCtx.strokeStyle = 'rgba(60,80,140,0.04)';
bgCtx.lineWidth = 0.5;
for (let y = 0; y < H; y += 40) {
    bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(W, y); bgCtx.stroke();
}
bgCtx.globalAlpha = 1;

class Particle {
    constructor(x, y, c, spd = 1, sz = 3, lt = 30) {
        this.x = x; this.y = y; this.c = c; this.sz = sz; this.lt = lt;
        this.maxLt = lt; this.maxSz = sz;
        this.vx = (Math.random() * 2 - 1) * spd;
        this.vy = (Math.random() * 2 - 1) * spd;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.lt--;
        this.vx *= 0.98; this.vy *= 0.98;
        this.sz = Math.max(0, this.maxSz * (this.lt / this.maxLt));
    }
    draw() {
        if (this.lt <= 0 || this.sz <= 0.2) return;
        const alpha = Math.min(1, this.lt / this.maxLt);
        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.shadowColor = this.c;
        ctx.shadowBlur = this.sz * 3;
        ctx.fillStyle = this.c;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, Math.PI * 2); ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, dx, dy) {
        this.x = x; this.y = y; this.dx = dx; this.dy = dy;
        this.r = 5; this.dmg = bulletDamage;
        this.trail = []; this.c = 'rgb(200,200,255)';
        this.isEnemy = false;
        this.speed = null;
    }
    update() {
        if (this.trail.length > 5) this.trail.shift();
        this.trail.push({ x: this.x, y: this.y });

        let spd = this.speed !== null ? this.speed : bulletSpeed;

        if (this.pulseSpeed) {
            this.timer = (this.timer || 0) + 1;
            spd = 2 + Math.sin(this.timer * 0.05) * 1.5;
        } else if (this.zigzag) {
            this.timer = (this.timer || 0) + 1;
            const perpX = -this.dy;
            const perpY = this.dx;
            const wiggle = Math.cos(this.timer * 0.1) * 3;
            this.x += perpX * wiggle;
            this.y += perpY * wiggle;
            spd = 2.5;
        } else if (this.sniper) {
            spd = 25;
        }

        this.x += this.dx * spd;
        this.y += this.dy * spd;

        if (this.bounces > 0) {
            let bounced = false;
            if (this.x <= 0 || this.x >= W) { this.dx *= -1; bounced = true; this.x = Math.max(0, Math.min(W, this.x)); }
            if (this.y <= 0 || this.y >= H) { this.dy *= -1; bounced = true; this.y = Math.max(0, Math.min(H, this.y)); }
            if (bounced) this.bounces--;
        }

        if (Math.random() < 0.3) particles.push(new Particle(this.x, this.y, this.c, 0.5, 2, 10));
    }
    draw() {
        ctx.save();

        this.trail.forEach((p, i) => {
            if (this.trail.length > 1) {
                const t = i / this.trail.length;
                const s = this.r * t * 0.8;
                if (s > 0.3) {
                    ctx.globalAlpha = t * 0.6;
                    ctx.shadowColor = this.c;
                    ctx.shadowBlur = s * 2;
                    ctx.fillStyle = this.c;
                    ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
                }
            }
        });
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.globalAlpha = 0.25;
        ctx.shadowColor = this.c;
        ctx.shadowBlur = 15;
        ctx.fillStyle = this.c;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = 1;
        if (!this.isEnemy) {

            const angle = Math.atan2(this.dy, this.dx);
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            ctx.fillStyle = '#88bbff';
            ctx.shadowColor = '#4488ff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(this.r * 1.5, 0);
            ctx.lineTo(0, -this.r * 0.6);
            ctx.lineTo(-this.r, 0);
            ctx.lineTo(0, this.r * 0.6);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ddeeff';
            ctx.beginPath();
            ctx.moveTo(this.r * 0.8, 0);
            ctx.lineTo(0, -this.r * 0.25);
            ctx.lineTo(-this.r * 0.3, 0);
            ctx.lineTo(0, this.r * 0.25);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else {

            ctx.shadowColor = this.c;
            ctx.shadowBlur = 8;
            ctx.fillStyle = this.c;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2); ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.35, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

class Enemy {
    constructor(type, isMinion = false) {
        this.type = type;
        this.isMinion = isMinion;
        this.w = type == 'boss' ? 100 : (type == 'elite' ? 45 : (type == 'large' ? 50 : (type == 'medium' ? 40 : 30)));
        this.h = this.w;

        if (isMinion) {
            this.w = 25;
            this.h = 25;
        }

        const side = ['top', 'bottom', 'left', 'right'][Math.floor(Math.random() * 4)];
        if (side == 'top') { this.x = Math.random() * (W - this.w); this.y = -this.h }
        else if (side == 'bottom') { this.x = Math.random() * (W - this.w); this.y = H }
        else if (side == 'left') { this.x = -this.w; this.y = Math.random() * (H - this.h) }
        else { this.x = W; this.y = Math.random() * (H - this.h) }

        const waveScale = 1 + (wave - 1) * 0.15;
        const baseHp = { small: 40, medium: 80, large: 120, elite: 200, boss: 500 };
        const baseDmg = { small: 10, medium: 20, large: 30, elite: 35, boss: 25 };
        const baseScore = { small: 10, medium: 20, large: 30, elite: 50, boss: 200 };
        const moneyRanges = {
            small: { min: 5, max: 25 },
            medium: { min: 15, max: 35 },
            large: { min: 25, max: 45 },
            elite: { min: 40, max: 60 },
            boss: { min: 100, max: 150 }
        };

        this.hp = Math.floor((baseHp[type] || 40) * waveScale * (isMinion ? 1.0 : 1));
        this.maxHp = this.hp;
        this.contactDamage = Math.floor((baseDmg[type] || 10) * waveScale * (isMinion ? 0.5 : 1));
        this.scoreValue = Math.floor((baseScore[type] || 10) * (1 + wave * 0.08));

        const range = moneyRanges[this.type] || { min: 10, max: 30 };
        const baseMoney = range.min + Math.random() * (range.max - range.min);
        this.money = Math.floor(baseMoney * (1 + wave * 0.15) * (isMinion ? 0.3 : 2.5));

        this.spd = type == 'boss' ? 0.75 : (type == 'elite' ? 1.3 : (type == 'large' ? 1.2 : (type == 'medium' ? 1.4 : 1.5)));
        if (isMinion) this.spd *= 1.3;

        this.canDrop = Math.random() < 0.35 && !isMinion;
        this.flash = 0; this.anim = 0; this.pulse = 0; this.pdir = 1;

        this.aiTimer = 0;
        this.aiState = 'chase';
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.zigzagDir = Math.random() < 0.5 ? 1 : -1;
        this.dashCooldown = 0;
        this.lastShot = 0;
        this.teleportCooldown = 0;
    }

    update() {
        const dx = playerX - this.x, dy = playerY - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const dirX = d > 0 ? dx / d : 0;
        const dirY = d > 0 ? dy / d : 0;

        this.aiTimer++;

        if (this.isMinion) {
            this.updateMinionAI(dirX, dirY, d);
        } else {
            switch (this.type) {
                case 'small': this.updateSmallAI(dirX, dirY, d); break;
                case 'medium': this.updateMediumAI(dirX, dirY, d); break;
                case 'large': this.updateLargeAI(dirX, dirY, d); break;
                case 'elite': this.updateEliteAI(dirX, dirY, d); break;
                default: this.x += dirX * this.spd; this.y += dirY * this.spd;
            }
        }

        this.x = Math.max(-this.w, Math.min(W, this.x));
        this.y = Math.max(-this.h, Math.min(H, this.y));

        this.anim += 0.1;
        this.pulse += 0.1 * this.pdir;
        if (this.pulse > 4) this.pdir = -1; else if (this.pulse < 0) this.pdir = 1;
        if (this.flash > 0) this.flash -= 0.1;

        if (this.canDrop && Math.random() < 0.05) {
            particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#ff0', 0.5, 2, 20));
        }
    }

    updateMinionAI(dirX, dirY, d) {
        const wobble = Math.sin(this.aiTimer * 0.2) * 0.5;
        this.x += (dirX + wobble * dirY) * this.spd * 1.2;
        this.y += (dirY - wobble * dirX) * this.spd * 1.2;
    }

    updateSmallAI(dirX, dirY, d) {
        const zigzag = Math.sin(this.aiTimer * 0.15) * 2 * this.zigzagDir;
        const perpX = -dirY, perpY = dirX;
        this.x += (dirX * this.spd) + (perpX * zigzag * 0.3);
        this.y += (dirY * this.spd) + (perpY * zigzag * 0.3);

        if (this.aiTimer % 180 === 0) this.zigzagDir *= -1;
    }

    updateMediumAI(dirX, dirY, d) {
        const idealDist = 120 + Math.sin(this.aiTimer * 0.02) * 30;

        if (d < idealDist - 20) {
            this.x -= dirX * this.spd * 0.8;
            this.y -= dirY * this.spd * 0.8;
        } else if (d > idealDist + 30) {
            this.x += dirX * this.spd;
            this.y += dirY * this.spd;
        } else {
            this.orbitAngle += 0.03;
            const perpX = Math.cos(this.orbitAngle);
            const perpY = Math.sin(this.orbitAngle);
            this.x += perpX * this.spd * 0.8;
            this.y += perpY * this.spd * 0.8;
        }

        if (Date.now() - this.lastShot > 2500 && d < 250 && d > 60) {
            this.lastShot = Date.now();
            const b = new Bullet(this.x + this.w / 2, this.y + this.h / 2, dirX, dirY);
            b.c = '#fa0';
            b.dmg = Math.floor(8 * (1 + wave * 0.05));
            b.isEnemy = true;
            b.speed = 3;
            bullets.push(b);
        }
    }

    updateLargeAI(dirX, dirY, d) {
        if (this.dashCooldown > 0) this.dashCooldown--;

        if (this.aiState === 'chase') {
            this.x += dirX * this.spd * 0.6;
            this.y += dirY * this.spd * 0.6;

            if (d < 180 && d > 80 && this.dashCooldown <= 0 && Math.random() < 0.02) {
                this.aiState = 'dash';
                this.dashDir = { x: dirX, y: dirY };
                this.dashTimer = 20;
            }
        } else if (this.aiState === 'dash') {
            this.x += this.dashDir.x * this.spd * 4;
            this.y += this.dashDir.y * this.spd * 4;
            this.dashTimer--;

            if (Math.random() < 0.3) {
                particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, '#f0f', 1, 4, 15));
            }

            if (this.dashTimer <= 0) {
                this.aiState = 'chase';
                this.dashCooldown = 120;
            }
        }
    }

    updateEliteAI(dirX, dirY, d) {
        if (this.teleportCooldown > 0) this.teleportCooldown--;

        const hpRatio = this.hp / this.maxHp;
        if (hpRatio < 0.4 && this.teleportCooldown <= 0 && Math.random() < 0.03) {
            for (let i = 0; i < 15; i++) {
                particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, '#ffd700', 2, 4, 20));
            }
            this.x = Math.random() * (W - this.w);
            this.y = Math.random() * (H / 2);
            this.teleportCooldown = 180;
            for (let i = 0; i < 15; i++) {
                particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, '#ffd700', 2, 4, 20));
            }
        }

        this.orbitAngle += 0.025;
        const idealDist = 150;
        if (d > idealDist + 50) {
            this.x += dirX * this.spd * 1.2;
            this.y += dirY * this.spd * 1.2;
        } else if (d < idealDist - 30) {
            this.x -= dirX * this.spd;
            this.y -= dirY * this.spd;
        } else {
            const perpX = -dirY, perpY = dirX;
            this.x += perpX * this.spd;
            this.y += perpY * this.spd;
        }

        if (Date.now() - this.lastShot > 1800 && d < 300) {
            this.lastShot = Date.now();
            const angles = [-0.25, 0, 0.25];
            const baseAngle = Math.atan2(dirY, dirX);
            angles.forEach(offset => {
                const b = new Bullet(
                    this.x + this.w / 2,
                    this.y + this.h / 2,
                    Math.cos(baseAngle + offset),
                    Math.sin(baseAngle + offset)
                );
                b.c = '#ffd700';
                b.dmg = Math.floor(12 * (1 + wave * 0.05));
                b.isEnemy = true;
                b.speed = 3.5;
                bullets.push(b);
            });
            screenShake = 3;
        }
    }

    draw() {
        ctx.save();
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const t = Date.now();

        const dx = playerX - cx, dy = playerY - cy;
        const faceAngle = Math.atan2(dy, dx);

        if (this.isMinion) {

            ctx.translate(cx, cy); ctx.rotate(this.anim * 0.35); ctx.translate(-cx, -cy);
            const r = this.w / 2;

            ctx.globalAlpha = 0.12;
            ctx.fillStyle = '#aa55ff';
            ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;

            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                const bx1 = cx + Math.cos(a) * 2, by1 = cy + Math.sin(a) * 2;
                const bx2 = cx + Math.cos(a) * r, by2 = cy + Math.sin(a) * r;
                ctx.strokeStyle = `rgba(187,102,238,${0.6 + Math.sin(this.anim * 0.4 + i) * 0.3})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(bx1, by1); ctx.lineTo(bx2, by2); ctx.stroke();

                ctx.fillStyle = '#dd88ff';
                ctx.beginPath(); ctx.arc(bx2, by2, 1.5, 0, Math.PI * 2); ctx.fill();
            }

            const mGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.4);
            mGrad.addColorStop(0, '#ffccff');
            mGrad.addColorStop(0.5, '#aa44dd');
            mGrad.addColorStop(1, '#550088');
            ctx.fillStyle = mGrad;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(200,120,255,0.4)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(faceAngle); ctx.translate(-cx, -cy);
            ctx.fillStyle = '#ff44ff'; ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(cx + r * 0.15, cy, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            ctx.strokeStyle = `rgba(200,100,255,${0.2 + Math.sin(this.anim * 0.5) * 0.15})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke();

        } else if (this.type === 'small') {

            ctx.translate(cx, cy); ctx.rotate(faceAngle + Math.PI / 2); ctx.translate(-cx, -cy);
            const hw = this.w / 2, hh = this.h / 2;

            ctx.globalAlpha = 0.08;
            ctx.fillStyle = '#ff3322';
            ctx.beginPath();
            ctx.moveTo(cx, cy - hh * 0.7);
            ctx.lineTo(cx - hw * 0.5, cy + hh * 1.5);
            ctx.lineTo(cx + hw * 0.5, cy + hh * 1.5);
            ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1;

            const abdGrad = ctx.createRadialGradient(cx, cy + hh * 0.15, 0, cx, cy + hh * 0.15, hh * 0.35);
            abdGrad.addColorStop(0, '#ff6655');
            abdGrad.addColorStop(1, '#881100');
            ctx.fillStyle = abdGrad;
            ctx.beginPath(); ctx.ellipse(cx, cy + hh * 0.15, hw * 0.3, hh * 0.3, 0, 0, Math.PI * 2); ctx.fill();

            const thxGrad = ctx.createRadialGradient(cx, cy - hh * 0.1, 0, cx, cy - hh * 0.1, hw * 0.25);
            thxGrad.addColorStop(0, '#ff8877');
            thxGrad.addColorStop(1, '#992200');
            ctx.fillStyle = thxGrad;
            ctx.beginPath(); ctx.ellipse(cx, cy - hh * 0.1, hw * 0.25, hh * 0.2, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#cc3322';
            ctx.beginPath(); ctx.ellipse(cx, cy - hh * 0.4, hw * 0.2, hh * 0.15, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'rgba(255,100,80,0.18)';
            ctx.strokeStyle = 'rgba(255,120,100,0.3)'; ctx.lineWidth = 0.5;

            for (const s of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(cx + s * hw * 0.15, cy - hh * 0.2);
                ctx.quadraticCurveTo(cx + s * hw * 0.9, cy - hh * 0.4, cx + s * hw * 0.7, cy + hh * 0.1);
                ctx.lineTo(cx + s * hw * 0.15, cy); ctx.closePath();
                ctx.fill(); ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(cx + s * hw * 0.12, cy + hh * 0.05);
                ctx.quadraticCurveTo(cx + s * hw * 0.6, cy, cx + s * hw * 0.45, cy + hh * 0.25);
                ctx.lineTo(cx + s * hw * 0.12, cy + hh * 0.2); ctx.closePath();
                ctx.fill(); ctx.stroke();
            }

            ctx.strokeStyle = '#dd4433'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(cx - hw * 0.08, cy - hh * 0.5);
            ctx.quadraticCurveTo(cx - hw * 0.15, cy - hh * 0.7, cx - hw * 0.05, cy - hh * 0.72); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + hw * 0.08, cy - hh * 0.5);
            ctx.quadraticCurveTo(cx + hw * 0.15, cy - hh * 0.7, cx + hw * 0.05, cy - hh * 0.72); ctx.stroke();

            ctx.fillStyle = '#ffaa88'; ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 3;
            ctx.beginPath(); ctx.arc(cx - hw * 0.1, cy - hh * 0.42, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + hw * 0.1, cy - hh * 0.42, 2, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#aa2200';
            ctx.beginPath();
            ctx.moveTo(cx - 2, cy + hh * 0.4);
            ctx.lineTo(cx, cy + hh * 0.65);
            ctx.lineTo(cx + 2, cy + hh * 0.4);
            ctx.closePath(); ctx.fill();

            ctx.strokeStyle = 'rgba(255,150,130,0.12)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(cx - hw * 0.15, cy - hh * 0.25); ctx.lineTo(cx + hw * 0.15, cy - hh * 0.25); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx - hw * 0.2, cy + hh * 0.02); ctx.lineTo(cx + hw * 0.2, cy + hh * 0.02); ctx.stroke();

        } else if (this.type === 'medium') {

            const r = this.w / 2;

            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath(); ctx.arc(cx + 2, cy + 2, r * 0.85, 0, Math.PI * 2); ctx.fill();

            const armorGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
            armorGrad.addColorStop(0, '#cc8833');
            armorGrad.addColorStop(1, '#553300');
            ctx.fillStyle = armorGrad;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = 'rgba(255,200,100,0.15)'; ctx.lineWidth = 0.5;
            for (let i = 0; i < 6; i++) {
                const pa = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(pa) * r * 0.4, cy + Math.sin(pa) * r * 0.4);
                ctx.lineTo(cx + Math.cos(pa) * r * 0.85, cy + Math.sin(pa) * r * 0.85);
                ctx.stroke();
            }

            const hullGrad = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, 0, cx, cy, r * 0.55);
            hullGrad.addColorStop(0, '#ffdd88');
            hullGrad.addColorStop(0.5, '#cc9944');
            hullGrad.addColorStop(1, '#775522');
            ctx.fillStyle = hullGrad;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,220,130,0.3)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(faceAngle); ctx.translate(-cx, -cy);

            ctx.fillStyle = '#886622';
            ctx.fillRect(cx + r * 0.2, cy - 2.5, r * 0.8, 5);
            ctx.strokeStyle = 'rgba(200,160,80,0.3)'; ctx.lineWidth = 0.5;
            ctx.strokeRect(cx + r * 0.2, cy - 2.5, r * 0.8, 5);

            ctx.fillStyle = '#aa8833';
            ctx.fillRect(cx + r * 0.9, cy - 4, 4, 8);

            const muzzlePulse = 0.5 + Math.sin(t * 0.01) * 0.3;
            ctx.fillStyle = `rgba(255,180,60,${muzzlePulse * 0.6})`;
            ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(cx + r + 2, cy, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

            const exhaustAngle = faceAngle + Math.PI;
            for (let ei = -1; ei <= 1; ei++) {
                const ea = exhaustAngle + ei * 0.3;
                const ex = cx + Math.cos(ea) * r * 0.7;
                const ey = cy + Math.sin(ea) * r * 0.7;
                ctx.fillStyle = '#ff8844'; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 3;
                ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255,180,60,0.2)'; ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#ffee99';
            ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

        } else if (this.type === 'large') {

            const isDashing = this.aiState === 'dash';

            const fAngle = isDashing && this.dashDir ?
                Math.atan2(this.dashDir.y, this.dashDir.x) + Math.PI / 2 :
                faceAngle + Math.PI / 2;
            ctx.translate(cx, cy); ctx.rotate(fAngle); ctx.translate(-cx, -cy);
            const hw = this.w / 2, hh = this.h / 2;

            if (isDashing) {
                const shockR = hw + 12 + Math.sin(t * 0.02) * 4;
                ctx.globalAlpha = 0.25;
                ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 2;
                ctx.shadowColor = '#ff22ff'; ctx.shadowBlur = 15;
                ctx.beginPath(); ctx.arc(cx, cy, shockR, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;

                if (Math.random() < 0.5) {
                    particles.push(new Particle(cx + (Math.random() - 0.5) * hw, cy - hh * 0.8, '#ff88ff', 1, 2, 10));
                }
            }

            const cGrad = ctx.createLinearGradient(cx, cy - hh, cx, cy + hh);
            cGrad.addColorStop(0, isDashing ? '#ff88ff' : '#dd55dd');
            cGrad.addColorStop(0.3, '#aa22aa');
            cGrad.addColorStop(0.7, '#771177');
            cGrad.addColorStop(1, '#440044');
            ctx.fillStyle = cGrad;

            ctx.beginPath();
            ctx.moveTo(cx, cy - hh * 0.85);
            ctx.quadraticCurveTo(cx + hw * 0.5, cy - hh * 0.7, cx + hw * 0.85, cy - hh * 0.15);
            ctx.quadraticCurveTo(cx + hw * 0.9, cy + hh * 0.3, cx + hw * 0.6, cy + hh * 0.7);
            ctx.lineTo(cx - hw * 0.6, cy + hh * 0.7);
            ctx.quadraticCurveTo(cx - hw * 0.9, cy + hh * 0.3, cx - hw * 0.85, cy - hh * 0.15);
            ctx.quadraticCurveTo(cx - hw * 0.5, cy - hh * 0.7, cx, cy - hh * 0.85);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,150,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();

            ctx.strokeStyle = 'rgba(255,200,255,0.12)'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(cx, cy - hh * 0.7);
            ctx.quadraticCurveTo(cx + hw * 0.15, cy, cx, cy + hh * 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx, cy - hh * 0.7);
            ctx.quadraticCurveTo(cx - hw * 0.15, cy, cx, cy + hh * 0.5);
            ctx.stroke();

            ctx.strokeStyle = '#993399'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            for (const s of [-1, 1]) {
                const legSway = Math.sin(this.anim * 0.2 + s) * 3;

                ctx.beginPath();
                ctx.moveTo(cx + s * hw * 0.5, cy - hh * 0.2);
                ctx.quadraticCurveTo(cx + s * hw * 1.0, cy - hh * 0.1 + legSway, cx + s * hw * 0.9, cy + hh * 0.05 + legSway);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(cx + s * hw * 0.45, cy + hh * 0.2);
                ctx.quadraticCurveTo(cx + s * hw * 0.95, cy + hh * 0.3 - legSway, cx + s * hw * 0.85, cy + hh * 0.5 - legSway);
                ctx.stroke();
            }
            ctx.lineCap = 'butt';

            ctx.fillStyle = isDashing ? '#ffaaff' : '#cc66cc';
            ctx.beginPath();
            ctx.moveTo(cx - hw * 0.15, cy - hh * 0.7);
            ctx.quadraticCurveTo(cx - hw * 0.25, cy - hh * 1.0, cx - hw * 0.05, cy - hh * 0.95);
            ctx.lineTo(cx, cy - hh * 0.8); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + hw * 0.15, cy - hh * 0.7);
            ctx.quadraticCurveTo(cx + hw * 0.25, cy - hh * 1.0, cx + hw * 0.05, cy - hh * 0.95);
            ctx.lineTo(cx, cy - hh * 0.8); ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#ffbbee'; ctx.shadowColor = '#ff44cc'; ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.arc(cx - hw * 0.18, cy - hh * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + hw * 0.18, cy - hh * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#220022';
            ctx.beginPath(); ctx.arc(cx - hw * 0.18, cy - hh * 0.55, 1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + hw * 0.18, cy - hh * 0.55, 1, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#ff66ff'; ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.ellipse(cx, cy + hh * 0.65, hw * 0.2, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

        } else {

            const r = this.w / 2;

            const distort = Math.sin(this.anim * 0.25) * 0.3 + 0.2;
            ctx.globalAlpha = distort * 0.5;
            ctx.strokeStyle = '#ffee44'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(cx, cy, r + 10 + Math.sin(this.anim * 0.15) * 5, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, r + 14 + Math.cos(this.anim * 0.12) * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(this.anim * 0.04); ctx.translate(-cx, -cy);
            ctx.strokeStyle = '#bbaa44'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const px = cx + Math.cos(a) * (r + 3), py = cy + Math.sin(a) * (r + 3);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(-this.anim * 0.06); ctx.translate(-cx, -cy);
            ctx.strokeStyle = '#ddcc55'; ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
                const px = cx + Math.cos(a) * r * 0.65, py = cy + Math.sin(a) * r * 0.65;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
            ctx.restore();

            const eGrad = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, 0, cx, cy, r * 0.55);
            eGrad.addColorStop(0, '#ffeecc');
            eGrad.addColorStop(0.3, '#ddaa44');
            eGrad.addColorStop(0.7, '#886611');
            eGrad.addColorStop(1, '#443300');
            ctx.fillStyle = eGrad;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,220,80,0.35)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(faceAngle); ctx.translate(-cx, -cy);

            const iGrad = ctx.createRadialGradient(cx + r * 0.05, cy, 0, cx, cy, r * 0.3);
            iGrad.addColorStop(0, '#ff2200');
            iGrad.addColorStop(0.6, '#cc0000');
            iGrad.addColorStop(1, '#440000');
            ctx.fillStyle = iGrad;
            ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.ellipse(cx + r * 0.03, cy, r * 0.05, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'rgba(255,255,220,0.6)';
            ctx.beginPath(); ctx.ellipse(cx - r * 0.08, cy - r * 0.06, 1.5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            const baseA = faceAngle;
            const stoneAngles = [-0.25, 0, 0.25];
            stoneAngles.forEach((off, si) => {
                const sa = baseA + off + Math.sin(this.anim * 0.08 + si * 2) * 0.1;
                const sr = r * 0.8 + Math.sin(this.anim * 0.1 + si * 1.5) * 2;
                const sx = cx + Math.cos(sa) * sr;
                const sy = cy + Math.sin(sa) * sr;
                ctx.fillStyle = '#ff6622'; ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 4;
                ctx.save();
                ctx.translate(sx, sy); ctx.rotate(this.anim * 0.15 + si);
                ctx.beginPath();
                ctx.moveTo(0, -3); ctx.lineTo(3, 0); ctx.lineTo(0, 3); ctx.lineTo(-3, 0);
                ctx.closePath(); ctx.fill();
                ctx.restore();
            });
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255,180,50,0.12)'; ctx.lineWidth = 0.5;
            stoneAngles.forEach((off, si) => {
                const sa = baseA + off;
                const sx = cx + Math.cos(sa) * r * 0.8;
                const sy = cy + Math.sin(sa) * r * 0.8;
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();
            });
        }

        if (this.flash > 0) {
            ctx.globalAlpha = this.flash * 0.6;
            ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(cx, cy, this.w / 2 + 5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
        ctx.restore();

        if (this.canDrop) {
            ctx.save();
            ctx.globalAlpha = 0.25 + Math.sin(this.pulse * 3) * 0.15;
            ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 15;
            ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, this.w / 2 + 6 + this.pulse, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        const bw = this.w + 4, bx = this.x - 2, by = this.y - 12;
        const hp = this.hp / this.maxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 4, 2); ctx.fill();
        const hpColor = this.isMinion ? '#9933ff' : (hp > 0.5 ? '#44dd44' : (hp > 0.25 ? '#ddaa22' : '#dd3333'));
        ctx.fillStyle = hpColor;
        if (hp > 0) { ctx.beginPath(); ctx.roundRect(bx, by, hp * bw, 4, 2); ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, 4, 2); ctx.stroke();
    }

    hit(dmg, hitX, hitY) {
        this.hp -= dmg; this.flash = 1;

        const px = hitX !== undefined ? hitX : (this.x + Math.random() * this.w);
        const py = hitY !== undefined ? hitY : (this.y + Math.random() * this.h);

        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(
                px + (Math.random() - 0.5) * 10,
                py + (Math.random() - 0.5) * 10,
                '#fff', 2, 5, 30
            ));
        }
    }

    drop() {
        const luckBonus = window.dropChanceBonus || 0;
        const effectiveCanDrop = this.canDrop || Math.random() < luckBonus;

        if (effectiveCanDrop) {
            const greedMultiplier = 1 + (window.moneyBonus || 0);
            const finalMoney = Math.floor(this.money * greedMultiplier);
            playerMoney += finalMoney;

            if (typeof onMoneyEarned === 'function') onMoneyEarned(finalMoney);

            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#ff0', 1, 3, 30));
        }
    }
}

window.addEventListener('load', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainMenu = document.getElementById('mainMenu');

        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainMenu) mainMenu.classList.remove('hidden');

        if (typeof drawMainMenuEffects === 'function') {
            drawMainMenuEffects();
        }
    }, 1000);
});
