class Boss extends Enemy {
    constructor() {
        super('boss');

        const bossNumber = Math.floor(wave / 5);
        const difficultyMultiplier = 1 + bossNumber * 0.5;

        this.bossType = Math.floor(Math.random() * 3);

        const baseHp = 300 + Math.random() * 200;
        this.hp = Math.floor(baseHp * difficultyMultiplier);
        this.maxHp = this.hp;
        this.spd = (0.8 + Math.random() * 0.4) * (1 + bossNumber * 0.15);

        const baseCooldown = 2000 + Math.random() * 1000;
        this.attackCooldown = Math.max(600, baseCooldown - bossNumber * 350);
        this.lastAttack = 0;
        this.phase = 1;

        this.w = 70 + bossNumber * 12 + Math.random() * 20;
        this.h = this.w;
        this.rotation = 0;
        this.glowIntensity = 0;

        this.attackPool = this.generateRandomAttackPool();

        this.laserCharging = false;
        this.laserFiring = false;
        this.laserAngle = 0;
        this.laserSweep = false;
        this.laserTimer = 0;
        this.laserChargeTime = Math.max(500, 1000 - bossNumber * 100);
        this.laserFireTime = 2500 + bossNumber * 400;
        this.laserSweepSpeed = 0.025 + bossNumber * 0.005;

        this.lastSummon = 0;
        this.summonCount = 3 + Math.floor(bossNumber * 0.7);

        this.dying = false;
        this.deathTimer = 0;

        this.transitioning = false;
        this.transitionTimer = 0;

        this.canTeleport = Math.random() < 0.35 + bossNumber * 0.12;
        this.teleporting = false;
        this.teleportTimer = 0;
        this.teleportTarget = null;

        this.mines = [];
        this.mineCount = 4 + Math.floor(bossNumber * 0.8);

        this.enraged = false;
        this.rageThreshold = 0.35 + Math.random() * 0.1;

        this.isCharging = false;
        this.chargeDirection = { x: 0, y: 0 };
        this.chargeProgress = 0;
        this.chargeTrail = [];

        this.entering = true;
        this.entryY = -100;
        this.y = -100;

        this.names = ['DESTROYER', 'SUMMONER', 'OVERLORD', 'CHAOS LORD', 'NIGHTMARE'];
        this.colors = ['#ff3333', '#9933ff', '#ffcc00', '#00ffff', '#ff6600'];

        const suffixes = ['', ' MK-' + (bossNumber + 1), ' PRIME', ' OMEGA', ' REDUX'];
        this.displayName = this.names[this.bossType] + (bossNumber > 0 ? suffixes[Math.min(bossNumber, 4)] : '');
        this.color = this.colors[this.bossType];

        this.bulletHellAngle = 0;
        this.shieldActive = false;
        this.shieldTimer = 0;
    }

    generateRandomAttackPool() {
        const allAttacks = ['burst', 'spiral', 'wave', 'shotgun', 'charge', 'summon', 'omniBurst', 'mines', 'laser', 'bulletHell'];
        const pool = [];

        if (this.bossType === 0) {
            pool.push('burst', 'shotgun', 'charge');
        } else if (this.bossType === 1) {
            pool.push('summon', 'wave', 'spiral');
        } else {
            pool.push('laser', 'omniBurst', 'mines');
        }

        const extraCount = 2 + Math.floor(Math.random() * 2);
        const available = allAttacks.filter(a => !pool.includes(a));
        for (let i = 0; i < extraCount && available.length > 0; i++) {
            const idx = Math.floor(Math.random() * available.length);
            pool.push(available.splice(idx, 1)[0]);
        }

        return pool;
    }

