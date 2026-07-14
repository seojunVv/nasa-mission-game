import { useState } from "react";
import "./App.css";

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
    return (
      <main className="home">
        <section className="solo-panel">
          <div className="solo-header">
            <div>
              <p className="mission-label">APOLLO 13 · SOLO MISSION</p>
              <h2>MISSION DASHBOARD</h2>
            </div>

            <button
              type="button"
              className="back-button"
              onClick={returnHome}
            >
              ← EXIT MISSION
            </button>
          </div>

          <div className="telemetry-grid">
            <article className="telemetry-card">
              <span>OXYGEN</span>
              <strong>82%</strong>
              <div className="progress-track">
                <div className="progress-value oxygen-progress" />
              </div>
            </article>

            <article className="telemetry-card">
              <span>POWER</span>
              <strong>64%</strong>
              <div className="progress-track">
                <div className="progress-value power-progress" />
              </div>
            </article>

            <article className="telemetry-card">
              <span>CO₂ LEVEL</span>
              <strong>NORMAL</strong>
              <p>4.2 mmHg</p>
            </article>
          </div>

          <div className="solo-workspace">
            <section className="workspace-card">
              <p className="section-number">01</p>
              <h3>ASTRONAUT PANEL</h3>
              <p>
                Operate the spacecraft controls and complete instructions
                from Mission Control.
              </p>

              <div className="switch-list">
                <button type="button" className="control-switch">
                  MAIN POWER
                </button>

                <button type="button" className="control-switch">
                  OXYGEN VALVE
                </button>

                <button type="button" className="control-switch">
                  AUX BATTERY
                </button>
              </div>
            </section>

            <section className="workspace-card">
              <p className="section-number">02</p>
              <h3>MISSION CONTROL</h3>
              <p>
                Read the procedure and perform each instruction in the
                correct order.
              </p>

              <div className="procedure-box">
                <span>CURRENT PROCEDURE</span>
                <strong>Initial systems check</strong>
                <p>
                  Confirm that the main power system is active before
                  opening the oxygen valve.
                </p>
              </div>
            </section>
          </div>

          <button type="button" className="start-mission-button">
            BEGIN APOLLO 13 MISSION
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