
function drawPlayer() {
    const cx = playerX + PW / 2, cy = playerY + PH / 2;
    ctx.save();

    if (dirX != 0 || dirY != 0) {
        const angle = Math.atan2(dirY, dirX);
        ctx.translate(cx, cy); ctx.rotate(angle); ctx.translate(-cx, -cy);

        if (Math.random() < 0.3) {
            const ex = cx - Math.cos(angle) * PW / 2, ey = cy - Math.sin(angle) * PH / 2;
            particles.push(new Particle(ex, ey, isSliding ? 'rgb(100,200,255)' : 'rgb(100,150,255)', isSliding ? 3 : 1.5, isSliding ? 5 : 3, isSliding ? 15 : 10));
        }

        ctx.fillStyle = '#00f'; ctx.beginPath();
        ctx.moveTo(cx + PW / 2, cy);
        ctx.lineTo(cx - PW / 3, cy + PH / 4);
        ctx.lineTo(cx - PW / 3, cy - PH / 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgb(100,100,255)'; ctx.beginPath();
        ctx.moveTo(cx + PW / 4, cy);
        ctx.lineTo(cx - PW / 6, cy + PH / 8);
        ctx.lineTo(cx - PW / 6, cy - PH / 8);
        ctx.closePath(); ctx.fill();
    } else {
        ctx.fillStyle = '#00f'; ctx.beginPath();
        ctx.moveTo(cx, cy - PH / 2);
        ctx.lineTo(cx + PW / 2, cy);
        ctx.lineTo(cx, cy + PH / 2);
        ctx.lineTo(cx - PW / 2, cy);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgb(100,100,255)'; ctx.beginPath();
        ctx.moveTo(cx, cy - PH / 4);
        ctx.lineTo(cx + PW / 4, cy);
        ctx.lineTo(cx, cy + PH / 4);
        ctx.lineTo(cx - PW / 4, cy);
        ctx.closePath(); ctx.fill();
    }

    if (isSliding) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgb(100,100,255)';
        ctx.beginPath(); ctx.ellipse(cx, cy, PW, PH, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 2; i++) particles.push(new Particle(playerX + Math.random() * PW, playerY + Math.random() * PH, 'rgb(150,150,255)', 2, 4, 10));
    }

    if (invincible) {
        const pulse = (Date.now() % 500) / 500;
        ctx.globalAlpha = 0.4 * pulse;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(cx, cy, PW, PH, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

function drawGradientBar(x, y, w, h, val, maxVal, colors, label) {
    for (let i = 0; i < w; i++) {
        const g = `rgb(${Math.floor(colors.bg.r + i / w * (colors.bg2.r - colors.bg.r))},${Math.floor(colors.bg.g + i / w * (colors.bg2.g - colors.bg.g))},${Math.floor(colors.bg.b + i / w * (colors.bg2.b - colors.bg.b))})`;
        ctx.fillStyle = g; ctx.fillRect(x + i, y, 1, h);
    }
    const fill = Math.min(w, Math.floor(val / maxVal * w));
    for (let i = 0; i < fill; i++) {
        const colSet = val > maxVal * 0.7 ? colors.high : (val > maxVal * 0.3 ? colors.mid : colors.low);
        const g = `rgb(${Math.floor(colSet.r + i / 100 * 50)},${Math.floor(colSet.g + i / 100 * (colSet.g < 200 ? 100 : 55))},${Math.floor(colSet.b + i / 100 * 50)})`;
        ctx.fillStyle = g; ctx.fillRect(x + i, y, 1, h);
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff'; ctx.font = '20px Arial'; ctx.fillText(label, x + w + 5, y + h);
}

function drawUI() {
    drawGradientBar(10, 30, 100, 10, playerHealth, maxHealth, {
        bg: { r: 40, g: 10, b: 10 }, bg2: { r: 80, g: 40, b: 40 },
        high: { r: 100, g: 200, b: 30 }, mid: { r: 200, g: 200, b: 30 }, low: { r: 200, g: 30, b: 30 }
    }, 'Health');

    drawGradientBar(10, 10, 100, 10, energy, 100, {
        bg: { r: 20, g: 20, b: 60 }, bg2: { r: 50, g: 50, b: 120 },
        high: { r: 30, g: 100, b: 200 }, mid: { r: 30, g: 100, b: 200 }, low: { r: 30, g: 100, b: 200 }
    }, 'Energy');

    const now = Date.now();

    if (now - lastSlide < 2000) {
        const pct = (now - lastSlide) / 2000;
        ctx.fillStyle = '#666';
        ctx.fillRect(10, 22, Math.floor(100 * pct), 3);
    }

    const sx = 10, sy = H - 60;
    ctx.fillStyle = 'rgba(255,0,0,0.7)';
    ctx.fillRect(sx, sy, 40, 40);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, 40, 40);

    const cdPct = (now - skill.lastUse) / skill.cooldown;
    if (cdPct < 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx, sy, 40, Math.floor(40 * (1 - cdPct)));
    } else {
        const pulse = Math.sin(now * 0.008) * 0.3 + 0.3;
        ctx.strokeStyle = `rgba(100, 255, 150, ${pulse + 0.4})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - 2, sy - 2, 44, 44);
    }

    ctx.fillStyle = '#fff';
    for (let i = 0; i < skill.level; i++) {
        ctx.beginPath(); ctx.arc(sx + 5 + i * 8, sy + 5, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = '16px Arial'; ctx.fillText('E', sx + 15, sy + 28);

    ctx.fillStyle = '#fff'; ctx.font = '20px Arial';
    ctx.fillText(`Wave: ${wave}`, 10, H - 90);
    ctx.fillText(`Score: ${score}`, 10, H - 120);
    ctx.fillStyle = '#ff0';
    ctx.fillText(`Money: ${playerMoney}`, 10, H - 150);

    let py = 50;
    if (doubleShot) { ctx.fillText('Double Shot', W - 150, py); py += 25 }
    if (tripleShot) { ctx.fillText('Triple Shot', W - 150, py); py += 25 }

    if (invincible) {
        const shieldDuration = 1250 + (shopItems["Shield"].b * 750);
        const remaining = Math.ceil((shieldDuration - (now - invTime)) / 1000 * 10) / 10;
        ctx.fillStyle = '#0ff';
        ctx.fillText(`Shield: ${remaining.toFixed(1)}s`, W - 150, py);
        ctx.fillStyle = '#fff';
        py += 25;
    }

    if (shieldCooldown > 0) {
        const cdRemaining = Math.ceil(shieldCooldown / 1000);
        ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.fillText(`Shield CD: ${cdRemaining}s`, W - 160, py);
        ctx.fillStyle = '#fff';
        py += 25;
    } else if (!invincible) {
        ctx.fillStyle = '#0f0';
        ctx.fillText('Shield: Ready', W - 160, py);
        ctx.fillStyle = '#fff';
        py += 25;
    }

    if (wave === 0 && tutorialCircle) {
        const tc = tutorialCircle;
        const pulseSize = Math.sin(tc.pulse) * 10;
        ctx.strokeStyle = `rgba(100, 255, 100, ${0.5 + Math.sin(tc.pulse) * 0.3})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, tc.radius + pulseSize, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(100, 255, 100, 0.2)';
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, tc.radius, 0, Math.PI * 2);
        ctx.fill();

        const progress = tutorialProgress / 2000;
        if (progress > 0) {
            ctx.strokeStyle = 'rgba(100, 255, 100, 0.8)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(tc.x, tc.y, tc.radius - 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
            ctx.stroke();
        }

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Enter to Start', tc.x, tc.y - 10);

        const remaining = Math.ceil((2000 - tutorialProgress) / 1000);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`Hold: ${remaining}s`, tc.x, tc.y + 15);
        ctx.textAlign = 'left';
    }

    if (isResting && wave >= 0 && !isShop) {
        const duration = wave === 0 ? 15000 : 5000;
        const remain = Math.ceil((duration - (now - restStart)) / 1000);
        ctx.fillStyle = 'rgb(200,200,255)';
        ctx.font = '20px Arial';

        if (wave === 0) {
            ctx.fillText(`Tutorial - Wave 1 in: ${remain}s`, W - 220, 25);
            ctx.font = '16px Arial';
            ctx.fillStyle = 'rgba(200,200,255,0.7)';
            ctx.fillText('Practice your movement!', W - 180, 50);
        } else {
            ctx.fillText(`Next wave in: ${remain}s`, W - 180, 25);
        }
    }
}

