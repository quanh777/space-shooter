import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, ref, type Database, type DatabaseReference } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAO7VOR8lmJ4PsZ9IfG1TWeyNwgcqkFuTg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'space-shooter-game-aba9c.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    'https://space-shooter-game-aba9c-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'space-shooter-game-aba9c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'space-shooter-game-aba9c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '36541489910',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:36541489910:web:d9019afb23c82c433fc2d7',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-WV3WYWWJ2M',
};

let app: FirebaseApp | null = null;
let database: Database | null = null;
let leaderboardRef: DatabaseReference | null = null;

export function isFirebaseReady(): boolean {
  return database !== null && leaderboardRef !== null;
}

export function getLeaderboardRef(): DatabaseReference | null {
  if (leaderboardRef) return leaderboardRef;
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    leaderboardRef = ref(database, 'leaderboard');
    return leaderboardRef;
  } catch (err) {
    console.warn('[Firebase] Initialization skipped or failed:', err);
    return null;
  }
}
