import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FREE_CLEAN_PREVIEW,
  buildOrthogonalCablePath,
  getBootMachineState,
  getChallengeModuleState,
  getInitialMachineChallengeId,
} from "./campaignMachine.js";
import { isBootComplete } from "./progress.js";
import { DesktopJunkPhysics } from "./DesktopJunkPhysics.jsx";

const BOOT_ANIMATION_MS = 1050;
const MODULE_POWER_DELAY_MS = 180;
const LOCKED_REACTION_MS = 1500;

export function CampaignMap({
  challenges,
  progress,
  savedWorkspaceIds,
  powerSequenceSignal = 0,
  onPowerSequenceComplete,
  onStart,
  onContinue,
  onRestart,
  onFreeClean,
  onAchievements,
  onSound,
  onClipbitHit,
  soundControls,
}) {
  const tutorial = challenges.find((challenge) => challenge.tutorial);
  const missions = challenges
    .filter((challenge) => !challenge.tutorial)
    .sort((left, right) => left.number - right.number);
  const bootComplete = isBootComplete(progress);
  const bootSaved = savedWorkspaceIds.includes(`challenge:${tutorial?.id}`);
  const machineRef = useRef(null);
  const outputPortRef = useRef(null);
  const driveRef = useRef(null);
  const modulePortRefs = useRef(new Map());
  const bootTimersRef = useRef([]);
  const lockedTimerRef = useRef(null);
  const machineAlertTimerRef = useRef(null);
  const lastPowerLeakRef = useRef("");
  const selectionTouchedRef = useRef(false);
  const onSoundRef = useRef(onSound);
  const onPowerSequenceCompleteRef = useRef(onPowerSequenceComplete);
  const [sessionDiskInserted, setSessionDiskInserted] = useState(false);
  const [bootPhase, setBootPhase] = useState("waiting");
  const [bootDriveStatus, setBootDriveStatus] = useState("");
  const [machineAlert, setMachineAlert] = useState(null);
  const [powerLeakModuleId, setPowerLeakModuleId] = useState("");
  const [selectedChallengeId, setSelectedChallengeId] = useState(() => (
    getInitialMachineChallengeId(challenges, progress, savedWorkspaceIds)
  ));
  const [isFreeCleanSelected, setIsFreeCleanSelected] = useState(false);
  const [noPowerChallengeId, setNoPowerChallengeId] = useState("");
  const [cableGeometry, setCableGeometry] = useState({ width: 0, height: 0, paths: [] });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [poweredCount, setPoweredCount] = useState(() => (
    bootComplete && !powerSequenceSignal ? missions.length : 0
  ));

  onSoundRef.current = onSound;
  onPowerSequenceCompleteRef.current = onPowerSequenceComplete;

  const permanentMachineState = getBootMachineState(progress, savedWorkspaceIds, sessionDiskInserted);
  const diskInserted = permanentMachineState.diskInserted || bootPhase === "booting";
  const powerSequenceActive = bootComplete && poweredCount < missions.length;
  const selectedChallenge = challenges.find((challenge) => challenge.id === selectedChallengeId)
    ?? tutorial
    ?? challenges[0];
  const noPowerChallenge = challenges.find((challenge) => challenge.id === noPowerChallengeId);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (bootComplete) setBootPhase("online");
    else if (bootSaved) setBootPhase("incomplete");
    else if (!sessionDiskInserted) setBootPhase("waiting");
  }, [bootComplete, bootSaved, sessionDiskInserted]);

  useEffect(() => {
    if (selectionTouchedRef.current) return;
    setSelectedChallengeId(getInitialMachineChallengeId(challenges, progress, savedWorkspaceIds));
  }, [bootComplete, challenges, progress, savedWorkspaceIds]);

  useEffect(() => {
    if (!bootComplete) {
      setPoweredCount(0);
      return undefined;
    }
    if (!powerSequenceSignal || reducedMotion) {
      setPoweredCount(missions.length);
      if (powerSequenceSignal) onPowerSequenceCompleteRef.current?.();
      return undefined;
    }

    setPoweredCount(0);
    let nextCount = 0;
    const timerIds = [];
    const powerNextModule = () => {
      nextCount += 1;
      setPoweredCount(nextCount);
      onSoundRef.current?.("machinePower");
      if (nextCount < missions.length) {
        timerIds.push(window.setTimeout(powerNextModule, MODULE_POWER_DELAY_MS));
      } else {
        timerIds.push(window.setTimeout(() => {
          onPowerSequenceCompleteRef.current?.();
        }, MODULE_POWER_DELAY_MS));
      }
    };
    timerIds.push(window.setTimeout(powerNextModule, 280));
    return () => timerIds.forEach((timerId) => window.clearTimeout(timerId));
  }, [bootComplete, missions.length, powerSequenceSignal, reducedMotion]);

  useEffect(() => {
    const unpoweredMissions = missions.filter((_, index) => !bootComplete || index >= poweredCount);
    if (reducedMotion || !unpoweredMissions.length) {
      setPowerLeakModuleId("");
      return undefined;
    }

    let pulseTimer = null;
    let clearTimer = null;
    let cancelled = false;

    function schedulePulse() {
      const wait = 1800 + Math.random() * 4200;
      pulseTimer = window.setTimeout(triggerPulse, wait);
    }

    function triggerPulse() {
      if (cancelled) return;
      const freshChoices = unpoweredMissions.filter((challenge) => challenge.id !== lastPowerLeakRef.current);
      const choices = freshChoices.length ? freshChoices : unpoweredMissions;
      const challenge = choices[Math.floor(Math.random() * choices.length)];
      lastPowerLeakRef.current = challenge.id;
      setPowerLeakModuleId(challenge.id);
      clearTimer = window.setTimeout(() => {
        if (cancelled) return;
        setPowerLeakModuleId("");
        schedulePulse();
      }, 520);
    }

    schedulePulse();
    return () => {
      cancelled = true;
      if (pulseTimer) window.clearTimeout(pulseTimer);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [bootComplete, missions.length, poweredCount, reducedMotion]);

  useLayoutEffect(() => {
    const machine = machineRef.current;
    if (!machine) return undefined;
    let frameId = null;

    const updateCables = () => {
      const machineBounds = machine.getBoundingClientRect();
      const outputBounds = outputPortRef.current?.getBoundingClientRect();
      if (!outputBounds || !machineBounds.width || !machineBounds.height) return;
      const source = {
        x: outputBounds.left + outputBounds.width / 2 - machineBounds.left,
        y: outputBounds.top + outputBounds.height / 2 - machineBounds.top,
      };
      const targets = missions.flatMap((challenge) => {
        const portBounds = modulePortRefs.current.get(challenge.id)?.getBoundingClientRect();
        if (!portBounds) return [];
        return [{
          id: challenge.id,
          x: portBounds.left + portBounds.width / 2 - machineBounds.left,
          y: portBounds.top + portBounds.height / 2 - machineBounds.top,
        }];
      });
      const nearestTargetX = Math.min(...targets.map((target) => target.x));
      const trunkX = Number.isFinite(nearestTargetX)
        ? source.x + (nearestTargetX - source.x) * 0.45
        : source.x + 60;
      setCableGeometry({
        width: machineBounds.width,
        height: machineBounds.height,
        paths: targets.map((target) => ({
          id: target.id,
          path: buildOrthogonalCablePath(source, target, trunkX),
        })),
      });
    };

    const scheduleUpdate = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateCables);
    };
    scheduleUpdate();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(machine);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [missions.length]);

  useEffect(() => () => {
    clearBootTimers();
    if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
    if (machineAlertTimerRef.current) window.clearTimeout(machineAlertTimerRef.current);
  }, []);

  function clearBootTimers() {
    bootTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    bootTimersRef.current = [];
  }

  function insertBootDisk() {
    if (diskInserted || !tutorial) return;
    clearBootTimers();
    const bootDelay = reducedMotion ? 80 : BOOT_ANIMATION_MS;
    setSessionDiskInserted(true);
    setBootDriveStatus("");
    setMachineAlert(null);
    setBootPhase("booting");
    onSoundRef.current?.("machineBoot");
    bootTimersRef.current.push(window.setTimeout(() => {
      setBootPhase("ready");
      onStart(tutorial.id);
    }, bootDelay));
  }

  function showMachineAlert(kind, fileName = "") {
    if (machineAlertTimerRef.current) window.clearTimeout(machineAlertTimerRef.current);
    setMachineAlert({ kind, fileName });
    machineAlertTimerRef.current = window.setTimeout(() => {
      setMachineAlert(null);
      machineAlertTimerRef.current = null;
    }, kind === "boot-trash" ? 1900 : 1450);
  }

  function selectModule(challenge, moduleIndex) {
    const powered = bootComplete && moduleIndex < poweredCount;
    if (!powered) {
      if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
      setNoPowerChallengeId(challenge.id);
      onSoundRef.current?.("error");
      lockedTimerRef.current = window.setTimeout(() => {
        setNoPowerChallengeId("");
      }, LOCKED_REACTION_MS);
      return;
    }
    selectionTouchedRef.current = true;
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(false);
    setSelectedChallengeId(challenge.id);
    onSoundRef.current?.("open");
  }

  function selectTutorial() {
    selectionTouchedRef.current = true;
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(false);
    setSelectedChallengeId(tutorial.id);
    onSoundRef.current?.("open");
  }

  function selectFreeClean() {
    selectionTouchedRef.current = true;
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(true);
    onSoundRef.current?.("open");
  }

  function renderChallengeActions(challenge) {
    if (!challenge) return null;
    const state = getChallengeModuleState(challenge, progress, savedWorkspaceIds, bootComplete);
    if (state.locked) return null;
    if (challenge.tutorial && !diskInserted) return null;
    if (state.saved) {
      return (
        <>
          <button type="button" onClick={() => onContinue(challenge.id)}>Continue</button>
          <button type="button" className="secondary-button" onClick={() => onRestart(challenge.id)}>Restart</button>
        </>
      );
    }
    if (state.record?.complete) {
      return <button type="button" onClick={() => onRestart(challenge.id)}>Replay</button>;
    }
    return <button type="button" onClick={() => onStart(challenge.id)}>Start</button>;
  }

  function renderComputerScreen() {
    if (machineAlert) {
      const trashed = machineAlert.kind === "boot-trash";
      return (
        <div className={`machine-screen-message media-error ${trashed ? "boot-trashed" : "wrong-disk"}`}>
          <span>{trashed ? "RECOVERY MEDIA LOST" : "DRIVE REJECTED FILE"}</span>
          <strong>{trashed ? "BOOT DISK TRASHED" : "INVALID MEDIA"}</strong>
          <p>{trashed
            ? "Restore Junk before the computer notices"
            : `${machineAlert.fileName || "That file"} is not a boot disk`}</p>
        </div>
      );
    }
    if (noPowerChallenge) {
      return (
        <div className="machine-screen-message no-power">
          <span>FILE {noPowerChallenge.number}</span>
          <strong>NO POWER</strong>
          <p>Finish Boot Sequence before touching this module again</p>
        </div>
      );
    }
    if (bootPhase === "booting" || powerSequenceActive) {
      return (
        <div className="machine-screen-message booting" aria-live="polite">
          <span>{bootPhase === "booting" ? "CLEANOS BIOS 0.6" : "POWER BUS ONLINE"}</span>
          <strong>{bootPhase === "booting" ? "READING BOOT DISK" : "ROUTING POWER"}</strong>
          <div className="machine-boot-lines" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <p>{bootPhase === "booting" ? "Please pretend this is normal" : `${poweredCount}/${missions.length} modules awake`}</p>
        </div>
      );
    }
    if (isFreeCleanSelected) {
      return (
        <div className="machine-screen-details free-clean-screen-details">
          <div className="machine-screen-topline">
            <span>UTILITY</span>
            <span>READY</span>
          </div>
          <h2>Free Clean</h2>
          <div className="free-clean-screen-copy">
            {FREE_CLEAN_PREVIEW.map((sentence) => (
              <p key={sentence}>{sentence}</p>
            ))}
          </div>
          <div className="machine-screen-stats">
            <span>Your file</span>
            <span>No objectives</span>
            <span>All tools unlocked</span>
          </div>
          <div className="machine-screen-actions">
            <button type="button" onClick={onFreeClean}>Open Free Clean</button>
          </div>
        </div>
      );
    }
    if (!diskInserted) {
      return (
        <div className="machine-screen-message waiting">
          <span>CLEANOS RECOVERY CONSOLE</span>
          <strong>INSERT BOOT DISK</strong>
          <p>Drag BOOT_SEQUENCE into the drive below</p>
        </div>
      );
    }

    const challenge = bootComplete ? selectedChallenge : tutorial;
    const state = getChallengeModuleState(challenge, progress, savedWorkspaceIds, bootComplete);
    const status = challenge.tutorial && !bootComplete
      ? bootSaved ? "BOOT INCOMPLETE" : "BOOT DISK READY"
      : state.status;
    return (
      <div className="machine-screen-details">
        <div className="machine-screen-topline">
          <span>{challenge.tutorial ? "BOOT 0" : `FILE ${challenge.number}`}</span>
          <span>{status}</span>
        </div>
        <h2>{challenge.title}</h2>
        <p>{challenge.subtitle}</p>
        <div className="machine-screen-stats">
          <span>{challenge.rowCount.toLocaleString()} rows</span>
          <span>{challenge.objectives.length} objectives</span>
          <span>{state.record?.complete ? `${state.record.completions ?? 1} clears` : state.saved ? "Save detected" : "Fresh file"}</span>
        </div>
        <div className="machine-screen-actions">
          {renderChallengeActions(challenge)}
        </div>
      </div>
    );
  }

  return (
    <div className={`campaign-screen ${bootComplete ? "booted" : "locked"} ${powerSequenceActive ? "powering-up" : ""}`}>
      <header className="campaign-menu-bar">
        <div>
          <span className="campaign-status-light" />
          <strong>CLEANSHEET OS</strong>
          <span>REPAIR CONSOLE</span>
        </div>
        <div className="campaign-menu-actions">
          {soundControls}
          <button type="button" className="campaign-menu-button" onClick={onAchievements}>Achievements</button>
        </div>
      </header>

      <div className="campaign-main">
        <section className="campaign-desktop" aria-labelledby="campaign-title">
          <div className="campaign-background-machinery" aria-hidden="true">
            <span className="background-data-packet packet-one">01</span>
            <span className="background-data-packet packet-two">10</span>
            <span className="background-data-packet packet-three">DATA</span>
            <span className="background-memory-chip chip-one"><i /><i /><i /><i /></span>
            <span className="background-memory-chip chip-two"><i /><i /><i /><i /></span>
            <span className="background-memory-chip chip-three"><i /><i /><i /><i /></span>
            <i className="background-circuit-node node-one" />
            <i className="background-circuit-node node-two" />
            <i className="background-circuit-node node-three" />
            <i className="background-circuit-node node-four" />
            <i className="background-circuit-node node-five" />
          </div>

          <div className="campaign-intro">
            <span className="section-label">System recovery</span>
            <h1 id="campaign-title">{bootComplete ? "Pick the next broken module" : "This machine forgot how to start"}</h1>
            <p>{bootComplete
              ? "Choose a file module and inspect it on the main screen"
              : "Find the boot disk and wake up the rest of the machine"}</p>
          </div>

          <div ref={machineRef} className="campaign-machine">
            <svg
              className="machine-cable-layer"
              viewBox={`0 0 ${cableGeometry.width || 1} ${cableGeometry.height || 1}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {cableGeometry.paths.map((cable, index) => {
                const powered = bootComplete && index < poweredCount;
                const powering = powerSequenceActive && index === poweredCount - 1;
                const selected = selectedChallengeId === cable.id;
                const error = noPowerChallengeId === cable.id;
                return (
                  <g
                    className={`machine-cable ${powered ? "powered" : "locked"} ${powering ? "powering" : ""} ${selected ? "selected" : ""} ${error ? "error" : ""}`}
                    key={cable.id}
                    style={{ "--cable-delay": `${index * -0.67}s` }}
                  >
                    <path className="machine-cable-shadow" d={cable.path} />
                    <path className="machine-cable-wire" d={cable.path} />
                    <path className="machine-cable-signal" d={cable.path} />
                  </g>
                );
              })}
            </svg>

            <section className={`boot-computer ${bootPhase} ${diskInserted ? "disk-loaded" : ""}`}>
              <div className="boot-computer-monitor">
                <div className="boot-monitor-bezel">
                  <div className="boot-monitor-nameplate" aria-hidden="true">
                    <strong>CLEANOS</strong>
                    <span>DATA TERMINAL 86</span>
                  </div>
                  <span className="boot-monitor-screws" aria-hidden="true"><i /><i /><i /><i /></span>
                  <div className="boot-monitor-screen">
                    <div className="boot-screen-arcade" aria-hidden="true">
                      <span className="pixel-snake">
                        <i /><i /><i /><i /><i /><i /><i /><i />
                      </span>
                      <span className="pixel-data-bug" />
                    </div>
                    {renderComputerScreen()}
                    <span className="boot-screen-scanlines" aria-hidden="true" />
                  </div>
                  <div className="boot-monitor-footer" aria-hidden="true">
                    <span className="boot-monitor-vents"><i /><i /><i /><i /><i /><i /><i /></span>
                    <div className="boot-monitor-controls">
                      <small>{bootComplete ? "READY" : "STBY"}</small>
                      <span className={bootComplete ? "online" : ""} />
                      <i /><i />
                    </div>
                  </div>
                </div>
                <div className="boot-monitor-neck" aria-hidden="true" />
              </div>

              <div className="boot-computer-base">
                <div className="boot-mode-selectors">
                  <button
                    type="button"
                    className={`boot-selector ${selectedChallengeId === tutorial?.id && !isFreeCleanSelected ? "selected" : ""}`}
                    onClick={selectTutorial}
                    data-game-sound="custom"
                  >
                    <span>BOOT 0</span>
                    <strong>BOOT SEQUENCE</strong>
                    <span className="challenge-module-preview boot-selector-preview" aria-hidden="true">
                      {(tutorial.preview ?? tutorial.story.slice(0, 2)).map((sentence) => (
                        <span className="challenge-preview-sentence" key={sentence}>{sentence}</span>
                      ))}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`boot-selector free-clean-selector ${isFreeCleanSelected ? "selected" : ""}`}
                    onClick={selectFreeClean}
                    data-game-sound="custom"
                  >
                    <span>UTILITY</span>
                    <strong>FREE CLEAN</strong>
                    <span className="challenge-module-preview boot-selector-preview" aria-hidden="true">
                      {FREE_CLEAN_PREVIEW.map((sentence) => (
                        <span className="challenge-preview-sentence" key={sentence}>{sentence}</span>
                      ))}
                    </span>
                  </button>
                </div>
                <div className="boot-drive-panel">
                  <span className={`boot-drive-light ${diskInserted ? "active" : ""}`} />
                  <div ref={driveRef} className={`boot-floppy-drive ${bootDriveStatus}`}>
                    <span>{diskInserted ? "DISK LOADED" : "INSERT DISK"}</span>
                    {diskInserted && <i className="boot-inserted-disk" aria-hidden="true" />}
                  </div>
                  <small>3.5 CLEAN DRIVE</small>
                </div>
                <span ref={outputPortRef} className={`machine-output-port ${bootComplete ? "powered" : ""}`} aria-hidden="true">
                  OUT
                </span>
                <div className="boot-base-diagnostics" aria-hidden="true">
                  <strong>SYS BUS</strong>
                  <span className="boot-base-meter"><i /><i /><i /><i /><i /><i /><i /><i /></span>
                  <small>{bootComplete ? "RAM 640K OK" : diskInserted ? "READING MEDIA" : "WAITING FOR DISK"}</small>
                  <span className="boot-base-vents"><i /><i /><i /><i /><i /></span>
                </div>
              </div>
              <span className="boot-computer-feet" aria-hidden="true"><i /><i /></span>
            </section>

            <section className="challenge-module-bank" aria-label="Challenge modules">
              <div className="module-bank-header">
                <div className="module-bank-title">
                  <span>FILE BUS</span>
                  <small>RACK 06 // CLEAN ARRAY</small>
                </div>
                <span className="module-bank-fans" aria-hidden="true"><i /><i /></span>
                <div className="module-bank-state">
                  <span className="module-bank-lights" aria-hidden="true"><i /><i /><i /><i /></span>
                  <strong>{bootComplete ? "ONLINE" : "NO POWER"}</strong>
                </div>
              </div>
              <span className="module-bank-rail rail-left" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
              <span className="module-bank-rail rail-right" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
              <div className="challenge-module-grid">
                {missions.map((challenge, index) => {
                  const state = getChallengeModuleState(challenge, progress, savedWorkspaceIds, bootComplete);
                  const powered = bootComplete && index < poweredCount;
                  const selected = selectedChallengeId === challenge.id && !isFreeCleanSelected && !noPowerChallengeId;
                  const reacting = noPowerChallengeId === challenge.id;
                  return (
                    <button
                      type="button"
                      className={`challenge-module ${challenge.accent} ${powered ? "powered" : "locked"} ${powerLeakModuleId === challenge.id ? "power-leak" : ""} ${state.record?.complete ? "complete" : ""} ${selected ? "selected" : ""} ${reacting ? "no-power-reaction" : ""}`}
                      key={challenge.id}
                      style={{ "--module-delay": `${index * -0.43}s` }}
                      onClick={() => selectModule(challenge, index)}
                      aria-pressed={selected}
                      aria-disabled={!powered}
                      aria-label={`${challenge.title}, ${challenge.difficulty}, ${challenge.rowCount.toLocaleString()} rows, ${challenge.objectives.length} objectives, ${powered ? state.status : "No power"}`}
                      data-game-sound="custom"
                    >
                      <span
                        ref={(element) => {
                          if (element) modulePortRefs.current.set(challenge.id, element);
                          else modulePortRefs.current.delete(challenge.id);
                        }}
                        className={`challenge-module-port ${powered ? "powered" : ""}`}
                        aria-hidden="true"
                      />
                      <span className="challenge-module-number">FILE {challenge.number}</span>
                      <strong>{challenge.title}</strong>
                      <span className="challenge-module-meter" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                      <span className="challenge-module-status">
                        <i aria-hidden="true" />
                        {powered ? state.status : "NO POWER"}
                      </span>
                      <span className="challenge-module-preview" aria-hidden="true">
                        {(challenge.preview ?? challenge.story.slice(0, 2)).map((sentence) => (
                          <span className="challenge-preview-sentence" key={sentence}>{sentence}</span>
                        ))}
                      </span>
                      <span className="challenge-module-handle" aria-hidden="true" />
                      <span className="challenge-module-slots" aria-hidden="true"><i /><i /><i /></span>
                    </button>
                  );
                })}
              </div>
              <div className="module-bank-footer" aria-hidden="true">
                <span>DATA BUS A</span>
                <span className="module-bank-bus"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
                <strong>{bootComplete ? "LINKED" : "ISOLATED"}</strong>
              </div>
            </section>
          </div>
        </section>
        <DesktopJunkPhysics
          bootDiskEnabled={!diskInserted}
          bootDriveRef={driveRef}
          onBootDiskInserted={insertBootDisk}
          onBootDiskTrashed={() => showMachineAlert("boot-trash")}
          onBootDriveHotChange={(hot, valid) => setBootDriveStatus(hot ? (valid ? "accepting" : "rejecting") : "")}
          onWrongDriveFile={(fileName) => showMachineAlert("wrong-disk", fileName)}
          onSound={onSound}
          onClipbitHit={onClipbitHit}
        />
      </div>

      <footer className="campaign-taskbar">
        <span>{bootComplete
          ? `${Object.values(progress.records).filter((record) => record.complete).length}/${challenges.length} files restored`
          : diskInserted ? "BOOT_SEQUENCE.dsk loaded" : "BOOT DISK required"}</span>
      </footer>
    </div>
  );
}
