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
        this.deathState = 0;

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
        this.entryTimer = 0;
        this.entryState = 0;
        this.entryY = -150;
        this.y = -150;

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

        this.displayHp = this.hp;
        this.eyeOpenness = 1.0;

        this.restProgress = 0;
        this.currentPhaseLevel = 0;
        this.hpDrops = [];
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
            updateBossEntry(this);
            return;
        }

        if (this.dying) {
            updateBossDeath(this);
            return;
        }

        const wasHp = this.displayHp;
        this.displayHp += (this.hp - this.displayHp) * 0.05; // Smooth HP drop catch-up
        this.eyeOpenness += ((this.state === 'RESTING' ? 0 : 1) - this.eyeOpenness) * 0.15; // Smooth eye blink
        this.restProgress += ((this.state === 'RESTING' ? 1 : 0) - this.restProgress) * 0.03; // Smooth retract

        const targetPhaseLevel = Math.max(0, this.phase - 1);
        this.currentPhaseLevel += (targetPhaseLevel - this.currentPhaseLevel) * 0.005; // Slower physical transformation

        // HP bar drop particles (Bleeding effect) - sync with white hit flash duration
        if (this.hitFlash > 0.1 && wasHp - this.hp > 1 && Math.random() < 0.6) {
            const barWidth = Math.min(320, W - 80);
            const barX = (W - barWidth) / 2;
            const barY = 18;
            const displayPct = Math.max(0, this.displayHp / this.maxHp);
            const px = barX + barWidth * displayPct - Math.random() * 5;
            this.hpDrops.push({
                x: px, y: barY + 14,
                vx: (Math.random() - 0.5) * 0.5, vy: 0,
                life: 10 + Math.random() * 10, maxLife: 15,
                color: this.color,
                size: 1.5 + Math.random() * 1.5
            });
        }

        // Update bleeding particles
        if (this.hpDrops.length > 0) {
            this.hpDrops = this.hpDrops.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15; // Gravity
                p.vx *= 0.95; // Horizontal friction
                p.life--;
                return p.life > 0;
            });
        }

        this.breathe += 0.03;
        this.ambientTimer++;
        bossAmbientParticles(this);
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

            bossPhaseTransitionEffect(this, newPhase);

            if (this.phase === 3 && !this.enraged) {
                this.enraged = true;
            }
        }

        if (this.transitioning) {
            this.transitionTimer--;
            if (this.transitionTimer <= 0) this.transitioning = false;
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

        const d = Math.sqrt((px - cx) ** 2 + (cy - py) ** 2);
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
        drawBoss(this, ctx);
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
        const displayPct = Math.max(0, this.displayHp / this.maxHp);

        // Catch-up background bar (White/Red)
        ctx.fillStyle = this.hitFlash > 0.1 ? '#ffffff' : '#cc0000';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * displayPct, barH, 3);
        ctx.fill();

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

        // Draw bleeding particles
        if (this.hpDrops.length > 0) {
            this.hpDrops.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                ctx.fillRect(p.x - p.size / 2, p.y, p.size, p.size * 2);
            });
            ctx.globalAlpha = 1;
        }

        ctx.restore();
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
            this.hp = 1; // Keep alive for death cinematic
            this.dying = true;
            this.deathTimer = 0;
            this.deathState = 0;
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