const DESKTOP_FILE_WIDTH = 58;
const DESKTOP_FILE_HEIGHT = 70;
const MAX_THROW_SPEED = 1500;

const DESKTOP_SCALE_BASE_WIDTH = 1920;
const DESKTOP_SCALE_BASE_HEIGHT = 1080;
const MIN_DESKTOP_OBJECT_SCALE = 0.82;
const MAX_DESKTOP_OBJECT_SCALE = 1.2;
const GRAVITY = 980;
const AIR_DRAG = 0.995;
const FLOOR_FRICTION = 0.84;
const BOUNDARY_RESTITUTION = 0.58;
const FILE_RESTITUTION = 0.66;
const RESTING_SPEED = 28;

export function getDesktopObjectMetrics(viewportWidth, viewportHeight) {
  const width = Number(viewportWidth) || DESKTOP_SCALE_BASE_WIDTH;
  const height = Number(viewportHeight) || DESKTOP_SCALE_BASE_HEIGHT;
  const scale = clamp(
    Math.min(width / DESKTOP_SCALE_BASE_WIDTH, height / DESKTOP_SCALE_BASE_HEIGHT),
    MIN_DESKTOP_OBJECT_SCALE,
    MAX_DESKTOP_OBJECT_SCALE,
  );
  return {
    scale,
    fileWidth: DESKTOP_FILE_WIDTH * scale,
    fileHeight: DESKTOP_FILE_HEIGHT * scale,
    clipbitSpace: (width >= 700 ? 150 : 105) * scale,
    clipbitHitHeight: 230 * scale,
  };
}

export function createDesktopFiles(definitions, bounds, metrics = getDesktopObjectMetrics(0)) {
  const fileWidth = Math.max(1, Number(metrics.fileWidth) || DESKTOP_FILE_WIDTH);
  const fileHeight = Math.max(1, Number(metrics.fileHeight) || DESKTOP_FILE_HEIGHT);
  const scale = Math.max(0.5, Number(metrics.scale) || fileWidth / DESKTOP_FILE_WIDTH);
  const width = Math.max(fileWidth, Number(bounds?.width) || 0);
  const height = Math.max(fileHeight, Number(bounds?.height) || 0);
  const maxY = Math.max(0, height - fileHeight);
  const startY = Math.min(42 * scale, maxY);
  const endY = Math.max(startY, maxY - 112 * scale);
  const spacing = definitions.length > 1 ? Math.min(88 * scale, (endY - startY) / (definitions.length - 1)) : 0;

  return definitions.map((definition, index) => ({
    ...definition,
    x: clamp((18 + index % 2 * 4) * scale, 0, width - fileWidth),
    y: clamp(startY + spacing * index, 0, maxY),
    vx: 0,
    vy: 0,
    angle: (index % 2 ? 1 : -1) * (2 + index % 3),
    angularVelocity: 0,
    width: fileWidth,
    height: fileHeight,
    pinned: true,
    dragging: false,
    sleeping: true,
    discarded: false,
    discarding: false,
  }));
}

export function stepDesktopPhysics(files, bounds, elapsedSeconds, options = {}) {
  const width = Math.max(0, Number(bounds?.width) || 0);
  const height = Math.max(0, Number(bounds?.height) || 0);
  const dt = clamp(Number(elapsedSeconds) || 0, 0, 0.032);
  const draggedId = options.draggedId ?? "";
  const next = files.map((file) => ({ ...file }));
  let collisions = 0;

  for (const file of next) {
    if (!isActive(file) || file.pinned || file.id === draggedId || file.dragging || file.sleeping || !dt) continue;
    file.vy += GRAVITY * dt;
    file.vx *= Math.pow(AIR_DRAG, dt * 60);
    file.angularVelocity *= Math.pow(AIR_DRAG, dt * 60);
    file.x += file.vx * dt;
    file.y += file.vy * dt;
    file.angle += file.angularVelocity * dt;
    collisions += resolveBoundaries(file, width, height, dt);
  }

  for (let leftIndex = 0; leftIndex < next.length; leftIndex += 1) {
    const left = next[leftIndex];
    if (!isActive(left)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < next.length; rightIndex += 1) {
      const right = next[rightIndex];
      if (!isActive(right)) continue;
      collisions += resolveFileCollision(left, right, draggedId);
    }
  }

  for (const file of next) {
    if (!isActive(file) || file.id === draggedId || file.dragging) continue;
    const floor = Math.max(0, height - file.height);
    const onFloor = file.y >= floor - 0.5;
    if (onFloor && Math.abs(file.vy) < RESTING_SPEED) {
      file.y = floor;
      file.vy = 0;
    }
    if (onFloor && Math.abs(file.vx) < 4 && Math.abs(file.angularVelocity) < 4 && file.vy === 0) {
      file.vx = 0;
      file.angularVelocity = 0;
      file.sleeping = true;
    }
  }

  return { files: next, collisions };
}

