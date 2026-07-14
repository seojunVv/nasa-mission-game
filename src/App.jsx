import { useEffect, useState } from "react";
import {
  get,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";

import "./App.css";
import SoloMission from "./SoloMission";
import { db, ensureSignedIn } from "./firebase";

function generateRoomCode() {
  return Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase();
}

function App() {
  const [page, setPage] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const multiplayerPages = [
      "role",
      "astronaut",
      "engineer",
    ];

    if (!roomCode || !multiplayerPages.includes(page)) {
      return undefined;
    }

    const roomReference = ref(db, `rooms/${roomCode}`);

    const unsubscribe = onValue(
      roomReference,
      (snapshot) => {
        if (snapshot.exists()) {
          setRoomData(snapshot.val());
        } else {
          setRoomData(null);
        }
      },
      (error) => {
        console.error("Room listener error:", error);
      }
    );

    return unsubscribe;
  }, [roomCode, page]);

  async function createRoom() {
    try {
      setLoading(true);

      const user = await ensureSignedIn();
      setUserId(user.uid);

      let newCode = "";

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = generateRoomCode();
        const snapshot = await get(
          ref(db, `rooms/${candidate}`)
        );

        if (!snapshot.exists()) {
          newCode = candidate;
          break;
        }
      }

      if (!newCode) {
        throw new Error("Unable to generate a room code.");
      }

      await set(ref(db, `rooms/${newCode}`), {
        mission: "apollo13",
        status: "lobby",
        createdAt: Date.now(),
        hostUid: user.uid,

        players: {
          [user.uid]: {
            role: "unselected",
            joinedAt: Date.now(),
          },
        },
      });

      setRoomCode(newCode);
      setPage("role");
    } catch (error) {
      console.error("Create room error:", error);
      alert(
        "Could not create the room. Check Firebase Authentication and Database Rules."
      );
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    const cleanedCode = roomCode.trim().toUpperCase();

    if (cleanedCode.length !== 5) {
      alert("Enter a 5-character room code.");
      return;
    }

    try {
      setLoading(true);

      const user = await ensureSignedIn();
      setUserId(user.uid);

      const roomReference = ref(
        db,
        `rooms/${cleanedCode}`
      );

      const snapshot = await get(roomReference);

      if (!snapshot.exists()) {
        alert("Room not found.");
        return;
      }

      const existingRoom = snapshot.val();
      const existingPlayers = existingRoom.players ?? {};

      const isAlreadyInside = Boolean(
        existingPlayers[user.uid]
      );

      if (
        !isAlreadyInside &&
        Object.keys(existingPlayers).length >= 2
      ) {
        alert("This room is already full.");
        return;
      }

      await update(
        ref(
          db,
          `rooms/${cleanedCode}/players/${user.uid}`
        ),
        {
          role:
            existingPlayers[user.uid]?.role ??
            "unselected",
          joinedAt:
            existingPlayers[user.uid]?.joinedAt ??
            Date.now(),
        }
      );

      setRoomCode(cleanedCode);
      setPage("role");
    } catch (error) {
      console.error("Join room error:", error);
      alert(
       `${error.code ?? "UNKNOWN ERROR"}\n${error.message}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function chooseRole(role) {
    try {
      setLoading(true);

      const user = await ensureSignedIn();
      setUserId(user.uid);

      const players = roomData?.players ?? {};

      const roleTaken = Object.entries(players).some(
        ([playerUid, player]) =>
          playerUid !== user.uid &&
          player.role === role
      );

      if (roleTaken) {
        alert("The other player already selected this role.");
        return;
      }

      await update(
        ref(
          db,
          `rooms/${roomCode}/players/${user.uid}`
        ),
        {
          role,
        }
      );

      setPage(role);
    } catch (error) {
      console.error("Choose role error:", error);
      alert("Could not select the role.");
    } finally {
      setLoading(false);
    }
  }

  function startSolo() {
    setRoomCode("SOLO");
    setPage("solo");
  }

  function returnHome() {
    setPage("home");
    setRoomCode("");
    setRoomData(null);
    setUserId("");
  }

  const players = Object.entries(
    roomData?.players ?? {}
  );

  const astronautTakenByOther = players.some(
    ([playerUid, player]) =>
      playerUid !== userId &&
      player.role === "astronaut"
  );

  const engineerTakenByOther = players.some(
    ([playerUid, player]) =>
      playerUid !== userId &&
      player.role === "engineer"
  );

  if (page === "role") {
    return (
      <main className="home">
        <section className="panel">
          <p className="mission-label">
            MULTIPLAYER MISSION ROOM
          </p>

          <h2>ROOM CODE</h2>
          <p className="room-code">{roomCode}</p>

          <div className="connection-summary">
            <span
              className={
                players.length >= 2
                  ? "connection-dot connected"
                  : "connection-dot"
              }
            />

            CONNECTED PLAYERS: {players.length} / 2
          </div>

          <div className="player-list">
            {players.map(([playerUid, player], index) => (
              <div className="player-row" key={playerUid}>
                <span>
                  PLAYER {index + 1}
                  {playerUid === userId ? " · YOU" : ""}
                </span>

                <strong>
                  {player.role === "unselected"
                    ? "CHOOSING ROLE"
                    : player.role.toUpperCase()}
                </strong>
              </div>
            ))}
          </div>

          <p className="description">
            Choose your role for the Apollo 13 mission.
          </p>

          <div className="role-grid">
            <button
              type="button"
              className="role-card"
              disabled={astronautTakenByOther || loading}
              onClick={() => chooseRole("astronaut")}
            >
              <span className="role-icon">🚀</span>
              <strong>ASTRONAUT</strong>

              <small>
                {astronautTakenByOther
                  ? "ROLE TAKEN"
                  : "Operate the spacecraft"}
              </small>
            </button>

            <button
              type="button"
              className="role-card"
              disabled={engineerTakenByOther || loading}
              onClick={() => chooseRole("engineer")}
            >
              <span className="role-icon">🎧</span>
              <strong>MISSION CONTROL</strong>

              <small>
                {engineerTakenByOther
                  ? "ROLE TAKEN"
                  : "Analyze data and give instructions"}
              </small>
            </button>
          </div>

          <button
            type="button"
            className="back-button"
            onClick={returnHome}
          >
            ← BACK TO HOME
          </button>
        </section>
      </main>
    );
  }

  if (page === "astronaut" || page === "engineer") {
    const isAstronaut = page === "astronaut";

    const requiredOtherRole = isAstronaut
      ? "engineer"
      : "astronaut";

    const otherPlayerReady = players.some(
      ([playerUid, player]) =>
        playerUid !== userId &&
        player.role === requiredOtherRole
    );

    return (
      <main className="home">
        <section className="panel">
          <p className="mission-label">
            APOLLO 13 · MULTIPLAYER
          </p>

          <h2>
            {isAstronaut
              ? "ASTRONAUT CONTROL PANEL"
              : "MISSION CONTROL"}
          </h2>

          <p className="room-information">
            ROOM <strong>{roomCode}</strong>
          </p>

          <div
            className={
              otherPlayerReady
                ? "status-message ready"
                : "status-message"
            }
          >
            <span
              className={
                otherPlayerReady
                  ? "status-dot ready"
                  : "status-dot"
              }
            />

            {otherPlayerReady
              ? "Both players are connected and ready."
              : "Waiting for the other player to choose a role..."}
          </div>

          {otherPlayerReady && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                alert(
                  "Both players are connected. The synchronized mission comes next."
                )
              }
            >
              START MULTIPLAYER MISSION
            </button>
          )}

          <button
            type="button"
            className="back-button multiplayer-back"
            onClick={() => setPage("role")}
          >
            ← CHANGE ROLE
          </button>
        </section>
      </main>
    );
  }

  if (page === "solo") {
    return <SoloMission onExit={returnHome} />;
  }

  return (
    <main className="home">
      <section className="hero">
        <p className="mission-label">
          MISSION CONTROL SYSTEM
        </p>

        <h1>
          RECREATE
          <br />
          THE MISSION
        </h1>

        <p className="description">
          Work as an astronaut and a mission control
          engineer to survive critical moments from
          historic space missions.
        </p>

        <div className="home-actions">
          <button
            type="button"
            className="primary-button"
            onClick={startSolo}
          >
            SOLO PLAY
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={createRoom}
          >
            {loading
              ? "CONNECTING..."
              : "CREATE MULTIPLAYER ROOM"}
          </button>

          <div className="join-section">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={roomCode}
              maxLength={5}
              aria-label="Room code"
              onChange={(event) =>
                setRoomCode(
                  event.target.value
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .toUpperCase()
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  joinRoom();
                }
              }}
            />

            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={joinRoom}
            >
              JOIN ROOM
            </button>
          </div>
        </div>

        <p className="mission-name">
          MISSION 01 · APOLLO 13
        </p>
      </section>
    </main>
  );
}

export default App;