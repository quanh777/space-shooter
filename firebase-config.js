const firebaseConfig = {
    apiKey: "AIzaSyAO7VOR8lmJ4PsZ9IfG1TWeyNwgcqkFuTg",
    authDomain: "space-shooter-game-aba9c.firebaseapp.com",
    databaseURL: "https://space-shooter-game-aba9c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "space-shooter-game-aba9c",
    storageBucket: "space-shooter-game-aba9c.firebasestorage.app",
    messagingSenderId: "36541489910",
    appId: "1:36541489910:web:d9019afb23c82c433fc2d7",
    measurementId: "G-WV3WYWWJ2M"
};

try {
    firebase.initializeApp(firebaseConfig);
    window.database = firebase.database();
    window.leaderboardRef = window.database.ref('leaderboard');
    console.log("Firebase initialized successfully!");
} catch (error) {
    console.error("Firebase initialization error:", error);
    alert("Firebase not configured! Please update firebase-config.js with your Firebase credentials.");
}
