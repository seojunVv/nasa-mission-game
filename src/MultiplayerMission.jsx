import { useEffect, useRef, useState } from "react";
import {
  get,
  onValue,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";

import { db } from "./firebase";
import "./MultiplayerMission.css";

const GAME_DURATION_MS = 60_000;
const FIRST_TASK_DELAY_MS = 4_000;
const TASK_INTERVAL_MS = 5_000;
const TASK_DURATION_MS = 7_000;
const FAULT_DURATION_MS = 8_000;

const FAULT_OPTIONS = [
  {
    type: "reverseControls",
    label: "CONTROLS REVERSED",
    description: "UP and DOWN controls are reversed.",
  },
  {
    type: "weakThruster",
    label: "WEAK THRUSTER",
    description: "The spacecraft moves much more slowly.",
  },
  {
    type: "inputLag",
    label: "CONTROL DELAY",
    description: "Some movement inputs are temporarily ignored.",
  },
  {
    type: "upFailure",
    label: "UP THRUSTER OFFLINE",
    description: "The pilot cannot move upward.",
  },
  {
    type: "downFailure",
    label: "DOWN THRUSTER OFFLINE",
    description: "The pilot cannot move downward.",
  },
  {
    type: "gravityLeak",
    label: "STABILIZER FAILURE",
    description: "The spacecraft is slowly pulled downward.",
  },
];

const INITIAL_GAME = {
  status: "waiting",
  message: "Waiting for the Systems Engineer to start the Moon flight.",
  startedAt: 0,
  durationMs: GAME_DURATION_MS,
  distanceRemaining: 100,
  hull: 3,
  score: 0,
  fault: null,
  task: null,
  lastTaskAt: 0,
};

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createSequence() {
  return Array.from(
    { length: 3 },
    () => Math.floor(Math.random() * 4) + 1
  );
}

function chooseFault() {
  return FAULT_OPTIONS[
    Math.floor(Math.random() * FAULT_OPTIONS.length)
  ];
}

function MultiplayerMission({ roomCode, role, onBack }) {
  const [game, setGame] = useState(INITIAL_GAME);
  const [now, setNow] = useState(Date.now());

  const gamePath = `rooms/${roomCode}/moonFlight`;
  const isPilot = role === "astronaut";
  const isEngineer = role === "engineer";

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, gamePath),
      (snapshot) => {
        if (!snapshot.exists()) {
          setGame(INITIAL_GAME);
          return;
        }

        setGame({
          ...INITIAL_GAME,
          ...snapshot.val(),
        });
      },
      (error) => {
        console.error("Moon flight listener error:", error);
      }
    );

    return unsubscribe;
  }, [gamePath]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  async function startMission() {
    if (!isEngineer) {
      return;
    }

    const startedAt = Date.now();

    try {
      await set(ref(db, gamePath), {
        ...INITIAL_GAME,
        status: "active",
        startedAt,
        lastTaskAt: startedAt,
        message:
          "Moon flight started. Pilot: avoid the asteroids and keep the spacecraft alive.",
      });
    } catch (error) {
      console.error("Start Moon flight error:", error);
      alert(error.message);
    }
  }

  return (
    <main className="moon-game-page">
      <section className="moon-game-shell">
        <header className="moon-game-header">
          <div>
            <p className="moon-game-kicker">
              APOLLO 13 · EMERGENCY MOON FLIGHT
            </p>

            <h1>
              {isPilot
                ? "SPACECRAFT PILOT"
                : "SYSTEMS ENGINEER"}
            </h1>

            <p className="moon-game-room">
              ROOM <strong>{roomCode}</strong>
            </p>
          </div>

          <button
            type="button"
            className="moon-game-exit"
            onClick={onBack}
          >
            ← LEAVE STATION
          </button>
        </header>

        <MissionSummary game={game} now={now} />

        {isPilot ? (
          <PilotGame
            game={game}
            gamePath={gamePath}
            now={now}
          />
        ) : (
          <EngineerConsole
            game={game}
            gamePath={gamePath}
            now={now}
            onStart={startMission}
          />
        )}
      </section>
    </main>
  );
}

