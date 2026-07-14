import { useState } from "react";

const procedures = [
  {
    key: "mainPower",
    title: "Activate main power",
    instruction:
      "Activate MAIN POWER to begin the emergency system check.",
  },
  {
    key: "oxygenValve",
    title: "Open the oxygen valve",
    instruction:
      "Open OXYGEN VALVE to restore oxygen flow to the cabin.",
  },
  {
    key: "auxBattery",
    title: "Connect auxiliary battery",
    instruction:
      "Activate AUX BATTERY to stabilize the spacecraft power system.",
  },
];

function SoloMission({ onExit }) {
  const [missionStarted, setMissionStarted] = useState(false);
  const [missionStatus, setMissionStatus] = useState("ready");
  const [step, setStep] = useState(0);

  const [oxygen, setOxygen] = useState(82);
  const [power, setPower] = useState(64);

  const [switches, setSwitches] = useState({
    mainPower: false,
    oxygenValve: false,
    auxBattery: false,
  });

  const [message, setMessage] = useState(
    "Press BEGIN MISSION when you are ready."
  );

  function beginMission() {
    setMissionStarted(true);
    setMissionStatus("active");
    setStep(0);

    setOxygen(82);
    setPower(64);

    setSwitches({
      mainPower: false,
      oxygenValve: false,
      auxBattery: false,
    });

    setMessage(
      "Emergency detected. Follow the Mission Control procedure."
    );
  }

  function operateSwitch(switchName) {
    if (!missionStarted) {
      setMessage("Begin the mission before operating the controls.");
      return;
    }

    if (missionStatus !== "active") {
      return;
    }

    const expectedSwitch = procedures[step].key;

    if (switchName !== expectedSwitch) {
      const newPower = Math.max(0, power - 8);

      setPower(newPower);
      setOxygen((currentOxygen) =>
        Math.max(0, currentOxygen - 3)
      );

      setMessage(
        "Incorrect procedure! Power and oxygen levels have decreased."
      );

      if (newPower === 0) {
        setMissionStatus("failed");
        setMissionStarted(false);
        setMessage("Mission failed: the spacecraft lost all power.");
      }

      return;
    }

    setSwitches((currentSwitches) => ({
      ...currentSwitches,
      [switchName]: true,
    }));

    setPower((currentPower) => Math.max(0, currentPower - 4));

    const nextStep = step + 1;
    setStep(nextStep);

    if (nextStep === procedures.length) {
      setMissionStatus("success");
      setMissionStarted(false);
      setMessage(
        "Mission successful! Oxygen flow and electrical power are stable."
      );
    } else {
      setMessage(
        `Procedure completed. Next: ${procedures[nextStep].title}.`
      );
    }
  }

  const currentProcedure = procedures[step];

  const co2Status =
    missionStatus === "success"
      ? "STABLE"
      : missionStarted
        ? "RISING"
        : "NORMAL";

  return (
    <main className="home">
      <section className="solo-panel">
        <div className="solo-header">
          <div>
            <p className="mission-label">
              APOLLO 13 · SOLO MISSION
            </p>
            <h2>MISSION DASHBOARD</h2>
          </div>

          <button
            type="button"
            className="back-button"
            onClick={onExit}
          >
            ← EXIT MISSION
          </button>
        </div>

        <div className={`mission-alert ${missionStatus}`}>
          {message}
        </div>

        <div className="telemetry-grid">
          <article className="telemetry-card">
            <span>OXYGEN</span>
            <strong>{oxygen}%</strong>

            <div className="progress-track">
              <div
                className="progress-value oxygen-progress"
                style={{ width: `${oxygen}%` }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>POWER</span>
            <strong>{power}%</strong>

            <div className="progress-track">
              <div
                className="progress-value power-progress"
                style={{ width: `${power}%` }}
              />
            </div>
          </article>

          <article className="telemetry-card">
            <span>CO₂ LEVEL</span>
            <strong>{co2Status}</strong>

            <p>
              {missionStatus === "success"
                ? "3.8 mmHg"
                : missionStarted
                  ? "6.1 mmHg"
                  : "4.2 mmHg"}
            </p>
          </article>
        </div>

        <div className="solo-workspace">
          <section className="workspace-card">
            <p className="section-number">01</p>
            <h3>ASTRONAUT PANEL</h3>

            <p>
              Operate each spacecraft control in the correct order.
            </p>

            <div className="switch-list">
              <button
                type="button"
                className={`control-switch ${
                  switches.mainPower ? "active" : ""
                }`}
                disabled={switches.mainPower}
                onClick={() => operateSwitch("mainPower")}
              >
                MAIN POWER
                <span>
                  {switches.mainPower ? "ON" : "OFF"}
                </span>
              </button>

              <button
                type="button"
                className={`control-switch ${
                  switches.oxygenValve ? "active" : ""
                }`}
                disabled={switches.oxygenValve}
                onClick={() => operateSwitch("oxygenValve")}
              >
                OXYGEN VALVE
                <span>
                  {switches.oxygenValve ? "OPEN" : "CLOSED"}
                </span>
              </button>

              <button
                type="button"
                className={`control-switch ${
                  switches.auxBattery ? "active" : ""
                }`}
                disabled={switches.auxBattery}
                onClick={() => operateSwitch("auxBattery")}
              >
                AUX BATTERY
                <span>
                  {switches.auxBattery ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          </section>

          <section className="workspace-card">
            <p className="section-number">02</p>
            <h3>MISSION CONTROL</h3>

            <p>
              Read the current procedure before operating a control.
            </p>

            <div className="procedure-box">
              <span>
                {missionStatus === "success"
                  ? "MISSION COMPLETE"
                  : `PROCEDURE ${Math.min(
                      step + 1,
                      procedures.length
                    )} OF ${procedures.length}`}
              </span>

              <strong>
                {currentProcedure?.title ??
                  "Spacecraft stabilized"}
              </strong>

              <p>
                {currentProcedure?.instruction ??
                  "All emergency procedures have been completed."}
              </p>
            </div>
          </section>
        </div>

        <button
          type="button"
          className="start-mission-button"
          onClick={beginMission}
        >
          {missionStatus === "ready"
            ? "BEGIN APOLLO 13 MISSION"
            : "RESTART MISSION"}
        </button>
      </section>
    </main>
  );
}

export default SoloMission;