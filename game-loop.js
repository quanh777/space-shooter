let isPaused = false;

let comboScoreEarned = 0;
let comboEndDisplay = null;
let comboEnemyBreakdown = { small: 0, medium: 0, large: 0, elite: 0, boss: 0 };

let spawnQueue = [];
let spawnTimer = 0;
let spawnInterval = 800;

function addComboKill(scoreEarned = 0, enemyType = 'small') {
    comboKills++;
    comboTimer = 2500;
    comboScoreEarned += scoreEarned;

    if (comboEnemyBreakdown[enemyType] !== undefined) {
        comboEnemyBreakdown[enemyType]++;
    }

    maxCombo = Math.max(maxCombo, comboKills);
    comboMultiplier = comboKills < 3 ? 1 : (comboKills < 6 ? 1.5 : (comboKills < 10 ? 2 : 3));

    if (typeof onEnemyKilled === 'function') onEnemyKilled();

    if (comboKills >= 5 && comboKills % 5 === 0) {
        screenShake = 5;
        for (let i = 0; i < 15; i++) {
            particles.push(new Particle(playerX + PW / 2, playerY + PH / 2, '#ff0', 3, 5, 25));
        }
    }
}

function updateCombo() {
    if (comboTimer > 0) {
        comboTimer -= 16.67;
        if (comboTimer <= 0) {
            if (comboKills >= 3) {
                const t = Date.now();
                let rank, rankColor;
                if (comboKills >= 25) { rank = 'SSS'; rankColor = '#ff6666'; }
                else if (comboKills >= 18) { rank = 'SS'; rankColor = '#ffffff'; }
                else if (comboKills >= 13) { rank = 'S'; rankColor = '#ffdd44'; }
                else if (comboKills >= 9) { rank = 'A'; rankColor = '#ff8822'; }
                else if (comboKills >= 6) { rank = 'B'; rankColor = '#ff5533'; }
                else if (comboKills >= 4) { rank = 'C'; rankColor = '#aa88ff'; }
                else { rank = 'D'; rankColor = '#6688cc'; }

                comboEndDisplay = {
                    kills: comboKills,
                    score: comboScoreEarned,
                    breakdown: { ...comboEnemyBreakdown },
                    multiplier: comboMultiplier,
                    rank: rank,
                    rankColor: rankColor,
                    timer: 150,
                    alpha: 0,
                    scale: 4.0,
                    impactY: H / 4,
                    hasImpacted: false
                };
            }
            if (comboScoreEarned > 0) {
                if (comboKills >= 3) {
                    scorePopups.push({
                        val: comboScoreEarned,
                        alpha: 0,
                        state: 'appear',
                        timer: 0,
                        xOffset: 40,
                        yOffset: -10
                    });
                } else {
                    score += comboScoreEarned;
                }
            }

            comboKills = 0;
            comboMultiplier = 1;
            comboScoreEarned = 0;
            comboEnemyBreakdown = { small: 0, medium: 0, large: 0, elite: 0, boss: 0 };
        }
    }

    if (comboEndDisplay) {
        comboEndDisplay.timer--;

        if (comboEndDisplay.timer > 135) {
            let p = (150 - comboEndDisplay.timer) / 15;

            const s = 1.70158;
            const easeOutBack = (p -= 1) * p * ((s + 1) * p + s) + 1;

            comboEndDisplay.scale = 4.0 - 3.0 * easeOutBack;
            comboEndDisplay.alpha = p * 2;
            if (comboEndDisplay.alpha > 1) comboEndDisplay.alpha = 1;

            if (comboEndDisplay.scale <= 1.05 && !comboEndDisplay.hasImpacted) {
                comboEndDisplay.hasImpacted = true;
                comboEndDisplay.scale = 1.0;
                screenShake = 15;

                for (let i = 0; i < 30; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 5 + Math.random() * 8;
                    particles.push(new Particle(
                        W / 2, comboEndDisplay.impactY,
                        comboEndDisplay.rankColor,
                        2 + Math.random() * 4, spd, 40
                    ));
                }
            }
        }

        else if (comboEndDisplay.timer <= 20) {
            const p = comboEndDisplay.timer / 20;
            comboEndDisplay.alpha = p;
            comboEndDisplay.scaleX = 1 + (1 - p) * 3;
            comboEndDisplay.scaleY = p;
        }

        else {
            comboEndDisplay.scale = 1;
            comboEndDisplay.scaleX = 1;
            comboEndDisplay.scaleY = 1;
            comboEndDisplay.alpha = 1;
        }

        if (comboEndDisplay.timer <= 0) {
            comboEndDisplay = null;
        }
    }
}

function checkCrit() {
    return Math.random() < CRIT_CHANCE;
}

function applyCritDamage(baseDmg, isCrit) {
    return isCrit ? Math.floor(baseDmg * CRIT_MULTIPLIER) : baseDmg;
}

function spawnPowerUp(x, y) {
    if (Math.random() > 0.25) return;

    const types = Object.keys(POWER_UP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];

    powerUps.push({
        x: x, y: y,
        type: type,
        pulse: 0,
        lifetime: 300
    });
}

function hasBuff(type) {
    return activeBuffs[type] && activeBuffs[type] > Date.now();
}

function activateBuff(type) {
    const now = Date.now();
    const duration = POWER_UP_TYPES[type].duration;
    activeBuffs[type] = now + duration;
    const desc = POWER_UP_TYPES[type].desc;
    buffTexts.push({ text: desc, y: H / 2 - 50, alpha: 1, color: POWER_UP_TYPES[type].color });
}

let buffTexts = [];

function updateBuffTexts() {
    buffTexts = buffTexts.filter(t => {
        t.y -= 0.4;
        t.alpha -= 0.0067;
        return t.alpha > 0;
    });
}

function calculateWaveBonus() {
    const clearTime = Date.now() - waveStartTime;
    if (clearTime < 10000) return 100;
    if (clearTime < 20000) return 50;
    if (clearTime < 30000) return 25;
    return 0;
}

function aimEnemy() {
    let min = Infinity, target = null;
    enemies.forEach(e => {
        const d = Math.sqrt((e.x - playerX) ** 2 + (e.y - playerY) ** 2);
        if (d < min) { min = d; target = e }
    });
    if (target) {
        const dx = target.x - playerX, dy = target.y - playerY, d = Math.sqrt(dx * dx + dy * dy);
        playerTargetAngle = Math.atan2(dy, dx);
        return { x: dx / d, y: dy / d };
    }
    return dirX || dirY ? { x: dirX, y: dirY } : { x: Math.cos(playerFacingAngle), y: Math.sin(playerFacingAngle) };
}

function shoot() {
    const aim = aimEnemy(), cx = playerX + PW / 2, cy = playerY + PH / 2;
    bullets.push(new Bullet(cx, cy, aim.x, aim.y));

    if (doubleShot) {
        bullets.push(new Bullet(cx - 10, cy, aim.x, aim.y));
        bullets.push(new Bullet(cx + 10, cy, aim.x, aim.y));
    } else if (tripleShot) {
        const a = Math.atan2(aim.y, aim.x);
        bullets.push(new Bullet(cx, cy, Math.cos(a - 0.3), Math.sin(a - 0.3)));
        bullets.push(new Bullet(cx, cy, Math.cos(a + 0.3), Math.sin(a + 0.3)));
    }

    for (let i = 0; i < 3; i++) particles.push(new Particle(cx, cy, 'rgb(100,150,255)', 2, 3, 10));
    canShoot = false; lastShot = Date.now();
}