function drawShop() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center';
    ctx.fillText('SHOP', W / 2, 60);

    ctx.font = '32px Arial'; ctx.fillStyle = 'rgb(200,200,255)';
    ctx.fillText(`Wave ${wave} Completed!`, W / 2, 105);

    const flashTime = Date.now() % 600 < 300;
    const canAffordAny = selectedItems.length > 0 && playerMoney >= selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
    const moneyColor = selectedItems.length == 0 ? '#ff0' : (canAffordAny ? '#6f6' : (flashTime ? '#f33' : '#f66'));
    ctx.fillStyle = moneyColor;
    ctx.font = '24px Arial';
    ctx.fillText(`Your Money: ${playerMoney}`, W / 2, 140);

    if (selectedItems.length > 0) {
        const total = selectedItems.reduce((sum, item) => sum + getItemPrice(item), 0);
        const remaining = playerMoney - total;
        ctx.font = '20px Arial';
        ctx.fillStyle = remaining >= 0 ? '#6f6' : '#f66';
        ctx.fillText(`Total: ${total} | Remaining: ${remaining}`, W / 2, 165);
    }

    const startY = 190, spacing = 65;
    itemsToSell.forEach((item, i) => {
        const itm = shopItems[item];
        const price = getItemPrice(item);
        const maxed = itm.max !== -1 && itm.b >= itm.max;
        const skillUpLimited = item === 'Skill Up' && skillUpBoughtThisShop;
        const afford = playerMoney >= price;
        const sel = selectedItems.includes(item);

        const y = startY + i * spacing;
        const bw = 420, bh = 55, bx = W / 2 - bw / 2, by = y - 8;

        const canSelect = afford && !maxed && !skillUpLimited;
        ctx.globalAlpha = canSelect ? 1 : 0.4;
        ctx.fillStyle = sel ? 'rgb(100,150,100)' : (maxed || skillUpLimited ? 'rgb(100,100,100)' : (afford ? 'rgb(50,50,80)' : 'rgb(80,50,50)'));
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 10);
        ctx.fill();
        ctx.globalAlpha = 1;

        const textColor = maxed || skillUpLimited ? 'rgb(150,150,150)' : (afford ? 'rgb(200,255,200)' : 'rgb(255,150,150))');
        ctx.fillStyle = textColor;
        ctx.font = '22px Arial'; ctx.textAlign = 'center';
        const priceText = maxed ? 'MAX' : (skillUpLimited ? 'BOUGHT' : `${price}$`);
        ctx.fillText(`${i + 1}. ${item}: ${priceText}`, W / 2, y + 12);

        ctx.font = '16px Arial'; ctx.fillStyle = 'rgb(180,180,180)';
        const lang = typeof getLang === 'function' ? getLang() : null;
        const desc = item == 'Skill Up'
            ? `Upgrade bomb (Lv ${skill.level}/${skill.maxLvl})`
            : (lang && itm.descVI ? (lang === LANGUAGES.vi ? itm.descVI : itm.desc) : itm.desc);
        ctx.fillText(desc, W / 2, y + 32);

        if (item != 'Skill Up' && itm.max !== -1) {
            ctx.font = '16px Arial'; ctx.fillStyle = 'rgb(150,150,150)'; ctx.textAlign = 'right';
            ctx.fillText(`${itm.b}/${itm.max}`, bx + bw - 8, y + 10);
        }
    });

    const btnY1 = H - 150, btnY2 = H - 95, btnY3 = H - 45;
    const btnW = 300, btnH = 45;

    const canBuy = selectedItems.length > 0 && canAffordAny;
    ctx.fillStyle = canBuy ? 'rgb(50,120,50)' : 'rgb(70,70,70)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - btnW / 2, btnY1, btnW, btnH, 10);
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
    ctx.fillText('BUY (Enter)', W / 2, btnY1 + 30);

    const refreshCost = 20 + shopRefreshCount * 15;
    const canRefresh = playerMoney >= refreshCost;
    ctx.fillStyle = canRefresh ? 'rgb(50,80,140)' : 'rgb(60,60,80)';
    ctx.globalAlpha = canRefresh ? 1 : 0.5;
    ctx.beginPath();
    ctx.roundRect(W / 2 - btnW / 2, btnY2, btnW, btnH, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = canRefresh ? '#fff' : '#aaa'; ctx.font = 'bold 22px Arial';
    ctx.fillText(`REFRESH (${refreshCost}$)`, W / 2, btnY2 + 28);

    ctx.fillStyle = 'rgb(120,50,50)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - btnW / 2, btnY3, btnW, btnH, 10);
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial';
    ctx.fillText('SKIP (ESC)', W / 2, btnY3 + 28);

    ctx.textAlign = 'left';
}
