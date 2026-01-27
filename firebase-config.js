const firebaseConfig = {
    apiKey: "AIzaSyAO7VOR8lmJ4PsZ9IfG1TWeyNwgcqkFuTg",
    authDomain: "space-shooter-game-aba9c.firebaseapp.com",
    projectId: "space-shooter-game-aba9c",
    storageBucket: "space-shooter-game-aba9c.firebasestorage.app",
    messagingSenderId: "36541489910",
    appId: "1:36541489910:web:01fdb3d4e5de2aa93fc2d7",
    measurementId: "G-K56TY900ES"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    console.log("Firebase initialized successfully!");
} catch (error) {
    console.error("Firebase initialization error:", error);
    alert("Firebase not configured! Please update firebase-config.js with your Firebase credentials.");
}

// Database reference for leaderboard
const leaderboardRef = database.ref('leaderboard');