export function clampFileToBounds(file, bounds) {
  const width = Math.max(file.width, Number(bounds?.width) || 0);
  const height = Math.max(file.height, Number(bounds?.height) || 0);
  return {
    ...file,
    x: clamp(file.x, 0, width - file.width),
    y: clamp(file.y, 0, height - file.height),
  };
}

export function resizeDesktopFiles(files, previousBounds, nextBounds, metrics = getDesktopObjectMetrics(0)) {
  const fileWidth = Math.max(1, Number(metrics.fileWidth) || DESKTOP_FILE_WIDTH);
  const fileHeight = Math.max(1, Number(metrics.fileHeight) || DESKTOP_FILE_HEIGHT);
  const previousWidth = Math.max(1, Number(previousBounds?.width) || 1);
  const previousHeight = Math.max(1, Number(previousBounds?.height) || 1);
  const nextWidth = Math.max(fileWidth, Number(nextBounds?.width) || fileWidth);
  const nextHeight = Math.max(fileHeight, Number(nextBounds?.height) || fileHeight);
  const pinnedLayout = createDesktopFiles(files, { width: nextWidth, height: nextHeight }, metrics);
  return files.map((file, index) => {
    if (file.pinned) {
      return {
        ...file,
        x: pinnedLayout[index].x,
        y: pinnedLayout[index].y,
        angle: pinnedLayout[index].angle,
        width: fileWidth,
        height: fileHeight,
        sleeping: true,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
      };
    }
    return clampFileToBounds({
      ...file,
      x: file.x * nextWidth / previousWidth,
      y: file.y * nextHeight / previousHeight,
      width: fileWidth,
      height: fileHeight,
      sleeping: true,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
    }, { width: nextWidth, height: nextHeight });
  });
}

export function clampThrowVelocity(vx, vy, maxSpeed = MAX_THROW_SPEED) {
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed) || speed === 0) return { vx: 0, vy: 0 };
  if (speed <= maxSpeed) return { vx, vy };
  const scale = maxSpeed / speed;
  return { vx: vx * scale, vy: vy * scale };
}

export function isFileInRecycleBin(file, binBounds) {
  return isFileNearTarget(file, binBounds);
}

export function isFileNearTarget(file, targetBounds, padding = 0) {
  if (!file || !targetBounds || file.discarded || file.discarding) return false;
  const centerX = file.x + file.width / 2;
  const centerY = file.y + file.height / 2;
  return centerX >= targetBounds.x - padding
    && centerX <= targetBounds.x + targetBounds.width + padding
    && centerY >= targetBounds.y - padding
    && centerY <= targetBounds.y + targetBounds.height + padding;
}

export function ejectFileFromTarget(file, targetBounds) {
  if (!file || !targetBounds) return file;
  const fileCenterX = file.x + file.width / 2;
  const targetCenterX = targetBounds.x + targetBounds.width / 2;
  const direction = fileCenterX <= targetCenterX ? -1 : 1;
  return {
    ...file,
    pinned: false,
    dragging: false,
    sleeping: false,
    vx: direction * Math.max(560, Math.abs(Number(file.vx) || 0) * 0.72),
    vy: -Math.max(480, Math.abs(Number(file.vy) || 0) * 0.58),
    angularVelocity: direction * 240,
  };
}