function MissionSummary({ game, now }) {
  const elapsed =
    game.status === "active"
      ? Math.max(0, now - game.startedAt)
      : 0;

  const timeRemaining =
    game.status === "active"
      ? Math.max(
          0,
          Math.ceil(
            (game.durationMs - elapsed) / 1000
          )
        )
      : Math.ceil(game.durationMs / 1000);

  return (
    <>
      <div className={`moon-game-message ${game.status}`}>
        {game.message}
      </div>

      <div className="moon-game-stats">
        <article>
          <span>DISTANCE TO MOON</span>
          <strong>{game.distanceRemaining}%</strong>
        </article>

        <article>
          <span>HULL</span>
          <strong>{game.hull} / 3</strong>
        </article>

        <article>
          <span>TIME</span>
          <strong>{timeRemaining}s</strong>
        </article>

        <article>
          <span>STATUS</span>
          <strong>{game.status.toUpperCase()}</strong>
        </article>
      </div>
    </>
  );
}

function PilotGame({ game, gamePath, now }) {
  const [shipY, setShipY] = useState(50);
  const [obstacles, setObstacles] = useState([]);

  const shipYRef = useRef(50);
  const obstaclesRef = useRef([]);
  const controlsRef = useRef({
    up: false,
    down: false,
  });
  const latestGameRef = useRef(game);
  const animationRef = useRef(null);
  const lastFrameRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const lastSyncRef = useRef(0);
  const endingRef = useRef(false);
  const damageLockRef = useRef(false);

  useEffect(() => {
    latestGameRef.current = game;
  }, [game]);

  useEffect(() => {
    shipYRef.current = 50;
    obstaclesRef.current = [];
    controlsRef.current = {
      up: false,
      down: false,
    };
    endingRef.current = false;
    damageLockRef.current = false;
    lastFrameRef.current = 0;
    lastSpawnRef.current = 0;
    lastSyncRef.current = 0;

    setShipY(50);
    setObstacles([]);
  }, [game.startedAt]);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        controlsRef.current.up = true;
      }

      if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        controlsRef.current.down = true;
      }
    }

    function handleKeyUp(event) {
      const key = event.key.toLowerCase();

      if (event.key === "ArrowUp" || key === "w") {
        controlsRef.current.up = false;
      }

      if (event.key === "ArrowDown" || key === "s") {
        controlsRef.current.down = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
      window.removeEventListener(
        "keyup",
        handleKeyUp
      );
    };
  }, []);

  useEffect(() => {
    if (game.status !== "active") {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      return undefined;
    }

    async function endMission(status, message) {
      if (endingRef.current) {
        return;
      }

      endingRef.current = true;

      await update(ref(db, gamePath), {
        status,
        distanceRemaining:
          status === "success" ? 0 : latestGameRef.current.distanceRemaining,
        message,
      });
    }

    async function damageShip() {
      if (damageLockRef.current) {
        return;
      }

      damageLockRef.current = true;

      try {
        const result = await runTransaction(
          ref(db, `${gamePath}/hull`),
          (currentHull) =>
            Math.max(0, (currentHull ?? 3) - 1)
        );

        const newHull = result.snapshot.val();

        if (newHull <= 0) {
          await endMission(
            "failed",
            "Mission failed: the spacecraft was destroyed before reaching the Moon."
          );
        } else {
          await update(ref(db, gamePath), {
            message: `Asteroid collision! Hull integrity is now ${newHull}/3.`,
          });
        }
      } finally {
        window.setTimeout(() => {
          damageLockRef.current = false;
        }, 700);
      }
    }

    function animate(timestamp) {
      const currentGame = latestGameRef.current;

      if (currentGame.status !== "active") {
        return;
      }

      if (!lastFrameRef.current) {
        lastFrameRef.current = timestamp;
      }

      const delta = Math.min(
        40,
        timestamp - lastFrameRef.current
      );

      lastFrameRef.current = timestamp;

      const elapsed = Date.now() - currentGame.startedAt;
      const progress = clamp(
        elapsed / currentGame.durationMs,
        0,
        1
      );

      if (elapsed >= currentGame.durationMs) {
        endMission(
          "success",
          "Mission successful! The spacecraft safely reached the Moon."
        );
        return;
      }

      let moveUp = controlsRef.current.up;
      let moveDown = controlsRef.current.down;

      const fault = currentGame.fault;
      const faultIsActive =
        fault && fault.endsAt > Date.now();

      if (faultIsActive) {
        if (fault.type === "reverseControls") {
          [moveUp, moveDown] = [moveDown, moveUp];
        }

        if (fault.type === "upFailure") {
          moveUp = false;
        }

        if (fault.type === "downFailure") {
          moveDown = false;
        }

        if (
          fault.type === "inputLag" &&
          Math.floor(Date.now() / 300) % 2 === 0
        ) {
          moveUp = false;
          moveDown = false;
        }
      }

      let movementPower = 0.038 * delta;

      if (
        faultIsActive &&
        fault.type === "weakThruster"
      ) {
        movementPower *= 0.38;
      }

      let nextY = shipYRef.current;

      if (moveUp) {
        nextY -= movementPower;
      }

      if (moveDown) {
        nextY += movementPower;
      }

      if (
        faultIsActive &&
        fault.type === "gravityLeak"
      ) {
        nextY += 0.024 * delta;
      }

      nextY = clamp(nextY, 7, 93);

      shipYRef.current = nextY;
      setShipY(nextY);

      const spawnInterval =
        1_500 - progress * 550;

      if (
        timestamp - lastSpawnRef.current >=
        spawnInterval
      ) {
        lastSpawnRef.current = timestamp;

        obstaclesRef.current.push({
          id: `${Date.now()}-${Math.random()}`,
          x: 108,
          y: 10 + Math.random() * 80,
          size: 6 + Math.random() * 5,
          wasHit: false,
        });
      }

      const obstacleSpeed =
        0.028 + progress * 0.018;

      let collisionDetected = false;

      obstaclesRef.current =
        obstaclesRef.current
          .map((obstacle) => {
            const movedObstacle = {
              ...obstacle,
              x:
                obstacle.x -
                obstacleSpeed * delta,
            };

            const collides =
              !movedObstacle.wasHit &&
              movedObstacle.x <= 20 &&
              movedObstacle.x >= 8 &&
              Math.abs(movedObstacle.y - nextY) <=
                movedObstacle.size / 2 + 4;

            if (collides) {
              movedObstacle.wasHit = true;
              collisionDetected = true;
            }

            return movedObstacle;
          })
          .filter((obstacle) => obstacle.x > -15);

      setObstacles([...obstaclesRef.current]);

      if (collisionDetected) {
        damageShip();
      }

      if (
        timestamp - lastSyncRef.current >= 500
      ) {
        lastSyncRef.current = timestamp;

        update(ref(db, gamePath), {
          distanceRemaining: Math.max(
            0,
            Math.ceil((1 - progress) * 100)
          ),
          score: Math.floor(progress * 1000),
        });
      }

      animationRef.current =
        requestAnimationFrame(animate);
    }

    animationRef.current =
      requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    game.status,
    game.startedAt,
    game.durationMs,
    gamePath,
  ]);

  const activeFault =
    game.fault && game.fault.endsAt > now
      ? game.fault
      : null;

  const journeyProgress = clamp(
    100 - game.distanceRemaining,
    0,
    100
  );

  function setControl(direction, isPressed) {
    controlsRef.current[direction] = isPressed;
  }

  return (
    <section className="pilot-game">
      {activeFault && (
        <div className="pilot-malfunction">
          <div>
            <strong>{activeFault.label}</strong>
            <span>{activeFault.description}</span>
          </div>

          <small>
            {Math.max(
              0,
              Math.ceil(
                (activeFault.endsAt - now) / 1000
              )
            )}
            s
          </small>
        </div>
      )}

      <div className="space-flight-area">
        <div className="stars" />

        <div
          className="moon-target"
          style={{
            opacity:
              0.18 + journeyProgress / 125,
            transform: `translateY(-50%) scale(${
              0.65 + journeyProgress / 125
            })`,
          }}
        >
          <span>MOON</span>
        </div>

        <div
          className="player-rocket"
          style={{ top: `${shipY}%` }}
        >
          🚀
        </div>

        {obstacles.map((obstacle) => (
          <div
            key={obstacle.id}
            className={`asteroid ${
              obstacle.wasHit ? "hit" : ""
            }`}
            style={{
              left: `${obstacle.x}%`,
              top: `${obstacle.y}%`,
              width: `${obstacle.size}%`,
            }}
          />
        ))}

        {game.status !== "active" && (
          <div className="flight-screen-overlay">
            <strong>
              {game.status === "waiting"
                ? "WAITING FOR ENGINEER"
                : game.status === "success"
                  ? "MOON REACHED"
                  : "MISSION FAILED"}
            </strong>

            <span>
              {game.status === "waiting"
                ? "The Systems Engineer must start the mission."
                : game.message}
            </span>
          </div>
        )}
      </div>

      <div className="moon-progress">
        <span>EARTH</span>

        <div>
          <i
            style={{ width: `${journeyProgress}%` }}
          />
        </div>

        <span>MOON</span>
      </div>

      <div className="simple-flight-controls">
        <button
          type="button"
          disabled={game.status !== "active"}
          onPointerDown={() =>
            setControl("up", true)
          }
          onPointerUp={() =>
            setControl("up", false)
          }
          onPointerLeave={() =>
            setControl("up", false)
          }
          onPointerCancel={() =>
            setControl("up", false)
          }
        >
          ▲
          <small>MOVE UP</small>
        </button>

        <div>
          <strong>
            {activeFault
              ? activeFault.label
              : "CONTROLS NORMAL"}
          </strong>
          <span>Use W / S or ↑ / ↓</span>
        </div>

        <button
          type="button"
          disabled={game.status !== "active"}
          onPointerDown={() =>
            setControl("down", true)
          }
          onPointerUp={() =>
            setControl("down", false)
          }
          onPointerLeave={() =>
            setControl("down", false)
          }
          onPointerCancel={() =>
            setControl("down", false)
          }
        >
          ▼
          <small>MOVE DOWN</small>
        </button>
      </div>
    </section>
  );
}