    update() {
        const now = Date.now();

        if (this.entering) {
            this.entryY += 2;
            this.y = this.entryY;
            if (this.y >= 50) {
                this.entering = false;
                this.y = 50;
                screenShake = 20;
                for (let i = 0; i < 50; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(
                        this.x + this.w / 2 + Math.cos(ang) * 50,
                        this.y + this.h / 2 + Math.sin(ang) * 50,
                        this.colors[this.bossType], 3, 6, 40
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

        const hpPct = this.hp / this.maxHp;
        const newPhase = hpPct <= this.rageThreshold ? 3 : (hpPct <= 0.6 ? 2 : 1);

        if (newPhase !== this.phase && !this.transitioning) {
            this.transitioning = true;
            this.transitionTimer = 60;
            this.phase = newPhase;
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
                this.attackCooldown *= 0.4;
                this.spd *= 1.9;
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
                const moveX = this.chargeDirection.x * 12;
                const moveY = this.chargeDirection.y * 12;
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

                if (Math.random() < 0.5) {
                    particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, '#f00', 2, 5, 20));
                }
            } else {
                this.isCharging = false;
                this.chargeProgress = 0;
            }
        }

        this.chargeTrail = this.chargeTrail.filter(t => {
            t.life--;
            return t.life > 0;
        });

        if (!this.isCharging) {
            this.moveByType();
        }

        this.rotation += this.enraged ? 0.06 : 0.02;
        this.anim += 0.1;
        this.pulse += 0.15 * this.pdir;
        if (this.pulse > 6) this.pdir = -1;
        else if (this.pulse < 0) this.pdir = 1;
        if (this.flash > 0) this.flash -= 0.05;
        this.glowIntensity = Math.max(0, this.glowIntensity - 0.02);

        this.updateLaser();
        this.updateMines();
        this.updateTeleport();

        if (now - this.lastAttack >= this.attackCooldown && !this.laserCharging && !this.laserFiring && !this.isCharging && !this.shieldActive) {
            this.useSkill();
        }
    }

    moveByType() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;

        if (this.bossType === 0) {
            const dx = px - cx, dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (this.phase === 1) {
                if (d > 100) {
                    this.x += (dx / d) * this.spd;
                    this.y += (dy / d) * this.spd;
                }
            } else if (this.phase === 2) {
                const t = Date.now() / 1000;
                if (Math.sin(t * 2) > 0.7) {
                    this.x += (dx / d) * this.spd * 3.5;
                    this.y += (dy / d) * this.spd * 3.5;
                } else if (d > 80) {
                    this.x += (dx / d) * this.spd * 1.5;
                    this.y += (dy / d) * this.spd * 1.5;
                }
            } else {
                this.x += (dx / d) * this.spd * 1.8 + Math.sin(Date.now() / 80) * this.spd * 2;
                this.y += (dy / d) * this.spd * 1.8 + Math.cos(Date.now() / 60) * this.spd * 1.5;
            }
        } else if (this.bossType === 1) {
            const dx = px - cx, dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            const idealDist = 180 + Math.sin(Date.now() / 2000) * 80;

            if (d < idealDist - 40) {
                this.x -= (dx / d) * this.spd * 1.2;
                this.y -= (dy / d) * this.spd * 1.2;
            } else if (d > idealDist + 40) {
                this.x += (dx / d) * this.spd;
                this.y += (dy / d) * this.spd;
            } else {
                const perpX = -dy / d, perpY = dx / d;
                this.x += perpX * this.spd * (this.phase >= 2 ? 1.8 : 1);
                this.y += perpY * this.spd * (this.phase >= 2 ? 1.8 : 1);
            }
        } else {
            if (!this.teleporting) {
                const t = Date.now() / 2500;
                const targetX = W / 2 + Math.sin(t) * (W * 0.38);
                const targetY = H / 2 + Math.sin(t * 2) * (H * 0.32);

                const dx = targetX - cx, dy = targetY - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 10) {
                    this.x += (dx / d) * this.spd * 1.4;
                    this.y += (dy / d) * this.spd * 1.4;
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
            this.laserAngle += (targetAngle - this.laserAngle) * 0.04;

            if (this.laserTimer <= 0) {
                this.laserCharging = false;
                this.laserFiring = true;
                this.laserTimer = this.laserFireTime;
                screenShake = 18;
            }
        }

        if (this.laserFiring) {
            this.laserTimer -= 16;

            if (this.laserSweep) {
                this.laserAngle += this.laserSweepSpeed * (this.enraged ? 1.5 : 1);
            }

            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const lx = cx + Math.cos(this.laserAngle) * 900;
            const ly = cy + Math.sin(this.laserAngle) * 900;
            const px = playerX + PW / 2, py = playerY + PH / 2;
            const d = distToSegment(px, py, cx, cy, lx, ly);

            const laserDamage = this.enraged ? 1.5 : 1;
            if (d < 35 && !invincible) {
                playerHealth -= laserDamage;
                if (Math.random() < 0.4) {
                    particles.push(new Particle(px, py, '#f00', 2, 3, 15));
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

            const dx = playerX + PW / 2 - m.x;
            const dy = playerY + PH / 2 - m.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 10) {
                m.x += (dx / d) * 0.5;
                m.y += (dy / d) * 0.5;
            }

            if (m.timer <= 0 || d < 25) {
                for (let i = 0; i < 25; i++) {
                    const ang = (i / 25) * Math.PI * 2;
                    particles.push(new Particle(m.x + Math.cos(ang) * 20, m.y + Math.sin(ang) * 20, '#fa0', 3, 5, 25));
                }
                screenShake = 10;

                if (d < 90 && !invincible) {
                    playerHealth -= 30;
                }

                for (let i = 0; i < 8; i++) {
                    const ang = (i / 8) * Math.PI * 2;
                    scheduledBullets.push({
                        x: m.x, y: m.y,
                        angle: ang,
                        delay: 0,
                        color: '#fa0',
                        damage: 8
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

            if (this.teleportTimer <= 500 && this.teleportTarget) {
                this.x = this.teleportTarget.x;
                this.y = this.teleportTarget.y;
                this.teleportTarget = null;
                screenShake = 12;

                for (let i = 0; i < 20; i++) {
                    const ang = (i / 20) * Math.PI * 2;
                    particles.push(new Particle(
                        this.x + this.w / 2 + Math.cos(ang) * 40,
                        this.y + this.h / 2 + Math.sin(ang) * 40,
                        '#ff0', 2, 4, 20
                    ));
                }

                if (this.enraged) {
                    this.burstAttack();
                }
            }

            if (this.teleportTimer <= 0) {
                this.teleporting = false;
            }
        }
    }

    draw() {
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
        gradient.addColorStop(0, this.colors[this.bossType] + '80');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, this.w / 2 + glowSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.colors[this.bossType];
        ctx.lineWidth = 3;
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
            ctx.lineWidth = 2;
            ctx.stroke();

            for (let i = 0; i < 4; i++) {
                const ang = -this.rotation * 2 + (i / 4) * Math.PI * 2;
                const orbX = cx + Math.cos(ang) * 35;
                const orbY = cy + Math.sin(ang) * 35;
                ctx.fillStyle = '#aa44ff';
                ctx.beginPath();
                ctx.arc(orbX, orbY, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#886600';
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 - 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffcc00';
            for (let i = 0; i < 5; i++) {
                const ang = -Math.PI / 2 + (i - 2) * 0.4;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(ang) * (this.w / 2 - 10), cy + Math.sin(ang) * (this.w / 2 - 10));
                ctx.lineTo(cx + Math.cos(ang - 0.15) * (this.w / 2 + 15), cy + Math.sin(ang - 0.15) * (this.w / 2 + 15));
                ctx.lineTo(cx + Math.cos(ang + 0.15) * (this.w / 2 + 15), cy + Math.sin(ang + 0.15) * (this.w / 2 + 15));
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, this.w * 0.15, 0, Math.PI * 2);
        ctx.fill();

        const eyeAng = Math.atan2(playerY - cy, playerX - cx);
        ctx.fillStyle = this.enraged ? '#f00' : '#000';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAng) * 5, cy + Math.sin(eyeAng) * 5, this.w * 0.08, 0, Math.PI * 2);
        ctx.fill();

        if (this.enraged) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() * 0.015) * 0.4})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 20, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.laserCharging) {
            const prog = 1 - this.laserTimer / this.laserChargeTime;
            ctx.strokeStyle = `rgba(255, 0, 0, ${prog})`;
            ctx.lineWidth = 2 + prog * 6;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(this.laserAngle) * 600, cy + Math.sin(this.laserAngle) * 600);
            ctx.stroke();
            ctx.setLineDash([]);

            if (Math.random() < prog) {
                const ang = Math.random() * Math.PI * 2;
                particles.push(new Particle(
                    cx + Math.cos(ang) * 50, cy + Math.sin(ang) * 50,
                    '#f00', 1, 2, 15
                ));
            }
        }

        if (this.laserFiring) {
            const beamWidth = 25 + Math.sin(Date.now() * 0.05) * 8;
            const lx = cx + Math.cos(this.laserAngle) * 900;
            const ly = cy + Math.sin(this.laserAngle) * 900;

            ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
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

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = beamWidth * 0.3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(lx, ly);
            ctx.stroke();
        }

        this.mines.forEach(m => {
            const danger = m.timer < 1000;
            const pulse = Math.sin(m.pulse * (danger ? 4 : 1)) * 0.3 + 0.7;
            ctx.fillStyle = danger ? `rgba(255, 0, 0, ${pulse})` : `rgba(255, 150, 0, ${pulse})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, 14 + (danger ? Math.sin(m.pulse * 6) * 4 : 0), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        if (this.flash > 0) {
            ctx.globalAlpha = this.flash;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

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

        ctx.fillStyle = '#fff';
        ctx.fillRect(barX + barWidth * 0.6 - 1, barY, 2, barH);
        ctx.fillRect(barX + barWidth * 0.3 - 1, barY, 2, barH);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barH);
    }

    useSkill() {
        this.lastAttack = Date.now();

        let attacks = [...this.attackPool];

        if (this.canTeleport && this.phase >= 2) {
            attacks.push('teleport');
        }

        if (this.phase === 3) {
            attacks.push('laserSweep');
            attacks.push('bulletHell');
        }

        const attack = attacks[Math.floor(Math.random() * attacks.length)];

        if (attack === 'burst') this.burstAttack();
        else if (attack === 'spiral') this.spiralAttack();
        else if (attack === 'wave') this.waveAttack();
        else if (attack === 'shotgun') this.shotgunAttack();
        else if (attack === 'charge') this.chargeAttack();
        else if (attack === 'summon') this.summonAttack();
        else if (attack === 'omniBurst') this.omniBurstAttack();
        else if (attack === 'mines') this.minesAttack();
        else if (attack === 'laser') this.laserAttack(false);
        else if (attack === 'laserSweep') this.laserAttack(true);
        else if (attack === 'teleport') this.teleportAttack();
        else if (attack === 'bulletHell') this.bulletHellAttack();

        if (this.enraged && Math.random() < 0.4) {
            this.attackCooldown *= 0.6;
        }
    }

    burstAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const count = this.enraged ? 28 : 18;
        const rings = this.phase >= 2 ? 2 : 1;

        for (let ring = 0; ring < rings; ring++) {
            for (let i = 0; i < count; i++) {
                const a = (2 * Math.PI * i / count) + this.rotation + ring * 0.15;
                scheduledBullets.push({
                    x: cx, y: cy,
                    angle: a,
                    delay: ring * 150,
                    color: this.colors[this.bossType],
                    damage: 15
                });
            }
        }
        screenShake = 6;
    }

    spiralAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const count = this.enraged ? 40 : 25;
        const arms = this.phase >= 2 ? 2 : 1;

        for (let arm = 0; arm < arms; arm++) {
            for (let i = 0; i < count; i++) {
                const a = (2 * Math.PI * i / count * 3) + Date.now() / 400 + (arm * Math.PI);
                scheduledBullets.push({ x: cx, y: cy, angle: a, delay: i * 35, color: '#fa0', damage: 12 });
            }
        }
    }

    waveAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;
        const baseAngle = Math.atan2(py - cy, px - cx);
        const count = this.enraged ? 9 : 6;
        const waves = this.phase >= 2 ? 2 : 1;

        for (let w = 0; w < waves; w++) {
            for (let i = -count; i <= count; i++) {
                const a = baseAngle + i * 0.1;
                scheduledBullets.push({ x: cx, y: cy, angle: a, delay: Math.abs(i) * 40 + w * 300, color: '#0ff', damage: 10 });
            }
        }
    }

    shotgunAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;
        const baseAngle = Math.atan2(py - cy, px - cx);
        const count = this.enraged ? 12 : 8;

        for (let i = 0; i < count; i++) {
            const a = baseAngle + (Math.random() - 0.5) * 0.6;
            scheduledBullets.push({ x: cx, y: cy, angle: a, delay: 0, color: '#f00', damage: 18 });
        }
        screenShake = 10;
    }

    chargeAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const dx = playerX + PW / 2 - cx, dy = playerY + PH / 2 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);

        this.isCharging = true;
        this.chargeProgress = 0;
        this.chargeDirection = { x: dx / d, y: dy / d };
        this.chargeTrail = [];
        screenShake = 12;
    }

    summonAttack() {
        const count = this.enraged ? this.summonCount + 3 : this.summonCount;
        const spawnMedium = this.phase >= 2 && Math.random() < 0.4;

        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            const ex = this.x + this.w / 2 + Math.cos(ang) * 70;
            const ey = this.y + this.h / 2 + Math.sin(ang) * 70;

            const minion = new Enemy('small', true);
            minion.x = ex;
            minion.y = ey;
            enemies.push(minion);

            for (let j = 0; j < 12; j++) {
                particles.push(new Particle(ex, ey, '#9933ff', 2, 4, 25));
            }
        }

        if (spawnMedium) {
            const medMinion = new Enemy('medium', true);
            medMinion.x = this.x + this.w / 2;
            medMinion.y = this.y + this.h + 30;
            enemies.push(medMinion);
        }

        screenShake = 6;
    }

    omniBurstAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const rings = this.enraged ? 4 : 3;

        for (let ring = 0; ring < rings; ring++) {
            const bulletCount = 16 + ring * 2;
            for (let i = 0; i < bulletCount; i++) {
                const a = (2 * Math.PI * i / bulletCount) + ring * 0.12;
                scheduledBullets.push({
                    x: cx, y: cy, angle: a,
                    delay: ring * 180,
                    color: ['#f00', '#ff0', '#0ff', '#f0f'][ring],
                    damage: 14
                });
            }
        }
        screenShake = 14;
    }

    minesAttack() {
        const count = this.enraged ? 8 : 5;
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 250;
            const offsetY = (Math.random() - 0.5) * 250;
            this.mines.push({
                x: Math.max(30, Math.min(W - 30, playerX + PW / 2 + offsetX)),
                y: Math.max(30, Math.min(H - 30, playerY + PH / 2 + offsetY)),
                timer: 2200,
                pulse: 0
            });
        }
    }

    laserAttack(sweep) {
        this.laserCharging = true;
        this.laserAngle = Math.atan2(playerY + PH / 2 - (this.y + this.h / 2), playerX + PW / 2 - (this.x + this.w / 2));
        this.laserTimer = this.laserChargeTime;
        this.laserSweep = sweep;
    }

    bulletHellAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const bulletCount = this.enraged ? 60 : 40;

        for (let i = 0; i < bulletCount; i++) {
            const a = this.bulletHellAngle + (i / bulletCount) * Math.PI * 4;
            scheduledBullets.push({
                x: cx, y: cy,
                angle: a,
                delay: i * 25,
                color: i % 2 === 0 ? '#ff0' : '#f0f',
                damage: 10
            });
        }
        this.bulletHellAngle += 0.5;
        screenShake = 5;
    }

    teleportAttack() {
        this.teleporting = true;
        this.teleportTimer = 800;

        for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * Math.PI * 2;
            particles.push(new Particle(
                this.x + this.w / 2 + Math.cos(ang) * 30,
                this.y + this.h / 2 + Math.sin(ang) * 30,
                '#ff0', 2, 4, 25
            ));
        }

        this.teleportTarget = {
            x: Math.random() * (W - this.w),
            y: Math.random() * (H / 2)
        };
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
        playerMoney += 60 + Math.floor(wave / 5) * 30;
    }

    hit(dmg) {
        if (this.dying || this.entering) return;

        if (this.shieldActive) {
            dmg = Math.floor(dmg * 0.2);
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

function spawnHealthPickup() {
    healthPickup = {
        x: Math.random() * (W - 20),
        y: Math.random() * (H - 20)
    };
}

function drawHealthPickup() {
    if (!healthPickup) return;
    const x = healthPickup.x, y = healthPickup.y;

    const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 1.0;

    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(x + 10, y + 10, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 5);
    ctx.bezierCurveTo(x + 10, y + 3, x + 7.5, y, x + 5, y + 3);
    ctx.bezierCurveTo(x + 2.5, y, x, y + 3, x, y + 5);
    ctx.bezierCurveTo(x, y + 7.5, x, y + 10, x + 10, y + 17.5);
    ctx.bezierCurveTo(x + 20, y + 10, x + 20, y + 7.5, x + 20, y + 5);
    ctx.bezierCurveTo(x + 20, y + 3, x + 17.5, y, x + 15, y + 3);
    ctx.bezierCurveTo(x + 12.5, y, x + 10, y + 3, x + 10, y + 5);
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
