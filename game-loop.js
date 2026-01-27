
let isPaused = false;

let comboScoreEarned = 0;
let comboEndDisplay = null;
let comboEnemyBreakdown = { small: 0, medium: 0, large: 0, elite: 0, boss: 0 };

function addComboKill(scoreEarned = 0, enemyType = 'small') {
    comboKills++;
    comboTimer = 2500;
    comboScoreEarned += scoreEarned;

    if (comboEnemyBreakdown[enemyType] !== undefined) {
        comboEnemyBreakdown[enemyType]++;
    }

    maxCombo = Math.max(maxCombo, comboKills);
    comboMultiplier = comboKills < 3 ? 1 : (comboKills < 6 ? 1.5 : (comboKills < 10 ? 2 : 3));

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
                comboEndDisplay = {
                    kills: comboKills,
                    score: comboScoreEarned,
                    breakdown: { ...comboEnemyBreakdown },
                    alpha: 1,
                    timer: 240,
                    y: H / 2 - 60
                };
            }
            comboKills = 0;
            comboMultiplier = 1;
            comboScoreEarned = 0;
            comboEnemyBreakdown = { small: 0, medium: 0, large: 0, elite: 0, boss: 0 };
        }
    }

    if (comboEndDisplay) {
        comboEndDisplay.timer--;
        if (comboEndDisplay.timer <= 60) {
            comboEndDisplay.alpha = comboEndDisplay.timer / 60;
        }
        comboEndDisplay.y -= 0.15;
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
        return { x: dx / d, y: dy / d };
    }
    return dirX || dirY ? { x: dirX, y: dirY } : { x: 0, y: -1 };
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
    for (let ring = 0; ring < 3; ring++) {
        const ringRadius = skill.radius * (ring + 1) / 3;
        for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            particles.push(new Particle(
                bomb.x + Math.cos(ang) * ringRadius,
                bomb.y + Math.sin(ang) * ringRadius,
                ring === 0 ? '#fff' : (ring === 1 ? '#ff8800' : '#ff4400'),
                2, 4, 25 - ring * 5
            ));
        }
    }

    for (let i = 0; i < 50; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * skill.radius * 0.7;
        const colors = ['#ff0', '#f80', '#f00', '#fff'];
        particles.push(new Particle(
            bomb.x + Math.cos(ang) * dist,
            bomb.y + Math.sin(ang) * dist,
            colors[Math.floor(Math.random() * colors.length)],
            2 + Math.random() * 3, 6, 35
        ));
    }

    screenShake = 25;

    enemies.forEach(enemy => {
        const dx = (enemy.x + enemy.w / 2) - bomb.x;
        const dy = (enemy.y + enemy.h / 2) - bomb.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d <= skill.radius) {
            const falloff = 1 - (d / skill.radius) * 0.5;
            enemy.hit(skill.damage * falloff);

            if (enemy.hp <= 0) {
                const baseScore = enemy.type == 'boss' ? 200 : (enemy.type == 'elite' ? 50 : (enemy.type == 'large' ? 30 : (enemy.type == 'medium' ? 20 : 10)));
                const earnedScore = Math.floor(baseScore * comboMultiplier);
                score += earnedScore;
                addComboKill(earnedScore, enemy.type);
                enemy.drop();
                for (let k = 0; k < 25; k++) {
                    particles.push(new Particle(
                        enemy.x + Math.random() * enemy.w,
                        enemy.y + Math.random() * enemy.h,
                        '#f00', 2, 5, 30
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
    if (shopItems['Skill Up'].b < shopItems['Skill Up'].max) {
        items.push('Skill Up');
    }
    return items;
}

function refreshShop() {
    const refreshCost = 20 + shopRefreshCount * 15;
    if (playerMoney >= refreshCost) {
        playerMoney -= refreshCost;
        shopRefreshCount++;
        skillUpBoughtThisShop = false;
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

    dirX = 0; dirY = 0;

    let dx = 0, dy = 0;
    if (keys['a']) dx = -1;
    if (keys['d']) dx = 1;
    if (keys['w']) dy = -1;
    if (keys['s']) dy = 1;

    if (dx || dy) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        dirX = dx / mag; dirY = dy / mag;
        const speedMult = hasBuff('speed') ? 1.5 : 1;
        playerX = Math.max(0, Math.min(W - PW, playerX + dirX * playerSpeed * speedMult));
        playerY = Math.max(0, Math.min(H - PH, playerY + dirY * playerSpeed * speedMult));
    }

    if (keys['Shift'] && !isSliding && energy >= 10 && (dx || dy)) {
        playerSpeed = 5; isSliding = true; lastSlide = now; energy -= 10;
    }
    if (isSliding && now - lastSlide >= 100) { playerSpeed = 2.5; isSliding = false }

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

            if (b.x >= e.x && b.x <= e.x + e.w && b.y >= e.y && b.y <= e.y + e.h) {
                if (!b.hitEnemies) b.hitEnemies = new Set();
                if (b.hitEnemies.has(e)) return true;
                b.hitEnemies.add(e);

                const isCrit = checkCrit();
                const dmgBonus = hasBuff('damage') ? 1.5 : 1;
                const finalDmg = Math.floor(applyCritDamage(b.dmg, isCrit) * dmgBonus);
                e.hit(finalDmg);

                if (isCrit) {
                    for (let k = 0; k < 8; k++) {
                        particles.push(new Particle(b.x, b.y, '#ff0', 3, 5, 20));
                    }
                }

                if (e.hp <= 0) {
                    const baseScore = e.type == 'boss' ? (bossKills++, 200) : (e.type == 'elite' ? 50 : (e.type == 'large' ? 30 : (e.type == 'medium' ? 20 : 10)));
                    const earnedScore = Math.floor(baseScore * comboMultiplier);
                    score += earnedScore;
                    addComboKill(earnedScore, e.type);

                    if (e.type === 'elite' || e.type === 'large') {
                        spawnPowerUp(e.x + e.w / 2, e.y + e.h / 2);
                    }

                    e.drop();
                    const deathColor = e.type === 'elite' ? '#ffd700' : '#f00';
                    for (let k = 0; k < 20; k++) particles.push(new Particle(e.x + Math.random() * e.w, e.y + Math.random() * e.h, deathColor, 2, 4, 30));
                    return window.piercingBullets ? true : false;
                }

                return window.piercingBullets ? true : false;
            }
            return true;
        });

        if (!invincible && playerX < e.x + e.w && playerX + PW > e.x && playerY < e.y + e.h && playerY + PH > e.y) {
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

        return e.hp > 0;
    });

    particles = particles.filter(p => { p.update(); return p.lt > 0 });
    if (particles.length > 500) {
        particles = particles.slice(-500);
    }

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
            buffTexts.push({ text: `FAST CLEAR +${waveBonusEarned}`, y: H / 2 - 80, alpha: 1, color: '#0ff' });
        }

        spawnHealthPickup();
    }

    const restDuration = wave === 0 ? 15000 : 5000;
    if (isResting && now - restStart >= restDuration && !isShop) {
        isResting = false; wave++;
        bossSpawned = wave % 5 !== 0 ? false : bossSpawned;
        showWaveTransition(wave);
        neededSpawn = true;
    }

    if (neededSpawn && !isTransitionActive()) {
        neededSpawn = false;
        isResting = false;

        if (wave % 5 == 0 && !bossSpawned) {
            enemies.push(new Boss()); bossSpawned = true;
        } else if (wave % 5 == 1 && wave > 1) {
            isShop = true;
            isResting = false;
            skillUpBoughtThisShop = false;
            shopRefreshCount = 0;
            itemsToSell = generateShopItems();
        } else {
            const baseCount = Math.floor(wave * 1.5 + 3);
            const bonusCount = Math.floor(Math.random() * 3) - 1;
            const n = Math.max(3, baseCount + bonusCount);

            const eliteChance = wave >= 3 ? Math.min(0.15, (wave - 2) * 0.02) : 0;
            const largeChance = Math.min(0.25, wave * 0.02);
            const mediumChance = Math.min(0.4, 0.25 + wave * 0.01);

            for (let i = 0; i < n; i++) {
                const r = Math.random();
                let type;
                if (r < eliteChance) type = 'elite';
                else if (r < eliteChance + largeChance) type = 'large';
                else if (r < eliteChance + largeChance + mediumChance) type = 'medium';
                else type = 'small';
                enemies.push(new Enemy(type));
            }

            if (wave >= 3 && wave % 3 === 0 && wave % 5 !== 0) {
                enemies.push(new Enemy('elite'));
            }
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

        ctx.fillStyle = config.color + '40';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x - 3, p.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    if (comboKills >= 2) {
        ctx.save();
        const fadeAlpha = comboTimer < 500 ? comboTimer / 500 : 1;
        ctx.globalAlpha = fadeAlpha;

        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.05;

        ctx.font = `bold ${Math.floor(24 * pulse)}px Arial`;
        ctx.textAlign = 'center';
        const comboColor = comboKills >= 10 ? '#ff0' : (comboKills >= 5 ? '#f80' : '#fff');
        ctx.fillStyle = comboColor;
        ctx.fillText(`${comboKills}x COMBO`, W / 2, 80);

        if (comboMultiplier > 1) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#0f0';
            ctx.fillText(`Score x${comboMultiplier}`, W / 2, 100);
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha * 0.5})`;
        const barWidth = 100 * (comboTimer / 2500);
        ctx.fillRect(W / 2 - 50, 105, barWidth, 3);

        ctx.restore();
    }

    if (comboEndDisplay) {
        ctx.save();
        ctx.globalAlpha = comboEndDisplay.alpha;
        ctx.textAlign = 'center';

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ff0';
        ctx.fillText(`${comboEndDisplay.kills}x COMBO!`, W / 2, comboEndDisplay.y);

        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#0f0';
        ctx.fillText(`+${comboEndDisplay.score} pts`, W / 2, comboEndDisplay.y + 28);

        const bd = comboEndDisplay.breakdown;
        let breakdownParts = [];
        if (bd.small > 0) breakdownParts.push(`${bd.small}S`);
        if (bd.medium > 0) breakdownParts.push(`${bd.medium}M`);
        if (bd.large > 0) breakdownParts.push(`${bd.large}L`);
        if (bd.elite > 0) breakdownParts.push(`${bd.elite}E`);
        if (bd.boss > 0) breakdownParts.push(`${bd.boss}B`);

        if (breakdownParts.length > 0) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#aaa';
            ctx.fillText(breakdownParts.join(' â€¢ '), W / 2, comboEndDisplay.y + 50);
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

    let buffIndex = 0;
    Object.keys(activeBuffs).forEach(type => {
        if (hasBuff(type)) {
            const remaining = Math.ceil((activeBuffs[type] - Date.now()) / 1000);
            const config = POWER_UP_TYPES[type];
            const x = W - 30 - buffIndex * 30;
            const y = H - 30;

            ctx.fillStyle = config.color;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${remaining}`, x, y + 4);

            buffIndex++;
        }
    });

    bombProjectiles.forEach(bomb => {
        bomb.trail.forEach((t, i) => {
            const alpha = (t.life / 15) * 0.6;
            const size = 4 + (1 - t.life / 15) * 8;
            ctx.fillStyle = `rgba(255, ${100 + i * 10}, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.save();
        ctx.translate(bomb.x, bomb.y);
        ctx.rotate(bomb.angle);

        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-bomb.radius - 15, 0);
        ctx.lineTo(-bomb.radius, -5);
        ctx.lineTo(-bomb.radius, 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.ellipse(0, 0, bomb.radius, bomb.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.ellipse(bomb.radius * 0.3, -2, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(bomb.radius * 0.8, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });

    drawPlayer();
    if (isResting) drawHealthPickup();
    drawUI();
    if (isShop) drawShop();
    drawWaveTransition();

    if (isPaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);

        const lang = typeof getLang === 'function' ? getLang() : { paused: 'PAUSED', resume: 'RESUME', restart: 'RESTART', backToMenu: 'MAIN MENU' };

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(lang.paused, W / 2, H / 2 - 80);

        const btnW = 220, btnH = 50;
        const btnX = W / 2 - btnW / 2;

        const buttons = [
            { text: lang.resume || 'RESUME', y: H / 2 - 10, color: 'rgba(50, 200, 50, 0.8)' },
            { text: lang.restart || 'RESTART', y: H / 2 + 55, color: 'rgba(255, 165, 0, 0.8)' },
            { text: lang.backToMenu || 'MAIN MENU', y: H / 2 + 120, color: 'rgba(255, 60, 60, 0.8)' }
        ];

        buttons.forEach(btn => {
            ctx.fillStyle = btn.color;
            ctx.beginPath();
            ctx.roundRect(btnX, btn.y, btnW, btnH, 10);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 22px Arial';
            ctx.fillText(btn.text, W / 2, btn.y + 32);
        });

        ctx.textAlign = 'left';
    }



    ctx.restore();
}

let animationFrameId = null;

function gameLoop() {
    update(); draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    document.getElementById('mainMenu').classList.add('hidden');
    canvas.style.display = 'block';

    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.classList.add('hidden');

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    gameRunning = true;
    resetGame();
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
    canvas.style.display = 'none';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalWave').textContent = wave;
    document.getElementById('gameOverScreen').classList.remove('hidden');

    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.classList.remove('hidden');

    loadGameOverLeaderboard();
}

function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startGame();
}

function showMainMenu() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');

    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.classList.remove('hidden');
}

function showInstructions() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('instructionsScreen').classList.remove('hidden');
}

function hideInstructions() {
    document.getElementById('instructionsScreen').classList.add('hidden');
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
        canvas.style.display = 'none';
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

                if (item === 'Skill Up') skillUpBoughtThisShop = true;
            });
            selectedItems = [];
        } else if (e.key === 'r' || e.key === 'R') {
            refreshShop();
        } else if (e.key == 'Escape') {
            selectedItems = [];
            isShop = false;
        }
    }
});

document.addEventListener('keyup', e => { keys[e.key] = false });

canvas.addEventListener('click', e => {
    if (isPaused) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const btnW = 220, btnH = 50;
        const btnX = W / 2 - btnW / 2;

        if (mx >= btnX && mx <= btnX + btnW && my >= H / 2 - 10 && my <= H / 2 - 10 + btnH) {
            isPaused = false;
        }

        if (mx >= btnX && mx <= btnX + btnW && my >= H / 2 + 55 && my <= H / 2 + 55 + btnH) {
            resetGame();
        }

        if (mx >= btnX && mx <= btnX + btnW && my >= H / 2 + 120 && my <= H / 2 + 120 + btnH) {
            isPaused = false;
            showMainMenu();
        }
        return;
    }

    if (!isShop) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const startY = 190, spacing = 65;
    itemsToSell.forEach((item, i) => {
        const y = startY + i * spacing;
        const bw = 420, bh = 55, bx = W / 2 - bw / 2, by = y - 8;

        if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
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

    const btnY1 = H - 150, btnY2 = H - 95, btnY3 = H - 45;
    const btnW = 300, btnH = 45;

    if (mx >= W / 2 - btnW / 2 && mx <= W / 2 + btnW / 2 && my >= btnY1 && my <= btnY1 + btnH) {
        if (selectedItems.length > 0) {
            const total = selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
            if (playerMoney >= total) {
                selectedItems.forEach(item => {
                    const price = getItemPrice(item);
                    playerMoney -= price;
                    shopItems[item].b++;
                    applyItem(item);

                    if (item === 'Skill Up') skillUpBoughtThisShop = true;
                });
                selectedItems = [];
            }
        }
    }

    if (mx >= W / 2 - btnW / 2 && mx <= W / 2 + btnW / 2 && my >= btnY2 && my <= btnY2 + btnH) {
        refreshShop();
    }

    if (mx >= W / 2 - btnW / 2 && mx <= W / 2 + btnW / 2 && my >= btnY3 && my <= btnY3 + btnH) {
        selectedItems = [];
        isShop = false;
    }
});

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainMenu').classList.remove('hidden');
    }, 1000);
});
