function showLeaderboard() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.remove('hidden');
    loadLeaderboard();
}

function hideLeaderboard() {
    document.getElementById('leaderboardScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

function getLangText(key, fallback) {
    if (typeof getLang === 'function') {
        const lang = getLang();
        return lang[key] || fallback;
    }
    return fallback;
}

function loadLeaderboard() {
    const content = document.getElementById('leaderboardContent');
    content.innerHTML = `<div class="loading">${getLangText('loadingScores', 'Đang tải...')}</div>`;

    if (!window.leaderboardRef) {
        content.innerHTML = `<div class="loading">Lỗi: Firebase chưa kết nối!</div>`;
        return;
    }

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    const loadPromise = window.leaderboardRef.orderByChild('score').limitToLast(10).once('value');

    Promise.race([loadPromise, timeoutPromise])
        .then(snapshot => {
            const scores = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    scores.push({
                        key: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
            }

            scores.reverse();

            if (scores.length === 0) {
                content.innerHTML = `<div class="loading">${getLangText('noScores', 'Chưa có điểm nào!')}</div>`;
                return;
            }

            displayLeaderboardTable(scores);
        })
        .catch(error => {
            console.error('Lỗi tải leaderboard:', error);
            content.innerHTML = `<div class="loading">Lỗi tải dữ liệu: ${error.message}</div>`;
        });
}

function displayLeaderboardTable(scores) {
    const content = document.getElementById('leaderboardContent');

    let html = '<table class="leaderboard-table">';
    html += `<thead><tr><th>${getLangText('rank', 'Hạng')}</th><th>${getLangText('name', 'Tên')}</th><th>${getLangText('score', 'Điểm')}</th><th>${getLangText('wave', 'Wave')}</th></tr></thead>`;
    html += '<tbody>';

    scores.forEach((entry, index) => {
        const rank = index + 1;
        let rowClass = '';

        if (rank === 1) rowClass = 'rank-1';
        else if (rank === 2) rowClass = 'rank-2';
        else if (rank === 3) rowClass = 'rank-3';

        if (window.lastSubmittedKey && entry.key === window.lastSubmittedKey) {
            rowClass += ' current-player';
        }

        html += `<tr class="${rowClass}">`;
        html += `<td>${rank}</td>`;
        html += `<td>${escapeHtml(entry.name)}</td>`;
        html += `<td>${entry.score}</td>`;
        html += `<td>${entry.wave}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    content.innerHTML = html;
}

function submitScore() {
    const nameInput = document.getElementById('playerName');
    const playerName = nameInput.value.trim();

    if (!playerName) {
        alert(getLangText('enterNameAlert', 'Vui lòng nhập tên!'));
        nameInput.focus();
        return;
    }

    if (playerName.length > 20) {
        alert(getLangText('nameTooLong', 'Tên không được quá 20 ký tự!'));
        nameInput.focus();
        return;
    }

    const finalScore = parseInt(document.getElementById('finalScore').textContent);
    const finalWave = parseInt(document.getElementById('finalWave').textContent);

    const scoreEntry = {
        name: playerName,
        score: finalScore,
        wave: finalWave,
        timestamp: Date.now()
    };

    window.leaderboardRef.push(scoreEntry)
        .then((ref) => {
            window.lastSubmittedKey = ref.key;
            localStorage.setItem('playerName', playerName);
            alert(getLangText('submitSuccess', 'Gửi điểm thành công!'));
            document.getElementById('gameOverScreen').classList.add('hidden');
            showLeaderboard();
        })
        .catch(error => {
            console.error('Lỗi gửi điểm:', error);
            alert('Lỗi kết nối. Vui lòng thử lại.');
        });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function cleanupLeaderboard() {
    window.leaderboardRef.orderByChild('score').once('value')
        .then(snapshot => {
            const scores = [];
            snapshot.forEach(childSnapshot => {
                scores.push({
                    key: childSnapshot.key,
                    score: childSnapshot.val().score
                });
            });

            scores.sort((a, b) => b.score - a.score);

            if (scores.length > 100) {
                for (let i = 100; i < scores.length; i++) {
                    window.leaderboardRef.child(scores[i].key).remove();
                }
            }
        })
        .catch(error => {
            console.error('Lỗi cleanup:', error);
        });
}

function loadGameOverLeaderboard() {
    const content = document.getElementById('gameOverLeaderboardContent');
    if (!content) return;

    content.innerHTML = '<div class="loading">Đang tải top 10...</div>';

    if (!window.leaderboardRef) {
        content.innerHTML = '<div class="loading">Lỗi: Firebase chưa init!</div>';
        return;
    }

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 8000);
    });

    const loadPromise = window.leaderboardRef.orderByChild('score').limitToLast(10).once('value');

    Promise.race([loadPromise, timeoutPromise])
        .then(snapshot => {
            const scores = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    scores.push({
                        key: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
            }

            scores.reverse();

            if (scores.length === 0) {
                content.innerHTML = '<div class="loading">Chưa có điểm!</div>';
                return;
            }

            let html = '<table class="leaderboard-table compact">';
            html += `<thead><tr><th>#</th><th>${getLangText('name', 'Tên')}</th><th>${getLangText('score', 'Điểm')}</th></tr></thead>`;
            html += '<tbody>';

            scores.forEach((entry, index) => {
                const rank = index + 1;
                let rowClass = rank <= 3 ? `rank-${rank}` : '';

                html += `<tr class="${rowClass}">`;
                html += `<td>${rank}</td>`;
                html += `<td>${escapeHtml(entry.name)}</td>`;
                html += `<td>${entry.score}</td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';
            content.innerHTML = html;
        })
        .catch(error => {
            console.error('Lỗi tải leaderboard:', error);
            content.innerHTML = `<div class="loading">Lỗi: ${error.message}</div>`;
        });
}

function updateRankPreview(playerScore) {
    const rankPreviewEl = document.getElementById('rankPreview');
    if (!rankPreviewEl || !window.leaderboardRef) return;

    window.leaderboardRef.orderByChild('score').once('value')
        .then(snapshot => {
            const scores = [];
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    scores.push(childSnapshot.val().score);
                });
            }

            scores.sort((a, b) => b - a);

            let rank = 1;
            for (const s of scores) {
                if (playerScore >= s) break;
                rank++;
            }

            const lang = typeof getLang === 'function' ? getLang() : {};
            const template = lang.rankPreview || 'You would rank #{rank}!';

            if (rank <= 10) {
                rankPreviewEl.innerHTML = `<strong style="color: #ffd700;">🔥 ${template.replace('{rank}', rank)}</strong>`;
            } else {
                rankPreviewEl.textContent = template.replace('{rank}', rank);
            }
        })
        .catch(() => {
            rankPreviewEl.textContent = '';
        });
}

