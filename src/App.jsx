import { useState } from "react";
import "./App.css";

function App() {
  const [page, setPage] = useState("home");
  const [roomCode, setRoomCode] = useState("");

  function createRoom() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(code);
    setPage("role");
  }

  function joinRoom() {
    if (roomCode.trim().length < 4) {
      alert("Enter a valid room code.");
      return;
    }

    setPage("role");
  }

  if (page === "role") {
    return (
      <main className="home">
        <section className="panel">
          <p className="mission-label">MISSION ROOM</p>

          <h2>ROOM CODE</h2>
          <p className="room-code">{roomCode}</p>

          <p className="description">
            Choose your role for the Apollo 13 mission.
          </p>

          <div className="role-grid">
            <button
              className="role-card"
              onClick={() => setPage("astronaut")}
            >
              <span className="role-icon">🚀</span>
              <strong>ASTRONAUT</strong>
              <small>Operate the spacecraft</small>
            </button>

            <button
              className="role-card"
              onClick={() => setPage("engineer")}
            >
              <span className="role-icon">🎧</span>
              <strong>MISSION CONTROL</strong>
              <small>Analyze data and give instructions</small>
            </button>
          </div>

          <button
            className="back-button"
            onClick={() => setPage("home")}
          >
            ← BACK
          </button>
        </section>
      </main>
    );
  }

  if (page === "astronaut" || page === "engineer") {
    return (
      <main className="home">
        <section className="panel">
          <p className="mission-label">APOLLO 13</p>

          <h2>
            {page === "astronaut"
              ? "ASTRONAUT CONTROL PANEL"
              : "MISSION CONTROL"}
          </h2>

          <p className="description">
            Room: <strong>{roomCode}</strong>
          </p>

          <p className="status-message">
            Waiting for mission systems...
          </p>

          <button
            className="back-button"
            onClick={() => setPage("role")}
          >
            ← CHANGE ROLE
          </button>
        </section>
      </main>
    );
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
          Work together as an astronaut and a mission control engineer
          to survive historic space missions.
        </p>

        <div className="buttons">
          <button className="primary-button" onClick={createRoom}>
            CREATE ROOM
          </button>

          <div className="join-section">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={roomCode}
              maxLength={5}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
            />

            <button className="secondary-button" onClick={joinRoom}>
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