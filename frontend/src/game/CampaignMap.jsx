import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FREE_CLEAN_PREVIEW,
  buildOrthogonalCablePath,
  getBootMachineState,
  getChallengeModuleState,
  getInitialMachineChallengeId,
  getNextTutorialChallenge,
  getPackChallenges,
  getTutorialChallenges,
  isTutorialChallengeUnlocked,
  isCoreCampaignComplete,
  isHellCampaignComplete,
} from "./campaignMachine.js";
import { isBootComplete } from "./progress.js";
import { CorruptedText } from "./CorruptedText.jsx";
import { DesktopJunkPhysics } from "./DesktopJunkPhysics.jsx";

const BOOT_ANIMATION_MS = 1050;
const EJECT_ANIMATION_MS = 420;
const MODULE_POWER_DELAY_MS = 180;
const LOCKED_REACTION_MS = 1500;
const HELL_INSERT_MS = 1750;
const HELL_EJECT_MS = 720;
const BOOT_DIAL_MIN_ANGLE = 0;
const BOOT_DIAL_MAX_ANGLE = 180;
const BOOT_DIAL_DEGREES_PER_PIXEL = 0.65;
const BOOT_DIAL_RADIUS_PX = 92;

function getBootDialAngle(index, count) {
  if (count <= 1) return 0;
  return BOOT_DIAL_MIN_ANGLE + (index / (count - 1)) * (BOOT_DIAL_MAX_ANGLE - BOOT_DIAL_MIN_ANGLE);
}

