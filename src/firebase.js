import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import {
  getAuth,
  signInAnonymously,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "Firebase 화면의 apiKey",
  authDomain: "nasa-mission-game.firebaseapp.com",
  databaseURL:
    "https://nasa-mission-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nasa-mission-game",
  storageBucket: "nasa-mission-game.firebasestorage.app",
  messagingSenderId: "62363577124",
  appId: "Firebase 화면의 appId",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

export async function ensureSignedIn() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);
  return result.user;
}