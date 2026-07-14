import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "네 Firebase apiKey",
  authDomain: "nasa-mission-game.firebaseapp.com",
  databaseURL:
    "https://nasa-mission-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nasa-mission-game",
  storageBucket: "nasa-mission-game.firebasestorage.app",
  messagingSenderId: "62363577124",
  appId: "네 Firebase appId",
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

// App.jsx를 수정하지 않아도 되도록 이름은 그대로 유지
export async function ensureSignedIn() {
  return {
    uid: getPlayerId(),
  };
}