function getBootDialMarkerStyle(index, count) {
  const angle = getBootDialAngle(index, count);
  const radians = angle * (Math.PI / 180);
  return {
    angle,
    style: {
      "--boot-dial-position-x": `${-Math.cos(radians) * BOOT_DIAL_RADIUS_PX}px`,
      "--boot-dial-position-y": `${8 + (1 - Math.sin(radians)) * BOOT_DIAL_RADIUS_PX}px`,
    },
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function TerminalTopDeck() {
  return (
    <div className="terminal-top-deck" aria-hidden="true">
      <span className="terminal-model-plate"><strong>CT 86</strong><small>FIELD TERMINAL</small></span>
      <span className="terminal-top-vent"><i /><i /><i /><i /><i /><i /><i /><i /></span>
      <span className="terminal-power-array"><i /><i /><i /><i /></span>
    </div>
  );
}

function TerminalControlStrip() {
  return (
    <div className="terminal-control-strip" aria-hidden="true">
      <span className="terminal-control-label"><strong>OPERATOR BUS</strong><small>INPUT ROUTER 04</small></span>
      <span className="terminal-toggle-bank"><i /><i /><i /><i /></span>
      <span className="terminal-control-meter"><i /><i /><i /><i /><i /><i /></span>
      <span className="terminal-key-switch"><i /></span>
    </div>
  );
}

function DriveMechanism() {
  return (
    <span className="drive-mechanism" aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

function RackChassisHardware() {
  return (
    <div className="rack-chassis-hardware" aria-hidden="true">
      <span className="rack-top-cap"><strong>CLN 06</strong><i /><i /><i /></span>
      <span className="rack-side-bus left"><i /><i /><i /><i /><i /><i /><i /><i /></span>
      <span className="rack-side-bus right"><i /><i /><i /><i /><i /><i /><i /><i /></span>
    </div>
  );
}

function ModuleFaceplateHardware() {
  return (
    <span className="module-faceplate-hardware" aria-hidden="true">
      <span className="module-faceplate-vent"><i /><i /><i /><i /></span>
      <span className="module-faceplate-lock" />
    </span>
  );
}

function RackCoolingBay({ powered, boosted, onBoost }) {
  const status = boosted ? "OVERDRIVE" : powered ? "FLOW 72%" : "PUMP OFF";

  return (
    <section className={`rack-cooling-bay ${powered ? "powered" : "offline"} ${boosted ? "boosted" : ""}`} aria-label="Server cooling bay">
      <div className="rack-cooling-header">
        <span><strong>LIQUID LOOP</strong><small>RACK COOLING 02</small></span>
        <span className="rack-cooling-status"><i />{status}</span>
      </div>
      <div className="rack-cooling-body">
        <svg className="coolant-pipe-map" viewBox="0 0 620 150" preserveAspectRatio="none" aria-hidden="true">
          <path className="coolant-pipe-shell" d="M75 43 H172 V23 H494 V43 H553 V108 H494 V127 H172 V108 H75 Z" />
          <path className="coolant-pipe-fluid" d="M75 43 H172 V23 H494 V43 H553 V108 H494 V127 H172 V108 H75 Z" pathLength="100" />
        </svg>
        <div className="coolant-reservoir" aria-hidden="true">
          <span className="coolant-reservoir-cap" />
          <span className="coolant-reservoir-glass">
            <span className="coolant-liquid"><i /><i /><i /></span>
          </span>
          <small>RES 72</small>
        </div>
        <div className="rack-cooling-fans">
          {["A", "B"].map((fan) => (
            <button
              type="button"
              className="rack-cooling-fan"
              onClick={onBoost}
              disabled={!powered}
              aria-label={`Boost cooling fan ${fan}`}
              aria-pressed={boosted}
              data-game-sound="custom"
              key={fan}
            >
              <span className="rack-fan-rotor" aria-hidden="true"><i /></span>
              <small>FAN {fan}</small>
            </button>
          ))}
        </div>
        <div className="coolant-pump" aria-hidden="true">
          <span className="coolant-pump-wheel"><i /></span>
          <small>PUMP 04</small>
        </div>
      </div>
      <div className="rack-cooling-footer" aria-hidden="true">
        <span>{powered ? "CLICK A FAN TO BOOST THE LOOP" : "COOLING BUS WAITING FOR POWER"}</span>
        <span className="coolant-pressure-meter"><i /><i /><i /><i /><i /><i /></span>
      </div>
    </section>
  );
}

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
  activePack = "core",
  onPackChange,
  onHellTransition,
  containmentSignal = 0,
  onContainmentComplete,
  initialChallengeId = "",
  reducedEffects = false,
}) {
  const tutorials = getTutorialChallenges(challenges);
  const tutorial = getNextTutorialChallenge(challenges, progress);
  const coreMissions = getPackChallenges(challenges, "core");
  const hellMissions = getPackChallenges(challenges, "hell");
  const missions = activePack === "hell" ? hellMissions : coreMissions;
  const missionKey = missions.map((challenge) => challenge.id).join("|");
  const bootComplete = isBootComplete(progress);
  const hellUnlocked = isCoreCampaignComplete(challenges, progress);
  const hellComplete = isHellCampaignComplete(challenges, progress);
  const bootSaved = tutorials.some((challenge) => savedWorkspaceIds.includes(`challenge:${challenge.id}`));
  const machineRef = useRef(null);
  const outputPortRef = useRef(null);
  const driveRef = useRef(null);
  const hellDriveRef = useRef(null);
  const modulePortRefs = useRef(new Map());
  const dialDraggingRef = useRef(false);
  const dialPointerStartXRef = useRef(0);
  const dialDragStartAngleRef = useRef(0);
  const dialLiveAngleRef = useRef(0);
  const bootTimersRef = useRef([]);
  const lockedTimerRef = useRef(null);
  const machineAlertTimerRef = useRef(null);
  const coolingBoostTimerRef = useRef(null);
  const lastPowerLeakRef = useRef("");
  const selectionTouchedRef = useRef(Boolean(initialChallengeId));
  const onSoundRef = useRef(onSound);
  const onPowerSequenceCompleteRef = useRef(onPowerSequenceComplete);
  const onPackChangeRef = useRef(onPackChange);
  const onHellTransitionRef = useRef(onHellTransition);
  const onContainmentCompleteRef = useRef(onContainmentComplete);
  const [sessionDiskInserted, setSessionDiskInserted] = useState(false);
  const [sessionDiskEjected, setSessionDiskEjected] = useState(false);
  const [bootDiskEjectSignal, setBootDiskEjectSignal] = useState(0);
  const [hellDiskEjectSignal, setHellDiskEjectSignal] = useState(0);
  const [manualPowerSequenceSignal, setManualPowerSequenceSignal] = useState(0);
  const [bootPhase, setBootPhase] = useState("waiting");
  const [bootDriveStatus, setBootDriveStatus] = useState("");
  const [hellDriveStatus, setHellDriveStatus] = useState("");
  const [hellPhase, setHellPhase] = useState(activePack === "hell" ? "active" : "idle");
  const [containmentPhase, setContainmentPhase] = useState("idle");
  const [machineAlert, setMachineAlert] = useState(null);
  const [powerLeakModuleId, setPowerLeakModuleId] = useState("");
  const [selectedChallengeId, setSelectedChallengeId] = useState(() => (
    challenges.some((challenge) => challenge.id === initialChallengeId)
      ? initialChallengeId
      : getInitialMachineChallengeId(challenges, progress, savedWorkspaceIds, activePack)
  ));
  const [isFreeCleanSelected, setIsFreeCleanSelected] = useState(false);
  const [noPowerChallengeId, setNoPowerChallengeId] = useState("");
  const [cableGeometry, setCableGeometry] = useState({ width: 0, height: 0, paths: [] });
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [coolingBoosted, setCoolingBoosted] = useState(false);
  const [dialDragAngle, setDialDragAngle] = useState(null);
  const [poweredCount, setPoweredCount] = useState(() => (
    bootComplete && !powerSequenceSignal ? missions.length : 0
  ));

  onSoundRef.current = onSound;
  onPowerSequenceCompleteRef.current = onPowerSequenceComplete;
  onPackChangeRef.current = onPackChange;
  onHellTransitionRef.current = onHellTransition;
  onContainmentCompleteRef.current = onContainmentComplete;

  const permanentMachineState = getBootMachineState(
    progress,
    savedWorkspaceIds,
    sessionDiskInserted,
    sessionDiskEjected,
  );
  const diskInserted = permanentMachineState.diskInserted || ["booting", "ejecting"].includes(bootPhase);
  const reducedMotion = reducedEffects || systemReducedMotion;
  const hellDiskInserted = activePack === "hell" || ["inserting", "ejecting"].includes(hellPhase);
  const hellMode = hellDiskInserted;
  const machinePowered = bootComplete && diskInserted && !["booting", "ejecting"].includes(bootPhase);
  const powerSequenceActive = machinePowered && poweredCount < missions.length;
  const selectedChallenge = challenges.find((challenge) => challenge.id === selectedChallengeId)
    ?? tutorial
    ?? challenges[0];
  const noPowerChallenge = challenges.find((challenge) => challenge.id === noPowerChallengeId);
  const selectedTutorialIndex = tutorials.findIndex((challenge) => challenge.id === selectedChallengeId);
  const dialStageIndex = selectedTutorialIndex >= 0 ? selectedTutorialIndex : Math.max(tutorials.length - 1, 0);
  const dialAngle = getBootDialAngle(dialStageIndex, tutorials.length);
  const dialInteractionDisabled = hellMode || ["booting", "ejecting"].includes(bootPhase);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (machinePowered) return;
    setCoolingBoosted(false);
    if (coolingBoostTimerRef.current) {
      window.clearTimeout(coolingBoostTimerRef.current);
      coolingBoostTimerRef.current = null;
    }
  }, [machinePowered]);

  useEffect(() => {
    if (!containmentSignal || activePack !== "hell") return undefined;

    setContainmentPhase("sealing");
    onSoundRef.current?.("hellContained");
    onHellTransitionRef.current?.("contained");
    const timerId = window.setTimeout(() => {
      setContainmentPhase("contained");
      onContainmentCompleteRef.current?.();
    }, reducedMotion ? 240 : 2200);

    return () => window.clearTimeout(timerId);
  }, [activePack, containmentSignal, reducedMotion]);

  useEffect(() => {
    if (["booting", "ejecting"].includes(bootPhase)) return;
    if (sessionDiskEjected) setBootPhase("waiting");
    else if (bootComplete) setBootPhase("online");
    else if (bootSaved) setBootPhase("incomplete");
    else if (!sessionDiskInserted) setBootPhase("waiting");
    else setBootPhase("ready");
  }, [bootComplete, bootPhase, bootSaved, sessionDiskEjected, sessionDiskInserted]);

  useEffect(() => {
    if (selectionTouchedRef.current) return;
    setSelectedChallengeId(getInitialMachineChallengeId(challenges, progress, savedWorkspaceIds, activePack));
  }, [activePack, bootComplete, challenges, progress, savedWorkspaceIds]);

  useEffect(() => {
    if (["inserting", "ejecting"].includes(hellPhase)) return;
    setHellPhase(activePack === "hell" ? "active" : "idle");
    setIsFreeCleanSelected(false);
    if (selectionTouchedRef.current) return;
    setSelectedChallengeId(getInitialMachineChallengeId(
      challenges,
      progress,
      savedWorkspaceIds,
      activePack,
    ));
  }, [activePack]);

  useEffect(() => {
    if (!machinePowered) {
      setPoweredCount(0);
      return undefined;
    }
    const shouldAnimate = Boolean(powerSequenceSignal || manualPowerSequenceSignal);
    if (!shouldAnimate || reducedMotion) {
      setPoweredCount(missions.length);
      if (powerSequenceSignal) onPowerSequenceCompleteRef.current?.();
      if (manualPowerSequenceSignal) setManualPowerSequenceSignal(0);
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
          if (powerSequenceSignal) onPowerSequenceCompleteRef.current?.();
          if (manualPowerSequenceSignal) setManualPowerSequenceSignal(0);
        }, MODULE_POWER_DELAY_MS));
      }
    };
    timerIds.push(window.setTimeout(powerNextModule, 280));
    return () => timerIds.forEach((timerId) => window.clearTimeout(timerId));
  }, [machinePowered, manualPowerSequenceSignal, missionKey, missions.length, powerSequenceSignal, reducedMotion]);

  useEffect(() => {
    const unpoweredMissions = missions.filter((_, index) => !machinePowered || index >= poweredCount);
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
  }, [machinePowered, missionKey, missions.length, poweredCount, reducedMotion]);

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
  }, [missionKey, missions.length]);

  useEffect(() => () => {
    clearBootTimers();
    if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
    if (machineAlertTimerRef.current) window.clearTimeout(machineAlertTimerRef.current);
    if (coolingBoostTimerRef.current) window.clearTimeout(coolingBoostTimerRef.current);
  }, []);

  function clearBootTimers() {
    bootTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    bootTimersRef.current = [];
  }

  function insertBootDisk() {
    if (diskInserted || !tutorial) return;
    clearBootTimers();
    const bootDelay = reducedMotion ? 80 : BOOT_ANIMATION_MS;
    setBootDriveStatus("");
    setMachineAlert(null);
    setBootPhase("booting");
    onSoundRef.current?.("machineBoot");
    bootTimersRef.current.push(window.setTimeout(() => {
      setSessionDiskInserted(true);
      setSessionDiskEjected(false);
      if (bootComplete) {
        setBootPhase("online");
        setManualPowerSequenceSignal((current) => current + 1);
        return;
      }
      setBootPhase(bootSaved ? "incomplete" : "ready");
    }, bootDelay));
  }

  function ejectBootDisk() {
    if (!diskInserted || ["booting", "ejecting"].includes(bootPhase)) return;
    clearBootTimers();
    if (lockedTimerRef.current) window.clearTimeout(lockedTimerRef.current);
    if (machineAlertTimerRef.current) window.clearTimeout(machineAlertTimerRef.current);
    setBootDriveStatus("");
    setMachineAlert(null);
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(false);
    setPoweredCount(0);
    setSessionDiskInserted(false);
    setSessionDiskEjected(true);
    setBootPhase("ejecting");
    onSoundRef.current?.("floppyEject");
    const ejectDelay = reducedMotion ? 80 : EJECT_ANIMATION_MS;
    bootTimersRef.current.push(window.setTimeout(() => {
      setBootPhase("waiting");
      setBootDiskEjectSignal((current) => current + 1);
    }, ejectDelay));
  }

  function insertHellDisk() {
    if (!hellUnlocked || hellDiskInserted || ["inserting", "ejecting"].includes(hellPhase)) return;
    if (!machinePowered) {
      showMachineAlert("hell-no-power");
      setHellDiskEjectSignal((current) => current + 1);
      return;
    }

    clearBootTimers();
    setHellDriveStatus("");
    setMachineAlert(null);
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(false);
    setPoweredCount(0);
    setHellPhase("inserting");
    onHellTransitionRef.current?.("start");
    const totalDelay = reducedMotion ? 160 : HELL_INSERT_MS;
    const breachDelay = reducedMotion ? 50 : 430;
    const swapDelay = reducedMotion ? 90 : 980;
    bootTimersRef.current.push(window.setTimeout(() => {
      onHellTransitionRef.current?.("breach");
    }, breachDelay));
    bootTimersRef.current.push(window.setTimeout(() => {
      onPackChangeRef.current?.("hell");
      selectionTouchedRef.current = false;
      setSelectedChallengeId(getInitialMachineChallengeId(
        challenges,
        progress,
        savedWorkspaceIds,
        "hell",
      ));
    }, swapDelay));
    bootTimersRef.current.push(window.setTimeout(() => {
      setHellPhase("active");
      setManualPowerSequenceSignal((current) => current + 1);
      onHellTransitionRef.current?.("active");
    }, totalDelay));
  }

  function ejectHellDisk() {
    if (!hellDiskInserted || ["inserting", "ejecting"].includes(hellPhase)) return;
    clearBootTimers();
    setHellDriveStatus("");
    setMachineAlert(null);
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(false);
    setPoweredCount(0);
    setHellPhase("ejecting");
    onSoundRef.current?.("hellEject");
    onHellTransitionRef.current?.("ejecting");
    const ejectDelay = reducedMotion ? 100 : HELL_EJECT_MS;
    bootTimersRef.current.push(window.setTimeout(() => {
      onPackChangeRef.current?.("core");
      selectionTouchedRef.current = false;
      setSelectedChallengeId(getInitialMachineChallengeId(
        challenges,
        progress,
        savedWorkspaceIds,
        "core",
      ));
      setHellPhase("idle");
      setHellDiskEjectSignal((current) => current + 1);
      setManualPowerSequenceSignal((current) => current + 1);
      onHellTransitionRef.current?.("ejected");
    }, ejectDelay));
  }

  function showMachineAlert(kind, fileName = "") {
    if (machineAlertTimerRef.current) window.clearTimeout(machineAlertTimerRef.current);
    setMachineAlert({ kind, fileName });
    machineAlertTimerRef.current = window.setTimeout(() => {
      setMachineAlert(null);
      machineAlertTimerRef.current = null;
    }, ["boot-trash", "hell-trash"].includes(kind) ? 1900 : 1450);
  }

  function selectModule(challenge, moduleIndex) {
    const powered = machinePowered && moduleIndex < poweredCount;
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

  function selectTutorial(challenge, allowLockedPreview = false) {
    if (hellMode || (!diskInserted && !allowLockedPreview) || ["booting", "ejecting"].includes(bootPhase)) return;
    if (!isTutorialChallengeUnlocked(challenge, challenges, progress)) {
      onSoundRef.current?.("error");
      if (!allowLockedPreview) return;
    }
    selectionTouchedRef.current = true;
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(false);
    setSelectedChallengeId(challenge.id);
    onSoundRef.current?.("open");
  }

  function constrainBootDialAngle(angle) {
    return clamp(angle, BOOT_DIAL_MIN_ANGLE, BOOT_DIAL_MAX_ANGLE);
  }

  function readDraggedBootDialAngle(event) {
    return constrainBootDialAngle(
      dialDragStartAngleRef.current
        + (event.clientX - dialPointerStartXRef.current) * BOOT_DIAL_DEGREES_PER_PIXEL,
    );
  }

  function beginBootDialDrag(event) {
    if (dialInteractionDisabled || !tutorials.length) return;
    event.preventDefault();
    dialDraggingRef.current = true;
    dialPointerStartXRef.current = event.clientX;
    dialDragStartAngleRef.current = dialAngle;
    dialLiveAngleRef.current = dialAngle;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDialDragAngle(dialAngle);
  }

  function moveBootDial(event) {
    if (!dialDraggingRef.current) return;
    const nextAngle = readDraggedBootDialAngle(event);
    dialLiveAngleRef.current = nextAngle;
    setDialDragAngle(nextAngle);
  }

  function finishBootDialDrag(event) {
    if (!dialDraggingRef.current) return;
    const finalAngle = dialLiveAngleRef.current;
    const stageIndex = tutorials.length <= 1
      ? 0
      : Math.round(((finalAngle - BOOT_DIAL_MIN_ANGLE) / (BOOT_DIAL_MAX_ANGLE - BOOT_DIAL_MIN_ANGLE)) * (tutorials.length - 1));
    dialDraggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDialDragAngle(null);
    selectTutorial(tutorials[clamp(stageIndex, 0, tutorials.length - 1)], true);
  }

  function cancelBootDialDrag() {
    dialDraggingRef.current = false;
    setDialDragAngle(null);
  }

  function handleBootDialKeyDown(event) {
    if (dialInteractionDisabled || !tutorials.length) return;
    let nextIndex = dialStageIndex;
    if (event.key === "ArrowLeft") nextIndex -= 1;
    else if (event.key === "ArrowRight") nextIndex += 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tutorials.length - 1;
    else return;
    event.preventDefault();
    selectTutorial(tutorials[clamp(nextIndex, 0, tutorials.length - 1)], true);
  }

  function selectFreeClean() {
    if (sessionDiskEjected || ["booting", "ejecting"].includes(bootPhase)) return;
    selectionTouchedRef.current = true;
    setNoPowerChallengeId("");
    setIsFreeCleanSelected(true);
    onSoundRef.current?.("open");
  }

  function boostCooling() {
    if (!machinePowered) return;
    if (coolingBoostTimerRef.current) window.clearTimeout(coolingBoostTimerRef.current);
    setCoolingBoosted(true);
    onSoundRef.current?.("machinePower");
    coolingBoostTimerRef.current = window.setTimeout(() => {
      setCoolingBoosted(false);
      coolingBoostTimerRef.current = null;
    }, reducedMotion ? 1200 : 5200);
  }

  function renderChallengeActions(challenge) {
    if (!challenge) return null;
    const state = getChallengeModuleState(challenge, progress, savedWorkspaceIds, machinePowered);
    if (state.locked) return null;
    if (challenge.tutorial && !diskInserted) return null;
    if (challenge.tutorial && !isTutorialChallengeUnlocked(challenge, challenges, progress)) return null;
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
      const bootTrashed = machineAlert.kind === "boot-trash";
      const hellTrashed = machineAlert.kind === "hell-trash";
      const noHellPower = machineAlert.kind === "hell-no-power";
      const trashed = bootTrashed || hellTrashed;
      return (
        <div className={`machine-screen-message media-error ${trashed ? "boot-trashed" : "wrong-disk"}`}>
          <span>{trashed ? "REMOVABLE MEDIA LOST" : noHellPower ? "DATA DRIVE OFFLINE" : "DRIVE REJECTED FILE"}</span>
          <strong>{bootTrashed ? "BOOT DISK TRASHED" : hellTrashed ? "HELL DISK TRASHED" : noHellPower ? "NO POWER" : "INVALID MEDIA"}</strong>
          <p>{trashed
            ? hellTrashed ? "Honestly this may have been the correct decision" : "Restore Junk before the computer notices"
            : noHellPower
              ? "Wake the machine before inserting cursed software"
              : `${machineAlert.fileName || "That file"} does not belong in this drive`}</p>
        </div>
      );
    }
    if (noPowerChallenge) {
      return (
        <div className="machine-screen-message no-power">
          <span>{noPowerChallenge.pack === "hell" ? `H${noPowerChallenge.number}` : `FILE ${noPowerChallenge.number}`}</span>
          <strong>NO POWER</strong>
          <p>Finish Boot Sequence before touching this module again</p>
        </div>
      );
    }
    if (["inserting", "ejecting"].includes(hellPhase)) {
      const ejecting = hellPhase === "ejecting";
      return (
        <div className={`machine-screen-message hell-transition ${ejecting ? "ejecting" : "inserting"}`} aria-live="assertive">
          <span>{ejecting ? "DATA DRIVE" : "UNKNOWN MEDIA DETECTED"}</span>
          <strong>{ejecting ? "CONTAINING BREACH" : "FILESYSTEM SCREAMING"}</strong>
          <div className="machine-boot-lines" aria-hidden="true"><i /><i /><i /><i /></div>
          <p>{ejecting ? "Returning to the part of the machine that only looks broken" : "This disk should not have passed quality control"}</p>
        </div>
      );
    }
    if (containmentPhase === "sealing") {
      return (
        <div className="machine-screen-message hell-containment-message" aria-live="assertive">
          <span>H6 // FINAL SECTOR</span>
          <strong>CONTAINMENT ATTEMPT ██████</strong>
          <div className="machine-boot-lines" aria-hidden="true"><i /><i /><i /><i /></div>
          <p>Six files cleaned // signal collapsing // do not celebrate yet</p>
        </div>
      );
    }
    if (["booting", "ejecting"].includes(bootPhase) || powerSequenceActive) {
      const ejecting = bootPhase === "ejecting";
      return (
        <div className={`machine-screen-message ${ejecting ? "ejecting" : "booting"}`} aria-live="polite">
          <span>{ejecting ? "REMOVABLE MEDIA" : bootPhase === "booting" ? "CLEANOS BIOS 0.6" : "POWER BUS ONLINE"}</span>
          <strong>{ejecting ? "CUTTING POWER" : bootPhase === "booting" ? "READING BOOT DISK" : "ROUTING POWER"}</strong>
          <div className="machine-boot-lines" aria-hidden="true">
            <i /><i /><i /><i />
          </div>
          <p>{ejecting ? "Please wait while everything forgets how electricity works" : bootPhase === "booting" ? "Please pretend this is normal" : `${poweredCount}/${missions.length} modules awake`}</p>
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

    const challenge = bootComplete
      ? selectedChallenge
      : selectedChallenge?.tutorial ? selectedChallenge : tutorial;
    const state = getChallengeModuleState(challenge, progress, savedWorkspaceIds, machinePowered);
    const tutorialUnlocked = isTutorialChallengeUnlocked(challenge, challenges, progress);
    const status = challenge.tutorial
      ? !tutorialUnlocked
        ? "STAGE LOCKED"
        : state.record?.complete
          ? "STAGE COMPLETE"
          : state.saved
            ? "STAGE IN PROGRESS"
            : `0.${challenge.tutorialStage}C READY`
      : state.status;
    return (
      <div className="machine-screen-details">
        <div className="machine-screen-topline">
          <span>{challenge.tutorial ? `BOOT 0.${challenge.tutorialStage}C` : challenge.pack === "hell" ? `H${challenge.number}` : `FILE ${challenge.number}`}</span>
          <span>{status}</span>
        </div>
        <CorruptedText
          as="h2"
          active={challenge.pack === "hell"}
          reducedEffects={reducedMotion}
        >
          {challenge.title}
        </CorruptedText>
        <p>{challenge.subtitle}</p>
        <div className="machine-screen-stats">
          <span>{challenge.rowCount.toLocaleString()} rows</span>
          <span>{challenge.objectives.length} objective{challenge.objectives.length === 1 ? "" : "s"}</span>
          <span>{state.record?.complete ? `${state.record.completions ?? 1} clears` : state.saved ? "Save detected" : "Fresh file"}</span>
        </div>
        <div className="machine-screen-actions">
          {renderChallengeActions(challenge)}
        </div>
      </div>
    );
  }

  return (
    <div className={`campaign-screen ${machinePowered ? "booted" : "locked"} ${powerSequenceActive ? "powering-up" : ""} ${hellMode ? "hell-mode" : ""} ${hellPhase === "inserting" ? "hell-breach" : ""} ${hellComplete ? "hell-contained" : ""} ${containmentPhase === "sealing" ? "hell-containment-event" : ""}`}>
      <div className="hell-screen-corruption" aria-hidden="true"><i /><i /><i /><i /></div>
      <header className="campaign-menu-bar">
        <div>
          <span className="campaign-status-light" />
          <strong>CLEANSHEET OS</strong>
          <span>REPAIR CONSOLE</span>
        </div>
        <div className="campaign-menu-actions">
          {soundControls}
          <button
            type="button"
            className="campaign-menu-button"
            onClick={selectFreeClean}
            disabled={sessionDiskEjected || ["booting", "ejecting"].includes(bootPhase)}
          >
            Free Clean
          </button>
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
            <span className="section-label">{hellMode ? "Containment failure" : "System recovery"}</span>
            <h1 id="campaign-title">{machinePowered
              ? hellMode ? "Pick what kind of terrible happens next" : "Pick the next broken module"
              : sessionDiskEjected
                ? "You turned the entire machine off"
                : "This machine forgot how to start"}</h1>
            <p>{machinePowered
              ? hellMode ? "All six files are awake and none of them are ranked by mercy" : "Choose a file module and inspect it on the main screen"
              : sessionDiskEjected
                ? "Find the boot disk and put it back before anyone notices"
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
                const powered = machinePowered && index < poweredCount;
                const powering = powerSequenceActive && index === poweredCount - 1;
                const selected = powered && selectedChallengeId === cable.id;
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
              <TerminalTopDeck />
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
                    <span className="terminal-crt-reflection" aria-hidden="true" />
                    <span className="boot-screen-scanlines" aria-hidden="true" />
                  </div>
                  <div className="boot-monitor-footer" aria-hidden="true">
                    <span className="boot-monitor-vents"><i /><i /><i /><i /><i /><i /><i /></span>
                    <div className="boot-monitor-controls">
                      <small>{machinePowered ? "READY" : "STBY"}</small>
                      <span className={machinePowered ? "online" : ""} />
                      <i /><i />
                    </div>
                  </div>
                </div>
                <div className="boot-monitor-neck" aria-hidden="true" />
              </div>

              <div className="boot-computer-base">
                <TerminalControlStrip />
                <div className="boot-mode-selectors">
                  <div
                    className={`boot-stage-dial ${dialDragAngle !== null ? "dragging" : ""}`}
                    style={{ "--boot-dial-angle": `${dialDragAngle ?? dialAngle}deg` }}
                  >
                    <div className="boot-dial-face">
                      <div className="boot-dial-positions" role="group" aria-label="Boot stage selector">
                        {tutorials.map((challenge, index) => {
                          const unlocked = isTutorialChallengeUnlocked(challenge, challenges, progress);
                          const complete = Boolean(progress.records?.[challenge.id]?.complete);
                          const selected = selectedChallengeId === challenge.id && !isFreeCleanSelected;
                          const stageCode = `0.${challenge.tutorialStage}C`;
                          const marker = getBootDialMarkerStyle(index, tutorials.length);
                          return (
                            <button
                              type="button"
                              aria-pressed={selected}
                              aria-label={`BOOT ${challenge.tutorialStage} ${stageCode} ${challenge.title.toUpperCase()} ${complete ? "done" : unlocked ? "ready" : "locked"}`}
                              className={`boot-dial-position ${selected ? "selected" : ""} ${complete ? "complete" : ""} ${unlocked ? "" : "locked"}`}
                              onClick={() => selectTutorial(challenge)}
                              disabled={hellMode || !diskInserted || !unlocked || ["booting", "ejecting"].includes(bootPhase)}
                              data-dial-angle={marker.angle}
                              data-game-sound="custom"
                              key={challenge.id}
                              style={marker.style}
                            >
                              <span>{stageCode}</span>
                              <small>{complete ? "DONE" : unlocked ? "READY" : "LOCKED"}</small>
                            </button>
                          );
                        })}
                      </div>
                      <div className="boot-dial-hardware">
                        <span className="boot-dial-scale" aria-hidden="true" />
                        <button
                          type="button"
                          className="boot-dial-knob"
                          aria-label={`Turn boot stage dial, selected 0.${tutorials[dialStageIndex]?.tutorialStage ?? 1}C`}
                          disabled={dialInteractionDisabled}
                          onPointerDown={beginBootDialDrag}
                          onPointerMove={moveBootDial}
                          onPointerUp={finishBootDialDrag}
                          onPointerCancel={cancelBootDialDrag}
                          onLostPointerCapture={cancelBootDialDrag}
                          onKeyDown={handleBootDialKeyDown}
                          data-game-sound="custom"
                        >
                          <i />
                        </button>
                      </div>
                    </div>
                    <div className="boot-dial-readout" aria-live="polite">
                      <span>SELECTED // 0.{tutorials[dialStageIndex]?.tutorialStage ?? 1}C</span>
                      <strong>{tutorials[dialStageIndex]?.title ?? "NO STAGE"}</strong>
                    </div>
                  </div>
                </div>
                <div className="boot-drive-stack">
                  <div className="boot-drive-panel">
                    <span className={`boot-drive-light ${diskInserted ? "active" : ""}`} />
                    <DriveMechanism />
                    <div ref={driveRef} className={`boot-floppy-drive ${bootDriveStatus}`}>
                      <span>{bootPhase === "ejecting" ? "EJECTING" : diskInserted ? "DISK LOADED" : "INSERT DISK"}</span>
                      {diskInserted && <i className="boot-inserted-disk" aria-hidden="true" />}
                    </div>
                    <div className="boot-drive-footer">
                      <small>BOOT DRIVE</small>
                      {diskInserted && (
                        <button
                          type="button"
                          className="boot-eject-button"
                          onClick={ejectBootDisk}
                          disabled={["booting", "ejecting"].includes(bootPhase)}
                          data-game-sound="custom"
                        >
                          EJECT
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`boot-drive-panel hell-drive-panel ${hellUnlocked ? "unlocked" : "locked"}`}>
                    <span className={`boot-drive-light ${hellDiskInserted ? "active" : hellUnlocked ? "available" : ""}`} />
                    <DriveMechanism />
                    <div ref={hellDriveRef} className={`boot-floppy-drive hell-floppy-drive ${hellDriveStatus}`}>
                      <span>{!hellUnlocked
                        ? "LOCKED"
                        : hellPhase === "ejecting"
                          ? "EJECTING"
                          : hellDiskInserted
                            ? "MEDIA BREACH"
                            : "INSERT DATA"}</span>
                      {hellDiskInserted && <i className="boot-inserted-disk hell-inserted-disk" aria-hidden="true" />}
                    </div>
                    <div className="boot-drive-footer">
                      <small>DATA DRIVE</small>
                      {hellDiskInserted && (
                        <button
                          type="button"
                          className="boot-eject-button hell-eject-button"
                          onClick={ejectHellDisk}
                          disabled={["inserting", "ejecting"].includes(hellPhase)}
                          data-game-sound="custom"
                        >
                          EJECT
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <span ref={outputPortRef} className={`machine-output-port ${machinePowered ? "powered" : ""}`} aria-hidden="true">
                  OUT
                </span>
                <div className="boot-base-diagnostics" aria-hidden="true">
                  <strong>SYS BUS</strong>
                  <span className="boot-base-meter"><i /><i /><i /><i /><i /><i /><i /><i /></span>
                  <small>{hellMode ? "CONTAINMENT FAILED" : machinePowered ? "RAM 64MB" : diskInserted ? "READING MEDIA" : "WAITING FOR DISK"}</small>
                  <span className="boot-base-vents"><i /><i /><i /><i /><i /></span>
                </div>
              </div>
              <span className="boot-computer-feet" aria-hidden="true"><i /><i /></span>
            </section>

            <section className="challenge-module-bank" aria-label="Challenge modules">
              <RackChassisHardware />
              <div className="module-bank-header">
                <div className="module-bank-title">
                  <span>{hellMode ? "BREACH BUS" : "FILE BUS"}</span>
                  <small>{hellMode ? "RACK H6 // CORRUPTED ARRAY" : "RACK 06 // CLEAN ARRAY"}</small>
                </div>
                <span className="module-bank-fans" aria-hidden="true"><i /><i /></span>
                <div className="module-bank-state">
                  <span className="module-bank-lights" aria-hidden="true"><i /><i /><i /><i /></span>
                  <strong>{machinePowered ? "ONLINE" : "NO POWER"}</strong>
                </div>
              </div>
              <div className="module-bank-service-strip" aria-hidden="true">
                <span>THERMAL</span>
                <span className="rack-thermal-meter"><i /><i /><i /><i /><i /><i /><i /><i /></span>
                <strong>{machinePowered ? "BUS STABLE" : "COLD START"}</strong>
              </div>
              <span className="module-bank-rail rail-left" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
              <span className="module-bank-rail rail-right" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
              <div className="challenge-module-grid">
                {missions.map((challenge, index) => {
                  const state = getChallengeModuleState(challenge, progress, savedWorkspaceIds, machinePowered);
                  const powered = machinePowered && index < poweredCount;
                  const selected = powered && selectedChallengeId === challenge.id && !isFreeCleanSelected && !noPowerChallengeId;
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
                      <ModuleFaceplateHardware />
                      <span className="challenge-module-number">{challenge.pack === "hell" ? `H${challenge.number}` : `FILE ${challenge.number}`}</span>
                      <CorruptedText
                        as="strong"
                        active={challenge.pack === "hell"}
                        reducedEffects={reducedMotion}
                      >
                        {challenge.title}
                      </CorruptedText>
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
                <strong>{machinePowered ? "LINKED" : "ISOLATED"}</strong>
                <span className="rack-power-supplies"><i /><i /><i /></span>
              </div>
              <RackCoolingBay
                powered={machinePowered}
                boosted={coolingBoosted}
                onBoost={boostCooling}
              />
            </section>
          </div>
        </section>
        <DesktopJunkPhysics
          bootDiskEnabled={!diskInserted}
          bootDiskEjectSignal={bootDiskEjectSignal}
          bootDriveRef={driveRef}
          hellDiskEnabled={hellUnlocked && !hellDiskInserted}
          hellDiskEjectSignal={hellDiskEjectSignal}
          hellDriveRef={hellDriveRef}
          onBootDiskInserted={insertBootDisk}
          onBootDiskTrashed={() => showMachineAlert("boot-trash")}
          onBootDriveHotChange={(hot, valid) => setBootDriveStatus(hot ? (valid ? "accepting" : "rejecting") : "")}
          onHellDiskInserted={insertHellDisk}
          onHellDiskTrashed={() => showMachineAlert("hell-trash")}
          onHellDriveHotChange={(hot, valid) => setHellDriveStatus(hot ? (valid ? "accepting" : "rejecting") : "")}
          onWrongDriveFile={(fileName) => showMachineAlert("wrong-disk", fileName)}
          onSound={onSound}
          onClipbitHit={onClipbitHit}
        />
      </div>

      <footer className="campaign-taskbar">
        <span>{machinePowered
          ? `${missions.filter((challenge) => progress.records[challenge.id]?.complete).length}/${missions.length} ${hellMode ? "nightmares contained" : "files restored"}`
          : diskInserted ? "BOOT_SEQUENCE.dsk loaded" : "BOOT DISK required"}</span>
      </footer>
    </div>
  );
}