function explodeBomb(bomb) {
    
    for (let i = 0; i < 30; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * skill.radius * 0.15;
        particles.push(new Particle(bomb.x + Math.cos(ang) * dist, bomb.y + Math.sin(ang) * dist, '#ffffff', 6 + Math.random() * 4, 12, 15));
    }

    for (let i = 0; i < 60; i++) {
        const ang = (i / 60) * Math.PI * 2;
        const p1 = new Particle(bomb.x, bomb.y, '#00ffff', 0, 5, 30);
        p1.vx = Math.cos(ang) * 15;
        p1.vy = Math.sin(ang) * 15;
        p1.maxLt = 20; p1.lt = 20;
        particles.push(p1);

        const p2 = new Particle(bomb.x, bomb.y, '#0088ff', 0, 8, 25);
        p2.vx = Math.cos(ang) * 8;
        p2.vy = Math.sin(ang) * 8;
        particles.push(p2);
    }

    for (let i = 0; i < 40; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * skill.radius * 0.8;
        const colors = ['#00ffff', '#ffffff', '#00aaff', '#0044ff'];
        particles.push(new Particle(
            bomb.x + Math.cos(ang) * dist,
            bomb.y + Math.sin(ang) * dist,
            colors[Math.floor(Math.random() * colors.length)],
            1 + Math.random() * 5, 4 + Math.random() * 6, 20 + Math.random() * 20
        ));
    }

    screenShake = 35;

    enemies.forEach(enemy => {
        const dx = (enemy.x + enemy.w / 2) - bomb.x;
        const dy = (enemy.y + enemy.h / 2) - bomb.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (!enemy.entering && !enemy.dying && d <= skill.radius) {
            const falloff = 1 - (d / skill.radius) * 0.5;
            enemy.hit(skill.damage * falloff);

            if (enemy.hp <= 0) {
                const baseScore = enemy.type == 'boss' ? 200 : (enemy.type == 'elite' ? 50 : (enemy.type == 'large' ? 30 : (enemy.type == 'medium' ? 20 : 10)));
                const earnedScore = Math.floor(baseScore * comboMultiplier);
                addComboKill(earnedScore, enemy.type);
                enemy.drop();
                const deathColor = enemy.getBloodColor();
                for (let k = 0; k < 25; k++) {
                    particles.push(new Particle(
                        enemy.x + Math.random() * enemy.w,
                        enemy.y + Math.random() * enemy.h,
                        deathColor, 2, 5, 30
                    ));
                }
            }
        }
    });
    enemies = enemies.filter(e => e.hp > 0);
}

function useSkill() {
    if (Date.now() - skill.lastUse >= skill.cooldown && energy >= skill.cost) {
        energy -= skill.cost; skill.lastUse = Date.now();

        const cx = playerX + PW / 2, cy = playerY + PH / 2;

        let target = null;
        let minDist = Infinity;
        enemies.forEach(e => {
            const dx = (e.x + e.w / 2) - cx;
            const dy = (e.y + e.h / 2) - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                target = e;
            }
        });

        for (let i = 0; i < 15; i++) {
            const ang = Math.random() * Math.PI * 2;
            particles.push(new Particle(
                cx + Math.cos(ang) * 20,
                cy + Math.sin(ang) * 20,
                '#ff6600', 2, 4, 20
            ));
        }

        bombProjectiles.push({
            x: cx,
            y: cy,
            speed: 7,
            angle: target ? Math.atan2((target.y + target.h / 2) - cy, (target.x + target.w / 2) - cx) : -Math.PI / 2,
            turnSpeed: 0.08,
            target: target,
            trail: [],
            lifeTime: 180,
            radius: 12
        });
    }
}

function getItemPrice(item) {
    if (item === 'Skill Up') {
        return Math.floor((40 + bossKills * 30) * Math.pow(1.4, shopItems[item].b));
    }
    if (item === 'Health Upgrade') {
        return Math.floor(75 * Math.pow(2, shopItems[item].b));
    }
    return Math.floor(shopItems[item].price * Math.pow(1.4, shopItems[item].b));
}

function applyItem(item) {
    if (item == 'Health Upgrade') playerHealth = Math.min(maxHealth, playerHealth + 25);
    else if (item == 'Energy Upgrade') energyRegen += 5;
    else if (item == 'Bullet Speed') bulletSpeed += 2;
    else if (item == 'Bullet Damage') bulletDamage += 10;
    else if (item == 'Double Shot') { doubleShot = true; tripleShot = false }
    else if (item == 'Triple Shot') { tripleShot = true; doubleShot = false }
    else if (item == 'Piercing') window.piercingBullets = true;
    else if (item == 'Max Health') { maxHealth += 25; playerHealth = Math.min(maxHealth, playerHealth + 25) }
    else if (item == 'Fire Rate') bulletCooldown = Math.max(200, bulletCooldown - 100);
    else if (item == 'Regen') window.hpRegen = (window.hpRegen || 0) + 0.5;
    else if (item == 'Speed Boost') playerSpeed += 0.3;
    else if (item == 'Dash Cooldown') window.dashCooldownReduction = (window.dashCooldownReduction || 0) + 500;
    else if (item == 'Luck') window.dropChanceBonus = (window.dropChanceBonus || 0) + 0.15;
    else if (item == 'Magnet') window.pickupRange = (window.pickupRange || 50) + 50;
    else if (item == 'Greed') window.moneyBonus = (window.moneyBonus || 0) + 0.2;
    else if (item == 'Skill Up') {
        if (skill.level < skill.maxLvl) {
            skill.level++; skill.radius += 30; skill.damage += 40;
            skill.cooldown = Math.max(3000, skill.cooldown - 500);
        }
    }
}

function generateShopItems() {
    const allItems = Object.keys(shopItems).filter(k => k !== 'Skill Up');
    const available = allItems.filter(k => shopItems[k].max === -1 || shopItems[k].b < shopItems[k].max);

    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }

    const items = available.slice(0, 3);
    const wantsSkillUp = Math.random() < 0.8;
    const canSkillUp = shopItems['Skill Up'].max === -1 || shopItems['Skill Up'].b < shopItems['Skill Up'].max;

    if (wantsSkillUp && canSkillUp) {
        items.push('Skill Up');
    } else if (available.length > 3) {
        items.push(available[3]);
    }

    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
}

function refreshShop() {
    const refreshCost = 20 + shopRefreshCount * 15;
    if (playerMoney >= refreshCost) {
        playerMoney -= refreshCost;
        shopRefreshCount++;
        skillUpBoughtThisShop = false;
        shopRevealTime = Date.now();
        itemsToSell = generateShopItems();
        selectedItems = [];
    }
}

