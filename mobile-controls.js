
let joystickActive = false;
let joystickData = { x: 0, y: 0 };
let isMobileDevice = false;

function initMobileControls() {
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 850;

    if (isMobileDevice) {
        setupJoystick();
        setupActionButtons();
    }
}

function showMobileControls() {
    if (!isMobileDevice) return;
    const controls = document.getElementById('mobileControls');
    if (controls) controls.classList.remove('hidden');
}

function hideMobileControls() {
    const controls = document.getElementById('mobileControls');
    if (controls) controls.classList.add('hidden');
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
        e.stopPropagation();
        if (typeof isPaused !== 'undefined') {
            isPaused = !isPaused;
        }
        if (typeof handlePause === 'function') {
            handlePause();
        } else {
            keys['Escape'] = true;
            setTimeout(() => keys['Escape'] = false, 100);
        }
    });
}

window.addEventListener('load', () => {
    initMobileControls();
});
