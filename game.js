// === SPACE SHOOTER - Game Variables ===
// Phiên bản web tương đương với Pygame original

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 800, H = 600;

// === TRẠNG THÁI GAME ===
let gameRunning = false;
let score = 0, wave = 0, playerHealth = 100, maxHealth = 100;
let playerMoney = 0, energy = 100, energyRegen = 10;
let invincible = false, invTime = 0, screenShake = 0;
let doubleShot = false, tripleShot = false;
let isResting = false, restStart = 0, bossSpawned = false;
let isShop = false, selectedItems = [], itemsToSell = [];
let skillUpBoughtThisShop = false; // Giới hạn mua Skill Up 1 lần/shop
let bossKills = 0, keys = {};
let neededSpawn = false;
let tutorialCircle = null;
let tutorialProgress = 0;

// === COMBO SYSTEM - Tính điểm và multiplier ===
let comboKills = 0;
let comboTimer = 0;
let maxCombo = 0;
let comboMultiplier = 1;

// === CRITICAL HITS ===
const CRIT_CHANCE = 0.15;
const CRIT_MULTIPLIER = 2;

// === POWER-UPS ===
let powerUps = [];
let activeBuffs = {};
const POWER_UP_TYPES = {
    'speed': { color: '#00ff00', duration: 5000, desc: 'SPEED BOOST' },
    'rapid': { color: '#ffff00', duration: 4000, desc: 'RAPID FIRE' },
    'damage': { color: '#ff6600', duration: 5000, desc: 'DAMAGE UP' },
    'magnet': { color: '#ff00ff', duration: 6000, desc: 'MONEY MAGNET' }
};

// === WAVE BONUS ===
let waveStartTime = 0;
let waveBonusEarned = 0;

// === PLAYER ===
const PW = 50, PH = 50;
let playerX = 375, playerY = 275, playerSpeed = 2.5;
let dirX = 0, dirY = 0, isSliding = false, lastSlide = 0;

// === ĐẠN ===
let bullets = [], bulletSpeed = 5, bulletCooldown = 500;
let bulletDamage = 20, canShoot = true, lastShot = 0;

// === ENEMY VÀ PARTICLES ===
let enemies = [], particles = [];
let bombProjectiles = [];

// === SKILL BOMB ===
const skill = { level: 1, maxLvl: 5, cooldown: 6000, lastUse: 0, radius: 100, damage: 100, cost: 20 };

// === SHIELD ===
let shieldCooldown = 0;
const SHIELD_COOLDOWN_BASE = 10000;

// === SHOP ITEMS - Expanded ===
const shopItems = {
    // Healing & Survival
    "Health Upgrade": { price: 50, max: -1, b: 0, desc: "Heal 25 HP instantly", descVI: "Hồi 25 HP ngay" },
    "Max Health": { price: 100, max: 5, b: 0, desc: "+25 Max HP", descVI: "+25 HP tối đa" },
    "Shield": { price: 60, max: 5, b: 0, desc: "Auto shield +duration -CD", descVI: "Khiên tự động +thời gian -CD" },
    "Regen": { price: 120, max: 3, b: 0, desc: "+0.5 HP/sec regen", descVI: "+0.5 HP/giây" },

    // Energy & Movement
    "Energy Upgrade": { price: 30, max: 5, b: 0, desc: "+5 energy regen", descVI: "+5 hồi năng lượng" },
    "Speed Boost": { price: 80, max: 3, b: 0, desc: "+0.3 move speed", descVI: "+0.3 tốc độ di chuyển" },
    "Dash Cooldown": { price: 100, max: 2, b: 0, desc: "-0.5s dash cooldown", descVI: "-0.5s CD dash" },

    // Weapons
    "Bullet Speed": { price: 20, max: 3, b: 0, desc: "+2 bullet speed", descVI: "+2 tốc độ đạn" },
    "Bullet Damage": { price: 90, max: 3, b: 0, desc: "+10 bullet damage", descVI: "+10 sát thương đạn" },
    "Fire Rate": { price: 70, max: 3, b: 0, desc: "-100ms fire delay", descVI: "-100ms thời gian bắn" },
    "Double Shot": { price: 80, max: 1, b: 0, desc: "Fire 2 bullets", descVI: "Bắn 2 viên đạn" },
    "Triple Shot": { price: 150, max: 1, b: 0, desc: "Fire 3 bullets fan", descVI: "Bắn 3 viên hình quạt" },
    "Piercing": { price: 200, max: 1, b: 0, desc: "Bullets pierce enemies", descVI: "Đạn xuyên địch" },

    // Skill
    "Skill Up": { price: 50, max: 4, b: 0, desc: "Upgrade bomb skill", descVI: "Nâng cấp skill bomb" },

    // Luck & Money
    "Luck": { price: 60, max: 3, b: 0, desc: "+15% drop chance", descVI: "+15% tỉ lệ rơi đồ" },
    "Magnet": { price: 80, max: 2, b: 0, desc: "+50 pickup range", descVI: "+50 tầm nhặt đồ" },
    "Greed": { price: 100, max: 3, b: 0, desc: "+20% money drops", descVI: "+20% tiền rơi" }
};

