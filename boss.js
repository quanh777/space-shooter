class Boss extends Enemy {
    constructor() {
        super('boss');

        const bossNumber = Math.floor(wave / 5);
        const difficultyMultiplier = bossNumber === 1 ? 1 : (1 + (bossNumber - 1) * 0.3);

        this.damageMultiplier = 1 + (bossNumber - 1) * 0.2;

        this.bossType = Math.floor(Math.random() * 3);

        const baseHp = bossNumber === 1 ? (1750 + Math.random() * 200) : (2500 + Math.random() * 300);
        this.hp = Math.floor(baseHp * difficultyMultiplier);
        this.maxHp = this.hp;

        this.spd = 0.9 + bossNumber * 0.1;

        // FSM AI
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
        this.rageThreshold = 0.3; // Phase 3

        this.isCharging = false;
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
    }

    getDamage(baseDamage) {
        return Math.floor(baseDamage * this.damageMultiplier);
    }

    generateRandomAttackPool() {
        const typePools = [
            ['machineGun', 'shotgunBlast', 'charge', 'novaRing', 'crossBurst'],       // DESTROYER
            ['minionSwarm', 'lotusSpiral', 'homingOrbs', 'flowerPetals', 'waveAttack'], // SUMMONER
            ['strategicMines', 'deathRay', 'gridLock', 'sniperShot', 'matrixRings']      // OVERLORD
        ];

        const available = [...typePools[this.bossType]];
        const selected = [];

        // Pick 3 random skills dynamically per Boss
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

        // Phase Transitions
        const hpPct = this.hp / this.maxHp;
        const newPhase = hpPct <= this.rageThreshold ? 3 : (hpPct <= 0.6 ? 2 : 1);

        if (newPhase !== this.phase && !this.transitioning) {
            this.transitioning = true;
            this.transitionTimer = 60;
            this.phase = newPhase;
            this.maxConsecutiveAttacks = 2 + this.phase; // Phase 1: 3, Ph2: 4, Ph3: 5
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

        if (this.isCharging) {
            this.chargeProgress++;
            if (this.chargeProgress <= 35) {
                const moveX = this.chargeDirection.x * 15;
                const moveY = this.chargeDirection.y * 15;
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
                }

            } else {
                this.chargeCount--;
                if (this.chargeCount > 0) {
                    this.chargeProgress = 0;
                    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
                    const px = playerX + PW / 2, py = playerY + PH / 2;
                    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) || 1;
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

        // Smart Move logic
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

        // --- FINITE STATE MACHINE (COMBOS & RESTS) ---
        if (this.state === 'IDLE') {
            this.attackCooldownTimer -= 16;
            if (this.attackCooldownTimer <= 0 && !this.shieldActive) {
                if (this.consecutiveAttacks < this.maxConsecutiveAttacks) {
                    this.state = 'ATTACKING';
                    this.useSkill();
                    this.consecutiveAttacks++;
                } else {
                    // Finished N attacks. Wait for total clear then sleep.
                    this.state = 'WAITING_CLEAR_REST';
                }
            }
        } else if (this.state === 'ATTACKING') {
            // Wait until any active channeling is completely finished
            if (!this.laserCharging && !this.laserFiring && !this.isCharging && !this.teleporting && !this.clonesActive) {
                this.state = 'WAITING_CLEAR_SKILL';
            }
        } else if (this.state === 'WAITING_CLEAR_SKILL') {
            // Wait for bullets/minions strictly before firing the NEXT skill in the combo
            if (this.isScreenClear()) {
                this.state = 'IDLE';
                // 800ms -> 600ms -> 400ms delay between combo attacks
                this.attackCooldownTimer = Math.max(200, 1000 - (this.phase * 200));
            }
        } else if (this.state === 'WAITING_CLEAR_REST') {
            if (this.isScreenClear()) {
                this.state = 'RESTING';
                this.restTimer = 2000 + Math.random() * 2000; // Sleep 2 to 4 seconds
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
        if (this.state === 'RESTING') finalSpd *= 0.35; // Slow down during rest

        if (this.bossType === 0) {
            // DESTROYER: Aggressive but keeps a respectful distance after skills
            const dx = px - cx, dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (this.phase === 1) {
                if (d > 100) {
                    this.x += (dx / d) * finalSpd;
                    this.y += (dy / d) * finalSpd;
                }
            } else if (this.phase === 2) {
                const t = Date.now() / 1000;
                if (Math.sin(t * 2) > 0.7) {
                    this.x += (dx / d) * finalSpd * 3.5;
                    this.y += (dy / d) * finalSpd * 3.5;
                } else if (d > 80) {
                    this.x += (dx / d) * finalSpd * 1.5;
                    this.y += (dy / d) * finalSpd * 1.5;
                }
            } else {
                this.x += (dx / d) * finalSpd * 1.8 + Math.sin(Date.now() / 80) * finalSpd * 2;
                this.y += (dy / d) * finalSpd * 1.8 + Math.cos(Date.now() / 60) * finalSpd * 1.5;
            }

            // Anti-Hug logic
            if (d < 150 && !this.isCharging && this.state !== 'RESTING') {
                this.x -= (dx / d) * finalSpd * 1.5;
                this.y -= (dy / d) * finalSpd * 1.5;
            }

        } else if (this.bossType === 1) {
            // SUMMONER: Constantly evades to ideal distance ring
            const dx = px - cx, dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = 200 + Math.sin(Date.now() / 2000) * 80;

            if (d < idealDist - 40) {
                this.x -= (dx / d) * finalSpd * 1.5;
                this.y -= (dy / d) * finalSpd * 1.5;
            } else if (d > idealDist + 40) {
                this.x += (dx / d) * finalSpd;
                this.y += (dy / d) * finalSpd;
            } else {
                const perpX = -dy / d, perpY = dx / d;
                this.x += perpX * finalSpd * (this.phase >= 2 ? 1.5 : 1);
                this.y += perpY * finalSpd * (this.phase >= 2 ? 1.5 : 1);
            }
        } else {
            // OVERLORD: Figure 8 and stays opposite to player Y
            if (!this.teleporting) {
                const t = Date.now() / 2500;
                let targetX = W / 2 + Math.sin(t) * (W * 0.38);
                let targetY = H / 4 + Math.sin(t * 2) * (H * 0.2);

                if (py < H / 2) {
                    targetY = H * 0.75 + Math.sin(t * 2) * (H * 0.2);
                }

                const dx = targetX - cx, dy = targetY - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 10) {
                    this.x += (dx / d) * finalSpd * 1.4;
                    this.y += (dy / d) * finalSpd * 1.4;
                }
            }
        }

        this.x = Math.max(10, Math.min(W - this.w - 10, this.x));
        this.y = Math.max(10, Math.min(H - this.h - 10, this.y));
    }

    updateLaser() {
        if (this.laserCharging) {
            this.laserTimer -= 16;
            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const targetAngle = Math.atan2(playerY + PH / 2 - cy, playerX + PW / 2 - cx);
            this.laserAngle += (targetAngle - this.laserAngle) * 0.08;

            if (this.laserTimer <= 0) {
                this.laserCharging = false;
                this.laserFiring = true;
                this.laserTimer = this.laserSweep ? 2500 : 800;
                screenShake = 18;
            }
        }

        if (this.laserFiring) {
            this.laserTimer -= 16;

            if (this.laserSweep) {
                this.laserAngle += this.laserSweepSpeed * this.laserSweepDir;
            }

            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const lx = cx + Math.cos(this.laserAngle) * 1500;
            const ly = cy + Math.sin(this.laserAngle) * 1500;
            const px = playerX + PW / 2, py = playerY + PH / 2;

            if (!invincible) {
                const d = distToSegment(px, py, cx, cy, lx, ly);
                if (d < 35) {
                    playerHealth -= this.getDamage(15);
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
                    playerHealth -= 30;
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

        this.chargeTrail.forEach(t => {
            ctx.globalAlpha = t.life / 20 * 0.6;
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.arc(t.x, t.y, 15 * (t.life / 20), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        if (this.shieldActive) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.3;
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        const glowSize = 20 + this.pulse + (this.enraged ? 10 : 0) + this.glowIntensity * 30;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.w / 2 + glowSize);

        let glowColor = this.color + '80';
        if (this.state === 'RESTING') {
            glowColor = '#00ff8880';
        }

        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, this.w / 2 + glowSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.state === 'RESTING' ? '#00ff88' : this.colors[this.bossType];
        ctx.lineWidth = 3;

        if (this.clonesActive && this.cloneTimer > 0) {
            ctx.globalAlpha = 0.6;
            this.clonePositions.forEach(pos => {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            ctx.restore();
            return;
        }

        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const ang = this.rotation + (i / 8) * Math.PI * 2;
            const r1 = this.w / 2 + 5;
            const r2 = this.w / 2 + 15;
            ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
            ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
        }
        ctx.stroke();

        if (this.bossType === 0) {
            ctx.fillStyle = '#880000';
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const ang = this.rotation + (i / 6) * Math.PI * 2;
                const r = this.w / 2;
                const spike = i % 2 === 0 ? 12 : 0;
                ctx.lineTo(cx + Math.cos(ang) * (r + spike), cy + Math.sin(ang) * (r + spike));
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ff4444';
            ctx.stroke();
        } else if (this.bossType === 1) {
            ctx.fillStyle = '#440066';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const ang = this.rotation + (i / 4) * Math.PI * 2;
                ctx.lineTo(cx + Math.cos(ang) * this.w / 2, cy + Math.sin(ang) * this.w / 2);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#cc66ff';
            ctx.stroke();
        } else {
            ctx.fillStyle = '#886600';
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 - 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, this.w * 0.15, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === 'RESTING') {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - 10, cy);
            ctx.quadraticCurveTo(cx, cy + 8, cx + 10, cy);
            ctx.stroke();

            if (Math.random() < 0.05) {
                particles.push(new Particle(this.x + this.w, this.y, '#fff', 1, 2, 40));
            }
        } else {
            const eyeAng = Math.atan2(playerY - cy, playerX - cx);
            ctx.fillStyle = this.enraged ? '#f00' : '#000';
            ctx.beginPath();
            ctx.arc(cx + Math.cos(eyeAng) * 5, cy + Math.sin(eyeAng) * 5, this.w * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.enraged) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() * 0.015) * 0.4})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 20, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.laserCharging) {
            const prog = 1 - this.laserTimer / 1000;
            ctx.strokeStyle = `rgba(255, 0, 0, ${Math.max(0, prog)})`;
            ctx.lineWidth = 2 + prog * 6;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(this.laserAngle) * 900, cy + Math.sin(this.laserAngle) * 900);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (this.laserFiring) {
            const beamWidth = 30 + Math.sin(Date.now() * 0.05) * 10;
            const lx = cx + Math.cos(this.laserAngle) * 1500;
            const ly = cy + Math.sin(this.laserAngle) * 1500;

            ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
            ctx.lineWidth = beamWidth * 2.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(lx, ly);
            ctx.stroke();

            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = beamWidth;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(lx, ly);
            ctx.stroke();
        }

        this.mines.forEach(m => {
            const danger = m.timer < 1000;
            const pulse = Math.sin(m.pulse * (danger ? 6 : 2)) * 0.3 + 0.7;
            ctx.fillStyle = danger ? `rgba(255, 50, 50, ${pulse})` : m.color;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.homing ? 18 : 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        ctx.restore();
        this.drawHealthBar();

        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.displayName, cx, this.y - 20);
        ctx.textAlign = 'left';
    }

    drawHealthBar() {
        const barWidth = Math.min(300, W - 100);
        const barX = (W - barWidth) / 2;
        const barY = 20;
        const barH = 12;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barH);

        const hpPct = Math.max(0, this.hp / this.maxHp);
        const hpColor = this.enraged ? '#ff0000' :
            `rgb(${Math.floor(255 * (1 - hpPct))}, ${Math.floor(255 * hpPct)}, 0)`;
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, hpPct * barWidth, barH);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barH);
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

        // --- DESTROYER SKILLS (Red/Aggressive) ---
        if (attack === 'machineGun') {
            const count = 10 + this.phase * 5;
            for (let i = 0; i < count; i++) {
                scheduledBullets.push({
                    x: cx, y: cy,
                    angle: baseAngle + (Math.random() - 0.5) * 0.3,
                    delay: i * 80, color: '#ff3333', damage: this.getDamage(10)
                });
            }
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
            this.isCharging = true;
            this.chargeProgress = 0;
            this.chargeCount = this.phase;
            this.chargeDirection = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
            this.chargeTrail = [];
            screenShake = 12;
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
        }

        // --- SUMMONER SKILLS (Purple/Space Control) ---
        else if (attack === 'minionSwarm') {
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
                if (typeof enemies !== 'undefined') enemies.push(minion);

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

        // --- OVERLORD SKILLS (Gold/Grid Control) ---
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
            screenShake = 10;
            const count = this.phase === 3 ? 3 : (this.phase === 2 ? 2 : 1);
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (this.hp <= 0) return;
                    const napAngle = Math.atan2(playerY + PH / 2 - cy, playerX + PW / 2 - cx);
                    let b = new Bullet(cx, cy, napAngle, false, '#ffffff', this.getDamage(25));
                    b.spd = 12 + this.phase * 2;
                    b.isEnemy = true;
                    if (typeof bullets !== 'undefined') bullets.push(b);
                    screenShake = 15;
                }, 600 + i * 500);
            }
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
        this.teleportTarget = {
            x: Math.max(this.w, Math.min(W - this.w, playerX + (Math.random() - 0.5) * 500)),
            y: Math.max(this.h, Math.min(H - this.h, playerY + (Math.random() - 0.5) * 500))
        };
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
    const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 1.0;
    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(healthPickup.x + 10, healthPickup.y + 10, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(healthPickup.x + 10, healthPickup.y + 5);
    ctx.bezierCurveTo(healthPickup.x + 10, healthPickup.y + 3, healthPickup.x + 7.5, healthPickup.y, healthPickup.x + 5, healthPickup.y + 3);
    ctx.bezierCurveTo(healthPickup.x + 2.5, healthPickup.y, healthPickup.x, healthPickup.y + 3, healthPickup.x, healthPickup.y + 5);
    ctx.bezierCurveTo(healthPickup.x, healthPickup.y + 7.5, healthPickup.x, healthPickup.y + 10, healthPickup.x + 10, healthPickup.y + 17.5);
    ctx.bezierCurveTo(healthPickup.x + 20, healthPickup.y + 10, healthPickup.x + 20, healthPickup.y + 7.5, healthPickup.x + 20, healthPickup.y + 5);
    ctx.bezierCurveTo(healthPickup.x + 20, healthPickup.y + 3, healthPickup.x + 17.5, healthPickup.y, healthPickup.x + 15, healthPickup.y + 3);
    ctx.bezierCurveTo(healthPickup.x + 12.5, healthPickup.y, healthPickup.x + 10, healthPickup.y + 3, healthPickup.x + 10, healthPickup.y + 5);
    ctx.fill();
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
