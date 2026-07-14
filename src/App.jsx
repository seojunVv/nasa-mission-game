import { useState } from "react";
import "./App.css";
import SoloMission from "./SoloMission";

function App() {
  const [page, setPage] = useState("home");
  const [roomCode, setRoomCode] = useState("");

  function createRoom() {
    const code = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();

    setRoomCode(code);
    setPage("role");
  }

  function joinRoom() {
    const cleanedCode = roomCode.trim().toUpperCase();

    if (cleanedCode.length < 4) {
      alert("Enter a valid room code.");
      return;
    }

    setRoomCode(cleanedCode);
    setPage("role");
  }

  function startSolo() {
    setRoomCode("SOLO");
    setPage("solo");
  }

  function returnHome() {
    setRoomCode("");
    setPage("home");
  }

  if (page === "role") {
    return (
      <main className="home">
        <section className="panel">
          <p className="mission-label">MULTIPLAYER MISSION ROOM</p>

          <h2>ROOM CODE</h2>
          <p className="room-code">{roomCode}</p>

          <p className="description">
            Choose your role for the Apollo 13 mission.
          </p>

          <div className="role-grid">
            <button
              type="button"
              className="role-card"
              onClick={() => setPage("astronaut")}
            >
              <span className="role-icon">🚀</span>
              <strong>ASTRONAUT</strong>
              <small>Operate the spacecraft and respond to emergencies.</small>
            </button>

            <button
              type="button"
              className="role-card"
              onClick={() => setPage("engineer")}
            >
              <span className="role-icon">🎧</span>
              <strong>MISSION CONTROL</strong>
              <small>Analyze telemetry and guide the astronaut.</small>
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

    return (
      <main className="home">
        <section className="panel">
          <p className="mission-label">APOLLO 13 · MULTIPLAYER</p>

          <h2>
            {isAstronaut
              ? "ASTRONAUT CONTROL PANEL"
              : "MISSION CONTROL"}
          </h2>

          <p className="room-information">
            ROOM <strong>{roomCode}</strong>
          </p>

          <div className="status-message">
            <span className="status-dot" />
            Waiting for the other player to connect...
          </div>

          <button
            type="button"
            className="back-button"
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
        <p className="mission-label">MISSION CONTROL SYSTEM</p>

        <h1>
          RECREATE
          <br />
          THE MISSION
        </h1>

        <p className="description">
          Work as an astronaut and a mission control engineer to survive
          critical moments from historic space missions.
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
            onClick={createRoom}
          >
            CREATE MULTIPLAYER ROOM
          </button>

          <div className="join-section">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={roomCode}
              maxLength={5}
              aria-label="Room code"
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
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
              onClick={joinRoom}
            >
              JOIN ROOM
            </button>
          </div>
        </div>

        <p className="mission-name">MISSION 01 · APOLLO 13</p>
      </section>
    </main>
  );
}

export default App;