// Shop refresh system
let shopRefreshCount = 0;
let shopRefreshPrice = 20;

// === STATIC BACKGROUND - Tạo 1 lần duy nhất ===
const bgCanvas = document.createElement('canvas');
bgCanvas.width = W; bgCanvas.height = H;
const bgCtx = bgCanvas.getContext('2d');
bgCtx.fillStyle = 'rgb(5,5,30)';
bgCtx.fillRect(0, 0, W, H);

// Vẽ sao
for (let i = 0; i < 100; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = Math.random() * 2 + 1, b = Math.floor(Math.random() * 105 + 150);
    bgCtx.fillStyle = `rgb(${b},${b},${b})`;
    bgCtx.beginPath(); bgCtx.arc(x, y, r, 0, Math.PI * 2); bgCtx.fill();
}

// Vẽ tinh vân
for (let n = 0; n < 5; n++) {
    const nx = Math.random() * W, ny = Math.random() * H, ns = Math.random() * 100 + 50;
    const nc = { r: Math.floor(Math.random() * 50 + 20), g: Math.floor(Math.random() * 50 + 20), b: Math.floor(Math.random() * 60 + 60) };
    for (let i = 0; i < 30; i++) {
        const s = ns - i * 2; if (s <= 0) break;
        const a = Math.max(0, 200 - i * 6);
        bgCtx.globalAlpha = a / 255;
        bgCtx.fillStyle = `rgb(${nc.r},${nc.g},${nc.b})`;
        bgCtx.beginPath(); bgCtx.ellipse(nx, ny, s / 2, s / 2, 0, 0, Math.PI * 2); bgCtx.fill();
    }
}
bgCtx.globalAlpha = 1;

// === CLASSES ===

// Particle - Hiệu ứng hạt
class Particle {
    constructor(x, y, c, spd = 1, sz = 3, lt = 30) {
        this.x = x; this.y = y; this.c = c; this.sz = sz; this.lt = lt;
        this.vx = (Math.random() * 2 - 1) * spd;
        this.vy = (Math.random() * 2 - 1) * spd;
    }
    update() { this.x += this.vx; this.y += this.vy; this.lt--; this.sz = Math.max(0, this.sz - 0.1) }
    draw() {
        if (this.lt > 0 && this.sz > 0) {
            ctx.fillStyle = this.c;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// Bullet - Đạn
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
        const spd = this.speed !== null ? this.speed : bulletSpeed;
        this.x += this.dx * spd; this.y += this.dy * spd;
        if (Math.random() < 0.3) particles.push(new Particle(this.x, this.y, this.c, 0.5, 2, 10));
    }
    draw() {
        this.trail.forEach((p, i) => {
            if (this.trail.length > 1) {
                const a = i / this.trail.length, s = (this.r * i / this.trail.length);
                if (s > 0) {
                    ctx.globalAlpha = a; ctx.fillStyle = this.c;
                    ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
                }
            }
        });
        ctx.globalAlpha = 0.4; ctx.fillStyle = this.c;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.c;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    }
}

// Enemy - Kẻ địch
class Enemy {
    constructor(type) {
        this.type = type;
        this.w = type == 'boss' ? 100 : (type == 'elite' ? 45 : (type == 'large' ? 50 : (type == 'medium' ? 40 : 30)));
        this.h = this.w;

        // Spawn ngẫu nhiên từ các cạnh màn hình
        const side = ['top', 'bottom', 'left', 'right'][Math.floor(Math.random() * 4)];
        if (side == 'top') { this.x = Math.random() * (W - this.w); this.y = -this.h }
        else if (side == 'bottom') { this.x = Math.random() * (W - this.w); this.y = H }
        else if (side == 'left') { this.x = -this.w; this.y = Math.random() * (H - this.h) }
        else { this.x = W; this.y = Math.random() * (H - this.h) }

        this.hp = type == 'boss' ? 500 : (type == 'elite' ? 200 : (type == 'large' ? 120 : (type == 'medium' ? 80 : 40)));
        this.maxHp = this.hp;
        this.spd = type == 'boss' ? 0.75 : (type == 'elite' ? 1.3 : (type == 'large' ? 1.2 : (type == 'medium' ? 1.4 : 1.5)));
        // Tiền theo loại enemy với range ngẫu nhiên (~20 đơn vị dao động)
        const moneyRanges = {
            small: { min: 5, max: 25 },
            medium: { min: 15, max: 35 },
            large: { min: 25, max: 45 },
            elite: { min: 40, max: 60 },
            boss: { min: 100, max: 150 }
        };
        const range = moneyRanges[this.type] || { min: 10, max: 30 };
        this.money = Math.floor(range.min + Math.random() * (range.max - range.min));
        this.canDrop = Math.random() < 0.7;
        this.flash = 0; this.anim = 0; this.pulse = 0; this.pdir = 1;
    }

