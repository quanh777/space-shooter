class Boss extends Enemy {
    constructor() {
        super('boss');

        const bossNumber = Math.floor(wave / 5);
        const difficultyMultiplier = bossNumber === 1 ? 1 : (1 + (bossNumber - 1) * 0.3);

        this.damageMultiplier = 1 + (bossNumber - 1) * 0.2;

        this.bossType = Math.floor(Math.random() * 3);

        const baseHp = bossNumber === 1 ? (1500 + Math.random() * 500) : (2500 + (bossNumber * 1000) + Math.random() * 1000);
        this.hp = Math.floor(baseHp * difficultyMultiplier * (1 + bossNumber * 0.2));
        this.maxHp = this.hp;

        this.spd = 0.9 + bossNumber * 0.1;

        this.state = 'IDLE';
        this.consecutiveAttacks = 0;
        this.maxConsecutiveAttacks = 3;
        this.attackCooldownTimer = 1000;
        this.restTimer = 0;

        this.phase = 1;

        this.w = 80 + bossNumber * 5 + Math.random() * 15;
        this.h = this.w;
        this.rotation = 0;
        this.glowIntensity = 0;

        this.attackPool = this.generateRandomAttackPool();

        this.laserCharging = false;
        this.laserFiring = false;
        this.laserAngle = 0;
        this.laserSweep = false;
        this.laserSweepDir = 1;
        this.laserTimer = 0;
        this.laserSweepSpeed = 0.025;

        this.dying = false;
        this.deathTimer = 0;

        this.transitioning = false;
        this.transitionTimer = 0;

        this.teleporting = false;
        this.teleportTimer = 0;
        this.teleportTarget = null;

        this.clonesActive = false;
        this.cloneTimer = 0;
        this.clonePositions = [];

        this.mines = [];
        this.enraged = false;
        this.rageThreshold = 0.3;

        this.machineGunActive = false;
        this.machineGunTimer = 0;
        this.machineGunShotsFired = 0;
        this.machineGunMaxShots = 0;

        this.sniperActive = false;
        this.sniperTimer = 0;
        this.sniperShotsFired = 0;
        this.sniperMaxShots = 0;

        this.isCharging = false;
        this.preChargeTimer = 0;
        this.chargeDirection = { x: 0, y: 0 };
        this.chargeProgress = 0;
        this.chargeCount = 0;
        this.chargeTrail = [];

        this.entering = true;
        this.entryY = -100;
        this.y = -100;

        this.names = ['DESTROYER', 'SUMMONER', 'OVERLORD'];
        this.colors = ['#ff3333', '#9933ff', '#ffcc00'];

        const suffixes = ['', ' MK-' + (bossNumber + 1), ' PRIME', ' OMEGA', ' REDUX'];
        this.displayName = this.names[this.bossType] + (bossNumber > 0 ? suffixes[Math.min(bossNumber, 4)] : '');
        this.color = this.colors[this.bossType];

        this.shieldActive = false;
        this.shieldTimer = 0;

        this.attackFlash = 0;
        this.hitFlash = 0;
        this.breathe = 0;
        this.attackWindup = 0;
        this.bodyRecoil = 0;
        this.coreEnergy = 0.3;
        this.ambientTimer = 0;
        this.lastAttackType = '';
    }

    getDamage(baseDamage) {
        return Math.floor(baseDamage * this.damageMultiplier);
    }

    generateRandomAttackPool() {
        const typePools = [
            ['machineGun', 'shotgunBlast', 'charge', 'novaRing', 'crossBurst'],
            ['minionSwarm', 'lotusSpiral', 'homingOrbs', 'flowerPetals', 'waveAttack'],
            ['strategicMines', 'deathRay', 'gridLock', 'sniperShot', 'matrixRings']
        ];

        const available = [...typePools[this.bossType]];
        const selected = [];

        for (let i = 0; i < 3 && available.length > 0; i++) {
            const idx = Math.floor(Math.random() * available.length);
            selected.push(available.splice(idx, 1)[0]);
        }
        return selected;
    }

    update() {
        if (this.entering) {
            this.entryY += 2;
            this.y = this.entryY;
            if (this.y >= 50) {
                this.x = W / 2 - this.w / 2;
                this.entering = false;
                this.y = 50;
                screenShake = 20;
                for (let i = 0; i < 50; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(
                        this.x + this.w / 2 + Math.cos(ang) * 50,
                        this.y + this.h / 2 + Math.sin(ang) * 50,
                        this.color, 3, 6, 40
                    ));
                }
            }
            return;
        }

        if (this.dying) {
            this.deathTimer += 16;
            if (this.deathTimer % 100 < 20) {
                screenShake = 10;
                const rx = this.x + Math.random() * this.w;
                const ry = this.y + Math.random() * this.h;
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(rx, ry,
                        ['#ff0', '#f80', '#f00'][Math.floor(Math.random() * 3)],
                        3, 5, 30));
                }
            }
            if (this.deathTimer >= 2000) {
                this.finalExplosion();
                this.hp = -999;
            }
            return;
        }

        this.breathe += 0.03;
        this.ambientTimer++;
        this.attackFlash *= 0.85;
        this.hitFlash *= 0.9;
        this.bodyRecoil *= 0.88;

        let coreTarget = 0.3;
        if (this.laserCharging) coreTarget = 0.6 + (1 - this.laserTimer / 1000) * 0.4;
        else if (this.laserFiring) coreTarget = 1.0;
        else if (this.machineGunActive) coreTarget = 0.7;
        else if (this.sniperActive) coreTarget = 0.8;
        else if (this.preChargeTimer > 0) coreTarget = 0.5 + (1 - this.preChargeTimer / 90) * 0.5;
        else if (this.state === 'RESTING') coreTarget = 0.15;
        this.coreEnergy += (coreTarget - this.coreEnergy) * 0.08;

        let windupTarget = 0;
        if (this.machineGunActive || this.sniperActive || this.laserFiring) windupTarget = 1;
        else if (this.laserCharging || this.preChargeTimer > 0) windupTarget = 0.6;
        this.attackWindup += (windupTarget - this.attackWindup) * 0.1;

        const hpPct = this.hp / this.maxHp;
        const newPhase = hpPct <= this.rageThreshold ? 3 : (hpPct <= 0.6 ? 2 : 1);

        if (newPhase !== this.phase && !this.transitioning) {
            this.transitioning = true;
            this.transitionTimer = 60;
            this.phase = newPhase;
            this.maxConsecutiveAttacks = 2 + this.phase;
            screenShake = 15;

            for (let i = 0; i < 30; i++) {
                const ang = (i / 30) * Math.PI * 2;
                particles.push(new Particle(
                    this.x + this.w / 2 + Math.cos(ang) * 60,
                    this.y + this.h / 2 + Math.sin(ang) * 60,
                    this.color, 2, 4, 30
                ));
            }

            if (this.phase === 3 && !this.enraged) {
                this.enraged = true;
                screenShake = 25;
            }
        }

        if (this.transitioning) {
            this.transitionTimer--;
            if (this.transitionTimer <= 0) this.transitioning = false;
            this.glowIntensity = 1;
            return;
        }

        if (this.shieldActive) {
            this.shieldTimer -= 16;
            if (this.shieldTimer <= 0) {
                this.shieldActive = false;
            }
        }

        if (this.machineGunActive) {
            this.machineGunTimer -= 16;
            if (this.machineGunTimer <= 0) {
                this.machineGunTimer = 80;

                const px = playerX + PW / 2, py = playerY + PH / 2;
                const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
                const angle = Math.atan2(py - cy, px - cx) + (Math.random() - 0.5) * 0.2;

                scheduledBullets.push({
                    x: cx, y: cy,
                    angle: angle,
                    delay: 0, color: '#ff3333', damage: this.getDamage(10)
                });
                this.attackFlash = 1; this.bodyRecoil = 0.5;

                this.machineGunShotsFired++;
                if (this.machineGunShotsFired >= this.machineGunMaxShots) {
                    this.machineGunActive = false;
                }
            }
        }

        if (this.sniperActive) {
            this.sniperTimer -= 16;

            if (this.sniperTimer <= 0) {
                this.sniperTimer = 80;

                const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
                const priorX = playerX + PW / 2 + (Math.random() - 0.5) * 10;
                const priorY = playerY + PH / 2 + (Math.random() - 0.5) * 10;
                const napAngle = Math.atan2(priorY - cy, priorX - cx);

                let b = new Bullet(cx, cy, Math.cos(napAngle), Math.sin(napAngle));
                b.c = '#ffffff';
                b.dmg = this.getDamage(25);
                b.speed = 20 + this.phase * 3;
                b.isEnemy = true;
                if (typeof bullets !== 'undefined') bullets.push(b);
                screenShake = 15;
                this.attackFlash = 1; this.bodyRecoil = 1;

                this.sniperShotsFired++;
                if (this.sniperShotsFired >= this.sniperMaxShots) {
                    this.sniperActive = false;
                }
            }
        }

        if (this.preChargeTimer > 0) {
            this.preChargeTimer--;

            const px = playerX + PW / 2, py = playerY + PH / 2;
            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            if (d > 0) {
                this.chargeDirection = { x: (px - cx) / d, y: (py - cy) / d };
            }

            if (this.preChargeTimer % 5 === 0) {
                this.flash = 0.5;
                const ang = Math.random() * Math.PI * 2;
                particles.push(new Particle(
                    this.x + this.w / 2 + Math.cos(ang) * 40,
                    this.y + this.h / 2 + Math.sin(ang) * 40,
                    '#ff0000', 3, 5, 20
                ));
            }

            if (this.preChargeTimer <= 0) {
                this.isCharging = true;
                screenShake = 12;
            }
        } else if (this.isCharging) {
            this.chargeProgress++;
            if (this.chargeProgress <= 35) {

                const dashSpd = 18 + this.phase * 2.5;
                const moveX = this.chargeDirection.x * dashSpd;
                const moveY = this.chargeDirection.y * dashSpd;
                this.x += moveX;
                this.y += moveY;

                this.chargeTrail.push({ x: this.x + this.w / 2, y: this.y + this.h / 2, life: 20 });

                if (this.x <= 0 || this.x >= W - this.w) {
                    this.chargeDirection.x *= -1;
                    screenShake = 8;
                }
                if (this.y <= 0 || this.y >= H - this.h) {
                    this.chargeDirection.y *= -1;
                    screenShake = 8;
                }

                this.x = Math.max(0, Math.min(W - this.w, this.x));
                this.y = Math.max(0, Math.min(H - this.h, this.y));

                const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
                const px = playerX + PW / 2, py = playerY + PH / 2;
                const d = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
                if (d < 40 && !invincible) {
                    playerHealth -= 25;
                    if (playerHealth <= 0) gameOver();
                }

            } else {
                this.chargeCount--;
                if (this.chargeCount > 0) {
                    this.chargeProgress = 0;
                    this.preChargeTimer = 60;
                    this.isCharging = false;
                    const px = playerX + PW / 2, py = playerY + PH / 2;
                    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
                    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
                    this.chargeDirection = { x: (px - cx) / d, y: (py - cy) / d };
                } else {
                    this.isCharging = false;
                    this.chargeProgress = 0;
                }
            }
        }

        this.chargeTrail = this.chargeTrail.filter(t => {
            t.life--;
            return t.life > 0;
        });

        if (!this.isCharging && !this.teleporting && !this.clonesActive) {
            this.moveByType();
        }

        this.rotation += (this.state === 'RESTING') ? 0.005 : (this.enraged ? 0.06 : 0.02);
        this.anim += 0.1;
        this.pulse += 0.15 * this.pdir;
        if (this.pulse > 6) this.pdir = -1;
        else if (this.pulse < 0) this.pdir = 1;
        this.glowIntensity = Math.max(0, this.glowIntensity - 0.02);

        this.updateLaser();
        this.updateMines();
        this.updateTeleport();

        const isBusy = this.preChargeTimer > 0 || this.isCharging || this.machineGunActive || this.sniperActive || this.laserCharging || this.laserFiring || this.teleporting || this.clonesActive;

        if (this.state === 'IDLE' && !isBusy) {
            this.attackCooldownTimer -= 16;
            if (this.attackCooldownTimer <= 0 && !this.shieldActive) {
                if (this.consecutiveAttacks < this.maxConsecutiveAttacks) {
                    this.state = 'ATTACKING';
                    this.useSkill();
                    this.consecutiveAttacks++;
                } else {
                    this.state = 'WAITING_CLEAR_REST';
                }
            }
        } else if (this.state === 'ATTACKING') {
            if (!this.laserCharging && !this.laserFiring && !this.isCharging && !this.teleporting && !this.clonesActive) {
                this.state = 'WAITING_CLEAR_SKILL';
            }
        } else if (this.state === 'WAITING_CLEAR_SKILL') {
            if (this.isScreenClear()) {
                this.state = 'IDLE';
                this.attackCooldownTimer = Math.max(200, 1000 - (this.phase * 200));
            }
        } else if (this.state === 'WAITING_CLEAR_REST') {
            if (this.isScreenClear()) {
                this.state = 'RESTING';
                this.restTimer = 2000 + Math.random() * 2000;
            }
        } else if (this.state === 'RESTING') {
            this.restTimer -= 16;
            if (this.restTimer <= 0) {
                this.state = 'IDLE';
                this.consecutiveAttacks = 0;
                this.maxConsecutiveAttacks = 2 + this.phase;
                this.attackCooldownTimer = 500;
            }
        }
    }

    isScreenClear() {
        let currentBossBullets = typeof bullets !== 'undefined' ? bullets.filter(b => b.isEnemy).length : 0;
        let scheduledCount = typeof scheduledBullets !== 'undefined' ? scheduledBullets.length : 0;
        let activeMines = this.mines.length;
        let activeMinions = typeof enemies !== 'undefined' ? enemies.filter(e => e.isMinion).length : 0;
        return (currentBossBullets <= 3 && scheduledCount === 0 && activeMines === 0 && activeMinions === 0);
    }

    moveByType() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;

        let finalSpd = this.spd;
        if (this.state === 'RESTING') finalSpd *= 0.35;

        let targetX = px < W / 2 ? W - 150 : 150;
        let targetY = py < H / 2 ? H - 150 : 150;

        const t = Date.now() / 2000;
        targetX += Math.sin(t) * 100;
        targetY += Math.cos(t) * 100;

        const tx = targetX - cx;
        const ty = targetY - cy;
        const tDist = Math.sqrt(tx * tx + ty * ty);

        if (tDist > 10) {
            this.x += (tx / tDist) * finalSpd * 1.5;
            this.y += (ty / tDist) * finalSpd * 1.5;
        }

        const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (d < 250 && !this.isCharging) {
            this.x -= ((px - cx) / d) * finalSpd * 2.5;
            this.y -= ((py - cy) / d) * finalSpd * 2.5;
        }

        this.x = Math.max(10, Math.min(W - this.w - 10, this.x));
        this.y = Math.max(10, Math.min(H - this.h - 10, this.y));
    }

    updateLaser() {
        if (this.laserCharging) {
            this.laserTimer -= 16;
            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;

            if (this.laserTimer > 400) {
                this.laserLocked = false;
                const targetAngle = Math.atan2(playerY + PH / 2 - cy, playerX + PW / 2 - cx);

                let diff = targetAngle - this.laserAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                this.laserAngle += diff * 0.2;
            } else {
                this.laserLocked = true;
                if (Math.random() < 0.3) {
                    particles.push(new Particle(
                        cx + Math.cos(this.laserAngle) * (this.w / 2 + 10),
                        cy + Math.sin(this.laserAngle) * (this.w / 2 + 10),
                        '#ffff00', 3, 4, 15
                    ));
                }
            }

            if (this.laserTimer <= 0) {
                this.laserCharging = false;
                this.laserLocked = false;
                this.laserFiring = true;
                this.laserTimer = 2500;
                screenShake = 18;
            }
        }

        if (this.laserFiring) {
            this.laserTimer -= 16;

            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const px = playerX + PW / 2, py = playerY + PH / 2;

            const targetAngle = Math.atan2(py - cy, px - cx);
            let diff = targetAngle - this.laserAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const sweepSpeed = 0.001 + this.phase * 0.005;
            this.laserAngle += Math.sign(diff) * Math.min(Math.abs(diff), sweepSpeed);

            const lx = cx + Math.cos(this.laserAngle) * 1500;
            const ly = cy + Math.sin(this.laserAngle) * 1500;

            this.laserDamageTimer = (this.laserDamageTimer || 0) - 16;

            if (!invincible) {
                const d = distToSegment(px, py, cx, cy, lx, ly);
                if (d < 35) {
                    if (this.laserDamageTimer <= 0) {
                        playerHealth -= this.getDamage(2 + this.phase * 0.5);
                        if (playerHealth <= 0) gameOver();
                        this.laserDamageTimer = 500;
                        screenShake = 5;
                    }
                    if (Math.random() < 0.4) {
                        particles.push(new Particle(px, py, '#f00', 2, 3, 15));
                    }
                }
            }

            if (this.laserTimer <= 0) {
                this.laserFiring = false;
            }
        }
    }

    updateMines() {
        this.mines = this.mines.filter(m => {
            m.timer -= 16;
            m.pulse = (m.pulse || 0) + 0.1;

            if (m.homing) {
                const dx = playerX + PW / 2 - m.x;
                const dy = playerY + PH / 2 - m.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 10) {
                    m.x += (dx / d) * 1.5;
                    m.y += (dy / d) * 1.5;
                }
                if (Math.random() < 0.2) particles.push(new Particle(m.x, m.y, '#9933ff', 2, 3, 10));
            }

            const dx = playerX + PW / 2 - m.x;
            const dy = playerY + PH / 2 - m.y;
            const playerDist = Math.sqrt(dx * dx + dy * dy);

            if (m.timer <= 0 || playerDist < 25) {
                for (let i = 0; i < 25; i++) {
                    const ang = (i / 25) * Math.PI * 2;
                    particles.push(new Particle(m.x + Math.cos(ang) * 20, m.y + Math.sin(ang) * 20, m.color, 3, 5, 25));
                }
                screenShake = 10;

                if (playerDist < 90 && !invincible) {
                    playerHealth -= 5;
                    if (playerHealth <= 0) gameOver();
                }

                for (let i = 0; i < 8; i++) {
                    const ang = (i / 8) * Math.PI * 2;
                    scheduledBullets.push({
                        x: m.x, y: m.y, angle: ang, delay: 0,
                        color: m.color, damage: 10
                    });
                }
                return false;
            }
            return true;
        });
    }

    updateTeleport() {
        if (this.teleporting) {
            this.teleportTimer -= 16;
            if (this.teleportTimer <= 0) {
                this.teleporting = false;
                this.x = this.teleportTarget.x;
                this.y = this.teleportTarget.y;
                this.teleportTarget = null;
                screenShake = 12;

                for (let i = 0; i < 30; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(
                        this.x + this.w / 2 + Math.cos(ang) * 40,
                        this.y + this.h / 2 + Math.sin(ang) * 40,
                        this.color, 2, 4, 30
                    ));
                }
            }
        }

        if (this.clonesActive) {
            this.cloneTimer -= 16;
            if (this.cloneTimer <= 0) {
                this.clonesActive = false;
                this.clonePositions = [];
                this.x = W / 2 - this.w / 2;
            }
        }
    }

    draw() {
        if (this.teleporting && this.teleportTimer < 200) return;

        ctx.save();
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const t = Date.now();
        const r = this.w / 2;
        const isResting = this.state === 'RESTING';
        const br = Math.sin(this.breathe) * 0.03;
        const recoilX = (Math.random() - 0.5) * this.bodyRecoil * 8;
        const recoilY = -this.bodyRecoil * 4;

        if (this.preChargeTimer > 0) {
            ctx.save();
            const chargeRatio = 1 - this.preChargeTimer / 90;
            const angle = Math.atan2(this.chargeDirection.y, this.chargeDirection.x);
            const perpX = Math.cos(angle + Math.PI / 2) * r;
            const perpY = Math.sin(angle + Math.PI / 2) * r;

            ctx.globalAlpha = 0.08 + chargeRatio * 0.12;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.moveTo(cx + perpX, cy + perpY);
            ctx.lineTo(cx + perpX + this.chargeDirection.x * 2000, cy + perpY + this.chargeDirection.y * 2000);
            ctx.lineTo(cx - perpX + this.chargeDirection.x * 2000, cy - perpY + this.chargeDirection.y * 2000);
            ctx.lineTo(cx - perpX, cy - perpY);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#ff3300';
            ctx.globalAlpha = 0.3 + Math.sin(t * 0.025) * 0.2 + chargeRatio * 0.4;
            ctx.lineWidth = 2 + chargeRatio * 4;
            ctx.setLineDash([25 - chargeRatio * 20, 8]);
            ctx.beginPath();
            ctx.moveTo(cx + perpX, cy + perpY);
            ctx.lineTo(cx + perpX + this.chargeDirection.x * 2000, cy + perpY + this.chargeDirection.y * 2000);
            ctx.moveTo(cx - perpX, cy - perpY);
            ctx.lineTo(cx - perpX + this.chargeDirection.x * 2000, cy - perpY + this.chargeDirection.y * 2000);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        if (this.sniperActive && this.sniperTimer > 0) {
            ctx.save();
            const px = playerX + PW / 2, py = playerY + PH / 2;
            const angle = Math.atan2(py - cy, px - cx);

            const laserGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * 600, cy + Math.sin(angle) * 600);
            laserGrad.addColorStop(0, 'rgba(255,220,0,0.9)');
            laserGrad.addColorStop(1, 'rgba(255,220,0,0)');
            ctx.strokeStyle = laserGrad;
            ctx.globalAlpha = 0.4 + Math.sin(t * 0.04) * 0.3;
            ctx.lineWidth = 2 + Math.sin(t * 0.06) * 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * 2000, cy + Math.sin(angle) * 2000);
            ctx.stroke();

            ctx.globalAlpha = 0.6 + Math.sin(t * 0.05) * 0.3;
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            const cs = 16 + Math.sin(t * 0.01) * 5;
            ctx.beginPath(); ctx.arc(px, py, cs, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(px, py, cs * 0.4, 0, Math.PI * 2); ctx.stroke();
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 + t * 0.003;
                ctx.beginPath();
                ctx.moveTo(px + Math.cos(a) * (cs + 4), py + Math.sin(a) * (cs + 4));
                ctx.lineTo(px + Math.cos(a) * (cs + 16), py + Math.sin(a) * (cs + 16));
                ctx.stroke();
            }
            ctx.restore();
        }

        this.chargeTrail.forEach(tr => {
            ctx.save();
            ctx.globalAlpha = tr.life / 20 * 0.35;
            ctx.fillStyle = this.bossType === 0 ? '#ff2200' : this.color;
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(tr.x, tr.y, r * 0.75 * (tr.life / 20), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        ctx.globalAlpha = 1;

        if (this.shieldActive) {
            ctx.save();
            const sa = 0.35 + Math.sin(t * 0.012) * 0.15;
            ctx.globalAlpha = sa;
            const sr = r + 30;
            for (let i = 0; i < 6; i++) {
                const a1 = (i / 6) * Math.PI * 2 + t * 0.0015;
                const a2 = ((i + 1) / 6) * Math.PI * 2 + t * 0.0015;
                ctx.strokeStyle = `rgba(0,255,255,${0.4 + Math.sin(t * 0.009 + i) * 0.3})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a1) * sr, cy + Math.sin(a1) * sr);
                ctx.lineTo(cx + Math.cos(a2) * sr, cy + Math.sin(a2) * sr);
                ctx.stroke();
                ctx.fillStyle = `rgba(0,200,255,${0.04 + Math.sin(t * 0.006 + i * 0.7) * 0.03})`;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a1) * sr, cy + Math.sin(a1) * sr);
                ctx.lineTo(cx + Math.cos(a2) * sr, cy + Math.sin(a2) * sr);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }

        const glowAmt = 12 + this.pulse + (this.enraged ? 15 : 0) + this.coreEnergy * 20;
        const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r + glowAmt);
        const auraColor = isResting ? 'rgba(0,255,136,0.25)' :
            this.bossType === 0 ? `rgba(255,${Math.floor(50 + this.coreEnergy * 100)},0,${0.15 + this.coreEnergy * 0.15})` :
                this.bossType === 1 ? `rgba(${Math.floor(120 + this.coreEnergy * 80)},50,255,${0.15 + this.coreEnergy * 0.15})` :
                    `rgba(255,${Math.floor(180 + this.coreEnergy * 50)},0,${0.15 + this.coreEnergy * 0.15})`;
        auraGrad.addColorStop(0, auraColor);
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath(); ctx.arc(cx, cy, r + glowAmt, 0, Math.PI * 2); ctx.fill();

        if (this.clonesActive && this.cloneTimer > 0) {
            ctx.globalAlpha = 0.3 + Math.sin(t * 0.012) * 0.12;
            this.clonePositions.forEach(pos => {
                const ccx = pos.x + this.w / 2 + (Math.random() - 0.5) * 5;
                const ccy = pos.y + this.h / 2 + (Math.random() - 0.5) * 5;
                ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 25;
                ctx.beginPath(); ctx.arc(ccx, ccy, r * 0.9, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = this.color; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.shadowBlur = 0;
            });
            ctx.globalAlpha = 1; ctx.restore(); return;
        }

        ctx.save();
        ctx.translate(cx + recoilX, cy + recoilY);
        ctx.scale(1 + br, 1 + br);

        if (this.bossType === 0) {

            for (let layer = 0; layer < 3; layer++) {
                const lr = r * (1.05 - layer * 0.15);
                const lRot = this.rotation * (1 - layer * 0.3);
                const shade = 20 + layer * 15;
                ctx.fillStyle = `rgb(${shade + 40},${shade},${shade})`;
                ctx.strokeStyle = `rgb(${shade + 80},${shade + 20},${shade + 20})`;
                ctx.lineWidth = 2 - layer * 0.5;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const ang = lRot + (i / 6) * Math.PI * 2;
                    const spikeOffset = (i % 2 === 0 ? 1.08 : 0.92) * lr;
                    const px = Math.cos(ang) * spikeOffset;
                    const py = Math.sin(ang) * spikeOffset;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(255,60,30,0.15)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const ang = this.rotation + (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ang) * r * 0.35, Math.sin(ang) * r * 0.35);
                ctx.lineTo(Math.cos(ang) * r * 0.95, Math.sin(ang) * r * 0.95);
                ctx.stroke();
            }

            if (this.phase >= 2) {
                ctx.strokeStyle = `rgba(255,100,0,${0.3 + Math.sin(t * 0.006) * 0.2 + this.coreEnergy * 0.3})`;
                ctx.lineWidth = 1.5 + this.coreEnergy;
                ctx.shadowColor = 'rgba(255,80,0,0.5)'; ctx.shadowBlur = 8;
                for (let i = 0; i < 5; i++) {
                    const ca = this.rotation * 1.2 + i * 1.25;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(ca) * r * 0.2, Math.sin(ca) * r * 0.2);
                    ctx.quadraticCurveTo(
                        Math.cos(ca + 0.3) * r * 0.55, Math.sin(ca + 0.3) * r * 0.55,
                        Math.cos(ca - 0.1) * r * 0.92, Math.sin(ca - 0.1) * r * 0.92
                    );
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            const sLen = (this.enraged ? r * 0.55 : r * 0.38) + this.attackWindup * r * 0.15;
            for (let i = 0; i < 6; i++) {
                const ang = -this.rotation * 0.5 + (i / 6) * Math.PI * 2;
                const base = r * 0.93;
                const bx = Math.cos(ang) * base, by = Math.sin(ang) * base;
                const tx = Math.cos(ang) * (base + sLen), ty = Math.sin(ang) * (base + sLen);
                const perpAng = ang + Math.PI / 2;
                const w = 5 + this.attackWindup * 2;

                const sg = ctx.createLinearGradient(bx, by, tx, ty);
                sg.addColorStop(0, '#666'); sg.addColorStop(0.4, '#999'); sg.addColorStop(1, '#444');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.moveTo(bx + Math.cos(perpAng) * w, by + Math.sin(perpAng) * w);
                ctx.lineTo(tx, ty);
                ctx.lineTo(bx - Math.cos(perpAng) * w, by - Math.sin(perpAng) * w);
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
            }

            if (this.attackFlash > 0.1) {
                for (let i = 0; i < 3; i++) {
                    const wa = this.rotation + (i / 3) * Math.PI * 2;
                    const wx = Math.cos(wa) * r * 0.6, wy = Math.sin(wa) * r * 0.6;
                    ctx.fillStyle = `rgba(255,200,100,${this.attackFlash * 0.8})`;
                    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 20 * this.attackFlash;
                    ctx.beginPath(); ctx.arc(wx, wy, 6 + this.attackFlash * 4, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
            cg.addColorStop(0, `rgba(255,255,255,${this.coreEnergy})`);
            cg.addColorStop(0.2, `rgba(255,${Math.floor(200 * this.coreEnergy)},${Math.floor(50 * this.coreEnergy)},${this.coreEnergy * 0.9})`);
            cg.addColorStop(0.5, `rgba(200,${Math.floor(40 * this.coreEnergy)},0,${this.coreEnergy * 0.6})`);
            cg.addColorStop(1, 'rgba(80,0,0,0)');
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = `rgba(255,100,0,${0.3 + this.coreEnergy * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.stroke();

            if (isResting) {
                ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, 5, 7, 0); ctx.stroke();
            } else {
                const ea = Math.atan2(playerY - cy, playerX - cx) - this.rotation;
                ctx.fillStyle = this.enraged ? '#ff0000' : '#111';
                ctx.beginPath(); ctx.arc(Math.cos(ea) * 4, Math.sin(ea) * 4, r * 0.09, 0, Math.PI * 2); ctx.fill();
            }
        }

        else if (this.bossType === 1) {

            ctx.save(); ctx.rotate(this.rotation);
            const vertices = [
                { x: 0, y: -r * 1.15 },
                { x: r * 0.95, y: 0 },
                { x: 0, y: r * 1.15 },
                { x: -r * 0.95, y: 0 }
            ];
            const faceColors = [
                ['#4a0088', '#2a0055'], ['#5a00aa', '#350066'],
                ['#3a0077', '#220044'], ['#480099', '#2d0055']
            ];
            for (let i = 0; i < 4; i++) {
                const v1 = vertices[i], v2 = vertices[(i + 1) % 4];
                const facGrad = ctx.createLinearGradient(0, 0, v1.x, v1.y);
                facGrad.addColorStop(0, faceColors[i][0]);
                facGrad.addColorStop(1, faceColors[i][1]);
                ctx.fillStyle = facGrad;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y);
                ctx.closePath(); ctx.fill();

                ctx.strokeStyle = `rgba(200,120,255,${0.3 + Math.sin(t * 0.007 + i * 1.5) * 0.25})`;
                ctx.lineWidth = 1.5 + Math.sin(t * 0.01 + i) * 0.5;
                ctx.beginPath(); ctx.moveTo(v1.x, v1.y); ctx.lineTo(v2.x, v2.y); ctx.stroke();
            }

            ctx.fillStyle = `rgba(180,80,255,${0.08 + Math.sin(t * 0.005) * 0.04})`;
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 0.35, 0); ctx.lineTo(0, r * 0.5); ctx.lineTo(-r * 0.35, 0);
            ctx.closePath(); ctx.fill();

            const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
            ig.addColorStop(0, `rgba(220,140,255,${0.4 + this.coreEnergy * 0.4})`);
            ig.addColorStop(0.4, `rgba(120,0,220,${0.15 + this.coreEnergy * 0.15})`);
            ig.addColorStop(1, 'transparent');
            ctx.fillStyle = ig;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();

            ctx.restore();

            if (this.phase >= 2) {
                ctx.strokeStyle = `rgba(200,0,255,${0.35 + Math.sin(t * 0.008) * 0.25})`;
                ctx.lineWidth = 1.5; ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 6;
                for (let i = 0; i < 4; i++) {
                    const ca = this.rotation + i * 1.57;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(ca) * r * 0.15, Math.sin(ca) * r * 0.15);
                    ctx.quadraticCurveTo(
                        Math.cos(ca + 0.35) * r * 0.5, Math.sin(ca + 0.35) * r * 0.5,
                        Math.cos(ca - 0.12) * r * 0.88, Math.sin(ca - 0.12) * r * 0.88
                    );
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            const rc = this.phase >= 2 ? 6 : 4;
            for (let i = 0; i < rc; i++) {
                const ra = (i / rc) * Math.PI * 2 + t * 0.0025;
                const rd = r * 1.45 + Math.sin(t * 0.006 + i * 2.5) * 10;
                const rx = Math.cos(ra) * rd, ry = Math.sin(ra) * rd;

                ctx.strokeStyle = `rgba(160,80,230,${0.1 + Math.sin(t * 0.005 + i) * 0.08 + this.coreEnergy * 0.1})`;
                ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(rx, ry); ctx.stroke();

                ctx.strokeStyle = `rgba(190,120,255,${0.4 + Math.sin(t * 0.012 + i * 0.8) * 0.3})`;
                ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rx, ry, 9, 0, Math.PI * 2); ctx.stroke();

                ctx.save(); ctx.translate(rx, ry); ctx.rotate(t * 0.005 + i);
                ctx.strokeStyle = `rgba(220,170,255,${0.5 + Math.sin(t * 0.015 + i) * 0.3})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
                ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
                ctx.restore();

                ctx.fillStyle = `rgba(230,170,255,${0.5 + Math.sin(t * 0.014 + i) * 0.3})`;
                ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
            }

            if (this.attackFlash > 0.1) {
                ctx.fillStyle = `rgba(200,100,255,${this.attackFlash * 0.5})`;
                ctx.shadowColor = '#cc66ff'; ctx.shadowBlur = 30 * this.attackFlash;
                ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }

            if (isResting) {
                ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, 5, 7, 0); ctx.stroke();
            } else {
                const ea = Math.atan2(playerY - cy, playerX - cx);
                ctx.fillStyle = this.enraged ? '#ff00ff' : '#1a001a';
                ctx.beginPath(); ctx.arc(Math.cos(ea) * 4, Math.sin(ea) * 4, r * 0.09, 0, Math.PI * 2); ctx.fill();
            }
        }

        else {

            const promCount = this.enraged ? 6 : 4;
            for (let i = 0; i < promCount; i++) {
                const pa = (i / promCount) * Math.PI * 2 + t * 0.0012;
                const amp = (this.enraged ? 25 : 14) + Math.sin(t * 0.004 + i * 1.8) * 8;
                const d = r * 1.1;
                ctx.strokeStyle = `rgba(255,${160 - i * 15},0,${0.2 + Math.sin(t * 0.005 + i) * 0.1})`;
                ctx.lineWidth = 3 + Math.sin(t * 0.003 + i) * 1;
                ctx.beginPath();
                const sx = Math.cos(pa) * d, sy = Math.sin(pa) * d;
                const ex = Math.cos(pa + 0.7) * d, ey = Math.sin(pa + 0.7) * d;
                const cpx = Math.cos(pa + 0.35) * (d + amp);
                const cpy = Math.sin(pa + 0.35) * (d + amp);
                ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey);
                ctx.stroke();
            }

            const rayN = this.phase >= 2 ? 14 : 9;
            for (let i = 0; i < rayN; i++) {
                const ra = this.rotation + (i / rayN) * Math.PI * 2;
                const len = r * (0.35 + Math.sin(t * 0.007 + i * 0.9) * 0.06) + this.attackWindup * r * 0.1;
                const base = r * 0.82;
                const rg = ctx.createLinearGradient(
                    Math.cos(ra) * base, Math.sin(ra) * base,
                    Math.cos(ra) * (base + len), Math.sin(ra) * (base + len)
                );
                rg.addColorStop(0, `rgba(255,210,60,${0.7 + this.coreEnergy * 0.3})`);
                rg.addColorStop(1, 'rgba(255,80,0,0)');
                ctx.fillStyle = rg;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ra - 0.1) * base, Math.sin(ra - 0.1) * base);
                ctx.lineTo(Math.cos(ra) * (base + len), Math.sin(ra) * (base + len));
                ctx.lineTo(Math.cos(ra + 0.1) * base, Math.sin(ra + 0.1) * base);
                ctx.closePath(); ctx.fill();
            }

            const sg = ctx.createRadialGradient(0, -r * 0.08, 0, 0, 0, r * 0.88);
            sg.addColorStop(0, `rgba(255,255,255,${0.8 + this.coreEnergy * 0.2})`);
            sg.addColorStop(0.12, '#fff8dd');
            sg.addColorStop(0.35, `rgb(255,${Math.floor(200 + this.coreEnergy * 30)},50)`);
            sg.addColorStop(0.65, `rgb(${Math.floor(200 + this.coreEnergy * 30)},${Math.floor(130 + this.coreEnergy * 20)},0)`);
            sg.addColorStop(1, '#553300');
            ctx.fillStyle = sg;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();

            for (let i = 0; i < 3; i++) {
                const sa = t * 0.0003 + i * 2.1;
                const sd = r * (0.25 + i * 0.15);
                ctx.fillStyle = `rgba(180,100,0,${0.1 + Math.sin(t * 0.004 + i) * 0.05})`;
                ctx.beginPath(); ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, r * 0.1 + i * 2, 0, Math.PI * 2); ctx.fill();
            }

            ctx.globalAlpha = 0.06 + Math.sin(t * 0.004) * 0.03;
            ctx.fillStyle = '#ffffcc';
            ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-r * 0.12, r * 0.18, r * 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;

            if (this.phase >= 2) {
                ctx.strokeStyle = `rgba(255,255,200,${0.2 + Math.sin(t * 0.012) * 0.1})`;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.stroke();
            }

            if (this.attackFlash > 0.1) {
                ctx.fillStyle = `rgba(255,255,200,${this.attackFlash * 0.4})`;
                ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 40 * this.attackFlash;
                ctx.beginPath(); ctx.arc(0, 0, r * 0.95 + this.attackFlash * 10, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            }

            if (isResting) {
                ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, 5, 7, 0); ctx.stroke();
            } else {
                const ea = Math.atan2(playerY - cy, playerX - cx);
                ctx.fillStyle = this.enraged ? '#ff0000' : '#442200';
                ctx.beginPath(); ctx.arc(Math.cos(ea) * 4, Math.sin(ea) * 4, r * 0.11, 0, Math.PI * 2); ctx.fill();
            }
        }

        if (this.hitFlash > 0.05) {
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.6})`;
            ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();

        if (this.enraged) {
            ctx.strokeStyle = `rgba(255,20,0,${0.15 + Math.sin(t * 0.018) * 0.25})`;
            ctx.lineWidth = 3; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.arc(cx, cy, r + 24, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            if (this.ambientTimer % 3 === 0) {
                const ea = Math.random() * Math.PI * 2;
                particles.push(new Particle(cx + Math.cos(ea) * r, cy + Math.sin(ea) * r, '#ff4400', 1.5, 2.5, 22));
            }
        }

        if (this.ambientTimer % 8 === 0 && !isResting) {
            const pa = Math.random() * Math.PI * 2;
            const pc = this.bossType === 0 ? '#ff6633' : this.bossType === 1 ? '#aa66ff' : '#ffcc44';
            particles.push(new Particle(
                cx + Math.cos(pa) * r * 0.8, cy + Math.sin(pa) * r * 0.8,
                pc, 1, 1.5, 25
            ));
        }

        if (this.laserCharging) {
            const prog = 1 - this.laserTimer / 1000;
            ctx.save();
            if (this.laserLocked) {
                const pulse = Math.sin(t * 0.06) * 0.5 + 0.5;
                ctx.strokeStyle = `rgba(255,${Math.floor(220 * pulse)},${Math.floor(60 * pulse)},${0.5 + 0.5 * pulse})`;
                ctx.lineWidth = 6 + prog * 12;
                ctx.setLineDash([]);
                ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 25;
            } else {
                ctx.strokeStyle = `rgba(255,60,0,${0.15 + prog * 0.5})`;
                ctx.lineWidth = 2 + prog * 6;
                ctx.setLineDash([22 - prog * 18, 8]);
            }
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(this.laserAngle) * 1500, cy + Math.sin(this.laserAngle) * 1500);
            ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;

            if (prog > 0.25) {
                ctx.globalAlpha = (prog - 0.25) * 1.3;
                ctx.strokeStyle = 'rgba(255,200,100,0.25)'; ctx.lineWidth = 1;
                for (let i = -1; i <= 1; i += 2) {
                    const off = (1 - prog) * 90 * i;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(this.laserAngle + Math.PI / 2) * off, cy + Math.sin(this.laserAngle + Math.PI / 2) * off);
                    ctx.lineTo(cx + Math.cos(this.laserAngle) * 250, cy + Math.sin(this.laserAngle) * 250);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        }

        if (this.laserFiring) {
            const bw = 28 + Math.sin(t * 0.06) * 8;
            const lx = cx + Math.cos(this.laserAngle) * 1500;
            const ly = cy + Math.sin(this.laserAngle) * 1500;
            ctx.save();
            ctx.strokeStyle = 'rgba(255,80,30,0.2)'; ctx.lineWidth = bw * 3.5;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,40,0,0.65)'; ctx.lineWidth = bw * 1.6;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,230,200,0.85)'; ctx.lineWidth = bw * 0.4;
            ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 35;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.shadowBlur = 0; ctx.restore();
        }

        this.mines.forEach(m => {
            const danger = m.timer < 1000;
            const pulse = Math.sin(m.pulse * (danger ? 6 : 2)) * 0.3 + 0.7;
            const mr = m.homing ? 16 : 12;
            ctx.save(); ctx.translate(m.x, m.y);
            const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, mr);
            mg.addColorStop(0, danger ? `rgba(255,120,50,${pulse})` : '#fff');
            mg.addColorStop(0.5, danger ? `rgba(255,30,0,${pulse * 0.7})` : m.color);
            mg.addColorStop(1, 'rgba(0,0,0,0.2)');
            ctx.fillStyle = mg;
            ctx.beginPath(); ctx.arc(0, 0, mr, 0, Math.PI * 2); ctx.fill();
            const tr = m.timer / 5000;
            ctx.strokeStyle = danger ? `rgba(255,0,0,${pulse})` : 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, mr + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * tr); ctx.stroke();
            ctx.restore();
        });

        if (isResting && this.ambientTimer % 30 === 0) {
            particles.push(new Particle(cx + r * 0.5, cy - r * 0.5, '#aaffaa', 1, 1.5, 50));
        }

        ctx.restore();
        this.drawHealthBar();

        ctx.save();
        ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 10;
        ctx.fillText(this.displayName, cx, this.y - 14);
        ctx.shadowBlur = 0; ctx.restore();
    }

    drawHealthBar() {
        const barWidth = Math.min(320, W - 80);
        const barX = (W - barWidth) / 2;
        const barY = 18;
        const barH = 14;

        ctx.save();

        ctx.fillStyle = 'rgba(20, 20, 30, 0.85)';
        ctx.beginPath();
        ctx.roundRect(barX - 2, barY - 2, barWidth + 4, barH + 4, 5);
        ctx.fill();

        const hpPct = Math.max(0, this.hp / this.maxHp);
        const hpGrad = ctx.createLinearGradient(barX, 0, barX + barWidth * hpPct, 0);
        if (this.enraged) {
            hpGrad.addColorStop(0, '#ff2200');
            hpGrad.addColorStop(1, '#ff6600');
        } else {
            hpGrad.addColorStop(0, this.color);
            hpGrad.addColorStop(0.5, this.color + 'cc');
            hpGrad.addColorStop(1, this.color);
        }
        ctx.fillStyle = hpGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * hpPct, barH, 3);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * hpPct, barH / 2, [3, 3, 0, 0]);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(barX - 1, barY - 1, barWidth + 2, barH + 2, 4);
        ctx.stroke();

        const markers = [0.6, 0.3];
        markers.forEach(p => {
            const mx = barX + barWidth * p;
            ctx.fillStyle = hpPct <= p ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.moveTo(mx, barY - 3);
            ctx.lineTo(mx + 4, barY + barH / 2);
            ctx.lineTo(mx, barY + barH + 3);
            ctx.lineTo(mx - 4, barY + barH / 2);
            ctx.closePath();
            ctx.fill();
        });

        ctx.restore();
    }

    useSkill() {
        if (this.bossType === 2 && this.phase >= 2 && Math.random() < 0.25) {
            this.telegraphTeleport();
            return;
        }

        const attack = this.attackPool[Math.floor(Math.random() * this.attackPool.length)];
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;
        const baseAngle = Math.atan2(py - cy, px - cx);

        if (attack === 'machineGun') {
            this.machineGunMaxShots = 10 + this.phase * 5;
            this.machineGunShotsFired = 0;
            this.machineGunTimer = 0;
            this.machineGunActive = true;
        } else if (attack === 'shotgunBlast') {
            const waves = this.phase;
            for (let w = 0; w < waves; w++) {
                for (let i = -3; i <= 3; i++) {
                    scheduledBullets.push({
                        x: cx, y: cy, angle: baseAngle + i * 0.15,
                        delay: w * 400, color: '#ff0000', damage: this.getDamage(15)
                    });
                }
            }
        } else if (attack === 'charge') {
            this.preChargeTimer = 90;
            this.chargeProgress = 0;
            this.chargeCount = this.phase;
            this.chargeDirection = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
            this.chargeTrail = [];
        } else if (attack === 'novaRing') {
            const count = 20 + this.phase * 4;
            const gap = Math.floor(Math.random() * count);
            for (let i = 0; i < count; i++) {
                if (i === gap || i === (gap + 1) % count || i === (gap - 1 + count) % count) continue;
                scheduledBullets.push({
                    x: cx, y: cy, angle: (2 * Math.PI * i / count),
                    delay: 0, color: '#ffaaaa', damage: this.getDamage(12)
                });
            }
        } else if (attack === 'crossBurst') {
            const waves = this.phase === 3 ? 3 : 2;
            for (let ring = 0; ring < waves; ring++) {
                for (let arm = 0; arm < 4; arm++) {
                    for (let i = 0; i < 4; i++) {
                        scheduledBullets.push({
                            x: cx, y: cy,
                            angle: baseAngle + (arm * Math.PI / 2) + (ring * 0.2),
                            delay: ring * 300 + i * 30,
                            color: '#ff8800', damage: this.getDamage(10)
                        });
                    }
                }
            }
        } else if (attack === 'minionSwarm') {
            const count = 2 + this.phase;
            for (let i = 0; i < count; i++) {
                const ang = (i / count) * Math.PI * 2;
                const ex = cx + Math.cos(ang) * 120;
                const ey = cy + Math.sin(ang) * 120;

                const minion = new Enemy('small', true);
                minion.x = ex; minion.y = ey;
                minion.maxHp = 400 + (this.phase * 150);
                minion.hp = minion.maxHp;
                minion.isMinion = true;

                enemies.push(minion);

                for (let j = 0; j < 15; j++) {
                    particles.push(new Particle(ex, ey, '#9933ff', 2, 4, 30));
                }
            }
        } else if (attack === 'lotusSpiral') {
            const count = 15 + this.phase * 10;
            for (let i = 0; i < count; i++) {
                const a = (2 * Math.PI * i / count * 2);
                scheduledBullets.push({
                    x: cx, y: cy, angle: a, delay: i * 40,
                    color: '#ff88ff', damage: this.getDamage(10)
                });
            }
        } else if (attack === 'homingOrbs') {
            const count = this.phase === 3 ? 4 : 2;
            for (let i = 0; i < count; i++) {
                this.mines.push({
                    x: cx + (Math.random() - 0.5) * 100, y: cy + (Math.random() - 0.5) * 100,
                    timer: 4000, pulse: 0, homing: true, color: '#aa00ff'
                });
            }
        } else if (attack === 'flowerPetals') {
            const count = 10 + this.phase * 10;
            for (let i = 0; i < count; i++) {
                scheduledBullets.push({
                    x: Math.random() * W, y: -20,
                    angle: Math.PI / 2 + (Math.random() - 0.5) * 0.2,
                    delay: i * 60, color: '#f0f', damage: this.getDamage(12)
                });
            }
        } else if (attack === 'waveAttack') {
            const count = 5 + this.phase * 2;
            const waves = this.phase >= 2 ? 2 : 1;
            for (let w = 0; w < waves; w++) {
                for (let i = -count; i <= count; i++) {
                    const a = baseAngle + i * 0.1;
                    scheduledBullets.push({
                        x: cx, y: cy, angle: a,
                        delay: Math.abs(i) * 50 + w * 400,
                        color: '#0ff', damage: this.getDamage(10)
                    });
                }
            }
        }

        else if (attack === 'strategicMines') {
            const count = 3 + this.phase * 2;
            for (let i = 0; i < count; i++) {
                this.mines.push({
                    x: Math.max(50, Math.min(W - 50, px + (Math.random() - 0.5) * 400)),
                    y: Math.max(50, Math.min(H - 50, py + (Math.random() - 0.5) * 400)),
                    timer: 5000, pulse: 0, homing: false, color: '#ffcc00'
                });
            }
        } else if (attack === 'deathRay') {
            this.laserCharging = true;
            this.laserAngle = baseAngle;
            this.laserTimer = 1000 - this.phase * 150;
            this.laserSweep = true;
            this.laserSweepDir = Math.random() < 0.5 ? 1 : -1;
        } else if (attack === 'gridLock') {
            const lines = this.phase >= 2 ? 2 : 1;
            for (let l = -lines; l <= lines; l++) {
                const offY = l * 120;
                const offX = l * 150;
                for (let i = 0; i < 10; i++) {
                    scheduledBullets.push({ x: cx, y: cy + offY, angle: 0, delay: i * 40, color: '#ffea00', damage: 12 });
                    scheduledBullets.push({ x: cx, y: cy + offY, angle: Math.PI, delay: i * 40, color: '#ffea00', damage: 12 });
                    scheduledBullets.push({ x: cx + offX, y: cy, angle: Math.PI / 2, delay: i * 40, color: '#ffcc00', damage: 12 });
                    scheduledBullets.push({ x: cx + offX, y: cy, angle: -Math.PI / 2, delay: i * 40, color: '#ffcc00', damage: 12 });
                }
            }
        } else if (attack === 'sniperShot') {
            this.sniperMaxShots = 1 + this.phase;
            this.sniperShotsFired = 0;
            this.sniperTimer = 300;
            this.sniperActive = true;
        } else if (attack === 'matrixRings') {
            const rings = this.phase;
            for (let r = 0; r < rings; r++) {
                const count = 16 + this.phase * 4;
                const safeGap = Math.floor(Math.random() * count);
                for (let i = 0; i < count; i++) {
                    if (i === safeGap || i === (safeGap + 1) % count || i === (safeGap - 1 + count) % count) continue;
                    scheduledBullets.push({
                        x: cx, y: cy, angle: (2 * Math.PI * i / count),
                        delay: r * 600, color: '#ffff00', damage: 10
                    });
                }
            }
        }
    }

    telegraphTeleport() {
        this.teleporting = true;
        this.teleportTimer = 500;

        let tx = playerX + (Math.random() < 0.5 ? -300 : 300);
        let ty = playerY + (Math.random() < 0.5 ? -300 : 300);

        tx = Math.max(this.w, Math.min(W - this.w, tx));
        ty = Math.max(this.h, Math.min(H - this.h, ty));

        this.teleportTarget = { x: tx, y: ty };

        for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * Math.PI * 2;
            particles.push(new Particle(
                this.x + this.w / 2 + Math.cos(ang) * 40,
                this.y + this.h / 2 + Math.sin(ang) * 40,
                '#ff0', 2, 4, 15
            ));
        }
    }

    finalExplosion() {
        for (let i = 0; i < 120; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * 120;
            const colors = ['#ff0', '#f80', '#f00', '#fff', this.color];
            particles.push(new Particle(
                this.x + this.w / 2 + Math.cos(ang) * dist,
                this.y + this.h / 2 + Math.sin(ang) * dist,
                colors[Math.floor(Math.random() * colors.length)],
                3 + Math.random() * 5, 10, 60
            ));
        }
        screenShake = 35;
        const bossReward = 60 + Math.floor(wave / 5) * 30;
        playerMoney += bossReward;

        if (typeof onBossDefeated === 'function') onBossDefeated();
        if (typeof onMoneyEarned === 'function') onMoneyEarned(bossReward);
    }

    hit(dmg) {
        if (this.dying || this.entering) return;

        if (this.shieldActive) {
            dmg = Math.floor(dmg * 0.2);
        } else if (this.state === 'RESTING') {
            dmg = Math.floor(dmg * 1.5);
            particles.push(new Particle(this.x + Math.random() * this.w, this.y + Math.random() * this.h, '#00ff88', 2, 4, 15));
        }

        super.hit(dmg);
        this.glowIntensity = 0.5;
        this.hitFlash = 1;

        if (this.hp <= 0 && !this.dying) {
            this.dying = true;
            this.deathTimer = 0;
        }
    }
}

