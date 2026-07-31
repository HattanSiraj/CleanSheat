import { useEffect, useRef, useState } from "react";
import {
  clampFileToBounds,
  clampThrowVelocity,
  createDesktopFiles,
  ejectFileFromTarget,
  getDesktopObjectMetrics,
  hasMovingDesktopFiles,
  isFileInRecycleBin,
  isFileNearTarget,
  releaseFileFromTarget,
  resizeDesktopFiles,
  stepDesktopPhysics,
} from "./desktopPhysics.js";

const BOOT_DISK = {
  id: "boot-sequence-disk",
  name: "BOOT_SEQUENCE.dsk",
  badge: "BOOT",
  color: "orange",
  kind: "boot-disk",
};

const HELL_DISK = {
  id: "hell-campaign-disk",
  name: "HELL_DISK.dsk",
  badge: "H6",
  color: "hell",
  kind: "hell-disk",
};

const JUNK_FILES = [
  { id: "junk-final", name: "final_final_7.csv", badge: "CSV", color: "orange" },
  { id: "junk-passwords", name: "passwords.txt", badge: "TXT", color: "teal" },
  { id: "junk-clean", name: "definitely_clean.csv", badge: "CSV", color: "sand" },
  { id: "junk-error", name: "error_404.csv", badge: "ERR", color: "red" },
  { id: "junk-open", name: "do_not_open.tmp", badge: "TMP", color: "blue" },
];

const DISCARD_ANIMATION_MS = 280;
const BOOT_DRIVE_PADDING = 24;

