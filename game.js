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
bgCtx.fillStyle = 'rgb(5,5,30)';
bgCtx.fillRect(0, 0, W, H);

for (let i = 0; i < 100; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = Math.random() * 2 + 1, b = Math.floor(Math.random() * 105 + 150);
    bgCtx.fillStyle = `rgb(${b},${b},${b})`;
    bgCtx.beginPath(); bgCtx.arc(x, y, r, 0, Math.PI * 2); bgCtx.fill();
}

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
            // Speed oscillates between 0.5 and 3.5, creating a stalling effect
            spd = 2 + Math.sin(this.timer * 0.05) * 1.5;
        } else if (this.zigzag) {
            this.timer = (this.timer || 0) + 1;
            const perpX = -this.dy;
            const perpY = this.dx;
            // Wiggle left and right as it moves forward
            const wiggle = Math.cos(this.timer * 0.1) * 3;
            // The dx and dy are preserved, just position changed by wiggle
            this.x += perpX * wiggle;
            this.y += perpY * wiggle;
            spd = 2.5; // Fixed slower speed for falling petal
        } else if (this.sniper) {
            spd = 25; // Extremely fast
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
        const baseDmg = { small: 10, medium: 20, large: 30, elite: 35, boss: 25 }; // Giảm damage va chạm trực tiếp với sếp
        const baseScore = { small: 10, medium: 20, large: 30, elite: 50, boss: 200 };
        const moneyRanges = {
            small: { min: 5, max: 25 },
            medium: { min: 15, max: 35 },
            large: { min: 25, max: 45 },
            elite: { min: 40, max: 60 },
            boss: { min: 100, max: 150 }
        };

        this.hp = Math.floor((baseHp[type] || 40) * waveScale * (isMinion ? 1.0 : 1)); // Minions from boss have normal HP for their tier
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

        if (this.isMinion) {
            ctx.translate(cx, cy);
            ctx.rotate(this.anim * 0.15);
            ctx.translate(-cx, -cy);

            ctx.fillStyle = '#9933ff';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 4) + (Math.PI / 2) * i;
                const r = this.w / 2;
                const px = cx + r * Math.cos(a);
                const py = cy + r * Math.sin(a);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#cc66ff';
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5 + Math.sin(this.anim * 0.3) * 0.3;
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else {
            const col = this.type == 'boss' || this.type == 'small' ? '#f00' : (this.type == 'elite' ? '#ffd700' : (this.type == 'large' ? '#f0f' : '#fa0'));

            if (this.type == 'medium' || this.type == 'large' || this.type == 'elite') {
                ctx.translate(cx, cy); ctx.rotate(this.anim * 20 * Math.PI / 180); ctx.translate(-cx, -cy);
            }

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
        }

        if (this.flash > 0) {
            ctx.globalAlpha = this.flash * 0.8; ctx.fillStyle = '#fff';
            ctx.fillRect(this.x - 10, this.y - 10, this.w + 20, this.h + 20); ctx.globalAlpha = 1;
        }
        ctx.restore();

        if (this.canDrop) {
            ctx.globalAlpha = 0.4; ctx.fillStyle = '#ff0';
            ctx.fillRect(this.x - 5 - this.pulse, this.y - 5 - this.pulse, this.w + 10 + this.pulse * 2, this.h + 10 + this.pulse * 2);
            ctx.globalAlpha = 1;
        }

        const bw = this.w, by = this.y - 10;
        ctx.fillStyle = '#3c3c3c'; ctx.fillRect(this.x, by, bw, 5);
        const hp = this.hp / this.maxHp;
        ctx.fillStyle = this.isMinion ? '#9933ff' : `rgb(${Math.min(255, Math.floor(255 * (1 - hp)))},${Math.min(255, Math.floor(255 * hp))},0)`;
        ctx.fillRect(this.x, by, hp * bw, 5);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(this.x, by, bw, 5);
    }

    hit(dmg) {
        this.hp -= dmg; this.flash = 1;
        for (let i = 0; i < 5; i++) particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#fff', 2, 3, 10));
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
