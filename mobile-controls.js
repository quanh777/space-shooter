
let joystickActive = false;
let joystickData = { x: 0, y: 0 };

function initMobileControls() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 850;

    if (isMobile) {
        document.getElementById('mobileControls').classList.remove('hidden');
        setupJoystick();
        setupActionButtons();
        setupCanvasTouch();
    }
}

function setupJoystick() {
    const joystick = document.getElementById('joystick');
    const inner = joystick.querySelector('.joystick-inner');

    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
    });

    joystick.addEventListener('touchmove', (e) => {
        if (!joystickActive) return;
        e.preventDefault();

        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const touch = e.touches[0];
        const deltaX = touch.clientX - centerX;
        const deltaY = touch.clientY - centerY;

        const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), 35);
        const angle = Math.atan2(deltaY, deltaX);

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        inner.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        // Provide smooth analog values (-1 to 1)
        joystickData.x = deltaX / 35;
        joystickData.y = deltaY / 35;
    });

    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        inner.style.transform = 'translate(-50%, -50%)';
        joystickData = { x: 0, y: 0 };
    });
}

function setupActionButtons() {
    const shootBtn = document.getElementById('shootBtn');
    const skillBtn = document.getElementById('skillBtn');
    const dashBtn = document.getElementById('dashBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[' '] = true;
    });

    shootBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[' '] = false;
    });

    skillBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys['e'] = true;
    });

    skillBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys['e'] = false;
    });

    dashBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys['Shift'] = true;
    });

    dashBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys['Shift'] = false;
    });

    pauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys['Escape'] = true;
        setTimeout(() => keys['Escape'] = false, 100);
    });
}

function setupCanvasTouch() {
    const canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('touchstart', (e) => {
        if (typeof isShop === 'undefined' || !isShop) return;

        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const touch = e.touches[0];
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;

        handleShopTouch(x, y);
    });
}

function handleShopTouch(x, y) {
    const startY = 190;
    const spacing = 65;
    const btnHeight = 55;
    const btnWidth = 420;
    const btnX = W / 2 - btnWidth / 2;

    if (typeof itemsToSell !== 'undefined') {
        itemsToSell.forEach((item, i) => {
            const itemY = startY + i * spacing - 8;
            if (x >= btnX && x <= btnX + btnWidth && y >= itemY && y <= itemY + btnHeight) {
                const itm = shopItems[item];
                const price = getItemPrice(item);
                const maxed = itm.max !== -1 && itm.b >= itm.max;
                const skillUpLimited = item === 'Skill Up' && skillUpBoughtThisShop;
                const afford = playerMoney >= price;

                if (!maxed && !skillUpLimited && afford) {
                    const idx = selectedItems.indexOf(item);
                    if (idx !== -1) {
                        selectedItems.splice(idx, 1);
                    } else {
                        selectedItems.push(item);
                    }
                }
            }
        });
    }

    const btnY1 = H - 150;
    const btnY2 = H - 95;
    const btnY3 = H - 45;
    const btnH = 45;
    const btnW = 300;
    const btnCenterX = W / 2 - btnW / 2;

    if (x >= btnCenterX && x <= btnCenterX + btnW) {
        if (y >= btnY1 && y <= btnY1 + btnH) {
            keys['Enter'] = true;
            setTimeout(() => keys['Enter'] = false, 100);
        } else if (y >= btnY2 && y <= btnY2 + btnH) {
            keys['r'] = true;
            setTimeout(() => keys['r'] = false, 100);
        } else if (y >= btnY3 && y <= btnY3 + btnH) {
            keys['Escape'] = true;
            setTimeout(() => keys['Escape'] = false, 100);
        }
    }
}

window.addEventListener('load', () => {
    initMobileControls();
});