function update() {
    if (!gameRunning || isShop || isPaused) return;

    if (isTransitionActive()) {
        updateWaveTransition();
        return;
    }

    const now = Date.now();

    const shieldDuration = 1250 + (shopItems["Shield"].b * 750);
    if (invincible && now - invTime >= shieldDuration) invincible = false;

    const effectiveCooldown = hasBuff('rapid') ? bulletCooldown * 0.5 : bulletCooldown;
    if (now - lastShot >= effectiveCooldown) canShoot = true;

    if (energy < 100 && now - lastSlide >= 2000) energy = Math.min(100, energy + energyRegen / 60);

    if (window.hpRegen && playerHealth < maxHealth) {
        playerHealth = Math.min(maxHealth, playerHealth + window.hpRegen / 60);
    }

    if (keys[' '] && canShoot) shoot();
    if (keys['e']) useSkill();

    const baseSpeed = hasBuff('speed') ? 3.5 : 2.3;

    let inputX = 0, inputY = 0;

    if (keys['a']) inputX -= 1;
    if (keys['d']) inputX += 1;
    if (keys['w']) inputY -= 1;
    if (keys['s']) inputY += 1;

    if (typeof joystickData !== 'undefined' && joystickData) {
        const deadzone = 0.15;
        if (Math.abs(joystickData.x) > deadzone) {
            inputX = joystickData.x;
        }
        if (Math.abs(joystickData.y) > deadzone) {
            inputY = joystickData.y;
        }
    }

    const hasInput = inputX !== 0 || inputY !== 0;

    if (keys['Shift'] && !isSliding && energy >= 10 && hasInput) {
        const magnitude = Math.sqrt(inputX * inputX + inputY * inputY);
        window.dashDirection = {
            x: inputX / magnitude,
            y: inputY / magnitude
        };
        isSliding = true;
        lastSlide = now;
        energy -= 10;

        if (typeof onDash === 'function') onDash();
    }

    let moveX = 0, moveY = 0;

    if (isSliding) {
        const dashSpeed = 8;
        const dashDuration = 60;
        const elapsed = now - lastSlide;

        if (elapsed < dashDuration) {
            moveX = window.dashDirection.x * dashSpeed;
            moveY = window.dashDirection.y * dashSpeed;
        } else {
            isSliding = false;
            window.dashDirection = null;
        }
    }

    if (!isSliding && hasInput) {
        const magnitude = Math.sqrt(inputX * inputX + inputY * inputY);
        const normalizedX = inputX / magnitude;
        const normalizedY = inputY / magnitude;

        moveX = normalizedX * baseSpeed;
        moveY = normalizedY * baseSpeed;

        dirX = normalizedX;
        dirY = normalizedY;
        playerTargetAngle = Math.atan2(normalizedY, normalizedX);
        playerMoving = true;
    } else if (!isSliding) {
        playerMoving = false;
    }

    playerX += moveX;
    playerY += moveY;

    if (playerX < 0) playerX = 0;
    if (playerX > W - PW) playerX = W - PW;
    if (playerY < 0) playerY = 0;
    if (playerY > H - PH) playerY = H - PH;

    bullets = bullets.filter(b => {
        b.update();

        if (b.isEnemy && !invincible) {
            const bx = b.x, by = b.y;
            if (bx >= playerX && bx <= playerX + PW && by >= playerY && by <= playerY + PH) {
                if (shieldCooldown <= 0) {
                    invincible = true;
                    invTime = now;
                    screenShake = 10;
                    const shieldUpgrades = shopItems["Shield"].b;
                    shieldCooldown = Math.max(5000, SHIELD_COOLDOWN_BASE - (shieldUpgrades * 1000));
                    for (let i = 0; i < 20; i++) {
                        const ang = (i / 20) * Math.PI * 2;
                        particles.push(new Particle(
                            playerX + PW / 2 + Math.cos(ang) * 30,
                            playerY + PH / 2 + Math.sin(ang) * 30,
                            '#0ff', 2, 4, 25
                        ));
                    }
                } else {
                    playerHealth -= b.dmg;
                    screenShake = 10;
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(bx, by, '#f00', 2, 3, 20));
                    }
                    if (playerHealth <= 0) gameOver();
                }
                return false;
            }
        }

        return b.x >= 0 && b.x <= W && b.y >= 0 && b.y <= H;
    });

    enemies = enemies.filter(e => {
        e.update();

        enemies.forEach(other => {
            if (other !== e) {
                const dx = other.x - e.x, dy = other.y - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < e.w) {
                    e.x -= (dx / dist) * (e.w - dist) / 2;
                    e.y -= (dy / dist) * (e.w - dist) / 2;
                }
            }
        });

        bullets = bullets.filter(b => {
            if (b.isEnemy) return true;

            if (!e.entering && !e.dying && b.x >= e.x && b.x <= e.x + e.w && b.y >= e.y && b.y <= e.y + e.h) {
                if (!b.hitEnemies) b.hitEnemies = new Set();
                if (b.hitEnemies.has(e)) return true;
                b.hitEnemies.add(e);

                const isCrit = checkCrit();
                const dmgBonus = hasBuff('damage') ? 1.5 : 1;
                const finalDmg = Math.floor(applyCritDamage(b.dmg, isCrit) * dmgBonus);
                e.hit(finalDmg, b.x, b.y);

                if (isCrit) {
                    for (let k = 0; k < 8; k++) {
                        particles.push(new Particle(b.x, b.y, '#ff0', 3, 5, 20));
                    }
                }

                if (e.hp <= 0) {
                    const baseScore = e.type == 'boss' ? (bossKills++, typeof onBossDefeated === 'function' && onBossDefeated(), 200) : (e.type == 'elite' ? 50 : (e.type == 'large' ? 30 : (e.type == 'medium' ? 20 : 10)));
                    const earnedScore = Math.floor(baseScore * comboMultiplier);
                    addComboKill(earnedScore, e.type);

                    if (e.type === 'elite' || e.type === 'large') {
                        spawnPowerUp(e.x + e.w / 2, e.y + e.h / 2);
                    }

                    e.drop();
                    const deathColor = e.getBloodColor();
                    for (let k = 0; k < 20; k++) particles.push(new Particle(e.x + Math.random() * e.w, e.y + Math.random() * e.h, deathColor, 2, 4, 30));
                    return window.piercingBullets ? true : false;
                }

                return window.piercingBullets ? true : false;
            }
            return true;
        });

        if (!e.entering && !e.dying && !invincible && playerX < e.x + e.w && playerX + PW > e.x && playerY < e.y + e.h && playerY + PH > e.y) {
            const collisionDamage = e.contactDamage || (e.type == 'boss' ? 50 : (e.type == 'elite' ? 35 : (e.type == 'large' ? 30 : (e.type == 'medium' ? 20 : 10))));

            if (shieldCooldown <= 0 && collisionDamage > 10) {
                invincible = true;
                invTime = now;
                screenShake = 10;
                const shieldUpgrades = shopItems["Shield"].b;
                shieldCooldown = Math.max(5000, SHIELD_COOLDOWN_BASE - (shieldUpgrades * 1000));

                for (let i = 0; i < 20; i++) {
                    const ang = (i / 20) * Math.PI * 2;
                    particles.push(new Particle(
                        playerX + PW / 2 + Math.cos(ang) * 30,
                        playerY + PH / 2 + Math.sin(ang) * 30,
                        '#0ff', 2, 4, 25
                    ));
                }
            } else {
                playerHealth -= collisionDamage;
                invincible = true; invTime = now; screenShake = 15;
                if (playerHealth <= 0) gameOver();
            }
        }

        return e.type === 'boss' ? e.hp !== -999 : e.hp > 0;
    });

    particles = particles.filter(p => { p.update(); return p.lt > 0 });

    scorePopups.forEach(sp => {
        if (sp.state === 'appear') {
            sp.alpha += 0.05;
            sp.yOffset += 0.5;
            sp.timer++;
            if (sp.timer >= 20) sp.state = 'wait';
        } else if (sp.state === 'wait') {
            sp.timer++;
            if (sp.timer >= 40) sp.state = 'merge';
        } else if (sp.state === 'merge') {
            sp.xOffset -= 2.0;
            sp.alpha -= 0.05;
            if (sp.xOffset <= 0 || sp.alpha <= 0) {
                sp.state = 'done';
                if (typeof scoreFlash !== 'undefined') scoreFlash = 1.0;
                score += sp.val;
            }
        }
    });
    scorePopups = scorePopups.filter(sp => sp.state !== 'done');
    if (particles.length > 500) {
        particles = particles.slice(-500);
    }

    goldPickups = goldPickups.filter(g => {
        const targetX = 15;
        const targetY = H - 108;
        const dx = targetX - g.x;
        const dy = targetY - g.y;
        const dist = Math.max(1, Math.hypot(dx, dy));

        const accel = 0.5 + (g.life * 0.05);

        g.vx *= 0.92;
        g.vy *= 0.92;

        g.vx += (dx / dist) * accel;
        g.vy += (dy / dist) * accel;

        g.x += g.vx;
        g.y += g.vy;
        g.life++;

        if (dist < 20) {
            window.moneyFlash = 1;
            return false;
        }
        return true;
    });

    scheduledBullets = scheduledBullets.filter(sb => {
        sb.delay -= 16;
        if (sb.delay <= 0) {
            const enemyBullet = new Bullet(sb.x, sb.y, Math.cos(sb.angle), Math.sin(sb.angle));
            enemyBullet.c = sb.color;
            enemyBullet.dmg = sb.damage;
            enemyBullet.isEnemy = true;
            enemyBullet.speed = 4;
            bullets.push(enemyBullet);
            return false;
        }
        return true;
    });

    bombProjectiles = bombProjectiles.filter(bomb => {
        bomb.lifeTime--;
        if (bomb.lifeTime <= 0) {
            explodeBomb(bomb);
            return false;
        }

        if (!bomb.target || bomb.target.hp <= 0) {
            let minDist = Infinity;
            enemies.forEach(e => {
                const dx = (e.x + e.w / 2) - bomb.x;
                const dy = (e.y + e.h / 2) - bomb.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist && e.hp > 0) {
                    minDist = dist;
                    bomb.target = e;
                }
            });
        }

        if (bomb.target && bomb.target.hp > 0) {
            const tx = bomb.target.x + bomb.target.w / 2;
            const ty = bomb.target.y + bomb.target.h / 2;
            const targetAngle = Math.atan2(ty - bomb.y, tx - bomb.x);

            let angleDiff = targetAngle - bomb.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            bomb.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), bomb.turnSpeed);
        }

        bomb.x += Math.cos(bomb.angle) * bomb.speed;
        bomb.y += Math.sin(bomb.angle) * bomb.speed;

        bomb.trail.push({ x: bomb.x, y: bomb.y, life: 15 });
        bomb.trail = bomb.trail.filter(t => --t.life > 0);

        if (bomb.x < -50 || bomb.x > W + 50 || bomb.y < -50 || bomb.y > H + 50) {
            return false;
        }

        let hit = false;
        enemies.forEach(e => {
            const dx = (e.x + e.w / 2) - bomb.x;
            const dy = (e.y + e.h / 2) - bomb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < bomb.radius + e.w / 2) {
                hit = true;
                explodeBomb(bomb);
            }
        });

        return !hit;
    });

    if (shieldCooldown > 0 && !invincible) {
        shieldCooldown -= 16.67;
        if (shieldCooldown < 0) shieldCooldown = 0;
    }

    if (wave === 0 && !isResting) {
        isResting = true;
        restStart = now;

        tutorialCircle = {
            x: 100 + Math.random() * (W - 200),
            y: 100 + Math.random() * (H - 200),
            radius: 60,
            pulse: 0
        };
        tutorialProgress = 0;
    }

    if (wave === 0 && tutorialCircle) {
        tutorialCircle.pulse += 0.05;

        const dx = (playerX + PW / 2) - tutorialCircle.x;
        const dy = (playerY + PH / 2) - tutorialCircle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < tutorialCircle.radius) {
            tutorialProgress += 16.67;

            if (tutorialProgress >= 2000) {
                isResting = false;
                wave = 1;
                showWaveTransition(1);
                neededSpawn = true;
                tutorialCircle = null;
                tutorialProgress = 0;
            }
        } else {
            tutorialProgress = Math.max(0, tutorialProgress - 33.33);
        }
    }

    if (enemies.length === 0 && !isResting && !isShop && wave > 0) {
        isResting = true; restStart = now;
        playerHealth = Math.min(maxHealth, playerHealth + 20);

        waveBonusEarned = calculateWaveBonus();
        if (waveBonusEarned > 0) {
            score += waveBonusEarned;
            const lang = typeof getLang === 'function' ? getLang() : null;
            const fastClearTxt = lang && lang.fastClear ? lang.fastClear : 'FAST CLEAR';
            buffTexts.push({ text: `${fastClearTxt} +${waveBonusEarned}`, y: H / 2 - 80, alpha: 1, color: '#0ff' });
        }

        spawnHealthPickup();
    }

    const restDuration = wave === 0 ? 15000 : 5000;
    if (isResting && now - restStart >= restDuration && !isShop) {
        isResting = false; wave++;
        bossSpawned = false;
        window.shopVisited = false;
        if (wave % 5 !== 1) {
            showWaveTransition(wave);
        }
        neededSpawn = true;
    }

    if (neededSpawn && !isTransitionActive()) {
        neededSpawn = false;
        isResting = false;

        if (wave % 5 == 0 && !bossSpawned) {
            enemies.push(new Boss()); bossSpawned = true;
        } else if (wave % 5 == 1 && wave > 1 && !window.shopVisited) {
            isShop = true;
            window.shopVisited = true;
            neededSpawn = true;
            isResting = false;
            skillUpBoughtThisShop = false;
            shopRefreshCount = 0;
            shopRevealTime = Date.now();
            itemsToSell = generateShopItems();
        } else {
            const baseCount = Math.floor(wave * 1.5 + 3);
            const bonusCount = Math.floor(Math.random() * 3) - 1;
            const totalEnemies = Math.max(3, baseCount + bonusCount);

            const eliteChance = wave >= 3 ? Math.min(0.15, (wave - 2) * 0.02) : 0;
            const largeChance = Math.min(0.25, wave * 0.02);
            const mediumChance = Math.min(0.4, 0.25 + wave * 0.01);

            spawnQueue = [];
            let remaining = totalEnemies;

            while (remaining > 0) {
                const batchType = Math.random();
                let batch = [];
                let maxBatch;

                if (batchType < 0.35) {
                    const typeRoll = Math.random();
                    let singleType, batchLimit;
                    if (typeRoll < 0.5) {
                        singleType = 'small'; batchLimit = 4 + Math.floor(Math.random() * 3);
                    } else if (typeRoll < 0.8) {
                        singleType = 'medium'; batchLimit = 3 + Math.floor(Math.random() * 2);
                    } else {
                        singleType = 'large'; batchLimit = 2 + Math.floor(Math.random() * 2);
                    }
                    maxBatch = Math.min(remaining, batchLimit);
                    for (let i = 0; i < maxBatch; i++) batch.push(singleType);
                } else {
                    maxBatch = Math.min(remaining, 3 + Math.floor(Math.random() * 2));
                    for (let i = 0; i < maxBatch; i++) {
                        const r = Math.random();
                        let type;
                        if (r < eliteChance) type = 'elite';
                        else if (r < eliteChance + largeChance) type = 'large';
                        else if (r < eliteChance + largeChance + mediumChance) type = 'medium';
                        else type = 'small';
                        batch.push(type);
                    }

                    const eliteCount = batch.filter(t => t === 'elite').length;
                    const largeCount = batch.filter(t => t === 'large').length;
                    if (eliteCount > 2) {
                        batch = batch.filter(t => t !== 'elite').concat(['elite', 'elite']);
                    }
                    if (largeCount > 3) {
                        batch = batch.filter(t => t !== 'large').concat(['large', 'large', 'large']);
                    }
                }

                spawnQueue.push(batch);
                remaining -= batch.length;
            }

            if (wave >= 3 && wave % 3 === 0 && wave % 5 !== 0) {
                spawnQueue.push(['elite']);
            }

            spawnInterval = Math.max(3000, 4000 - wave * 50);
            spawnTimer = 0;

            if (spawnQueue.length > 0) {
                const firstBatch = spawnQueue.shift();
                firstBatch.forEach(type => enemies.push(new Enemy(type)));
            }
        }
    }

    if (spawnQueue.length > 0 && !isResting && !isShop && !isTransitionActive()) {
        spawnTimer += 16.67;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            const batch = spawnQueue.shift();
            batch.forEach(type => enemies.push(new Enemy(type)));
        }
    }

    if (healthPickup && isResting &&
        playerX < healthPickup.x + 20 && playerX + PW > healthPickup.x &&
        playerY < healthPickup.y + 20 && playerY + PH > healthPickup.y) {
        playerHealth = Math.min(maxHealth, playerHealth + 30);
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(healthPickup.x + Math.random() * 20, healthPickup.y + Math.random() * 20, '#0f0', 2, 4, 30));
        }
        spawnHealthPickup();
    }

    powerUps = powerUps.filter(p => {
        p.pulse += 0.15;
        p.lifetime--;

        if (hasBuff('magnet')) {
            const dx = playerX + PW / 2 - p.x;
            const dy = playerY + PH / 2 - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                p.x += (dx / dist) * 3;
                p.y += (dy / dist) * 3;
            }
        }

        if (playerX < p.x + 15 && playerX + PW > p.x - 15 &&
            playerY < p.y + 15 && playerY + PH > p.y - 15) {
            activateBuff(p.type);
            for (let i = 0; i < 12; i++) {
                particles.push(new Particle(p.x, p.y, POWER_UP_TYPES[p.type].color, 2, 4, 25));
            }
            return false;
        }

        return p.lifetime > 0;
    });

    updateCombo();
    updateBuffTexts();

    if (neededSpawn && !isTransitionActive()) {
        waveStartTime = now;
    }

    if (screenShake > 0) screenShake -= 0.5;
}

