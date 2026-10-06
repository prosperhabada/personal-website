const canvas = document.querySelector('#playground');
const ctx = canvas.getContext('2d');
const switchButton = document.querySelector('#switch');
const soundButton = document.querySelector('#sound');
const stats = document.querySelector('#stats');
const announcement = document.querySelector('#announcement');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const art = {};
const gravity = 850, speed = 8.5, maxPull = 175;
let world, audioContext, drag = null, pointerId = null, lastTime = 0;
let angle = 0, angularVelocity = 0, shots = 0, bulbs = 0;
let powered = true, broken = false, soundEnabled = true;
let projectiles = [], fragments = [];
const keyboardPull = { x: 135, y: 100 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const notify = message => { announcement.textContent = message; };
const updateStats = () => { stats.textContent = shots + ' shots · ' + bulbs + ' bulbs'; };

function ensureAudio() {
  if (!soundEnabled) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  if (!audioContext) audioContext = new Audio();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
}
function playSound(kind) {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime, gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(kind === 'glass' ? 0.055 : 0.065, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'glass' ? 0.35 : 0.14));
  if (kind === 'glass') {
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.35, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 4500);
    const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 2400;
    source.buffer = buffer; source.connect(filter); filter.connect(gain); source.start();
  } else {
    const oscillator = audioContext.createOscillator();
    oscillator.type = kind === 'switch' ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'shot' ? 280 : kind === 'switch' ? 450 : 160, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'shot' ? 90 : 60, now + 0.13);
    oscillator.connect(gain); oscillator.start(); oscillator.stop(now + 0.15);
  }
}
function syncSwitch() {
  switchButton.setAttribute('aria-pressed', String(powered));
  switchButton.setAttribute('aria-label', powered ? 'Turn the lamp off' : 'Turn the lamp on');
  canvas.dataset.lamp = broken ? 'broken' : powered ? 'on' : 'off';
}
function toggleSwitch() {
  ensureAudio(); powered = !powered; syncSwitch(); playSound('switch');
  notify(broken ? 'Switch flipped. Replace the broken bulb to light the lamp.' : powered ? 'Lamp on.' : 'Lamp off.');
}
function replaceBulb() {
  ensureAudio();
  if (!broken) { notify('The bulb is still working.'); return; }
  broken = false; fragments = []; syncSwitch(); playSound('switch');
  notify(powered ? 'New bulb fitted. Lamp on.' : 'New bulb fitted. Flip the switch to turn it on.');
}
function reset() {
  angle = 0; angularVelocity = 0; powered = true; broken = false;
  shots = 0; bulbs = 0; projectiles = []; fragments = []; drag = null;
  keyboardPull.x = 135; keyboardPull.y = 100;
  if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  pointerId = null; updateStats(); syncSwitch(); notify('Playground reset.');
}
function resize() {
  const bounds = canvas.getBoundingClientRect(), mobile = bounds.width <= 700;
  const w = mobile ? 820 : 1536, h = w * bounds.height / bounds.width;
  const floor = mobile ? h - 315 : h * 0.842;
  world = { w, h, mobile, scale: bounds.width / w,
    pivot: { x: w * (mobile ? 0.43 : 0.5), y: mobile ? 440 : -10 },
    length: mobile ? 100 : h * 0.263,
    shadeWidth: mobile ? 400 : 460, shadeHeight: mobile ? 210 : 244,
    sling: { x: w * 0.794, y: floor - 198 },
    wallSwitch: { x: w * (mobile ? 0.855 : 0.765), y: mobile ? 660 : h * 0.398 }, floor };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
  ctx.setTransform(dpr * world.scale, 0, 0, dpr * world.scale, 0, 0);
  switchButton.style.left = world.wallSwitch.x / w * 100 + '%';
  switchButton.style.top = world.wallSwitch.y / h * 100 + '%';
  switchButton.style.width = 72 * world.scale + 'px'; switchButton.style.height = 124 * world.scale + 'px';
  switchButton.style.transform = 'translate(-50%, -50%)';
  projectiles = []; fragments = []; drag = null;
  if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  pointerId = null;
}
function lampPoint(x, y) {
  return { x: world.pivot.x + Math.sin(angle) * world.length + Math.cos(angle) * x + Math.sin(angle) * y,
    y: world.pivot.y + Math.cos(angle) * world.length - Math.sin(angle) * x + Math.cos(angle) * y };
}
function localPoint(point) {
  const mount = lampPoint(0, 0), dx = point.x - mount.x, dy = point.y - mount.y;
  return { x: Math.cos(angle) * dx - Math.sin(angle) * dy, y: Math.sin(angle) * dx + Math.cos(angle) * dy };
}
function bulbPoint() { return lampPoint(0, world.shadeHeight + 41); }
function breakBulb(projectile) {
  if (broken) return;
  broken = true; bulbs++; updateStats(); syncSwitch(); playSound('glass');
  const center = bulbPoint();
  for (let i = 0; i < (reducedMotion ? 6 : 24); i++) fragments.push({ x: center.x, y: center.y,
    vx: projectile.vx * 0.12 + (Math.random() - 0.5) * 380, vy: -80 - Math.random() * 260,
    rotation: Math.random() * 6, spin: Math.random() * 12 - 6, size: 4 + Math.random() * 8, life: 2.3 });
  notify('You broke the bulb! Fit a new one with Replace bulb.');
}
function shoot(pull) {
  if (!world || Math.hypot(pull.x, pull.y) < 12) return;
  ensureAudio();
  const length = Math.hypot(pull.x, pull.y), factor = Math.min(1, maxPull / length);
  projectiles.push({ x: world.sling.x, y: world.sling.y, vx: -pull.x * factor * speed,
    vy: -pull.y * factor * speed, life: 7, hits: new Set() });
  if (projectiles.length > 16) projectiles.shift();
  shots++; updateStats(); playSound('shot'); notify('Shot ' + shots + '.');
}
function collide(projectile) {
  const local = localPoint(projectile);
  const half = world.shadeWidth * (0.11 + 0.4 * clamp(local.y / world.shadeHeight, 0, 1));
  if (!projectile.hits.has('shade') && local.y > 4 && local.y < world.shadeHeight && Math.abs(local.x) < half) {
    projectile.hits.add('shade'); angularVelocity += clamp(projectile.vx / 700, -2.5, 2.5);
    projectile.vx *= -0.3; projectile.vy = Math.abs(projectile.vy) * 0.4;
    playSound('hit'); notify('Nice shot. The shade is swinging.');
  }
  const bulb = bulbPoint();
  if (!broken && Math.hypot(projectile.x - bulb.x, projectile.y - bulb.y) < 39) {
    breakBulb(projectile); projectile.vx *= 0.55; projectile.vy *= 0.55;
  }
  const wall = world.wallSwitch;
  if (!projectile.hits.has('switch') && Math.abs(projectile.x - wall.x) < 43 && Math.abs(projectile.y - wall.y) < 72) {
    projectile.hits.add('switch'); toggleSwitch(); projectile.vx *= -0.5;
  }
}
function update(dt) {
  if (!drag || drag.kind !== 'shade') {
    angularVelocity += -gravity / (world.length + world.shadeHeight * 0.5) * Math.sin(angle) * dt;
    angularVelocity *= Math.exp(-(reducedMotion ? 2.4 : 0.38) * dt); angle += angularVelocity * dt;
    if (Math.abs(angle) > 1.05) { angle = Math.sign(angle) * 1.05; angularVelocity *= -0.45; }
  }
  // Substeps keep a fast pebble from skipping the bulb or switch between frames.
  const steps = Math.max(1, Math.ceil(dt / 0.006)), step = dt / steps;
  for (let i = 0; i < steps; i++) for (const p of projectiles) {
    p.vy += gravity * step; p.x += p.vx * step; p.y += p.vy * step; p.life -= step; collide(p);
    if (p.y > world.floor - 9 && p.vy > 0) {
      p.y = world.floor - 9; p.vy *= -0.42; p.vx *= 0.7;
      if (Math.abs(p.vy) < 15) { p.vy = 0; p.vx *= 0.8; }
    }
  }
  projectiles = projectiles.filter(p => p.life > 0 && p.x > -100 && p.x < world.w + 100);
  for (const p of fragments) {
    p.vy += gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.spin * dt; p.life -= dt;
    if (p.y > world.floor) { p.y = world.floor; p.vy *= -0.25; p.vx *= 0.6; }
  }
  fragments = fragments.filter(p => p.life > 0);
  canvas.dataset.swing = Math.abs(angle) > 0.02 ? 'moving' : 'still';
}
function drawStone(x, y, size = 24) { ctx.drawImage(art.pebble, x - size / 2, y - size / 2, size, size * 0.85); }
function draw() {
  ctx.clearRect(0, 0, world.w, world.h);
  const mount = lampPoint(0, 0), lit = powered && !broken;
  ctx.save(); ctx.translate(mount.x, mount.y); ctx.rotate(-angle);
  if (lit) {
    const glow = ctx.createRadialGradient(0, world.shadeHeight, 10, 0, world.shadeHeight + 80, 290);
    glow.addColorStop(0, '#ffc46430'); glow.addColorStop(1, '#ffc46400');
    ctx.fillStyle = glow; ctx.fillRect(-310, 60, 620, 620);
    const beam = ctx.createLinearGradient(0, world.shadeHeight, 0, world.floor - mount.y);
    beam.addColorStop(0, '#ffcd7210'); beam.addColorStop(1, '#ffcd7200');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(-world.shadeWidth * 0.43, world.shadeHeight * 0.9);
    ctx.lineTo(-420, world.floor - mount.y); ctx.lineTo(420, world.floor - mount.y);
    ctx.lineTo(world.shadeWidth * 0.43, world.shadeHeight * 0.9); ctx.closePath(); ctx.fill();
  }
  ctx.restore(); ctx.strokeStyle = '#353c3c'; ctx.lineWidth = 8; ctx.beginPath();
  ctx.moveTo(world.pivot.x, world.pivot.y); ctx.lineTo(mount.x, mount.y + 22); ctx.stroke();
  ctx.strokeStyle = '#828173'; ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.moveTo(world.pivot.x - 1, world.pivot.y); ctx.lineTo(mount.x - 1, mount.y + 22); ctx.stroke();
  ctx.save(); ctx.translate(mount.x, mount.y); ctx.rotate(-angle);
  const bulbW = world.mobile ? 82 : 100, bulbH = bulbW * art.bulb.height / art.bulb.width;
  const bulbY = world.shadeHeight - 52;
  if (!broken) {
    ctx.filter = lit ? 'none' : 'brightness(0.48) saturate(0.4)';
    ctx.drawImage(art.bulb, -bulbW / 2, bulbY, bulbW, bulbH); ctx.filter = 'none';
  } else ctx.drawImage(art.bulb, 0, 0, art.bulb.width, art.bulb.height * 0.28, -bulbW / 2, bulbY, bulbW, bulbH * 0.28);
  ctx.drawImage(art.shade, -world.shadeWidth / 2, 0, world.shadeWidth, world.shadeHeight); ctx.restore();
  const floorGlow = ctx.createLinearGradient(world.w * 0.5, 0, world.w, 0);
  floorGlow.addColorStop(0, '#a77d4900'); floorGlow.addColorStop(0.5, '#a77d4988'); floorGlow.addColorStop(1, '#a77d4966');
  ctx.strokeStyle = floorGlow; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(world.w * 0.5, world.floor); ctx.lineTo(world.w, world.floor); ctx.stroke();
  ctx.drawImage(art.slingshot, world.sling.x - 79, world.sling.y - 5, 158, 207);
  const pull = drag && drag.kind === 'stone' ? drag.pull : { x: 0, y: 0 };
  const stone = { x: world.sling.x + pull.x, y: world.sling.y + pull.y };
  ctx.strokeStyle = '#dac193'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(world.sling.x - 55, world.sling.y + 14); ctx.lineTo(stone.x, stone.y);
  ctx.lineTo(world.sling.x + 55, world.sling.y + 14); ctx.stroke();
  if (drag && drag.kind === 'stone') {
    ctx.fillStyle = '#dce7ff88';
    for (let i = 1; i < 24; i++) {
      const t = i * 0.045, x = world.sling.x - pull.x * speed * t;
      const y = world.sling.y - pull.y * speed * t + gravity * t * t / 2;
      if (y >= world.floor || x < 0 || x > world.w) break;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawStone(stone.x, stone.y, 31);
  for (const p of projectiles) drawStone(p.x, p.y);
  for (const p of fragments) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.globalAlpha = Math.min(p.life, 1); ctx.fillStyle = '#c6edf1';
    ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size * 0.5, -p.size); ctx.lineTo(p.size, p.size * 0.45);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
function point(event) {
  const box = canvas.getBoundingClientRect();
  return { x: (event.clientX - box.left) / world.scale, y: (event.clientY - box.top) / world.scale };
}
canvas.addEventListener('pointerdown', event => {
  if (!world || pointerId !== null || event.button > 0) return;
  const p = point(event), local = localPoint(p);
  if (Math.hypot(p.x - world.sling.x, p.y - world.sling.y) < 125) drag = { kind: 'stone', pull: { x: 0, y: 0 } };
  else if (Math.abs(local.x) < world.shadeWidth / 2 && local.y > -25 && local.y < world.shadeHeight + 25)
    drag = { kind: 'shade', lastAngle: angle, lastTime: event.timeStamp,
      offset: Math.atan2(p.x - world.pivot.x, p.y - world.pivot.y) - angle };
  else return;
  ensureAudio(); pointerId = event.pointerId; canvas.setPointerCapture(pointerId);
  canvas.focus({ preventScroll: true }); event.preventDefault();
});
canvas.addEventListener('pointermove', event => {
  if (!world) return;
  const p = point(event);
  if (event.pointerId === pointerId && drag) {
    if (drag.kind === 'stone') {
      let x = p.x - world.sling.x, y = p.y - world.sling.y;
      const length = Math.hypot(x, y);
      if (length > maxPull) { x *= maxPull / length; y *= maxPull / length; }
      drag.pull = { x, y };
    } else {
      const next = clamp(Math.atan2(p.x - world.pivot.x, p.y - world.pivot.y) - drag.offset, -1.05, 1.05);
      angularVelocity = clamp((next - drag.lastAngle) / Math.max((event.timeStamp - drag.lastTime) / 1000, 0.008), -3, 3);
      angle = next; drag.lastAngle = next; drag.lastTime = event.timeStamp;
    }
    event.preventDefault();
  } else {
    const local = localPoint(p);
    canvas.style.cursor = Math.hypot(p.x - world.sling.x, p.y - world.sling.y) < 110 ||
      (Math.abs(local.x) < world.shadeWidth / 2 && local.y > 0 && local.y < world.shadeHeight) ? 'grab' : 'default';
  }
});
function release(event, cancelled = false) {
  if (event.pointerId !== pointerId) return;
  const current = drag; drag = null;
  if (current && !cancelled && current.kind === 'stone') shoot(current.pull);
  if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  pointerId = null;
}
canvas.addEventListener('pointerup', event => release(event));
canvas.addEventListener('pointercancel', event => release(event, true));
canvas.addEventListener('lostpointercapture', () => { drag = null; pointerId = null; });
canvas.addEventListener('keydown', event => {
  if (!world) return;
  const key = event.key.toLowerCase();
  if (!['s', 'b', 'r', ' ', 'enter', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'escape'].includes(key)) return;
  event.preventDefault(); ensureAudio();
  if (key === 's') toggleSwitch(); if (key === 'b') replaceBulb(); if (key === 'r') reset();
  if (key === ' ') { angularVelocity += 1.4; notify('The shade is swinging.'); }
  if (key === 'arrowleft') keyboardPull.x = clamp(keyboardPull.x + 10, -maxPull, maxPull);
  if (key === 'arrowright') keyboardPull.x = clamp(keyboardPull.x - 10, -maxPull, maxPull);
  if (key === 'arrowup') keyboardPull.y = clamp(keyboardPull.y + 10, -maxPull, maxPull);
  if (key === 'arrowdown') keyboardPull.y = clamp(keyboardPull.y - 10, -maxPull, maxPull);
  if (key.startsWith('arrow')) {
    const factor = Math.min(1, maxPull / Math.hypot(keyboardPull.x, keyboardPull.y));
    drag = { kind: 'stone', pull: { x: keyboardPull.x * factor, y: keyboardPull.y * factor } };
    notify('Aim adjusted. Press Enter to shoot.');
  }
  if (key === 'enter') { drag = null; shoot(keyboardPull); } if (key === 'escape') drag = null;
});
switchButton.addEventListener('click', toggleSwitch);
document.querySelector('#replace').addEventListener('click', replaceBulb);
document.querySelector('#reset').addEventListener('click', reset);
soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled; soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';
  soundButton.setAttribute('aria-pressed', String(soundEnabled)); if (soundEnabled) ensureAudio();
});
// Extract the four cutout sprites once, preserving the atlas alpha channel.
const atlas = new Image();
atlas.onload = () => {
  const crops = { shade: [76, 58, 820, 442], bulb: [1058, 65, 1294, 444],
    slingshot: [263, 518, 629, 991], pebble: [1078, 700, 1305, 887] };
  for (const [name, box] of Object.entries(crops)) {
    const sprite = document.createElement('canvas');
    sprite.width = box[2] - box[0]; sprite.height = box[3] - box[1];
    sprite.getContext('2d').drawImage(atlas, box[0], box[1], sprite.width, sprite.height, 0, 0, sprite.width, sprite.height);
    art[name] = sprite;
  }
  resize(); syncSwitch(); new ResizeObserver(resize).observe(canvas);
  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 0; lastTime = time;
    if (!document.hidden) { update(dt); draw(); } requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};
atlas.onerror = () => {
  document.querySelector('#instructions').textContent = 'The lamp artwork couldn’t load. Refresh to try again.';
  notify('The lamp artwork could not load.');
};
// The text fragments preserve the original PNG bytes without external image URLs.
Promise.all(Array.from({ length: 33 }, async (_, index) => {
  const response = await fetch('./assets/atlas-' + String(index).padStart(2, '0') + '.txt');
  if (!response.ok) throw new Error('Lamp artwork could not load.');
  return response.text();
})).then(parts => {
  atlas.src = 'data:image/png;base64,' + parts.join('');
}).catch(atlas.onerror);