function EngineerConsole({
  game,
  gamePath,
  now,
  onStart,
}) {
  const schedulerLockRef = useRef(false);

  useEffect(() => {
    if (game.status !== "active") {
      return undefined;
    }

    async function assignFault(
      currentTask,
      failureReason
    ) {
      const fault = chooseFault();
      const currentTime = Date.now();

      await update(ref(db, gamePath), {
        "task/status": "failed",
        "task/failureReason": failureReason,
        lastTaskAt: currentTime,
        fault: {
          ...fault,
          startedAt: currentTime,
          endsAt:
            currentTime + FAULT_DURATION_MS,
        },
        message: `Engineer failed the repair task. ${fault.label} is affecting the pilot.`,
      });
    }

    async function createTask() {
      const currentTime = Date.now();

      await update(ref(db, gamePath), {
        task: {
          id: `task-${currentTime}`,
          type: "switchSequence",
          sequence: createSequence(),
          progress: 0,
          status: "active",
          createdAt: currentTime,
          deadline:
            currentTime + TASK_DURATION_MS,
        },
        message:
          "New Systems Engineer repair task received.",
      });
    }

    async function schedulerTick() {
      if (schedulerLockRef.current) {
        return;
      }

      schedulerLockRef.current = true;

      try {
        const snapshot = await get(
          ref(db, gamePath)
        );

        if (!snapshot.exists()) {
          return;
        }

        const currentGame = snapshot.val();

        if (currentGame.status !== "active") {
          return;
        }

        const currentTime = Date.now();
        const currentTask = currentGame.task;

        if (
          currentTask?.status === "active" &&
          currentTask.deadline <= currentTime
        ) {
          await assignFault(
            currentTask,
            "TIME EXPIRED"
          );
          return;
        }

        const activeTask =
          currentTask?.status === "active";

        const lastTaskAt =
          currentGame.lastTaskAt ||
          currentGame.startedAt;

        const delay =
          currentGame.task == null
            ? FIRST_TASK_DELAY_MS
            : TASK_INTERVAL_MS;

        if (
          !activeTask &&
          currentTime - lastTaskAt >= delay
        ) {
          await createTask();
        }
      } catch (error) {
        console.error(
          "Engineer task scheduler error:",
          error
        );
      } finally {
        schedulerLockRef.current = false;
      }
    }

    const interval = window.setInterval(
      schedulerTick,
      450
    );

    schedulerTick();

    return () => window.clearInterval(interval);
  }, [game.status, gamePath]);

  async function pressSwitch(number) {
    try {
      const snapshot = await get(
        ref(db, gamePath)
      );

      if (!snapshot.exists()) {
        return;
      }

      const currentGame = snapshot.val();
      const currentTask = currentGame.task;

      if (
        !currentTask ||
        currentTask.status !== "active" ||
        Date.now() >= currentTask.deadline
      ) {
        return;
      }

      const expectedNumber =
        currentTask.sequence[
          currentTask.progress ?? 0
        ];

      if (number !== expectedNumber) {
        const fault = chooseFault();
        const currentTime = Date.now();

        await update(ref(db, gamePath), {
          "task/status": "failed",
          "task/failureReason": "WRONG SWITCH",
          lastTaskAt: currentTime,
          fault: {
            ...fault,
            startedAt: currentTime,
            endsAt:
              currentTime + FAULT_DURATION_MS,
          },
          message: `Wrong repair input. ${fault.label} is affecting the pilot.`,
        });

        return;
      }

      const nextProgress =
        (currentTask.progress ?? 0) + 1;

      if (
        nextProgress >=
        currentTask.sequence.length
      ) {
        const currentTime = Date.now();

        await update(ref(db, gamePath), {
          "task/progress": nextProgress,
          "task/status": "success",
          lastTaskAt: currentTime,
          fault: null,
          message:
            "Repair completed. Pilot controls are stable.",
        });

        return;
      }

      await update(ref(db, gamePath), {
        "task/progress": nextProgress,
      });
    } catch (error) {
      console.error(
        "Engineer switch error:",
        error
      );
    }
  }

  const task = game.task;
  const taskIsActive =
    task?.status === "active";

  const secondsRemaining = taskIsActive
    ? Math.max(
        0,
        (task.deadline - now) / 1000
      )
    : 0;

  const showSequence =
    taskIsActive &&
    now - task.createdAt < 2_300;

  const activeFault =
    game.fault && game.fault.endsAt > now
      ? game.fault
      : null;

  return (
    <section className="engineer-console">
      <div className="engineer-console-grid">
        <article className="repair-task-panel">
          <p className="engineer-panel-label">
            REPAIR TASK
          </p>

          {game.status === "waiting" ? (
            <>
              <h2>READY FOR LAUNCH</h2>

              <p>
                Start the mission. Keep completing repair
                tasks so the pilot can control the
                spacecraft and reach the Moon.
              </p>

              <button
                type="button"
                className="start-moon-flight"
                onClick={onStart}
              >
                START MOON FLIGHT
              </button>
            </>
          ) : taskIsActive ? (
            <>
              <h2>POWER ROUTING</h2>

              <p>
                Memorize the sequence. When it disappears,
                press the numbered switches in the same
                order.
              </p>

              <div className="repair-timer">
                <i
                  style={{
                    width: `${clamp(
                      (secondsRemaining /
                        (TASK_DURATION_MS / 1000)) *
                        100,
                      0,
                      100
                    )}%`,
                  }}
                />
              </div>

              <strong className="repair-countdown">
                {secondsRemaining.toFixed(1)}s
              </strong>

              <div
                className={`repair-sequence ${
                  showSequence ? "" : "hidden"
                }`}
              >
                {showSequence
                  ? task.sequence.join("  →  ")
                  : "SEQUENCE HIDDEN"}
              </div>

              <div className="repair-switches">
                {[1, 2, 3, 4].map((number) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() =>
                      pressSwitch(number)
                    }
                  >
                    {number}
                  </button>
                ))}
              </div>

              <p className="repair-progress">
                CORRECT INPUTS:{" "}
                {task.progress ?? 0} /{" "}
                {task.sequence.length}
              </p>
            </>
          ) : (
            <>
              <h2>
                {game.status === "active"
                  ? "SYSTEMS STABLE"
                  : game.status === "success"
                    ? "MOON ARRIVAL CONFIRMED"
                    : "MISSION ENDED"}
              </h2>

              <p>
                {game.status === "active"
                  ? "Stand by. The next repair task will arrive shortly."
                  : game.message}
              </p>

              {game.status !== "active" && (
                <button
                  type="button"
                  className="start-moon-flight"
                  onClick={onStart}
                >
                  RESTART MOON FLIGHT
                </button>
              )}
            </>
          )}
        </article>

        <article className="pilot-system-panel">
          <p className="engineer-panel-label">
            PILOT SYSTEM STATUS
          </p>

          <div
            className={`fault-status ${
              activeFault ? "active" : ""
            }`}
          >
            <span>
              {activeFault
                ? "ACTIVE MALFUNCTION"
                : "NO ACTIVE MALFUNCTION"}
            </span>

            <strong>
              {activeFault
                ? activeFault.label
                : "ALL SYSTEMS NORMAL"}
            </strong>

            <p>
              {activeFault
                ? activeFault.description
                : "Successful repairs keep the pilot controls working normally."}
            </p>

            {activeFault && (
              <small>
                Recovery in{" "}
                {Math.max(
                  0,
                  Math.ceil(
                    (activeFault.endsAt - now) /
                      1000
                  )
                )}
                s
              </small>
            )}
          </div>

          <div className="engineer-data-grid">
            <div>
              <span>MOON DISTANCE</span>
              <strong>
                {game.distanceRemaining}%
              </strong>
            </div>

            <div>
              <span>HULL</span>
              <strong>{game.hull} / 3</strong>
            </div>

            <div>
              <span>SCORE</span>
              <strong>{game.score}</strong>
            </div>

            <div>
              <span>LAST TASK</span>
              <strong>
                {task?.status?.toUpperCase() ??
                  "WAITING"}
              </strong>
            </div>
          </div>

          <div className="engineer-help">
            <strong>FAILED TASK EFFECTS</strong>

            <ul>
              <li>UP and DOWN may reverse.</li>
              <li>A thruster may become weak.</li>
              <li>One direction may stop working.</li>
              <li>Controls may lag or drift downward.</li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}

export default MultiplayerMission;