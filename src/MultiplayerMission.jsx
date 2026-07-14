import { useEffect, useState } from "react";
import {
  get,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";

import { db } from "./firebase";

const procedures = [
  {
    key: "mainPower",
    title: "Activate main power",
    instruction:
      "Tell the astronaut to activate MAIN POWER.",
  },
  {
    key: "oxygenValve",
    title: "Open the oxygen valve",
    instruction:
      "Tell the astronaut to open OXYGEN VALVE.",
  },
  {
    key: "auxBattery",
    title: "Connect auxiliary battery",
    instruction:
      "Tell the astronaut to activate AUX BATTERY.",
  },
];

const initialGame = {
  status: "waiting",
  step: 0,
  oxygen: 82,
  power: 64,
  message: "Waiting for Mission Control to begin.",
  switches: {
    mainPower: false,
    oxygenValve: false,
    auxBattery: false,
  },
};

function MultiplayerMission({
  roomCode,
  role,
  onBack,
}) {
  const [game, setGame] = useState(initialGame);
  const [loading, setLoading] = useState(false);

  const gameReference = ref(
    db,
    `rooms/${roomCode}/game`
  );

  useEffect(() => {
    const unsubscribe = onValue(
      gameReference,
      (snapshot) => {
        if (snapshot.exists()) {
          setGame(snapshot.val());
        } else {
          setGame(initialGame);
        }
      },
      (error) => {
        console.error("Mission listener error:", error);
      }
    );

    return unsubscribe;
  }, [roomCode]);

  async function startMission() {
    if (role !== "engineer") {
      return;
    }

    try {
      setLoading(true);

      await set(gameReference, {
        ...initialGame,
        status: "active",
        message:
          "Emergency detected. Mission Control must guide the astronaut.",
        startedAt: Date.now(),
      });
    } catch (error) {
      console.error("Start mission error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function operateSwitch(switchName) {
    if (role !== "astronaut") {
      return;
    }

    try {
      const snapshot = await get(gameReference);

      if (!snapshot.exists()) {
        alert("Mission data was not found.");
        return;
      }

      const currentGame = snapshot.val();

      if (currentGame.status !== "active") {
        alert("Mission Control has not started the mission.");
        return;
      }

      const currentStep = currentGame.step ?? 0;
      const expectedSwitch =
        procedures[currentStep]?.key;

      if (switchName !== expectedSwitch) {
        const newPower = Math.max(
          0,
          (currentGame.power ?? 64) - 8
        );

        const newOxygen = Math.max(
          0,
          (currentGame.oxygen ?? 82) - 3
        );

        const failed =
          newPower === 0 || newOxygen === 0;

        await update(gameReference, {
          power: newPower,
          oxygen: newOxygen,
          status: failed ? "failed" : "active",
          message: failed
            ? "Mission failed. Critical systems were lost."
            : "Incorrect control operated! Power and oxygen decreased.",
        });

        return;
      }

      const nextStep = currentStep + 1;
      const missionComplete =
        nextStep >= procedures.length;

      await update(gameReference, {
        [`switches/${switchName}`]: true,
        step: nextStep,
        power: Math.max(
          0,
          (currentGame.power ?? 64) - 4
        ),
        status: missionComplete
          ? "success"
          : "active",
        message: missionComplete
          ? "Mission successful! Spacecraft systems are stable."
          : `Procedure completed. Waiting for the next instruction.`,
      });
    } catch (error) {
      console.error("Operate switch error:", error);
      alert(error.message);
    }
  }

  const isEngineer = role === "engineer";
  const currentProcedure =
    procedures[game.step] ?? null;

  return (
    <main className="home">
      <section className="multiplayer-panel">
        <header className="multiplayer-header">
          <div>
            <p className="mission-label">
              APOLLO 13 · MULTIPLAYER
            </p>

            <h2>
              {isEngineer
                ? "MISSION CONTROL"
                : "ASTRONAUT PANEL"}
            </h2>

            <p className="room-information">
              ROOM <strong>{roomCode}</strong>
            </p>
          </div>

          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            ← LEAVE PANEL
          </button>
        </header>

        <div className={`mission-alert ${game.status}`}>
          {game.message}
        </div>

        <div className="telemetry-grid">
          <article className="telemetry-card">
            <span>OXYGEN</span>
            <strong>{game.oxygen}%</strong>

            <div className="progress-track">
              <div
                className="progress-value oxygen-progress"
                style={{
                  width: `${game.oxygen}%`,
                }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>POWER</span>
            <strong>{game.power}%</strong>

            <div className="progress-track">
              <div
                className="progress-value power-progress"
                style={{
                  width: `${game.power}%`,
                }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>MISSION STATUS</span>
            <strong>
              {game.status.toUpperCase()}
            </strong>
          </article>
        </div>

        {isEngineer ? (
          <section className="multiplayer-workspace">
            <div className="workspace-card">
              <p className="section-number">
                CURRENT PROCEDURE
              </p>

              <h3>
                {currentProcedure?.title ??
                  "Mission complete"}
              </h3>

              <p>
                {currentProcedure?.instruction ??
                  "All emergency procedures have been completed."}
              </p>

              {game.status !== "active" && (
                <button
                  type="button"
                  className="start-mission-button"
                  disabled={loading}
                  onClick={startMission}
                >
                  {loading
                    ? "STARTING..."
                    : game.status === "waiting"
                      ? "START MULTIPLAYER MISSION"
                      : "RESTART MISSION"}
                </button>
              )}
            </div>

            <div className="workspace-card">
              <p className="section-number">
                SPACECRAFT CONTROLS
              </p>

              <div className="switch-monitor">
                <div>
                  <span>MAIN POWER</span>
                  <strong>
                    {game.switches?.mainPower
                      ? "ON"
                      : "OFF"}
                  </strong>
                </div>

                <div>
                  <span>OXYGEN VALVE</span>
                  <strong>
                    {game.switches?.oxygenValve
                      ? "OPEN"
                      : "CLOSED"}
                  </strong>
                </div>

                <div>
                  <span>AUX BATTERY</span>
                  <strong>
                    {game.switches?.auxBattery
                      ? "ON"
                      : "OFF"}
                  </strong>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="workspace-card astronaut-workspace">
            <p className="section-number">
              SPACECRAFT CONTROL PANEL
            </p>

            <h3>WAIT FOR MISSION CONTROL</h3>

            <p>
              Listen to the engineer and operate the
              requested control.
            </p>

            <div className="switch-list">
              <button
                type="button"
                className={`control-switch ${
                  game.switches?.mainPower
                    ? "active"
                    : ""
                }`}
                disabled={
                  game.status !== "active" ||
                  game.switches?.mainPower
                }
                onClick={() =>
                  operateSwitch("mainPower")
                }
              >
                MAIN POWER

                <span>
                  {game.switches?.mainPower
                    ? "ON"
                    : "OFF"}
                </span>
              </button>

              <button
                type="button"
                className={`control-switch ${
                  game.switches?.oxygenValve
                    ? "active"
                    : ""
                }`}
                disabled={
                  game.status !== "active" ||
                  game.switches?.oxygenValve
                }
                onClick={() =>
                  operateSwitch("oxygenValve")
                }
              >
                OXYGEN VALVE

                <span>
                  {game.switches?.oxygenValve
                    ? "OPEN"
                    : "CLOSED"}
                </span>
              </button>

              <button
                type="button"
                className={`control-switch ${
                  game.switches?.auxBattery
                    ? "active"
                    : ""
                }`}
                disabled={
                  game.status !== "active" ||
                  game.switches?.auxBattery
                }
                onClick={() =>
                  operateSwitch("auxBattery")
                }
              >
                AUX BATTERY

                <span>
                  {game.switches?.auxBattery
                    ? "ON"
                    : "OFF"}
                </span>
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default MultiplayerMission;