    update() {
        const dx = playerX - this.x, dy = playerY - this.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0) { this.x += dx / d * this.spd; this.y += dy / d * this.spd }
        this.anim += 0.1;
        this.pulse += 0.1 * this.pdir;
        if (this.pulse > 4) this.pdir = -1; else if (this.pulse < 0) this.pdir = 1;
        if (this.flash > 0) this.flash -= 0.1;

        // Particles cho enemy có tiền
        if (this.canDrop && Math.random() < 0.05) {
            particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#ff0', 0.5, 2, 20));
        }
    }

    draw() {
        ctx.save();
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const col = this.type == 'boss' || this.type == 'small' ? '#f00' : (this.type == 'elite' ? '#ffd700' : (this.type == 'large' ? '#f0f' : '#fa0'));

        // Xoay medium, large, elite
        if (this.type == 'medium' || this.type == 'large' || this.type == 'elite') {
            ctx.translate(cx, cy); ctx.rotate(this.anim * 20 * Math.PI / 180); ctx.translate(-cx, -cy);
        }

        // Vẽ hình dạng
        ctx.fillStyle = col; ctx.beginPath();
        if (this.type == 'small') {
            ctx.moveTo(this.x, this.y + this.h); ctx.lineTo(this.x + this.w / 2, this.y); ctx.lineTo(this.x + this.w, this.y + this.h);
        } else if (this.type == 'medium') {
            ctx.moveTo(this.x + this.w / 2, this.y); ctx.lineTo(this.x + this.w, this.y + this.h / 2);
            ctx.lineTo(this.x + this.w / 2, this.y + this.h); ctx.lineTo(this.x, this.y + this.h / 2);
        } else if (this.type == 'large') {
            ctx.moveTo(this.x + this.w / 2, this.y); ctx.lineTo(this.x + this.w, this.y + this.h / 3);
            ctx.lineTo(this.x + this.w * 0.8, this.y + this.h); ctx.lineTo(this.x + this.w * 0.2, this.y + this.h);
            ctx.lineTo(this.x, this.y + this.h / 3);
        } else {
            for (let i = 0; i < 6; i++) {
                const a = 2 * Math.PI * i / 6, r = this.w / 2;
                const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
                if (i == 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
        }
        ctx.closePath(); ctx.fill();

        // Flash khi bị đánh
        if (this.flash > 0) {
            ctx.globalAlpha = this.flash * 0.8; ctx.fillStyle = '#fff';
            ctx.fillRect(this.x - 10, this.y - 10, this.w + 20, this.h + 20); ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Glow cho enemy có tiền
        if (this.canDrop) {
            ctx.globalAlpha = 0.4; ctx.fillStyle = '#ff0';
            ctx.fillRect(this.x - 5 - this.pulse, this.y - 5 - this.pulse, this.w + 10 + this.pulse * 2, this.h + 10 + this.pulse * 2);
            ctx.globalAlpha = 1;
        }

        // Thanh HP
        const bw = this.w, by = this.y - 10;
        ctx.fillStyle = '#3c3c3c'; ctx.fillRect(this.x, by, bw, 5);
        const hp = this.hp / this.maxHp;
        ctx.fillStyle = `rgb(${Math.min(255, Math.floor(255 * (1 - hp)))},${Math.min(255, Math.floor(255 * hp))},0)`;
        ctx.fillRect(this.x, by, hp * bw, 5);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(this.x, by, bw, 5);
    }

    hit(dmg) {
        this.hp -= dmg; this.flash = 1;
        for (let i = 0; i < 5; i++) particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#fff', 2, 3, 10));
    }

    drop() {
        // Luck bonus tăng tỉ lệ rơi tiền
        const luckBonus = window.dropChanceBonus || 0;
        const effectiveCanDrop = this.canDrop || Math.random() < luckBonus;

        if (effectiveCanDrop) {
            // Greed bonus tăng tiền nhận được
            const greedMultiplier = 1 + (window.moneyBonus || 0);
            const finalMoney = Math.floor(this.money * greedMultiplier);
            playerMoney += finalMoney;
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#ff0', 1, 3, 30));
        }
    }
}