let scheduledBullets = [];
let healthPickup = null;
function spawnHealthPickup() { healthPickup = { x: Math.random() * (W - 20), y: Math.random() * (H - 20) }; }
function drawHealthPickup() {
    if (!healthPickup) return;
    const hx = healthPickup.x + 10, hy = healthPickup.y + 10;
    const t = Date.now();
    const pulse = 0.85 + Math.sin(t * 0.005) * 0.15;

    ctx.save();
    ctx.globalAlpha = 0.08 + Math.sin(t * 0.004) * 0.04;
    ctx.fillStyle = '#00ff66';
    ctx.beginPath(); ctx.arc(hx, hy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(100,255,150,0.25)';
    ctx.lineWidth = 1.5;
    for (let band = 0; band < 2; band++) {
        ctx.beginPath();
        for (let s = 0; s <= 20; s++) {
            const angle = (s / 20) * Math.PI * 2 + t * 0.004 + band * Math.PI;
            const rx = Math.cos(angle) * 14;
            const ry = (s / 20 - 0.5) * 24;
            if (s === 0) ctx.moveTo(hx + rx, hy + ry);
            else ctx.lineTo(hx + rx, hy + ry);
        }
        ctx.stroke();
    }

    const capGrad = ctx.createRadialGradient(hx - 2, hy - 2, 0, hx, hy, 10);
    capGrad.addColorStop(0, '#ccffcc');
    capGrad.addColorStop(0.3, '#55dd66');
    capGrad.addColorStop(0.7, '#228833');
    capGrad.addColorStop(1, '#115522');
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.roundRect(hx - 8 * pulse, hy - 10 * pulse, 16 * pulse, 20 * pulse, 5 * pulse);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,255,150,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(hx - 8 * pulse, hy - 10 * pulse, 16 * pulse, 20 * pulse, 5 * pulse);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#44ff88'; ctx.shadowBlur = 6;
    ctx.fillRect(hx - 4, hy - 1.5, 8, 3);
    ctx.fillRect(hx - 1.5, hy - 4, 3, 8);
    ctx.shadowBlur = 0;

    if (Math.random() < 0.15) {
        const sa = Math.random() * Math.PI * 2;
        const sr = 8 + Math.random() * 10;
        particles.push(new Particle(
            hx + Math.cos(sa) * sr, hy + Math.sin(sa) * sr,
            '#88ffaa', 0.8, 1.5, 12
        ));
    }
}
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 == 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projx = x1 + t * dx, projy = y1 + t * dy;
    return Math.sqrt((px - projx) ** 2 + (py - projy) ** 2);
}