function draw() {
    const shk = screenShake > 0 ? { x: (Math.random() * 2 - 1) * screenShake, y: (Math.random() * 2 - 1) * screenShake } : { x: 0, y: 0 };
    ctx.save(); ctx.translate(shk.x, shk.y);

    ctx.drawImage(bgCanvas, 0, 0);

    particles.forEach(p => p.draw());
    enemies.forEach(e => e.draw());
    bullets.forEach(b => b.draw());

    powerUps.forEach(p => {
        const config = POWER_UP_TYPES[p.type];
        const size = 12 + Math.sin(p.pulse) * 3;

        ctx.save();
        ctx.shadowColor = config.color; ctx.shadowBlur = 15;
        ctx.fillStyle = config.color + '20';
        ctx.beginPath(); ctx.arc(p.x, p.y, size + 10, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = config.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, 3, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, size + 2, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    });

    if (comboKills >= 2) {
        ctx.save();
        const fadeAlpha = comboTimer < 500 ? comboTimer / 500 : 1;
        ctx.globalAlpha = fadeAlpha;
        const t = Date.now();

        let rank, rankColor, rankGlow, tier;
        if (comboKills >= 25) { rank = 'SSS'; rankColor = `hsl(${(t * 0.3) % 360},100%,70%)`; rankGlow = `hsl(${(t * 0.3) % 360},100%,50%)`; tier = 6; }
        else if (comboKills >= 18) { rank = 'SS'; rankColor = '#ffffff'; rankGlow = '#ffddaa'; tier = 5; }
        else if (comboKills >= 13) { rank = 'S'; rankColor = '#ffdd44'; rankGlow = '#ffaa00'; tier = 4; }
        else if (comboKills >= 9) { rank = 'A'; rankColor = '#ff8822'; rankGlow = '#cc4400'; tier = 3; }
        else if (comboKills >= 6) { rank = 'B'; rankColor = '#ff5533'; rankGlow = '#cc2200'; tier = 2; }
        else if (comboKills >= 4) { rank = 'C'; rankColor = '#aa88ff'; rankGlow = '#6644cc'; tier = 1; }
        else { rank = 'D'; rankColor = '#6688cc'; rankGlow = '#334488'; tier = 0; }

        if (tier >= 3) {
            const vigAlpha = 0.06 + Math.sin(t * 0.006) * 0.03;
            ctx.globalAlpha = vigAlpha * fadeAlpha;
            const vigGrad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.6);
            vigGrad.addColorStop(0, rankGlow);
            vigGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, W, H * 0.4);
            ctx.globalAlpha = fadeAlpha;
        }

        const cx = W / 2, cy = 65;
        const scale = 1 + Math.sin(t * 0.012) * 0.06;

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = rankGlow; ctx.shadowBlur = 25;
        ctx.font = `bold ${Math.floor(48 * scale)}px Arial`;
        ctx.fillStyle = rankColor;
        ctx.fillText(rank, cx, cy);

        ctx.shadowBlur = 40;
        ctx.fillText(rank, cx, cy);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`${comboKills} HITS`, cx, cy + 35);

        const timerRatio = comboTimer / 2500;
        const barW = 80, barH = 3;
        const barX = cx - barW / 2, barY = cy + 47;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 1.5); ctx.fill();
        ctx.fillStyle = rankColor;
        ctx.globalAlpha = fadeAlpha * 0.7;
        ctx.beginPath(); ctx.roundRect(barX, barY, barW * timerRatio, barH, 1.5); ctx.fill();
        ctx.globalAlpha = fadeAlpha;

        if (comboMultiplier > 1) {
            ctx.font = 'bold 13px Arial';
            ctx.fillStyle = '#44ff88'; ctx.shadowColor = '#22cc44'; ctx.shadowBlur = 6;
            ctx.fillText(`x${comboMultiplier} SCORE`, cx, cy + 62);
            ctx.shadowBlur = 0;
        }

        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    if (comboEndDisplay) {
        ctx.save();
        ctx.globalAlpha = comboEndDisplay.alpha;

        const cx = W / 2;
        const cy = comboEndDisplay.impactY;
        const scale = comboEndDisplay.scale;

        ctx.translate(cx, cy);

        if (comboEndDisplay.scaleX) {
            ctx.scale(comboEndDisplay.scaleX, comboEndDisplay.scaleY);
        } else {
            ctx.scale(scale, Math.max(0.1, scale));
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'italic 120px "Arial Black", Impact, sans-serif';

        ctx.globalCompositeOperation = 'screen';

        const shakeR = (Math.random() - 0.5) * 6 * (1 - comboEndDisplay.alpha);

        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillText(comboEndDisplay.rank, -4 + shakeR, 0);

        ctx.fillStyle = 'rgba(0, 0, 255, 0.4)';
        ctx.fillText(comboEndDisplay.rank, 4 - shakeR, 0);

        ctx.fillStyle = comboEndDisplay.rankColor;
        ctx.shadowColor = comboEndDisplay.rankColor;
        ctx.shadowBlur = 40;
        ctx.fillText(comboEndDisplay.rank, 0, 0);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(comboEndDisplay.rank, 0, 0);

        ctx.globalCompositeOperation = 'source-over';

        if (comboEndDisplay.hasImpacted) {

            const activeTime = 135 - comboEndDisplay.timer;
            const slideInPct = Math.min(1, activeTime / 10);

            const slideLeftX = -120 + (1 - slideInPct) * -200;
            ctx.textAlign = 'right';
            ctx.font = 'bold italic 36px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#000000'; ctx.shadowBlur = 10;
            ctx.fillText(`${comboEndDisplay.kills} HITS`, slideLeftX, -10);

            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#44ff88';
            ctx.shadowColor = '#22cc44'; ctx.shadowBlur = 8;
            ctx.fillText(`+${comboEndDisplay.score} PTS ` + (comboEndDisplay.multiplier > 1 ? `(x${comboEndDisplay.multiplier})` : ''), slideLeftX, 22);

            const slideRightX = 120 + (1 - slideInPct) * 200;
            ctx.textAlign = 'left';

            const bd = comboEndDisplay.breakdown;
            let parts = [];
            if (bd.small > 0) parts.push(`${bd.small} S`);
            if (bd.medium > 0) parts.push(`${bd.medium} M`);
            if (bd.large > 0) parts.push(`${bd.large} L`);
            if (bd.elite > 0) parts.push(`${bd.elite} E`);
            if (bd.boss > 0) parts.push(`${bd.boss} B`);

            if (parts.length > 0) {
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#aaaaff';
                ctx.shadowColor = '#5555ff'; ctx.shadowBlur = 5;
                ctx.fillText("ENEMIES SLASHED:", slideRightX, -8);

                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(parts.join('  ·  '), slideRightX, 16);
            }
        }

        ctx.restore();
    }

    buffTexts.forEach(t => {
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, W / 2, t.y);
        ctx.restore();
    });

    goldPickups.forEach(g => {
        ctx.save();
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    let buffIndex = 0;
    Object.keys(activeBuffs).forEach(type => {
        if (hasBuff(type)) {
            const remaining = Math.ceil((activeBuffs[type] - Date.now()) / 1000);
            const config = POWER_UP_TYPES[type];
            const x = W - 30 - buffIndex * 35;
            const y = H - 30;

            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
            ctx.shadowColor = config.color; ctx.shadowBlur = 8;
            ctx.fillStyle = config.color;
            ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = config.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(1, remaining / 10))); ctx.stroke();

            ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`${remaining}`, x, y + 3);
            ctx.restore();

            buffIndex++;
        }
    });

    bombProjectiles.forEach(bomb => {
        const drawTime = Date.now();
        bomb.trail.forEach((t, i) => {
            const alpha = (t.life / 15) * 0.8;
            const size = 4 + (1 - t.life / 15) * 8;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(t.x, t.y);
            ctx.rotate(bomb.angle);

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 1.5, 0, 0, Math.PI * 2); ctx.fill();

            if (i % 3 === 0) {
                ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-size, 0); ctx.lineTo(0, -size * 1.5);
                ctx.lineTo(size, 0); ctx.lineTo(0, size * 1.5);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.restore();
        });

        if (bomb.target && bomb.target.hp > 0) {
            const tx = bomb.target.x + bomb.target.w / 2;
            const ty = bomb.target.y + bomb.target.h / 2;
            const dist = Math.hypot(tx - bomb.x, ty - bomb.y);

            if (dist < 200) {
                const factor = 1 - (dist / 200);
                const tRad = Math.max(bomb.target.w, bomb.target.h) * 0.8 + 10;

                ctx.save();
                ctx.translate(tx, ty);
                ctx.rotate(drawTime * 0.005);
                ctx.strokeStyle = `rgba(255, 50, 0, ${factor})`;
                ctx.lineWidth = 2 + factor * 2;

                ctx.beginPath();
                ctx.arc(0, 0, tRad, 0, Math.PI * 2);
                ctx.stroke();

                for (let j = 0; j < 4; j++) {
                    ctx.rotate(Math.PI / 2);
                    ctx.beginPath();
                    ctx.moveTo(tRad * 0.8, 0);
                    ctx.lineTo(tRad * 1.4, 0);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        ctx.save();
        ctx.translate(bomb.x, bomb.y);
        ctx.rotate(bomb.angle);

        let proximityFactor = 0;
        if (bomb.target && bomb.target.hp > 0) {
            const tx = bomb.target.x + bomb.target.w / 2;
            const ty = bomb.target.y + bomb.target.h / 2;
            const dist = Math.sqrt((tx - bomb.x) ** 2 + (ty - bomb.y) ** 2);
            if (dist < 200) proximityFactor = 1 - (dist / 200);
        }

        ctx.scale(0.65, 0.65);

        if (proximityFactor > 0) {
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 15 + proximityFactor * 30;
            ctx.fillStyle = `rgba(255, 50, 0, ${proximityFactor * 0.5})`;
            ctx.beginPath(); ctx.arc(0, 0, bomb.radius * 2.5, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = `rgba(255, 0, 0, ${proximityFactor})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, bomb.radius * (2 + Math.sin(Date.now() * 0.02) * 0.5), 0, Math.PI * 2);
            ctx.moveTo(bomb.radius * 3, 0); ctx.lineTo(bomb.radius * 1.5, 0);
            ctx.moveTo(-bomb.radius * 3, 0); ctx.lineTo(-bomb.radius * 1.5, 0);
            ctx.moveTo(0, bomb.radius * 3); ctx.lineTo(0, bomb.radius * 1.5);
            ctx.moveTo(0, -bomb.radius * 3); ctx.lineTo(0, -bomb.radius * 1.5);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        const pulsate = Math.sin(drawTime * 0.01) * 0.2;

        ctx.fillStyle = proximityFactor > 0.5 ? '#221111' : '#111822';
        ctx.strokeStyle = proximityFactor > 0.8 ? '#ff4400' : '#00ffcc';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(bomb.radius * 0.5, -bomb.radius * 0.4);
        
        ctx.quadraticCurveTo(bomb.radius * 1.6, -bomb.radius * 0.3, bomb.radius * 1.8, -bomb.radius * 0.1);
        
        ctx.bezierCurveTo(bomb.radius * 1.95, 0, bomb.radius * 1.95, 0, bomb.radius * 1.8, bomb.radius * 0.1);
        
        ctx.quadraticCurveTo(bomb.radius * 1.6, bomb.radius * 0.3, bomb.radius * 0.5, bomb.radius * 0.4);
        
        ctx.lineTo(-bomb.radius * 0.8, bomb.radius * 0.4);
        ctx.lineTo(-bomb.radius * 1.0, 0); 
        ctx.lineTo(-bomb.radius * 0.8, -bomb.radius * 0.4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        if (proximityFactor > 0) {
            
            const blinkSpeed = Math.max(20, 150 - proximityFactor * 130);
            if (Math.floor(Date.now() / blinkSpeed) % 2 === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ff3300';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(bomb.radius * 1.7, 0, bomb.radius * 0.25, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        ctx.fillStyle = proximityFactor > 0 ? `rgba(255, ${200 - proximityFactor * 200}, 0, 1)` : '#00ffcc';
        ctx.beginPath();
        ctx.moveTo(bomb.radius * 0.8, bomb.radius * 0.36);
        ctx.lineTo(bomb.radius * 0.5, bomb.radius * 0.8);
        ctx.lineTo(bomb.radius * 0.2, bomb.radius * 0.39);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bomb.radius * 0.8, -bomb.radius * 0.36);
        ctx.lineTo(bomb.radius * 0.5, -bomb.radius * 0.8);
        ctx.lineTo(bomb.radius * 0.2, -bomb.radius * 0.39);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = proximityFactor > 0.6 ? '#aa2222' : '#1a2a3a';
        ctx.beginPath();
        ctx.moveTo(-bomb.radius * 0.2, bomb.radius * 0.4);
        ctx.lineTo(-bomb.radius * 0.8, bomb.radius * 1.4);
        ctx.lineTo(-bomb.radius * 1.0, bomb.radius * 1.4);
        ctx.lineTo(-bomb.radius * 0.8, bomb.radius * 0.4);
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-bomb.radius * 0.2, -bomb.radius * 0.4);
        ctx.lineTo(-bomb.radius * 0.8, -bomb.radius * 1.4);
        ctx.lineTo(-bomb.radius * 1.0, -bomb.radius * 1.4);
        ctx.lineTo(-bomb.radius * 0.8, -bomb.radius * 0.4);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = proximityFactor > 0.4 ? '#ff0000' : '#00ffff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(bomb.radius * 0.4, 0, bomb.radius * 0.2 + pulsate * bomb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = proximityFactor > 0.4 ? `rgba(255, 50, 0, ${0.5 + pulsate})` : `rgba(0, 255, 255, ${0.5 + pulsate})`;
        ctx.lineWidth = 1;
        for (let r = 0; r < 3; r++) {
            ctx.beginPath();
            ctx.ellipse(bomb.radius * (0.8 - r * 0.5), 0, bomb.radius * 0.1, bomb.radius * (0.6 + r * 0.1), Math.PI / 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';
        const engineGrad = ctx.createLinearGradient(-bomb.radius * 1.2, 0, -bomb.radius * 2.5, 0);
        engineGrad.addColorStop(0, '#ffffff');
        engineGrad.addColorStop(0.3, proximityFactor > 0.7 ? '#ff8800' : '#00ffff');
        engineGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = engineGrad;
        ctx.beginPath();
        ctx.moveTo(-bomb.radius * 1.2, bomb.radius * 0.15);
        ctx.lineTo(-bomb.radius * (2.5 + Math.random()), 0);
        ctx.lineTo(-bomb.radius * 1.2, -bomb.radius * 0.15);
        ctx.fill();

        ctx.restore();
    });

    drawPlayer();
    if (isResting) drawHealthPickup();
    drawUI();
    if (isShop) drawShop();
    drawWaveTransition();

    if (isPaused) {
        const t = Date.now();

        ctx.fillStyle = 'rgba(2,2,15,0.88)';
        ctx.fillRect(0, 0, W, H);

        ctx.globalAlpha = 0.03;
        for (let sy = 0; sy < H; sy += 4) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, sy, W, 1);
        }
        ctx.globalAlpha = 1;

        const lang = typeof getLang === 'function' ? getLang() : { paused: 'PAUSED', resume: 'RESUME', restart: 'RESTART', backToMenu: 'MAIN MENU' };

        const panelW = 280, panelH = 310;
        const panelX = W / 2 - panelW / 2, panelY = H / 2 - panelH / 2 - 10;
        ctx.fillStyle = 'rgba(15,15,40,0.6)';
        ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 12); ctx.fill();
        ctx.strokeStyle = 'rgba(100,140,255,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 12); ctx.stroke();

        const bracketSize = 12;
        ctx.strokeStyle = 'rgba(100,150,255,0.35)'; ctx.lineWidth = 2;
        const corners = [
            [panelX + 5, panelY + 5, 1, 1],
            [panelX + panelW - 5, panelY + 5, -1, 1],
            [panelX + 5, panelY + panelH - 5, 1, -1],
            [panelX + panelW - 5, panelY + panelH - 5, -1, -1]
        ];
        corners.forEach(([cx, cy, dx, dy]) => {
            ctx.beginPath();
            ctx.moveTo(cx, cy + dy * bracketSize);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + dx * bracketSize, cy);
            ctx.stroke();
        });

        const diamondY = panelY + 30;
        const dPulse = 0.7 + Math.sin(t * 0.004) * 0.3;
        ctx.save();
        ctx.translate(W / 2, diamondY);
        ctx.rotate(t * 0.001);
        ctx.fillStyle = `rgba(100,150,255,${dPulse})`;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(8, 0); ctx.lineTo(0, 8); ctx.lineTo(-8, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.shadowColor = '#4466ff'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#ddeeff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '4px';
        ctx.fillText(lang.paused, W / 2, panelY + 72);
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.font = '13px Arial'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(160,180,220,0.5)';
        const statsY = panelY + 100;
        ctx.fillText(`Wave ${wave}  ·  Score ${score}`, W / 2, statsY);

        const divGrad = ctx.createLinearGradient(panelX + 30, 0, panelX + panelW - 30, 0);
        divGrad.addColorStop(0, 'transparent');
        divGrad.addColorStop(0.5, 'rgba(100,150,255,0.3)');
        divGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = divGrad; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(panelX + 30, statsY + 12); ctx.lineTo(panelX + panelW - 30, statsY + 12); ctx.stroke();

        const btnW = 220, btnH = 44;
        const btnX = W / 2 - btnW / 2;
        const buttons = [
            { text: lang.resume || 'RESUME', y: statsY + 30, bg: '#22bb55', border: '#44ff88' },
            { text: lang.restart || 'RESTART', y: statsY + 85, bg: '#cc8800', border: '#ffbb33' },
            { text: lang.backToMenu || 'MAIN MENU', y: statsY + 140, bg: '#cc3333', border: '#ff6666' }
        ];

        buttons.forEach(btn => {

            ctx.fillStyle = btn.bg;
            ctx.beginPath(); ctx.roundRect(btnX, btn.y, btnW, btnH, 8); ctx.fill();

            ctx.strokeStyle = btn.border; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(btnX, btn.y, btnW, btnH, 8); ctx.stroke();

            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
            ctx.fillStyle = '#fff'; ctx.font = 'bold 17px Arial'; ctx.textAlign = 'center';
            ctx.fillText(btn.text, W / 2, btn.y + 28);
            ctx.shadowBlur = 0;
        });

        ctx.font = '11px Arial'; ctx.fillStyle = 'rgba(120,140,180,0.4)'; ctx.textAlign = 'center';
        ctx.fillText('ESC to resume  ·  R to restart  ·  M for menu', W / 2, panelY + panelH - 8);

        ctx.textAlign = 'left';
    }

    ctx.restore();
}

let animationFrameId = null;

function gameLoop() {
    update(); draw();
    updatePixiFrame();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    document.getElementById('mainMenu').classList.add('hidden');
    if (visibleCanvas) visibleCanvas.style.display = 'block';

    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.classList.add('hidden');

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.style.display = 'block';

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    gameRunning = true;
    resetGame();

    if (typeof showMobileControls === 'function') showMobileControls();

    if (typeof onGameStart === 'function') onGameStart();

    gameLoop();
}

window.cheat = {
    money: (amount = 10000) => { playerMoney += amount; console.log(`ðŸ’° +${amount}. Total: ${playerMoney}`); },
    maxStats: () => {
        maxHealth = 500; playerHealth = 500;
        bulletSpeed = 15; bulletCooldown = 100;
        energyRegen = 50; energy = 100;
        skill.level = 5; skill.radius = 250; skill.damage = 300; skill.cooldown = 3000;
        doubleShot = false; tripleShot = true;
        shopItems["Shield"].b = 5;
        console.log('âš¡ All stats maxed!');
    },
    wave: (w = 5) => {
        wave = w - 1; enemies = []; isResting = true; restStart = Date.now() - 4500;
        bossSpawned = false;
        console.log(`ðŸŒŠ Skipping to wave ${w}...`);
    },
    boss: () => {
        enemies = []; enemies.push(new Boss()); bossSpawned = true;
        console.log('ðŸ‘¹ Boss spawned!');
    },
    shop: () => {
        isShop = true; isResting = false;
        skillUpBoughtThisShop = false;
        shopRefreshCount = 0;
        shopRevealTime = Date.now();
        itemsToSell = generateShopItems();
        console.log('ðŸ›’ Shop opened!');
    },
    god: () => { invincible = true; invTime = Infinity; console.log('ðŸ›¡ï¸ God mode ON!'); },
    killAll: () => {
        enemies.forEach(e => { score += 50; e.drop(); });
        enemies = [];
        console.log('ðŸ’€ All enemies killed!');
    },
    heal: () => { playerHealth = maxHealth; console.log('â¤ï¸ Full health!'); },
    help: () => {
        console.log(`
ðŸŽ® CHEAT COMMANDS:
  cheat.money(10000)  - Add money
  cheat.maxStats()    - Max all upgrades
  cheat.wave(5)       - Skip to wave 5
  cheat.boss()        - Spawn boss
  cheat.shop()        - Open shop
  cheat.god()         - Invincibility
  cheat.killAll()     - Kill all
  cheat.heal()        - Full health
        `);
    }
};

function resetGame() {
    score = 0; wave = 0; playerHealth = 100; maxHealth = 100;
    playerMoney = 0; energy = 100; playerX = 375; playerY = 275;
    bullets = []; enemies = []; particles = [];
    bombProjectiles = []; shieldCooldown = 0;
    bossKills = 0; bossSpawned = false; isShop = false;
    doubleShot = false; tripleShot = false;
    isResting = false; restStart = 0; neededSpawn = false;
    tutorialCircle = null; tutorialProgress = 0;

    comboKills = 0; comboTimer = 0; maxCombo = 0; comboMultiplier = 1;
    comboScoreEarned = 0; comboEndDisplay = null;
    powerUps = []; activeBuffs = {}; buffTexts = [];
    waveStartTime = 0; waveBonusEarned = 0;

    Object.keys(shopItems).forEach(k => shopItems[k].b = 0);
}

function gameOver() {
    gameRunning = false;
    if (visibleCanvas) visibleCanvas.style.display = 'none';
    if (typeof hideMobileControls === 'function') hideMobileControls();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalWave').textContent = wave;
    document.getElementById('gameOverScreen').classList.remove('hidden');

    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.classList.remove('hidden');

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.style.display = 'none';

    if (typeof onGameOver === 'function') onGameOver(score);
    if (typeof onWaveComplete === 'function') onWaveComplete(wave);

    const savedName = localStorage.getItem('playerName');
    const nameInput = document.getElementById('playerName');
    if (savedName && nameInput) {
        nameInput.value = savedName;
    }

    setTimeout(() => {
        if (nameInput) nameInput.focus();
    }, 300);

    updateRankPreview(score);

    loadGameOverLeaderboard();
}

function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startGame();
}

function showMainMenu() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    if (typeof hideMobileControls === 'function') hideMobileControls();

    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.classList.remove('hidden');

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.style.display = 'none';
}

function showInstructions() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('instructionsScreen').classList.remove('hidden');
}

function hideInstructions() {
    document.getElementById('instructionsScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

function showInfo() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('infoScreen').classList.remove('hidden');
}

function hideInfo() {
    document.getElementById('infoScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

document.addEventListener('keydown', e => {
    keys[e.key] = true;

    if (e.key === 'Escape' && !isShop && gameRunning) {
        isPaused = !isPaused;
    }

    if (isPaused && e.key === 'r') {
        isPaused = false;
        resetGame();
    }

    if (isPaused && (e.key === 'm' || e.key === 'M')) {
        isPaused = false;
        gameRunning = false;
        if (visibleCanvas) visibleCanvas.style.display = 'none';
        document.getElementById('mainMenu').classList.remove('hidden');

        const langBtn = document.getElementById('langToggle');
        if (langBtn) langBtn.classList.remove('hidden');
    }

    if (isShop) {
        if (e.key >= '1' && e.key <= '4') {
            const idx = parseInt(e.key) - 1;
            if (idx < itemsToSell.length) {
                const item = itemsToSell[idx];
                const price = getItemPrice(item);
                const maxed = shopItems[item].max !== -1 && shopItems[item].b >= shopItems[item].max;

                const skillUpLimited = item === 'Skill Up' && skillUpBoughtThisShop;

                if (playerMoney >= price && !maxed && !skillUpLimited) {
                    if (selectedItems.includes(item)) selectedItems = selectedItems.filter(i => i !== item);
                    else selectedItems.push(item);
                }
            }
        } else if (e.key == 'Enter') {
            selectedItems.forEach(item => {
                const price = getItemPrice(item);
                playerMoney -= price;
                shopItems[item].b++;
                applyItem(item);

                if (typeof onPurchase === 'function') onPurchase();

                if (item === 'Skill Up') skillUpBoughtThisShop = true;
            });
            selectedItems = [];
        } else if (e.key === 'r' || e.key === 'R') {
            refreshShop();
        } else if (e.key == 'Escape') {
            selectedItems = [];
            isShop = false;
            if (wave % 5 === 1) showWaveTransition(wave);
        }
    }
});

document.addEventListener('keyup', e => { keys[e.key] = false });

let _lastTouchTime = 0;

document.addEventListener('click', e => {
    if (Date.now() - _lastTouchTime < 500) return;
    const vc = visibleCanvas || document.getElementById('gameCanvas');
    if (!vc) return;

    const rect = vc.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (isPaused) {

        const btnW = 220, btnH = 44;
        const btnX = W / 2 - btnW / 2;

        const resumeY = H / 2 - 35, restartY = H / 2 + 20, menuY = H / 2 + 75;

        if (mx >= btnX && mx <= btnX + btnW && my >= resumeY && my <= resumeY + btnH) {
            isPaused = false;
        }
        if (mx >= btnX && mx <= btnX + btnW && my >= restartY && my <= restartY + btnH) {
            resetGame();
        }
        if (mx >= btnX && mx <= btnX + btnW && my >= menuY && my <= menuY + btnH) {
            isPaused = false;
            showMainMenu();
        }
        return;
    }

    if (!isShop) return;

    const sl = getShopLayout();
    itemsToSell.forEach((item, i) => {
        if (i >= 4) return;
        const pos = sl.positions[i];

        if (mx >= pos.x && mx <= pos.x + sl.cardW && my >= pos.y && my <= pos.y + sl.cardH) {
            const itm = shopItems[item];
            const price = getItemPrice(item);
            const maxed = itm.max !== -1 && itm.b >= itm.max;

            const skillUpLimited = item === 'Skill Up' && skillUpBoughtThisShop;

            if (playerMoney >= price && !maxed && !skillUpLimited) {
                if (selectedItems.includes(item)) {
                    selectedItems = selectedItems.filter(i => i !== item);
                } else {
                    selectedItems.push(item);
                }
            }
        }
    });

    if (mx >= W / 2 - sl.btnW / 2 && mx <= W / 2 + sl.btnW / 2 && my >= sl.buyY && my <= sl.buyY + sl.btnH) {
        if (selectedItems.length > 0) {
            const total = selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
            if (playerMoney >= total) {
                selectedItems.forEach(item => {
                    const price = getItemPrice(item);
                    playerMoney -= price;
                    shopItems[item].b++;
                    applyItem(item);

                    if (typeof onPurchase === 'function') onPurchase();

                    if (item === 'Skill Up') skillUpBoughtThisShop = true;
                });
                selectedItems = [];
            }
        }
    }

    if (mx >= W / 2 - sl.btnW / 2 && mx <= W / 2 + sl.btnW / 2 && my >= sl.refY && my <= sl.refY + sl.btnH) {
        refreshShop();
    }

    if (mx >= W / 2 - sl.btnW / 2 && mx <= W / 2 + sl.btnW / 2 && my >= sl.skipY && my <= sl.skipY + sl.btnH) {
        selectedItems = [];
        isShop = false;
        if (wave % 5 === 1) showWaveTransition(wave);
    }
});

document.addEventListener('touchstart', e => {
    _lastTouchTime = Date.now();
    const vc = visibleCanvas || document.getElementById('gameCanvas');
    if (!vc) return;

    const rect = vc.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (touch.clientX - rect.left) * scaleX;
    const my = (touch.clientY - rect.top) * scaleY;

    if (isPaused) {
        e.preventDefault();

        const btnW = 220, btnH = 44;
        const btnX = W / 2 - btnW / 2;
        const resumeY = H / 2 - 35, restartY = H / 2 + 20, menuY = H / 2 + 75;

        if (mx >= btnX && mx <= btnX + btnW && my >= resumeY && my <= resumeY + btnH) {
            isPaused = false;
        }
        if (mx >= btnX && mx <= btnX + btnW && my >= restartY && my <= restartY + btnH) {
            resetGame();
        }
        if (mx >= btnX && mx <= btnX + btnW && my >= menuY && my <= menuY + btnH) {
            isPaused = false;
            showMainMenu();
        }
        return;
    }

    if (isShop) {
        e.preventDefault();

        const sl = getShopLayout();
        itemsToSell.forEach((item, i) => {
            if (i >= 4) return;
            const pos = sl.positions[i];

            if (mx >= pos.x && mx <= pos.x + sl.cardW && my >= pos.y && my <= pos.y + sl.cardH) {
                const itm = shopItems[item];
                const price = getItemPrice(item);
                const maxed = itm.max !== -1 && itm.b >= itm.max;
                const skillUpLimited = item === 'Skill Up' && skillUpBoughtThisShop;

                if (playerMoney >= price && !maxed && !skillUpLimited) {
                    if (selectedItems.includes(item)) {
                        selectedItems = selectedItems.filter(i => i !== item);
                    } else {
                        selectedItems.push(item);
                    }
                }
            }
        });

        if (mx >= W / 2 - sl.btnW / 2 && mx <= W / 2 + sl.btnW / 2) {
            if (my >= sl.buyY && my <= sl.buyY + sl.btnH) {
                if (selectedItems.length > 0) {
                    const total = selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
                    if (playerMoney >= total) {
                        selectedItems.forEach(item => {
                            const price = getItemPrice(item);
                            playerMoney -= price;
                            shopItems[item].b++;
                            applyItem(item);

                            if (typeof onPurchase === 'function') onPurchase();

                            if (item === 'Skill Up') skillUpBoughtThisShop = true;
                        });
                        selectedItems = [];
                    }
                }
            } else if (my >= sl.refY && my <= sl.refY + sl.btnH) {
                refreshShop();
            } else if (my >= sl.skipY && my <= sl.skipY + sl.btnH) {
                selectedItems = [];
                isShop = false;
            }
        }
        return;
    }
}, { passive: false });

window.addEventListener('load', () => {
    initPixiRenderer();
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainMenu').classList.remove('hidden');
    }, 1000);
});