export function DesktopJunkPhysics({
  bootDiskEnabled = false,
  bootDiskEjectSignal = 0,
  bootDriveRef,
  hellDiskEnabled = false,
  hellDiskEjectSignal = 0,
  hellDriveRef,
  onBootDiskInserted,
  onBootDiskTrashed,
  onBootDriveHotChange,
  onHellDiskInserted,
  onHellDiskTrashed,
  onHellDriveHotChange,
  onWrongDriveFile,
  onSound,
  onClipbitHit,
}) {
  const layerRef = useRef(null);
  const binRef = useRef(null);
  const filesRef = useRef([]);
  const boundsRef = useRef({ width: 0, height: 0 });
  const metricsRef = useRef(getDesktopObjectMetrics(0));
  const frameRef = useRef(null);
  const lastFrameRef = useRef(0);
  const dragRef = useRef(null);
  const discardTimeoutsRef = useRef(new Map());
  const bootTrashTimeoutRef = useRef(null);
  const bootInsertCooldownRef = useRef(0);
  const hellInsertCooldownRef = useRef(0);
  const lastBootDiskEjectSignalRef = useRef(bootDiskEjectSignal);
  const lastHellDiskEjectSignalRef = useRef(hellDiskEjectSignal);
  const driveRejectCooldownRef = useRef(new Map());
  const lastCollisionSoundRef = useRef(0);
  const lastClipbitHitRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const bootDiskEnabledRef = useRef(bootDiskEnabled);
  const hellDiskEnabledRef = useRef(hellDiskEnabled);
  const bootDriveRefRef = useRef(bootDriveRef);
  const hellDriveRefRef = useRef(hellDriveRef);
  const bootDriveHotRef = useRef("");
  const hellDriveHotRef = useRef("");
  const definitionsRef = useRef([]);
  const onBootDiskInsertedRef = useRef(onBootDiskInserted);
  const onBootDiskTrashedRef = useRef(onBootDiskTrashed);
  const onBootDriveHotChangeRef = useRef(onBootDriveHotChange);
  const onHellDiskInsertedRef = useRef(onHellDiskInserted);
  const onHellDiskTrashedRef = useRef(onHellDiskTrashed);
  const onHellDriveHotChangeRef = useRef(onHellDriveHotChange);
  const onWrongDriveFileRef = useRef(onWrongDriveFile);
  const onSoundRef = useRef(onSound);
  const onClipbitHitRef = useRef(onClipbitHit);
  const [files, setFiles] = useState([]);
  const [metrics, setMetrics] = useState(() => getDesktopObjectMetrics(0));
  const [binHot, setBinHot] = useState(false);
  const [bootTrashPanic, setBootTrashPanic] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  onSoundRef.current = onSound;
  onClipbitHitRef.current = onClipbitHit;
  onBootDiskInsertedRef.current = onBootDiskInserted;
  onBootDiskTrashedRef.current = onBootDiskTrashed;
  onBootDriveHotChangeRef.current = onBootDriveHotChange;
  onHellDiskInsertedRef.current = onHellDiskInserted;
  onHellDiskTrashedRef.current = onHellDiskTrashed;
  onHellDriveHotChangeRef.current = onHellDriveHotChange;
  onWrongDriveFileRef.current = onWrongDriveFile;
  bootDiskEnabledRef.current = bootDiskEnabled;
  hellDiskEnabledRef.current = hellDiskEnabled;
  bootDriveRefRef.current = bootDriveRef;
  hellDriveRefRef.current = hellDriveRef;
  definitionsRef.current = [
    ...(bootDiskEnabled ? [BOOT_DISK] : []),
    ...(hellDiskEnabled ? [HELL_DISK] : []),
    ...JUNK_FILES,
  ];

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    const updateBounds = () => {
      const nextMetrics = getDesktopObjectMetrics(layer.clientWidth, layer.clientHeight);
      const nextBounds = {
        width: Math.max(140, layer.clientWidth - nextMetrics.clipbitSpace),
        height: layer.clientHeight,
      };
      if (nextBounds.width < 100 || nextBounds.height < 100) return;
      const previousBounds = boundsRef.current;
      const nextFiles = filesRef.current.length
        ? resizeDesktopFiles(filesRef.current, previousBounds, nextBounds, nextMetrics)
        : createDesktopFiles(definitionsRef.current, nextBounds, nextMetrics);
      boundsRef.current = nextBounds;
      metricsRef.current = nextMetrics;
      setMetrics(nextMetrics);
      commitFiles(nextFiles);
    };

    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(layer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!boundsRef.current.width || !boundsRef.current.height) return;
    const layout = createDesktopFiles(definitionsRef.current, boundsRef.current, metricsRef.current);
    const existingFiles = new Map(filesRef.current.map((file) => [file.id, file]));
    commitFiles(layout.map((file) => {
      const existing = existingFiles.get(file.id);
      return existing ? { ...existing, width: file.width, height: file.height } : file;
    }));
    if (!bootDiskEnabled) setBootDriveHot(false);
    if (!hellDiskEnabled) setHellDriveHot(false);
  }, [bootDiskEnabled, hellDiskEnabled]);

  useEffect(() => {
    if (
      !bootDiskEjectSignal
      || bootDiskEjectSignal === lastBootDiskEjectSignalRef.current
      || !boundsRef.current.width
      || !boundsRef.current.height
    ) return;
    lastBootDiskEjectSignalRef.current = bootDiskEjectSignal;

    const layoutDisk = createDesktopFiles(
      [BOOT_DISK],
      boundsRef.current,
      metricsRef.current,
    )[0];
    const currentDisk = filesRef.current.find((file) => file.id === BOOT_DISK.id);
    const driveBounds = getBootDriveBounds();
    const sourceDisk = {
      ...(currentDisk ?? layoutDisk),
      discarded: false,
      discarding: false,
      pinned: false,
      dragging: false,
      sleeping: reducedMotionRef.current,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
    };
    const ejectedDisk = releaseFileFromTarget(
      sourceDisk,
      driveBounds,
      boundsRef.current,
      reducedMotionRef.current,
    );

    bootInsertCooldownRef.current = performance.now() + 900;
    commitFiles([
      ejectedDisk,
      ...filesRef.current.filter((file) => file.id !== BOOT_DISK.id),
    ]);
    ensureAnimation();
  }, [bootDiskEjectSignal]);

  useEffect(() => {
    if (
      !hellDiskEjectSignal
      || hellDiskEjectSignal === lastHellDiskEjectSignalRef.current
      || !boundsRef.current.width
      || !boundsRef.current.height
    ) return;
    lastHellDiskEjectSignalRef.current = hellDiskEjectSignal;

    const layoutDisk = createDesktopFiles(
      [HELL_DISK],
      boundsRef.current,
      metricsRef.current,
    )[0];
    const currentDisk = filesRef.current.find((file) => file.id === HELL_DISK.id);
    const sourceDisk = {
      ...(currentDisk ?? layoutDisk),
      discarded: false,
      discarding: false,
      pinned: false,
      dragging: false,
      sleeping: reducedMotionRef.current,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
    };
    const ejectedDisk = releaseFileFromTarget(
      sourceDisk,
      getHellDriveBounds(),
      boundsRef.current,
      reducedMotionRef.current,
    );

    hellInsertCooldownRef.current = performance.now() + 900;
    commitFiles([
      ejectedDisk,
      ...filesRef.current.filter((file) => file.id !== HELL_DISK.id),
    ]);
    ensureAnimation();
  }, [hellDiskEjectSignal]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      reducedMotionRef.current = query.matches;
      setReducedMotion(query.matches);
      if (query.matches) {
        cancelAnimation();
        commitFiles(filesRef.current.map((file) => ({
          ...file,
          vx: 0,
          vy: 0,
          angularVelocity: 0,
          sleeping: true,
        })));
      }
    };
    updatePreference();
    query.addEventListener?.("change", updatePreference);
    return () => query.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) cancelAnimation();
      else if (hasMovingDesktopFiles(filesRef.current, dragRef.current?.id)) ensureAnimation();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => () => {
    cancelAnimation();
    for (const timeoutId of discardTimeoutsRef.current.values()) window.clearTimeout(timeoutId);
    discardTimeoutsRef.current.clear();
    if (bootTrashTimeoutRef.current) window.clearTimeout(bootTrashTimeoutRef.current);
  }, []);

  function commitFiles(nextFiles) {
    filesRef.current = nextFiles;
    setFiles(nextFiles);
  }

  function playSound(name) {
    onSoundRef.current?.(name);
  }

  function cancelAnimation() {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastFrameRef.current = 0;
  }

  function ensureAnimation() {
    if (reducedMotionRef.current || frameRef.current || document.hidden) return;
    frameRef.current = window.requestAnimationFrame(runAnimation);
  }

  function runAnimation(timestamp) {
    frameRef.current = null;
    const elapsed = lastFrameRef.current ? (timestamp - lastFrameRef.current) / 1000 : 1 / 60;
    lastFrameRef.current = timestamp;
    const draggedId = dragRef.current?.id ?? "";
    const previousFiles = new Map(filesRef.current.map((file) => [file.id, file]));
    const result = stepDesktopPhysics(filesRef.current, boundsRef.current, elapsed, { draggedId });
    let nextFiles = result.files;
    const flyingBootDisk = bootDiskEnabledRef.current
      ? nextFiles.find((file) => file.id === BOOT_DISK.id && file.id !== draggedId)
      : null;
    if (
      flyingBootDisk
      && performance.now() >= bootInsertCooldownRef.current
      && isFileNearTarget(flyingBootDisk, getBootDriveBounds(), BOOT_DRIVE_PADDING)
    ) {
      insertBootDisk(nextFiles);
      return;
    }
    const flyingHellDisk = hellDiskEnabledRef.current
      ? nextFiles.find((file) => file.id === HELL_DISK.id && file.id !== draggedId)
      : null;
    if (
      flyingHellDisk
      && performance.now() >= hellInsertCooldownRef.current
      && isFileNearTarget(flyingHellDisk, getHellDriveBounds(), BOOT_DRIVE_PADDING)
    ) {
      insertHellDisk(nextFiles);
      return;
    }
    const bootDriveBounds = getBootDriveBounds();
    const hellDriveBounds = getHellDriveBounds();
    const now = performance.now();
    const wrongBootDriveFile = nextFiles.find((file) => (
      file.id !== BOOT_DISK.id
      && file.id !== draggedId
      && (driveRejectCooldownRef.current.get(file.id) ?? 0) <= now
      && isFileNearTarget(file, bootDriveBounds, BOOT_DRIVE_PADDING)
    ));
    if (wrongBootDriveFile) {
      rejectWrongDriveFile(wrongBootDriveFile, nextFiles, bootDriveBounds, "boot");
      return;
    }
    const wrongHellDriveFile = nextFiles.find((file) => (
      file.id !== HELL_DISK.id
      && file.id !== draggedId
      && (driveRejectCooldownRef.current.get(file.id) ?? 0) <= now
      && isFileNearTarget(file, hellDriveBounds, BOOT_DRIVE_PADDING)
    ));
    if (wrongHellDriveFile) {
      rejectWrongDriveFile(wrongHellDriveFile, nextFiles, hellDriveBounds, "hell");
      return;
    }
    const hitClipbit = nextFiles.some((file) => {
      const previous = previousFiles.get(file.id);
      const rightBoundary = boundsRef.current.width - file.width;
      return previous
        && !file.discarded
        && !file.discarding
        && previous.vx > 380
        && file.vx < 0
        && file.x >= rightBoundary - 0.5
        && file.y + file.height >= boundsRef.current.height - metricsRef.current.clipbitHitHeight;
    });
    const binBounds = getBinBounds();
    const recycledIds = nextFiles
      .filter((file) => file.id !== draggedId && isFileInRecycleBin(file, binBounds))
      .map((file) => file.id);
    if (recycledIds.length) nextFiles = beginDiscarding(recycledIds, nextFiles);
    else commitFiles(nextFiles);

    if (result.collisions && timestamp - lastCollisionSoundRef.current > 180) {
      lastCollisionSoundRef.current = timestamp;
      playSound("paperBounce");
    }
    if (hitClipbit && timestamp - lastClipbitHitRef.current > 900) {
      lastClipbitHitRef.current = timestamp;
      onClipbitHitRef.current?.();
    }
    if (hasMovingDesktopFiles(nextFiles, draggedId)) ensureAnimation();
    else lastFrameRef.current = 0;
  }

  function getBinBounds() {
    return getElementBounds(binRef.current);
  }

  function getBootDriveBounds() {
    return getElementBounds(bootDriveRefRef.current?.current);
  }

  function getHellDriveBounds() {
    return getElementBounds(hellDriveRefRef.current?.current);
  }

  function getElementBounds(element) {
    const layer = layerRef.current;
    if (!layer || !element) return null;
    const layerBounds = layer.getBoundingClientRect();
    const elementBounds = element.getBoundingClientRect();
    return {
      x: elementBounds.left - layerBounds.left,
      y: elementBounds.top - layerBounds.top,
      width: elementBounds.width,
      height: elementBounds.height,
    };
  }

  function setBootDriveHot(hot, valid = true) {
    const nextState = hot ? (valid ? "valid" : "invalid") : "";
    if (bootDriveHotRef.current === nextState) return;
    bootDriveHotRef.current = nextState;
    onBootDriveHotChangeRef.current?.(Boolean(hot), Boolean(valid));
  }

  function setHellDriveHot(hot, valid = true) {
    const nextState = hot ? (valid ? "valid" : "invalid") : "";
    if (hellDriveHotRef.current === nextState) return;
    hellDriveHotRef.current = nextState;
    onHellDriveHotChangeRef.current?.(Boolean(hot), Boolean(valid));
  }

  function insertBootDisk(sourceFiles = filesRef.current) {
    const disk = sourceFiles.find((file) => file.id === BOOT_DISK.id);
    if (!disk || disk.discarded || disk.discarding) return;
    dragRef.current = null;
    setBinHot(false);
    setBootDriveHot(false);
    commitFiles(sourceFiles.map((file) => (
      file.id === BOOT_DISK.id
        ? { ...file, discarded: true, dragging: false, vx: 0, vy: 0, angularVelocity: 0, sleeping: true }
        : file
    )));
    playSound("floppyInsert");
    onBootDiskInsertedRef.current?.();
  }

  function insertHellDisk(sourceFiles = filesRef.current) {
    const disk = sourceFiles.find((file) => file.id === HELL_DISK.id);
    if (!disk || disk.discarded || disk.discarding) return;
    dragRef.current = null;
    setBinHot(false);
    setHellDriveHot(false);
    commitFiles(sourceFiles.map((file) => (
      file.id === HELL_DISK.id
        ? { ...file, discarded: true, dragging: false, vx: 0, vy: 0, angularVelocity: 0, sleeping: true }
        : file
    )));
    playSound("hellInsert");
    onHellDiskInsertedRef.current?.();
  }

  function rejectWrongDriveFile(
    file,
    sourceFiles = filesRef.current,
    driveBounds = getBootDriveBounds(),
    drive = "boot",
  ) {
    if (!file || !driveBounds) return;
    driveRejectCooldownRef.current.set(file.id, performance.now() + 650);
    const ejected = ejectFileFromTarget(file, driveBounds);
    commitFiles(sourceFiles.map((item) => item.id === file.id ? ejected : item));
    if (drive === "hell") setHellDriveHot(false);
    else setBootDriveHot(false);
    playSound("driveReject");
    onWrongDriveFileRef.current?.(file.name);
    ensureAnimation();
  }

  function beginDiscarding(ids, sourceFiles = filesRef.current) {
    const idSet = new Set(ids);
    const newIds = sourceFiles
      .filter((file) => idSet.has(file.id) && !file.discarded && !file.discarding)
      .map((file) => file.id);
    if (!newIds.length) return sourceFiles;

    const nextFiles = sourceFiles.map((file) => (
      newIds.includes(file.id)
        ? { ...file, discarding: true, dragging: false, vx: 0, vy: 0, angularVelocity: 0, sleeping: true }
        : file
    ));
    commitFiles(nextFiles);
    setBinHot(false);
    const trashedBootDisk = newIds.includes(BOOT_DISK.id);
    const trashedHellDisk = newIds.includes(HELL_DISK.id);
    if (trashedBootDisk || trashedHellDisk) {
      setBootTrashPanic(true);
      if (bootTrashTimeoutRef.current) window.clearTimeout(bootTrashTimeoutRef.current);
      bootTrashTimeoutRef.current = window.setTimeout(() => {
        setBootTrashPanic(false);
        bootTrashTimeoutRef.current = null;
      }, 1100);
      playSound(trashedHellDisk ? "hellTrash" : "bootTrash");
      if (trashedBootDisk) onBootDiskTrashedRef.current?.();
      if (trashedHellDisk) onHellDiskTrashedRef.current?.();
    } else {
      playSound("paperTrash");
    }

    for (const id of newIds) {
      const timeoutId = window.setTimeout(() => {
        discardTimeoutsRef.current.delete(id);
        commitFiles(filesRef.current.map((file) => (
          file.id === id ? { ...file, discarded: true, discarding: false } : file
        )));
      }, DISCARD_ANIMATION_MS);
      discardTimeoutsRef.current.set(id, timeoutId);
    }
    return nextFiles;
  }

  function restoreJunk() {
    for (const timeoutId of discardTimeoutsRef.current.values()) window.clearTimeout(timeoutId);
    discardTimeoutsRef.current.clear();
    dragRef.current = null;
    setBinHot(false);
    setBootDriveHot(false);
    setHellDriveHot(false);
    setBootTrashPanic(false);
    if (bootTrashTimeoutRef.current) window.clearTimeout(bootTrashTimeoutRef.current);
    bootTrashTimeoutRef.current = null;
    commitFiles(createDesktopFiles(definitionsRef.current, boundsRef.current, metricsRef.current));
    playSound("paperRestore");
  }

  function getPointerPosition(event) {
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function handlePointerDown(event, fileId) {
    if (event.button !== undefined && event.button !== 0) return;
    const file = filesRef.current.find((item) => item.id === fileId);
    if (!file || file.discarded || file.discarding) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointer = getPointerPosition(event);
    dragRef.current = {
      id: fileId,
      pointerId: event.pointerId,
      offsetX: pointer.x - file.x,
      offsetY: pointer.y - file.y,
      lastTime: performance.now(),
    };
    commitFiles(filesRef.current.map((item) => (
      item.id === fileId
        ? { ...item, pinned: false, dragging: true, sleeping: false, vx: 0, vy: 0, angularVelocity: 0 }
        : item
    )));
    playSound(isRemovableDisk(file) ? "floppyPickup" : "paperPickup");
    ensureAnimation();
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const pointer = getPointerPosition(event);
    const current = filesRef.current.find((file) => file.id === drag.id);
    if (!current) return;
    const now = performance.now();
    const elapsed = Math.max(0.008, (now - drag.lastTime) / 1000);
    const moved = clampFileToBounds({
      ...current,
      x: pointer.x - drag.offsetX,
      y: pointer.y - drag.offsetY,
    }, boundsRef.current);
    const velocity = clampThrowVelocity((moved.x - current.x) / elapsed, (moved.y - current.y) / elapsed);
    moved.vx = velocity.vx;
    moved.vy = velocity.vy;
    moved.angle += (moved.x - current.x) * 0.11;
    moved.angularVelocity = velocity.vx * 0.16;
    moved.sleeping = false;
    moved.dragging = true;
    drag.lastTime = now;
    commitFiles(filesRef.current.map((file) => file.id === drag.id ? moved : file));
    const bootDriveHot = isFileNearTarget(moved, getBootDriveBounds(), BOOT_DRIVE_PADDING);
    const hellDriveHot = isFileNearTarget(moved, getHellDriveBounds(), BOOT_DRIVE_PADDING);
    setBootDriveHot(bootDriveHot, moved.id === BOOT_DISK.id);
    setHellDriveHot(hellDriveHot, moved.id === HELL_DISK.id);
    setBinHot(!bootDriveHot && !hellDriveHot && isFileInRecycleBin(moved, getBinBounds()));
    ensureAnimation();
  }

  function handlePointerEnd(event, allowRecycle = true) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const current = filesRef.current.find((file) => file.id === drag.id);
    dragRef.current = null;
    setBinHot(false);
    setBootDriveHot(false);
    setHellDriveHot(false);
    if (!current) return;
    if (
      allowRecycle
      && current.id === BOOT_DISK.id
      && performance.now() >= bootInsertCooldownRef.current
      && isFileNearTarget(current, getBootDriveBounds(), BOOT_DRIVE_PADDING)
    ) {
      insertBootDisk();
      return;
    }
    if (
      allowRecycle
      && current.id !== BOOT_DISK.id
      && isFileNearTarget(current, getBootDriveBounds(), BOOT_DRIVE_PADDING)
    ) {
      rejectWrongDriveFile(current, filesRef.current, getBootDriveBounds(), "boot");
      return;
    }
    if (
      allowRecycle
      && current.id === HELL_DISK.id
      && performance.now() >= hellInsertCooldownRef.current
      && isFileNearTarget(current, getHellDriveBounds(), BOOT_DRIVE_PADDING)
    ) {
      insertHellDisk();
      return;
    }
    if (
      allowRecycle
      && current.id !== HELL_DISK.id
      && isFileNearTarget(current, getHellDriveBounds(), BOOT_DRIVE_PADDING)
    ) {
      rejectWrongDriveFile(current, filesRef.current, getHellDriveBounds(), "hell");
      return;
    }
    if (allowRecycle && isFileInRecycleBin(current, getBinBounds())) {
      beginDiscarding([current.id]);
      return;
    }

    const speed = Math.hypot(current.vx, current.vy);
    const nextFiles = filesRef.current.map((file) => (
      file.id === current.id
        ? {
          ...file,
          dragging: false,
          vx: reducedMotionRef.current ? 0 : file.vx,
          vy: reducedMotionRef.current ? 0 : file.vy,
          angularVelocity: reducedMotionRef.current ? 0 : file.angularVelocity,
          sleeping: reducedMotionRef.current || speed < 12,
        }
        : file
    ));
    commitFiles(nextFiles);
    playSound(speed > 100 ? "paperThrow" : "paperDrop");
    ensureAnimation();
  }

  function handleFileKeyDown(event, fileId) {
    const file = filesRef.current.find((item) => item.id === fileId);
    if (!file || file.discarded || file.discarding) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      beginDiscarding([fileId]);
      return;
    }
    if (file.id === BOOT_DISK.id && event.key === "Enter") {
      event.preventDefault();
      insertBootDisk();
      return;
    }
    if (file.id === HELL_DISK.id && event.key === "Enter") {
      event.preventDefault();
      insertHellDisk();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const direction = definitionsRef.current.findIndex((item) => item.id === fileId) % 2 ? -1 : 1;
      const tossed = reducedMotionRef.current
        ? clampFileToBounds({ ...file, pinned: false, x: file.x + direction * 24, y: file.y - 24 }, boundsRef.current)
        : { ...file, pinned: false, vx: direction * 520, vy: -760, angularVelocity: direction * 180, sleeping: false };
      commitFiles(filesRef.current.map((item) => item.id === fileId ? tossed : item));
      playSound(isRemovableDisk(file) ? "floppyDrop" : "paperThrow");
      ensureAnimation();
      return;
    }

    const movement = {
      ArrowLeft: [-16, 0],
      ArrowRight: [16, 0],
      ArrowUp: [0, -16],
      ArrowDown: [0, 16],
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    const moved = clampFileToBounds({
      ...file,
      pinned: false,
      x: file.x + movement[0],
      y: file.y + movement[1],
      sleeping: true,
      vx: 0,
      vy: 0,
    }, boundsRef.current);
    commitFiles(filesRef.current.map((item) => item.id === fileId ? moved : item));
    const bootDriveHot = isFileNearTarget(moved, getBootDriveBounds(), BOOT_DRIVE_PADDING);
    const hellDriveHot = isFileNearTarget(moved, getHellDriveBounds(), BOOT_DRIVE_PADDING);
    setBootDriveHot(bootDriveHot, moved.id === BOOT_DISK.id);
    setHellDriveHot(hellDriveHot, moved.id === HELL_DISK.id);
    setBinHot(!bootDriveHot && !hellDriveHot && isFileInRecycleBin(moved, getBinBounds()));
    if (bootDriveHot && moved.id !== BOOT_DISK.id) {
      rejectWrongDriveFile(moved, filesRef.current, getBootDriveBounds(), "boot");
    } else if (hellDriveHot && moved.id !== HELL_DISK.id) {
      rejectWrongDriveFile(moved, filesRef.current, getHellDriveBounds(), "hell");
    }
  }

  const removedCount = files.filter((file) => file.discarded || file.discarding).length;

  return (
    <div
      ref={layerRef}
      className={`desktop-physics-layer ${reducedMotion ? "reduced-motion" : ""}`}
      style={{
        "--desktop-object-scale": metrics.scale,
        "--desktop-file-width": `${metrics.fileWidth}px`,
        "--desktop-file-height": `${metrics.fileHeight}px`,
      }}
      aria-label="Loose desktop files"
    >
      <span className="desktop-junk-help">Pull a file off its pin and throw it</span>
      {files.filter((file) => !file.discarded).map((file) => (
        <button
          type="button"
          className={`desktop-junk-file ${file.color} ${file.kind ?? ""} ${file.pinned ? "pinned" : ""} ${file.dragging ? "dragging" : ""} ${file.discarding ? "discarding" : ""}`}
          key={file.id}
          style={{
            "--junk-x": `${file.x}px`,
            "--junk-y": `${file.y}px`,
            "--junk-angle": `${file.angle}deg`,
          }}
          onPointerDown={(event) => handlePointerDown(event, file.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => handlePointerEnd(event, true)}
          onPointerCancel={(event) => handlePointerEnd(event, false)}
          onKeyDown={(event) => handleFileKeyDown(event, file.id)}
          data-game-sound="custom"
          title={file.name}
          aria-label={isRemovableDisk(file)
            ? `${file.name}, drag or throw it into its computer drive, press Enter to insert, or press Delete to recycle`
            : `${file.name}, drag to throw or press Delete to recycle`}
        >
          <span className={`desktop-junk-visual ${isRemovableDisk(file) ? "desktop-boot-disk-visual" : ""} ${file.id === HELL_DISK.id ? "desktop-hell-disk-visual" : ""}`}>
            {file.pinned && <span className="desktop-junk-pin" aria-hidden="true" />}
            {isRemovableDisk(file)
              ? <span className="desktop-boot-disk-shutter" aria-hidden="true" />
              : <span className="desktop-junk-fold" aria-hidden="true" />}
            <strong>{file.badge}</strong>
            <small>{file.name}</small>
            {isRemovableDisk(file) && <i className="desktop-boot-disk-notch" aria-hidden="true" />}
          </span>
        </button>
      ))}

      <div className={`desktop-recycle-station ${bootTrashPanic ? "boot-trash-panic" : ""}`}>
        {bootTrashPanic && (
          <span className="boot-trash-sparks" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
        )}
        <div ref={binRef} className={`desktop-recycle-bin ${binHot ? "hot" : ""} ${bootTrashPanic ? "panic" : ""}`} aria-hidden="true">
          <span className="desktop-recycle-lid" />
          <span className="desktop-recycle-body"><i /><i /><i /></span>
          <strong>{binHot ? "DROP" : bootTrashPanic ? "WHY?!" : "TRASH"}</strong>
        </div>
        <button type="button" className="desktop-restore-junk" data-game-sound="custom" onClick={restoreJunk} disabled={!removedCount}>
          Restore junk{removedCount ? ` (${removedCount})` : ""}
        </button>
      </div>
      <span className="screen-reader-only" role="status" aria-live="polite">
        {removedCount} of {definitionsRef.current.length} loose files recycled
      </span>
    </div>
  );
}

function isRemovableDisk(file) {
  return file?.id === BOOT_DISK.id || file?.id === HELL_DISK.id;
}
