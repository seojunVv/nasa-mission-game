import { useEffect, useState } from "react";
import {
  get,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";

import { db } from "./firebase";

const SYSTEM_LABELS = {
  guidance: "Guidance computer",
  stabilization: "Stabilization thrusters",
  cooling: "Engine cooling",
  lifeSupport: "Life support",
  fuelValve: "Fuel valve",
  engineAuthorized: "Engine authorization",
};

const initialGame = {
  status: "waiting",
  phase: "course-correction",
  message: "Waiting for Mission Control to begin.",
  pitch: 0,
  yaw: 0,
  targetPitch: 0,
  targetYaw: 0,
  power: 85,
  oxygen: 90,
  engineTemperature: 24,
  trajectoryError: 100,
  requiredBurn: 6,
  burnProgress: 0,
  engineRunning: false,
  mistakes: 0,
  systems: {
    guidance: false,
    stabilization: false,
    cooling: false,
    lifeSupport: false,
    fuelValve: false,
    engineAuthorized: false,
  },
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function randomStartingAngle() {
  const magnitude = 11 + Math.random() * 10;
  return roundOne(Math.random() > 0.5 ? magnitude : -magnitude);
}

function MultiplayerMission({ roomCode, role, onBack }) {
  const [game, setGame] = useState(initialGame);
  const [loading, setLoading] = useState(false);
  const [sensorNoise, setSensorNoise] = useState({
    pitch: 0,
    yaw: 0,
  });

  const gamePath = `rooms/${roomCode}/game`;
  const isEngineer = role === "engineer";
  const isPilot = role === "astronaut";

  useEffect(() => {
    const gameReference = ref(db, gamePath);

    const unsubscribe = onValue(
      gameReference,
      (snapshot) => {
        if (!snapshot.exists()) {
          setGame(initialGame);
          return;
        }

        const value = snapshot.val();

        setGame({
          ...initialGame,
          ...value,
          systems: {
            ...initialGame.systems,
            ...(value.systems ?? {}),
          },
        });
      },
      (error) => {
        console.error("Mission listener error:", error);
      }
    );

    return unsubscribe;
  }, [gamePath]);

  useEffect(() => {
    if (
      !isPilot ||
      game.status !== "active" ||
      game.systems.guidance
    ) {
      setSensorNoise({ pitch: 0, yaw: 0 });
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSensorNoise({
        pitch: roundOne((Math.random() - 0.5) * 10),
        yaw: roundOne((Math.random() - 0.5) * 10),
      });
    }, 700);

    return () => window.clearInterval(interval);
  }, [isPilot, game.status, game.systems.guidance]);

  useEffect(() => {
    if (
      !isPilot ||
      game.status !== "active" ||
      game.systems.stabilization
    ) {
      return undefined;
    }

    const interval = window.setInterval(async () => {
      try {
        const gameReference = ref(db, gamePath);
        const snapshot = await get(gameReference);

        if (!snapshot.exists()) {
          return;
        }

        const currentGame = snapshot.val();

        if (
          currentGame.status !== "active" ||
          currentGame.systems?.stabilization
        ) {
          return;
        }

        const weakPower =
          (currentGame.power ?? 0) < 25 ? 1.5 : 1;

        const burnMultiplier = currentGame.engineRunning
          ? 2.1
          : 1;

        const driftStrength =
          0.9 * weakPower * burnMultiplier;

        await update(gameReference, {
          pitch: roundOne(
            clamp(
              (currentGame.pitch ?? 0) +
                (Math.random() - 0.5) *
                  2 *
                  driftStrength,
              -45,
              45
            )
          ),
          yaw: roundOne(
            clamp(
              (currentGame.yaw ?? 0) +
                (Math.random() - 0.5) *
                  2 *
                  driftStrength,
              -45,
              45
            )
          ),
        });
      } catch (error) {
        console.error("Drift update error:", error);
      }
    }, 650);

    return () => window.clearInterval(interval);
  }, [
    isPilot,
    game.status,
    game.systems.stabilization,
    gamePath,
  ]);

  useEffect(() => {
    if (!isEngineer || game.status !== "active") {
      return undefined;
    }

    const interval = window.setInterval(async () => {
      try {
        const gameReference = ref(db, gamePath);
        const snapshot = await get(gameReference);

        if (!snapshot.exists()) {
          return;
        }

        const currentGame = snapshot.val();

        if (currentGame.status !== "active") {
          return;
        }

        const systems = {
          ...initialGame.systems,
          ...(currentGame.systems ?? {}),
        };

        const poweredSystemCount = [
          systems.guidance,
          systems.stabilization,
          systems.cooling,
          systems.lifeSupport,
        ].filter(Boolean).length;

        const powerDrain =
          0.25 +
          poweredSystemCount * 0.45 +
          (currentGame.engineRunning ? 1.1 : 0);

        const oxygenDrain = systems.lifeSupport
          ? 0.12
          : 1.6;

        const nextPower = roundOne(
          Math.max(0, (currentGame.power ?? 0) - powerDrain)
        );

        const nextOxygen = roundOne(
          Math.max(
            0,
            (currentGame.oxygen ?? 0) - oxygenDrain
          )
        );

        let nextTemperature =
          currentGame.engineTemperature ?? 24;

        if (!currentGame.engineRunning) {
          nextTemperature = roundOne(
            Math.max(
              20,
              nextTemperature -
                (systems.cooling ? 2.2 : 0.4)
            )
          );
        }

        const failed =
          nextPower <= 0 || nextOxygen <= 0;

        const changes = {
          power: nextPower,
          oxygen: nextOxygen,
          engineTemperature: nextTemperature,
        };

        if (failed) {
          changes.status = "failed";
          changes.engineRunning = false;
          changes.message =
            nextPower <= 0
              ? "Mission failed: spacecraft power was exhausted."
              : "Mission failed: cabin oxygen reached a critical level.";
        }

        await update(gameReference, changes);
      } catch (error) {
        console.error("Resource update error:", error);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isEngineer, game.status, gamePath]);

  useEffect(() => {
    if (
      !isPilot ||
      game.status !== "active" ||
      !game.engineRunning
    ) {
      return undefined;
    }

    const interval = window.setInterval(async () => {
      try {
        const gameReference = ref(db, gamePath);
        const snapshot = await get(gameReference);

        if (!snapshot.exists()) {
          return;
        }

        const currentGame = snapshot.val();

        if (
          currentGame.status !== "active" ||
          !currentGame.engineRunning
        ) {
          return;
        }

        const systems = {
          ...initialGame.systems,
          ...(currentGame.systems ?? {}),
        };

        if (
          !systems.fuelValve ||
          !systems.engineAuthorized
        ) {
          await update(gameReference, {
            engineRunning: false,
            message:
              "Engine cut off: Mission Control changed a required engine system.",
          });
          return;
        }

        const nextBurn = roundOne(
          (currentGame.burnProgress ?? 0) + 0.25
        );

        const alignmentError =
          Math.abs(
            (currentGame.pitch ?? 0) -
              (currentGame.targetPitch ?? 0)
          ) +
          Math.abs(
            (currentGame.yaw ?? 0) -
              (currentGame.targetYaw ?? 0)
          );

        let temperatureIncrease = systems.cooling
          ? 0.9
          : 4.2;

        if ((currentGame.power ?? 0) < 20) {
          temperatureIncrease *= 1.25;
        }

        const nextTemperature = roundOne(
          (currentGame.engineTemperature ?? 24) +
            temperatureIncrease
        );

        const requiredBurn =
          currentGame.requiredBurn ?? 6;

        const nextTrajectoryError = Math.max(
          0,
          Math.round(
            Math.max(0, requiredBurn - nextBurn) * 14 +
              alignmentError * 3
          )
        );

        if (nextTemperature >= 100) {
          await update(gameReference, {
            burnProgress: nextBurn,
            engineTemperature: nextTemperature,
            trajectoryError: nextTrajectoryError,
            engineRunning: false,
            status: "failed",
            message:
              "Mission failed: the engine overheated because cooling was insufficient.",
          });
          return;
        }

        if (nextBurn > requiredBurn + 1.2) {
          await update(gameReference, {
            burnProgress: nextBurn,
            engineTemperature: nextTemperature,
            trajectoryError: nextTrajectoryError,
            engineRunning: false,
            status: "failed",
            message:
              "Mission failed: the engine burn lasted too long and missed the return corridor.",
          });
          return;
        }

        if (
          nextBurn >= requiredBurn &&
          alignmentError <= 4
        ) {
          await update(gameReference, {
            burnProgress: nextBurn,
            engineTemperature: nextTemperature,
            trajectoryError: 0,
            engineRunning: false,
            status: "success",
            message:
              "Course correction successful! The spacecraft is on a safe return trajectory.",
          });
          return;
        }

        await update(gameReference, {
          burnProgress: nextBurn,
          engineTemperature: nextTemperature,
          trajectoryError: nextTrajectoryError,
        });
      } catch (error) {
        console.error("Engine burn update error:", error);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [
    isPilot,
    game.status,
    game.engineRunning,
    gamePath,
  ]);

  useEffect(() => {
    if (!isPilot) {
      return undefined;
    }

    function handleKeyDown(event) {
      const controls = {
        ArrowUp: ["pitch", 1],
        w: ["pitch", 1],
        W: ["pitch", 1],
        ArrowDown: ["pitch", -1],
        s: ["pitch", -1],
        S: ["pitch", -1],
        ArrowLeft: ["yaw", -1],
        a: ["yaw", -1],
        A: ["yaw", -1],
        ArrowRight: ["yaw", 1],
        d: ["yaw", 1],
        D: ["yaw", 1],
      };

      const control = controls[event.key];

      if (!control) {
        return;
      }

      event.preventDefault();
      moveCraft(control[0], control[1]);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isPilot, game.status, gamePath]);

  async function startMission() {
    if (!isEngineer) {
      return;
    }

    try {
      setLoading(true);

      await set(ref(db, gamePath), {
        ...initialGame,
        status: "active",
        message:
          "Emergency course correction started. Mission Control must configure the spacecraft.",
        pitch: randomStartingAngle(),
        yaw: randomStartingAngle(),
        requiredBurn: roundOne(
          5.5 + Math.random() * 1.8
        ),
        startedAt: Date.now(),
      });
    } catch (error) {
      console.error("Start mission error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSystem(systemName) {
    if (!isEngineer || game.status !== "active") {
      return;
    }

    try {
      const gameReference = ref(db, gamePath);
      const snapshot = await get(gameReference);

      if (!snapshot.exists()) {
        return;
      }

      const currentGame = snapshot.val();
      const currentValue = Boolean(
        currentGame.systems?.[systemName]
      );

      await update(gameReference, {
        [`systems/${systemName}`]: !currentValue,
        message: `${SYSTEM_LABELS[systemName]} ${
          currentValue ? "disabled" : "enabled"
        } by Mission Control.`,
      });
    } catch (error) {
      console.error("System toggle error:", error);
      alert(error.message);
    }
  }

  async function moveCraft(axis, direction) {
    if (!isPilot || game.status !== "active") {
      return;
    }

    try {
      const gameReference = ref(db, gamePath);
      const snapshot = await get(gameReference);

      if (!snapshot.exists()) {
        return;
      }

      const currentGame = snapshot.val();
      const systems = {
        ...initialGame.systems,
        ...(currentGame.systems ?? {}),
      };

      let response = systems.stabilization
        ? 1.7
        : 3.8;

      if ((currentGame.power ?? 0) < 25) {
        response *= 0.55;
      }

      const controlNoise = systems.stabilization
        ? 0
        : (Math.random() - 0.5) * 2.8;

      const currentValue = currentGame[axis] ?? 0;

      await update(gameReference, {
        [axis]: roundOne(
          clamp(
            currentValue +
              direction * response +
              controlNoise,
            -45,
            45
          )
        ),
      });
    } catch (error) {
      console.error("Pilot control error:", error);
    }
  }

  async function startEngine(event) {
    event?.preventDefault();

    if (!isPilot || game.status !== "active") {
      return;
    }

    try {
      const gameReference = ref(db, gamePath);
      const snapshot = await get(gameReference);

      if (!snapshot.exists()) {
        return;
      }

      const currentGame = snapshot.val();
      const systems = {
        ...initialGame.systems,
        ...(currentGame.systems ?? {}),
      };

      if (
        !systems.fuelValve ||
        !systems.engineAuthorized
      ) {
        await update(gameReference, {
          mistakes: (currentGame.mistakes ?? 0) + 1,
          message:
            "Engine start rejected. Mission Control must open the fuel valve and authorize ignition.",
        });
        return;
      }

      await update(gameReference, {
        engineRunning: true,
        message:
          "Engine burn in progress. Keep the spacecraft aligned.",
      });
    } catch (error) {
      console.error("Start engine error:", error);
    }
  }

  async function stopEngine() {
    if (!isPilot || game.status !== "active") {
      return;
    }

    try {
      const gameReference = ref(db, gamePath);
      const snapshot = await get(gameReference);

      if (!snapshot.exists()) {
        return;
      }

      const currentGame = snapshot.val();

      if (!currentGame.engineRunning) {
        return;
      }

      await update(gameReference, {
        engineRunning: false,
        message:
          (currentGame.burnProgress ?? 0) <
          (currentGame.requiredBurn ?? 6)
            ? "Engine burn paused before the required duration."
            : "Engine burn stopped. Checking trajectory...",
      });
    } catch (error) {
      console.error("Stop engine error:", error);
    }
  }

  const systems = game.systems ?? initialGame.systems;

  const displayedPitch = roundOne(
    game.pitch + sensorNoise.pitch
  );

  const displayedYaw = roundOne(
    game.yaw + sensorNoise.yaw
  );

  const markerX = clamp(displayedYaw * 4.5, -115, 115);
  const markerY = clamp(
    displayedPitch * -4.5,
    -115,
    115
  );

  const alignmentError =
    Math.abs(game.pitch - game.targetPitch) +
    Math.abs(game.yaw - game.targetYaw);

  const engineReady =
    systems.fuelValve &&
    systems.engineAuthorized &&
    game.status === "active";

  const activePowerSystems = [
    systems.guidance,
    systems.stabilization,
    systems.cooling,
    systems.lifeSupport,
  ].filter(Boolean).length;

  let engineerInstruction =
    "Start the mission when both players are ready.";

  if (game.status === "active") {
    if (!systems.lifeSupport) {
      engineerInstruction =
        "Enable LIFE SUPPORT before oxygen falls too quickly.";
    } else if (!systems.guidance) {
      engineerInstruction =
        "Enable GUIDANCE so the pilot can see reliable attitude data.";
    } else if (
      !systems.stabilization &&
      alignmentError > 4
    ) {
      engineerInstruction =
        "Enable STABILIZATION to stop drift while the pilot aligns the spacecraft.";
    } else if (alignmentError > 4) {
      engineerInstruction =
        "Tell the pilot to center the spacecraft marker inside the target ring.";
    } else if (!systems.cooling) {
      engineerInstruction =
        "Alignment is acceptable. Enable COOLING before ignition.";
    } else if (!systems.fuelValve) {
      engineerInstruction =
        "Open the FUEL VALVE to supply the engine.";
    } else if (!systems.engineAuthorized) {
      engineerInstruction =
        "Authorize ENGINE IGNITION, then tell the pilot the burn time.";
    } else {
      engineerInstruction = `Tell the pilot: hold the engine burn for ${game.requiredBurn.toFixed(
        1
      )} seconds while keeping the marker centered.`;
    }
  }

  return (
    <main className="home">
      <section className="multiplayer-panel">
        <header className="multiplayer-header">
          <div>
            <p className="mission-label">
              APOLLO 13 · MANUAL COURSE CORRECTION
            </p>

            <h2>
              {isEngineer
                ? "SYSTEMS ENGINEER"
                : "SPACECRAFT PILOT"}
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
            ← LEAVE STATION
          </button>
        </header>

        <div className={`mission-alert ${game.status}`}>
          {game.message}
        </div>

        <div className="telemetry-grid">
          <article className="telemetry-card">
            <span>SPACECRAFT POWER</span>
            <strong>{game.power.toFixed(1)}%</strong>

            <div className="progress-track">
              <div
                className="progress-value power-progress"
                style={{ width: `${game.power}%` }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>CABIN OXYGEN</span>
            <strong>{game.oxygen.toFixed(1)}%</strong>

            <div className="progress-track">
              <div
                className="progress-value oxygen-progress"
                style={{ width: `${game.oxygen}%` }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>ENGINE TEMPERATURE</span>
            <strong>
              {game.engineTemperature.toFixed(1)}°C
            </strong>

            <div className="progress-track">
              <div
                className="progress-value temperature-progress"
                style={{
                  width: `${clamp(
                    game.engineTemperature,
                    0,
                    100
                  )}%`,
                }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>TRAJECTORY ERROR</span>
            <strong>{game.trajectoryError}%</strong>
            <p>{game.status.toUpperCase()}</p>
          </article>
        </div>

        {isEngineer ? (
          <div className="engineer-layout">
            <section className="workspace-card">
              <p className="section-number">
                SYSTEM MANAGEMENT
              </p>

              <div className="power-load">
                <span>ACTIVE POWER LOAD</span>
                <strong>{activePowerSystems} / 4</strong>
              </div>

              <p className="role-note">
                More active systems make flying easier, but
                drain the battery faster.
              </p>

              <div className="system-grid">
                {[
                  "lifeSupport",
                  "guidance",
                  "stabilization",
                  "cooling",
                  "fuelValve",
                  "engineAuthorized",
                ].map((systemName) => (
                  <button
                    type="button"
                    key={systemName}
                    className={`system-toggle ${
                      systems[systemName] ? "active" : ""
                    }`}
                    disabled={game.status !== "active"}
                    onClick={() =>
                      toggleSystem(systemName)
                    }
                  >
                    <span>
                      {SYSTEM_LABELS[systemName]}
                    </span>

                    <strong>
                      {systems[systemName]
                        ? "ONLINE"
                        : "OFFLINE"}
                    </strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="workspace-card">
              <p className="section-number">
                FLIGHT TELEMETRY
              </p>

              <div className="engineer-instruction">
                <span>CURRENT RECOMMENDATION</span>
                <strong>{engineerInstruction}</strong>
              </div>

              <div className="engineer-metrics">
                <div>
                  <span>EXACT PITCH</span>
                  <strong>
                    {game.pitch.toFixed(1)}°
                  </strong>
                </div>

                <div>
                  <span>EXACT YAW</span>
                  <strong>{game.yaw.toFixed(1)}°</strong>
                </div>

                <div>
                  <span>ALIGNMENT ERROR</span>
                  <strong>
                    {alignmentError.toFixed(1)}°
                  </strong>
                </div>

                <div>
                  <span>REQUIRED BURN</span>
                  <strong>
                    {game.requiredBurn.toFixed(1)} s
                  </strong>
                </div>

                <div>
                  <span>ACTUAL BURN</span>
                  <strong>
                    {game.burnProgress.toFixed(1)} s
                  </strong>
                </div>

                <div>
                  <span>ENGINE</span>
                  <strong>
                    {game.engineRunning
                      ? "BURNING"
                      : "STOPPED"}
                  </strong>
                </div>
              </div>

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
                      ? "START COURSE CORRECTION"
                      : "RESTART COURSE CORRECTION"}
                </button>
              )}
            </section>
          </div>
        ) : (
          <div className="pilot-layout">
            <section className="workspace-card">
              <p className="section-number">
                ATTITUDE INDICATOR
              </p>

              <div className="attitude-display">
                <div className="attitude-grid" />

                {systems.guidance && (
                  <div className="target-ring">
                    TARGET
                  </div>
                )}

                <div
                  className="craft-marker"
                  style={{
                    transform: `translate(${markerX}px, ${markerY}px)`,
                  }}
                >
                  ▲
                </div>

                {!systems.guidance && (
                  <div className="guidance-offline">
                    GUIDANCE OFFLINE
                    <small>
                      Readings are unreliable
                    </small>
                  </div>
                )}
              </div>

              <div className="attitude-readouts">
                <div>
                  <span>PITCH</span>
                  <strong>
                    {systems.guidance ? "" : "≈ "}
                    {displayedPitch.toFixed(1)}°
                  </strong>
                </div>

                <div>
                  <span>YAW</span>
                  <strong>
                    {systems.guidance ? "" : "≈ "}
                    {displayedYaw.toFixed(1)}°
                  </strong>
                </div>
              </div>

              <div className="pilot-status-row">
                <span
                  className={
                    systems.guidance ? "online" : ""
                  }
                >
                  GUIDANCE
                </span>

                <span
                  className={
                    systems.stabilization
                      ? "online"
                      : ""
                  }
                >
                  STABILIZATION
                </span>

                <span
                  className={
                    systems.cooling ? "online" : ""
                  }
                >
                  COOLING
                </span>

                <span
                  className={engineReady ? "online" : ""}
                >
                  ENGINE READY
                </span>
              </div>
            </section>

            <section className="workspace-card pilot-controls">
              <p className="section-number">
                MANUAL FLIGHT CONTROLS
              </p>

              <p className="role-note">
                Use WASD, arrow keys, or the buttons.
                Center the marker before burning.
              </p>

              <div className="control-pad">
                <button
                  type="button"
                  className="axis-button pitch-up"
                  disabled={game.status !== "active"}
                  onClick={() => moveCraft("pitch", 1)}
                >
                  ↑
                  <small>NOSE UP</small>
                </button>

                <button
                  type="button"
                  className="axis-button yaw-left"
                  disabled={game.status !== "active"}
                  onClick={() => moveCraft("yaw", -1)}
                >
                  ←
                  <small>YAW LEFT</small>
                </button>

                <div className="control-center">
                  <strong>
                    {alignmentError <= 4
                      ? "ALIGNED"
                      : "ALIGN"}
                  </strong>
                </div>

                <button
                  type="button"
                  className="axis-button yaw-right"
                  disabled={game.status !== "active"}
                  onClick={() => moveCraft("yaw", 1)}
                >
                  →
                  <small>YAW RIGHT</small>
                </button>

                <button
                  type="button"
                  className="axis-button pitch-down"
                  disabled={game.status !== "active"}
                  onClick={() => moveCraft("pitch", -1)}
                >
                  ↓
                  <small>NOSE DOWN</small>
                </button>
              </div>

              <div className="burn-readout">
                <span>ENGINE BURN TIMER</span>
                <strong>
                  {game.burnProgress.toFixed(1)} s
                </strong>
              </div>

              <button
                type="button"
                className={`burn-button ${
                  game.engineRunning ? "running" : ""
                }`}
                disabled={!engineReady}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(
                    event.pointerId
                  );
                  startEngine(event);
                }}
                onPointerUp={stopEngine}
                onPointerCancel={stopEngine}
                onContextMenu={(event) =>
                  event.preventDefault()
                }
              >
                {game.engineRunning
                  ? "ENGINE BURNING — RELEASE TO STOP"
                  : engineReady
                    ? "HOLD TO FIRE ENGINE"
                    : "ENGINE LOCKED BY MISSION CONTROL"}
              </button>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default MultiplayerMission;