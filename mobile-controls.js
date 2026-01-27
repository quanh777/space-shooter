// === MOBILE CONTROLS - Điều khiển cảm ứng ===

let joystickActive = false;
let joystickData = { x: 0, y: 0 };

function initMobileControls() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 850;

    if (isMobile) {
        document.getElementById('mobileControls').classList.remove('hidden');
        setupJoystick();
        setupActionButtons();
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

        // Chuẩn hoá -1 đến 1
        joystickData.x = deltaX / 35;
        joystickData.y = deltaY / 35;

        // Giả lập phím WASD
        keys['w'] = joystickData.y < -0.3;
        keys['s'] = joystickData.y > 0.3;
        keys['a'] = joystickData.x < -0.3;
        keys['d'] = joystickData.x > 0.3;
    });

    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        inner.style.transform = 'translate(-50%, -50%)';
        joystickData = { x: 0, y: 0 };
        keys['w'] = keys['s'] = keys['a'] = keys['d'] = false;
    });
}

function setupActionButtons() {
    const shootBtn = document.getElementById('shootBtn');
    const skillBtn = document.getElementById('skillBtn');

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
}

window.addEventListener('load', () => {
    initMobileControls();
});
