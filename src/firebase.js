import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCrqtaaEltWuVgZCom2PfWSQBkVbe9e69Q",
  authDomain: "nasa-mission-game.firebaseapp.com",
  databaseURL:
    "https://nasa-mission-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nasa-mission-game",
  storageBucket: "nasa-mission-game.firebasestorage.app",
  messagingSenderId: "62363577124",
  appId: "1:62363577124:web:1960a88f86996a6b81e1b1",
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);

function getPlayerId() {
  const storageKey = "nasaMissionPlayerId";
  let playerId = localStorage.getItem(storageKey);

  if (!playerId) {
    playerId =
      "player_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substring(2, 10);

    localStorage.setItem(storageKey, playerId);
  }

  return playerId;
}

export async function ensureSignedIn() {
  return {
    uid: getPlayerId(),
  };
}