export function releaseFileFromTarget(file, targetBounds, bounds, reducedMotion = false) {
  if (!file) return file;
  const positioned = targetBounds
    ? clampFileToBounds({
        ...file,
        x: reducedMotion
          ? targetBounds.x - file.width - 18
          : targetBounds.x + targetBounds.width / 2 - file.width / 2,
        y: targetBounds.y - file.height * 0.35,
        pinned: false,
        dragging: false,
        sleeping: reducedMotion,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
      }, bounds)
    : clampFileToBounds({
        ...file,
        pinned: false,
        dragging: false,
        sleeping: true,
        vx: 0,
        vy: 0,
        angularVelocity: 0,
      }, bounds);
  return reducedMotion || !targetBounds ? positioned : ejectFileFromTarget(positioned, targetBounds);
}

export function hasMovingDesktopFiles(files, draggedId = "") {
  return files.some((file) => (
    isActive(file)
    && !file.pinned
    && (file.id === draggedId || file.dragging || !file.sleeping || Math.hypot(file.vx, file.vy) > 1)
  ));
}

function resolveBoundaries(file, width, height, dt) {
  const maxX = Math.max(0, width - file.width);
  const maxY = Math.max(0, height - file.height);
  let collisions = 0;

  if (file.x < 0) {
    file.x = 0;
    if (file.vx < 0) {
      if (Math.abs(file.vx) > 110) collisions += 1;
      file.vx = Math.abs(file.vx) * BOUNDARY_RESTITUTION;
      file.angularVelocity += file.vx * 0.08;
    }
  } else if (file.x > maxX) {
    file.x = maxX;
    if (file.vx > 0) {
      if (Math.abs(file.vx) > 110) collisions += 1;
      file.vx = -Math.abs(file.vx) * BOUNDARY_RESTITUTION;
      file.angularVelocity += file.vx * 0.08;
    }
  }

  if (file.y < 0) {
    file.y = 0;
    if (file.vy < 0) {
      if (Math.abs(file.vy) > 110) collisions += 1;
      file.vy = Math.abs(file.vy) * BOUNDARY_RESTITUTION;
    }
  } else if (file.y > maxY) {
    file.y = maxY;
    if (file.vy > 0) {
      if (Math.abs(file.vy) > 110) collisions += 1;
      file.vy = -Math.abs(file.vy) * BOUNDARY_RESTITUTION;
    }
    file.vx *= Math.pow(FLOOR_FRICTION, dt * 60);
    file.angularVelocity *= Math.pow(FLOOR_FRICTION, dt * 60);
  }

  return collisions;
}

function resolveFileCollision(left, right, draggedId) {
  const overlapX = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
  const overlapY = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
  if (overlapX <= 0 || overlapY <= 0) return 0;

  const leftInverseMass = left.pinned || left.id === draggedId || left.dragging ? 0 : 1;
  const rightInverseMass = right.pinned || right.id === draggedId || right.dragging ? 0 : 1;
  const inverseMassTotal = leftInverseMass + rightInverseMass;
  if (inverseMassTotal === 0) return 0;

  const horizontalCollision = overlapX < overlapY;
  const normalX = horizontalCollision
    ? left.x + left.width / 2 < right.x + right.width / 2 ? 1 : -1
    : 0;
  const normalY = horizontalCollision
    ? 0
    : left.y + left.height / 2 < right.y + right.height / 2 ? 1 : -1;
  const penetration = horizontalCollision ? overlapX : overlapY;

  const correction = penetration / inverseMassTotal;
  left.x -= normalX * correction * leftInverseMass;
  left.y -= normalY * correction * leftInverseMass;
  right.x += normalX * correction * rightInverseMass;
  right.y += normalY * correction * rightInverseMass;

  const relativeVelocityX = right.vx - left.vx;
  const relativeVelocityY = right.vy - left.vy;
  const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;
  if (velocityAlongNormal >= 0) return 0;

  const impulse = -(1 + FILE_RESTITUTION) * velocityAlongNormal / inverseMassTotal;
  left.vx -= impulse * normalX * leftInverseMass;
  left.vy -= impulse * normalY * leftInverseMass;
  right.vx += impulse * normalX * rightInverseMass;
  right.vy += impulse * normalY * rightInverseMass;
  left.angularVelocity -= impulse * 0.025 * leftInverseMass;
  right.angularVelocity += impulse * 0.025 * rightInverseMass;
  left.sleeping = false;
  right.sleeping = false;
  return Math.abs(velocityAlongNormal) > 90 ? 1 : 0;
}

function isActive(file) {
  return !file.discarded && !file.discarding;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
