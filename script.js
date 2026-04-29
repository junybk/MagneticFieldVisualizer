import * as THREE from 'three';

// =========================================================
//  SCENE SETUP
// =========================================================
const canvas = document.getElementById('three-canvas');
const canvasWrap = canvas.parentElement;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xede6da, 0.028);
const fogBaseDensity = 0.028;
const fogMinDensity = 0.006;
const fogNearRadius = 10;
const fogFarRadius = 30;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(8, 6, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const ambient = new THREE.AmbientLight(0xf0e8d8, 0.75);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.1);
keyLight.position.set(5, 10, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xc77a7a, 0.25);
rimLight.position.set(-8, 4, -5);
scene.add(rimLight);
const fillLight = new THREE.PointLight(0x7b9bb0, 0.35, 30);
fillLight.position.set(0, 5, 0);
scene.add(fillLight);
const hemiLight = new THREE.HemisphereLight(0xfff4e2, 0xc9bfa8, 0.35);
scene.add(hemiLight);

class BarMagnet {
  constructor(position, rotation = 0, id) {
    this.id = id;
    this.type = 'bar';
    this.typeLabel = '棒磁石';
    this.strength = 1.0;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotation;
    this.group.userData.magnet = this;

    const W = 2.4, H = 0.8, D = 0.8;
    const nGeom = new THREE.BoxGeometry(W / 2, H, D);
    const nMat = new THREE.MeshStandardMaterial({
      color: 0xc77a7a, metalness: 0.35, roughness: 0.45,
      emissive: 0xa05555, emissiveIntensity: 0.08
    });
    this.nMesh = new THREE.Mesh(nGeom, nMat);
    this.nMesh.position.x = W / 4;
    this.nMesh.castShadow = true;
    this.nMesh.userData.magnet = this;
    this.group.add(this.nMesh);

    const sGeom = new THREE.BoxGeometry(W / 2, H, D);
    const sMat = new THREE.MeshStandardMaterial({
      color: 0x7b9bb0, metalness: 0.35, roughness: 0.45,
      emissive: 0x4e7388, emissiveIntensity: 0.08
    });
    this.sMesh = new THREE.Mesh(sGeom, sMat);
    this.sMesh.position.x = -W / 4;
    this.sMesh.castShadow = true;
    this.sMesh.userData.magnet = this;
    this.group.add(this.sMesh);

    this.addLabel('N', W / 4);
    this.addLabel('S', -W / 4);

    const ringGeom = new THREE.TorusGeometry(W / 2 + 0.15, 0.04, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8ca88a, transparent: true, opacity: 0 });
    this.ring = new THREE.Mesh(ringGeom, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = -H / 2 - 0.02;
    this.group.add(this.ring);

    this.poleN = new THREE.Vector3();
    this.poleS = new THREE.Vector3();
    this.updatePoles();
  }

  addLabel(text, xOffset) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = 'bold 80px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const geom = new THREE.PlaneGeometry(0.5, 0.5);
    const label = new THREE.Mesh(geom, mat);
    label.position.set(xOffset, 0.41, 0);
    label.rotation.x = -Math.PI / 2;
    this.group.add(label);
  }

  updatePoles() {
    const W = 2.4;
    const offset = W / 2 - 0.2;
    const dirN = new THREE.Vector3(1, 0, 0).applyQuaternion(this.group.quaternion);
    this.poleN.copy(this.group.position).addScaledVector(dirN, offset);
    this.poleS.copy(this.group.position).addScaledVector(dirN, -offset);
  }

  setSelected(sel) {
    this.selected = sel;
    this.ring.material.opacity = sel ? 0.95 : 0;
    this.nMesh.material.emissiveIntensity = sel ? 0.28 : (this.measured ? 0.18 : 0.08);
    this.sMesh.material.emissiveIntensity = sel ? 0.28 : (this.measured ? 0.18 : 0.08);
  }

  setMeasured(measured, label) {
    this.measured = measured;
    this.measureLabel = label;
    if (!this.selected) {
      this.nMesh.material.emissiveIntensity = measured ? 0.18 : 0.08;
      this.sMesh.material.emissiveIntensity = measured ? 0.18 : 0.08;
    }
  }
}

class UMagnet {
  constructor(position, rotation = 0, id) {
    this.id = id;
    this.type = 'u';
    this.typeLabel = 'U字磁石';
    this.strength = 1.0;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotation;
    this.group.userData.magnet = this;

    const legW = 0.5, legLen = 1.6, gap = 1.0, H = 0.7;
    const legCenterX = gap / 2 + legW / 2;
    const archRadius = gap / 2 + legW / 2;
    const tubeRadius = legW / 2;
    const yTip = legLen / 2;
    const yArch = -legLen / 2;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, metalness: 0.2, roughness: 0.55 });
    const legGeom = new THREE.BoxGeometry(legW, H, legLen);
    const rightLeg = new THREE.Mesh(legGeom, bodyMat);
    rightLeg.position.set(legCenterX, 0, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    rightLeg.userData.magnet = this;
    this.group.add(rightLeg);

    const leftLeg = new THREE.Mesh(legGeom.clone(), bodyMat);
    leftLeg.position.set(-legCenterX, 0, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    leftLeg.userData.magnet = this;
    this.group.add(leftLeg);

    const archGeom = new THREE.TorusGeometry(archRadius, tubeRadius, 12, 40, Math.PI);
    archGeom.rotateX(Math.PI / 2);
    archGeom.rotateY(Math.PI);
    archGeom.translate(0, 0, yArch);
    const arch = new THREE.Mesh(archGeom, bodyMat);
    arch.castShadow = true;
    arch.receiveShadow = true;
    arch.userData.magnet = this;
    this.group.add(arch);

    const capLen = 0.5;
    const capGeomN = new THREE.BoxGeometry(legW * 1.01, H * 1.01, capLen);
    const capMatN = new THREE.MeshStandardMaterial({
      color: 0xc77a7a, metalness: 0.35, roughness: 0.45, emissive: 0xa05555, emissiveIntensity: 0.08
    });
    this.nMesh = new THREE.Mesh(capGeomN, capMatN);
    this.nMesh.position.set(legCenterX, 0, yTip - capLen / 2);
    this.nMesh.castShadow = true;
    this.nMesh.userData.magnet = this;
    this.group.add(this.nMesh);

    const capGeomS = new THREE.BoxGeometry(legW * 1.01, H * 1.01, capLen);
    const capMatS = new THREE.MeshStandardMaterial({
      color: 0x7b9bb0, metalness: 0.35, roughness: 0.45, emissive: 0x4e7388, emissiveIntensity: 0.08
    });
    this.sMesh = new THREE.Mesh(capGeomS, capMatS);
    this.sMesh.position.set(-legCenterX, 0, yTip - capLen / 2);
    this.sMesh.castShadow = true;
    this.sMesh.userData.magnet = this;
    this.group.add(this.sMesh);

    this.addTopLabel('N', legCenterX, yTip - 0.25);
    this.addTopLabel('S', -legCenterX, yTip - 0.25);

    const ringGeom = new THREE.TorusGeometry(gap * 0.75, 0.04, 8, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8ca88a, transparent: true, opacity: 0 });
    this.ring = new THREE.Mesh(ringGeom, ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.set(0, -H / 2 - 0.02, yTip - 0.4);
    this.ring.scale.set(1.0, 1.3, 1.0);
    this.group.add(this.ring);

    this.poleN = new THREE.Vector3();
    this.poleS = new THREE.Vector3();
    this._legOffsetX = legCenterX;
    this._legOffsetZ = yTip - 0.1;
    this.updatePoles();
  }

  addTopLabel(text, xOffset, zOffset) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = 'bold 80px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const geom = new THREE.PlaneGeometry(0.45, 0.45);
    const label = new THREE.Mesh(geom, mat);
    label.position.set(xOffset, 0.39, zOffset);
    label.rotation.x = -Math.PI / 2;
    this.group.add(label);
  }

  updatePoles() {
    const nLocal = new THREE.Vector3(this._legOffsetX, 0, this._legOffsetZ);
    const sLocal = new THREE.Vector3(-this._legOffsetX, 0, this._legOffsetZ);
    this.poleN.copy(nLocal).applyQuaternion(this.group.quaternion).add(this.group.position);
    this.poleS.copy(sLocal).applyQuaternion(this.group.quaternion).add(this.group.position);
  }

  setSelected(sel) {
    this.selected = sel;
    this.ring.material.opacity = sel ? 0.95 : 0;
    const intensity = sel ? 0.28 : (this.measured ? 0.18 : 0.08);
    this.nMesh.material.emissiveIntensity = intensity;
    this.sMesh.material.emissiveIntensity = intensity;
  }

  setMeasured(measured, label) {
    this.measured = measured;
    this.measureLabel = label;
    if (!this.selected) {
      this.nMesh.material.emissiveIntensity = measured ? 0.18 : 0.08;
      this.sMesh.material.emissiveIntensity = measured ? 0.18 : 0.08;
    }
  }
}

function computeFieldAt(point, magnets) {
  const B = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (const m of magnets) {
    tmp.subVectors(point, m.poleN);
    let r2 = tmp.lengthSq();
    if (r2 < 0.04) r2 = 0.04;
    const fN = m.strength / (r2 * Math.sqrt(r2));
    B.addScaledVector(tmp, fN);
    tmp.subVectors(point, m.poleS);
    r2 = tmp.lengthSq();
    if (r2 < 0.04) r2 = 0.04;
    const fS = -m.strength / (r2 * Math.sqrt(r2));
    B.addScaledVector(tmp, fS);
  }
  return B;
}

const fieldLineGroup = new THREE.Group();
scene.add(fieldLineGroup);

function traceFieldLine(startPoint, direction, magnets, maxSteps = 500) {
  const points = [startPoint.clone()];
  const p = startPoint.clone();
  const step = 0.08;
  for (let i = 0; i < maxSteps; i++) {
    const field = computeFieldAt(p, magnets);
    if (field.lengthSq() < 1e-6) break;
    field.normalize().multiplyScalar(step * direction);
    p.add(field);
    let hitMagnet = false;
    for (const m of magnets) {
      if (p.distanceTo(m.poleN) < 0.25 || p.distanceTo(m.poleS) < 0.25) {
        hitMagnet = true; break;
      }
    }
    points.push(p.clone());
    if (hitMagnet) break;
    if (p.length() > 30) break;
  }
  return points;
}

function buildFieldLines(magnets, density) {
  while (fieldLineGroup.children.length) {
    const c = fieldLineGroup.children.pop();
    c.geometry?.dispose();
    c.material?.dispose();
  }
  if (magnets.length === 0) return;
  const seedOffsets = [];
  for (let i = 0; i < density; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / density);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    seedOffsets.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    ));
  }
  for (const m of magnets) {
    for (const seed of seedOffsets) {
      const startPos = m.poleN.clone().addScaledVector(seed, 0.35);
      const points = traceFieldLine(startPos, 1, magnets, 400);
      if (points.length < 3) continue;
      addFieldLineMesh(points);
    }
  }
}

function addFieldLineMesh(points) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const colors = [];
  const cN = new THREE.Color(0xa05555);
  const cS = new THREE.Color(0x4e7388);
  const cTmp = new THREE.Color();
  for (let i = 0; i < points.length; i++) {
    const t = i / points.length;
    cTmp.copy(cN).lerp(cS, t);
    colors.push(cTmp.r, cTmp.g, cTmp.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, linewidth: 1 });
  const line = new THREE.Line(geom, mat);
  line.userData.basePoints = points;
  fieldLineGroup.add(line);
}

const particleGroup = new THREE.Group();
scene.add(particleGroup);
const PARTICLE_COUNT = 600;
let particleData = [];

function initParticles() {
  while (particleGroup.children.length) {
    const c = particleGroup.children.pop();
    c.geometry?.dispose();
    c.material?.dispose();
  }
  particleData = [];
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 8 + 1,
      (Math.random() - 0.5) * 14
    );
    positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    colors[i * 3] = 0.63; colors[i * 3 + 1] = 0.48; colors[i * 3 + 2] = 0.48;
    particleData.push({ pos: p, life: Math.random() * 100 });
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(140, 168, 138, 1)');
  grad.addColorStop(0.4, 'rgba(140, 168, 138, 0.7)');
  grad.addColorStop(1, 'rgba(140, 168, 138, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({
    size: 0.22, map: tex, vertexColors: true, transparent: true,
    opacity: 0.75, blending: THREE.NormalBlending, depthWrite: false
  });
  const points = new THREE.Points(geom, mat);
  particleGroup.add(points);
  particleGroup.userData.points = points;
}
initParticles();

function updateParticles(dt, magnets) {
  const points = particleGroup.userData.points;
  if (!points) return;
  const posArr = points.geometry.attributes.position.array;
  const colArr = points.geometry.attributes.color.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const d = particleData[i];
    const B = computeFieldAt(d.pos, magnets);
    const speed = Math.min(B.length() * 2, 4);
    B.normalize().multiplyScalar(speed * dt * animSpeed);
    d.pos.add(B);
    d.life -= dt * 60;
    let reset = d.life < 0 || d.pos.length() > 14;
    for (const m of magnets) {
      if (d.pos.distanceTo(m.poleS) < 0.3) { reset = true; break; }
    }
    if (reset) {
      if (magnets.length > 0) {
        const m = magnets[Math.floor(Math.random() * magnets.length)];
        const seed = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
        d.pos.copy(m.poleN).addScaledVector(seed, 0.35);
      } else {
        d.pos.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 10);
      }
      d.life = 60 + Math.random() * 80;
    }
    posArr[i * 3] = d.pos.x;
    posArr[i * 3 + 1] = d.pos.y;
    posArr[i * 3 + 2] = d.pos.z;
    const intensity = Math.min(computeFieldAt(d.pos, magnets).length() * 0.5, 1);
    colArr[i * 3] = 0.78 - intensity * 0.23;
    colArr[i * 3 + 1] = 0.48 + intensity * 0.18;
    colArr[i * 3 + 2] = 0.48 + intensity * 0.06;
  }
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate = true;
}

const compassGroup = new THREE.Group();
scene.add(compassGroup);

class CompassProbe {
  constructor(position, id) {
    this.id = id;
    this.type = 'compass';
    this.typeLabel = '方位磁針';
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.userData.compass = this;

    const baseR = 0.55, baseH = 0.08;
    const baseGeom = new THREE.CylinderGeometry(baseR, baseR * 0.95, baseH, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, metalness: 0.12, roughness: 0.6 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = -baseH / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    base.userData.compass = this;
    this.group.add(base);

    const ringGeom = new THREE.TorusGeometry(baseR, 0.025, 8, 48);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xb8a991, metalness: 0.25, roughness: 0.55 });
    const baseRing = new THREE.Mesh(ringGeom, ringMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.001;
    baseRing.userData.compass = this;
    this.group.add(baseRing);

    const needleHalfLen = 0.42, needleMaxW = 0.075;
    const nShape = new THREE.Shape();
    nShape.moveTo(needleHalfLen, 0);
    nShape.lineTo(0, needleMaxW);
    nShape.lineTo(0, -needleMaxW);
    nShape.lineTo(needleHalfLen, 0);
    const nGeom = new THREE.ExtrudeGeometry(nShape, { depth: 0.04, bevelEnabled: false });
    const nMat = new THREE.MeshStandardMaterial({
      color: 0xc77a7a, emissive: 0xa05555, emissiveIntensity: 0.1,
      metalness: 0.25, roughness: 0.5, transparent: false, opacity: 1.0
    });
    this.nNeedle = new THREE.Mesh(nGeom, nMat);
    this.nNeedle.rotation.x = -Math.PI / 2;
    this.nNeedle.position.y = 0.03;
    this.nNeedle.castShadow = true;
    this.nNeedle.userData.compass = this;
    this.group.add(this.nNeedle);

    const sShape = new THREE.Shape();
    sShape.moveTo(-needleHalfLen, 0);
    sShape.lineTo(0, -needleMaxW);
    sShape.lineTo(0, needleMaxW);
    sShape.lineTo(-needleHalfLen, 0);
    const sGeom = new THREE.ExtrudeGeometry(sShape, { depth: 0.04, bevelEnabled: false });
    const sMat = new THREE.MeshStandardMaterial({
      color: 0x7b9bb0, emissive: 0x4e7388, emissiveIntensity: 0.1,
      metalness: 0.25, roughness: 0.5, transparent: false, opacity: 1.0
    });
    this.sNeedle = new THREE.Mesh(sGeom, sMat);
    this.sNeedle.rotation.x = -Math.PI / 2;
    this.sNeedle.position.y = 0.03;
    this.sNeedle.castShadow = true;
    this.sNeedle.userData.compass = this;
    this.group.add(this.sNeedle);

    const pinGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, metalness: 0.5, roughness: 0.4 });
    const pin = new THREE.Mesh(pinGeom, pinMat);
    pin.position.y = 0.04;
    pin.userData.compass = this;
    this.group.add(pin);

    const selRingGeom = new THREE.TorusGeometry(baseR + 0.12, 0.03, 8, 48);
    const selRingMat = new THREE.MeshBasicMaterial({ color: 0x8ca88a, transparent: true, opacity: 0 });
    this.selectionRing = new THREE.Mesh(selRingGeom, selRingMat);
    this.selectionRing.rotation.x = Math.PI / 2;
    this.selectionRing.position.y = -baseH + 0.002;
    this.group.add(this.selectionRing);
  }

  setSelected(sel) {
    this.selected = sel;
    this.selectionRing.material.opacity = sel ? 0.9 : 0;
  }

  updateFromField(magnets) {
    const B = computeFieldAt(this.group.position, magnets);
    if (B.lengthSq() < 1e-6) {
      this.nNeedle.material.opacity = 0.3;
      this.sNeedle.material.opacity = 0.3;
      return;
    }
    const angle = Math.atan2(B.z, B.x);
    this.group.rotation.y = -angle;
    const intensity = Math.min(B.length() * 0.3, 1);
    const opacity = 0.45 + intensity * 0.5;
    this.nNeedle.material.opacity = opacity;
    this.sNeedle.material.opacity = opacity;
  }
}

let compasses = [];
let selectedCompass = null;
let magnets = [];
let nextId = 1;
let selectedMagnet = null;
let measureTargets = [];

function addCompass(position) {
  const c = new CompassProbe(position, nextId++);
  compasses.push(c);
  compassGroup.add(c.group);
  updateCompassList();
  selectCompass(c);
  return c;
}

function removeCompass(c) {
  const idx = compasses.indexOf(c);
  if (idx < 0) return;
  compassGroup.remove(c.group);
  c.group.traverse(o => {
    o.geometry?.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(mm => mm.dispose());
      else o.material.dispose();
    }
  });
  compasses.splice(idx, 1);
  if (selectedCompass === c) selectedCompass = null;
  updateCompassList();
}

function selectCompass(c) {
  magnets.forEach(m => m.setSelected(false));
  selectedMagnet = null;
  compasses.forEach(cc => cc.setSelected(false));
  selectedCompass = c;
  if (c) c.setSelected(true);
  updateMagnetList();
  updateCompassList();
  updateReadout();
}

function updateAllCompasses() {
  for (const c of compasses) c.updateFromField(magnets);
}

function updateCompassList() {
  const list = document.getElementById('compass-list');
  if (!list) return;
  list.innerHTML = '';
  if (compasses.length === 0) {
    list.innerHTML = '<div style="font-size: 11px; color: var(--text-lo); padding: 8px 2px;">まだ配置されていません</div>';
    return;
  }
  compasses.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'magnet-item' + (c === selectedCompass ? ' active' : '');
    item.innerHTML = `
      <div class="compass-swatch"></div>
      <div class="magnet-info">
        <div class="magnet-name">方位磁針 #${String(i + 1).padStart(2, '0')}</div>
        <div class="magnet-coord">X:${c.group.position.x.toFixed(1)} Z:${c.group.position.z.toFixed(1)}</div>
      </div>
      <button class="btn" style="padding: 4px 8px; font-size: 10px; flex: none;" data-remove-compass="${c.id}">✕</button>
    `;
    item.onclick = (e) => {
      if (e.target.closest('[data-remove-compass]')) removeCompass(c);
      else selectCompass(c);
    };
    list.appendChild(item);
  });
}

function toggleMeasureTarget(m) {
  const idx = measureTargets.indexOf(m);
  if (idx >= 0) measureTargets.splice(idx, 1);
  else {
    if (measureTargets.length >= 2) measureTargets.shift();
    measureTargets.push(m);
  }
  magnets.forEach(mg => {
    const i = measureTargets.indexOf(mg);
    mg.setMeasured(i >= 0, i === 0 ? 'A' : i === 1 ? 'B' : '');
  });
  updateMagnetList();
  updateMetrics();
}

function addMagnet(position, rotation = 0, type = 'bar') {
  const m = type === 'u' ? new UMagnet(position, rotation, nextId++) : new BarMagnet(position, rotation, nextId++);
  m.strength = parseFloat(strengthSlider.value);
  magnets.push(m);
  scene.add(m.group);
  if (measureTargets.length < 2) measureTargets.push(m);
  magnets.forEach(mg => {
    const i = measureTargets.indexOf(mg);
    mg.setMeasured(i >= 0, i === 0 ? 'A' : i === 1 ? 'B' : '');
  });
  updateMagnetList();
  rebuildField();
  selectMagnet(m);
  return m;
}

function removeMagnet(m) {
  const idx = magnets.indexOf(m);
  if (idx < 0) return;
  scene.remove(m.group);
  m.group.traverse(o => {
    o.geometry?.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(mm => mm.dispose());
      else o.material.dispose();
    }
  });
  magnets.splice(idx, 1);
  const mIdx = measureTargets.indexOf(m);
  if (mIdx >= 0) measureTargets.splice(mIdx, 1);
  for (const mg of magnets) {
    if (measureTargets.length >= 2) break;
    if (!measureTargets.includes(mg)) measureTargets.push(mg);
  }
  magnets.forEach(mg => {
    const i = measureTargets.indexOf(mg);
    mg.setMeasured(i >= 0, i === 0 ? 'A' : i === 1 ? 'B' : '');
  });
  if (selectedMagnet === m) selectedMagnet = magnets[0] || null;
  if (selectedMagnet) selectedMagnet.setSelected(true);
  updateMagnetList();
  rebuildField();
  updateMetrics();
}

function selectMagnet(m) {
  magnets.forEach(mg => mg.setSelected(false));
  selectedMagnet = m;
  if (m) m.setSelected(true);
  compasses.forEach(cc => cc.setSelected(false));
  selectedCompass = null;
  updateMagnetList();
  updateCompassList();
  updateReadout();
}

function updateMagnetList() {
  const list = document.getElementById('magnet-list');
  list.innerHTML = '';
  magnets.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'magnet-item' + (m === selectedMagnet ? ' active' : '');
    const rotDeg = Math.round(m.group.rotation.y * 180 / Math.PI);
    const mIdx = measureTargets.indexOf(m);
    const isChecked = mIdx >= 0;
    const badgeLabel = isChecked ? (mIdx === 0 ? 'A' : 'B') : '';
    const disabled = !isChecked && measureTargets.length >= 2;
    item.innerHTML = `
      <div class="magnet-swatch${m.type === 'u' ? ' u' : ''}"></div>
      <div class="magnet-info">
        <div class="magnet-name">${m.typeLabel} #${String(i + 1).padStart(2, '0')}</div>
        <div class="magnet-coord">X:${m.group.position.x.toFixed(1)} Z:${m.group.position.z.toFixed(1)} θ:${rotDeg}°</div>
      </div>
      <div class="measure-check ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''}" data-measure="${m.id}" title="計測対象にする${isChecked ? ` (選択中: ${badgeLabel})` : ''}">
        ${badgeLabel ? `<span class="measure-badge">${badgeLabel}</span>` : ''}
      </div>
      <button class="btn" style="padding: 4px 8px; font-size: 10px; flex: none;" data-remove="${m.id}">✕</button>
    `;
    item.onclick = (e) => {
      if (e.target.closest('[data-remove]')) removeMagnet(m);
      else if (e.target.closest('[data-measure]')) {
        e.stopPropagation();
        if (!disabled || isChecked) toggleMeasureTarget(m);
      } else selectMagnet(m);
    };
    list.appendChild(item);
  });
  document.getElementById('count').textContent = magnets.length;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPoint = new THREE.Vector3();
let draggingMagnet = null;
let dragOffset = new THREE.Vector3();
let rotatingMagnet = null;
let rotateStartAngle = 0;
let rotateStartMouse = 0;
let draggingCompass = null;

let isOrbiting = false;
let isPanning = false;
let orbitStart = { x: 0, y: 0 };
const cameraTarget = new THREE.Vector3(0, 0, 0);
const cameraTargetMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x8ca88a, transparent: true, opacity: 0.9 })
);
cameraTargetMarker.position.copy(cameraTarget);
scene.add(cameraTargetMarker);
let spherical = new THREE.Spherical();
spherical.setFromVector3(camera.position.clone().sub(cameraTarget));
let spaceKeyPressed = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spaceKeyPressed) {
    spaceKeyPressed = true;
    if (!draggingMagnet && !rotatingMagnet && !isOrbiting && !isPanning) canvas.style.cursor = 'move';
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spaceKeyPressed = false;
    if (!draggingMagnet && !rotatingMagnet && !isOrbiting && !isPanning) canvas.style.cursor = 'grab';
  }
});

function updateCameraPosition() {
  const offset = new THREE.Vector3().setFromSpherical(spherical);
  camera.position.copy(cameraTarget).add(offset);
  camera.lookAt(cameraTarget);
  cameraTargetMarker.position.copy(cameraTarget);

  // ズームアウト時にフォグを弱めて、磁石の視認性を保つ
  const t = THREE.MathUtils.clamp((spherical.radius - fogNearRadius) / (fogFarRadius - fogNearRadius), 0, 1);
  scene.fog.density = THREE.MathUtils.lerp(fogBaseDensity, fogMinDensity, t);
}

function panCamera(dx, dy) {
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  right.setFromMatrixColumn(camera.matrix, 0);
  up.setFromMatrixColumn(camera.matrix, 1);
  const panScale = spherical.radius * 0.0018;
  right.multiplyScalar(-dx * panScale);
  up.multiplyScalar(dy * panScale);
  cameraTarget.add(right).add(up);
  cameraTarget.x = Math.max(-15, Math.min(15, cameraTarget.x));
  cameraTarget.y = Math.max(-5, Math.min(8, cameraTarget.y));
  cameraTarget.z = Math.max(-15, Math.min(15, cameraTarget.z));
  updateCameraPosition();
}

function updateMouse(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function getMagnetFromIntersect(objects) {
  for (const o of objects) {
    let n = o.object;
    while (n) {
      if (n.userData?.magnet) return n.userData.magnet;
      n = n.parent;
    }
  }
  return null;
}

function getCompassFromIntersect(objects) {
  for (const o of objects) {
    let n = o.object;
    while (n) {
      if (n.userData?.compass) return n.userData.compass;
      n = n.parent;
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 1 || (e.button === 0 && spaceKeyPressed)) {
    isPanning = true;
    orbitStart = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'move';
    e.preventDefault();
    return;
  }
  if (e.button === 2) {
    isOrbiting = true;
    orbitStart = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
    return;
  }

  updateMouse(e);
  raycaster.setFromCamera(mouse, camera);
  const magnetMeshes = [];
  magnets.forEach(m => m.group.traverse(o => { if (o.isMesh && o.userData.magnet) magnetMeshes.push(o); }));
  const compassMeshes = [];
  compasses.forEach(c => c.group.traverse(o => { if (o.isMesh && o.userData.compass) compassMeshes.push(o); }));
  const magnetHits = raycaster.intersectObjects(magnetMeshes, false);
  const compassHits = raycaster.intersectObjects(compassMeshes, false);
  const magnetDist = magnetHits.length ? magnetHits[0].distance : Infinity;
  const compassDist = compassHits.length ? compassHits[0].distance : Infinity;

  if (magnetDist < compassDist && magnetHits.length) {
    const m = getMagnetFromIntersect(magnetHits);
    selectMagnet(m);
    if (e.shiftKey) {
      rotatingMagnet = m;
      rotateStartAngle = m.group.rotation.y;
      rotateStartMouse = e.clientX;
      canvas.style.cursor = 'ew-resize';
    } else {
      draggingMagnet = m;
      raycaster.ray.intersectPlane(dragPlane, dragPoint);
      dragOffset.subVectors(m.group.position, dragPoint);
      dragOffset.y = 0;
      canvas.style.cursor = 'grabbing';
    }
  } else if (compassHits.length) {
    const c = getCompassFromIntersect(compassHits);
    selectCompass(c);
    draggingCompass = c;
    raycaster.ray.intersectPlane(dragPlane, dragPoint);
    dragOffset.subVectors(c.group.position, dragPoint);
    dragOffset.y = 0;
    canvas.style.cursor = 'grabbing';
  } else {
    isOrbiting = true;
    orbitStart = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', (e) => {
  updateMouse(e);
  if (draggingMagnet) {
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      draggingMagnet.group.position.copy(dragPoint).add(dragOffset);
      draggingMagnet.group.position.y = 0;
      draggingMagnet.group.position.x = Math.max(-7, Math.min(7, draggingMagnet.group.position.x));
      draggingMagnet.group.position.z = Math.max(-7, Math.min(7, draggingMagnet.group.position.z));
      draggingMagnet.updatePoles();
      rebuildField();
      updateMagnetList();
      updateReadout();
    }
  } else if (rotatingMagnet) {
    const dx = e.clientX - rotateStartMouse;
    rotatingMagnet.group.rotation.y = rotateStartAngle + dx * 0.015;
    rotatingMagnet.updatePoles();
    rebuildField();
    updateMagnetList();
    updateReadout();
  } else if (draggingCompass) {
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      draggingCompass.group.position.copy(dragPoint).add(dragOffset);
      draggingCompass.group.position.y = 0;
      draggingCompass.group.position.x = Math.max(-9, Math.min(9, draggingCompass.group.position.x));
      draggingCompass.group.position.z = Math.max(-9, Math.min(9, draggingCompass.group.position.z));
      updateCompassList();
      updateReadout();
    }
  } else if (isPanning) {
    const dx = e.clientX - orbitStart.x;
    const dy = e.clientY - orbitStart.y;
    panCamera(dx, dy);
    orbitStart = { x: e.clientX, y: e.clientY };
  } else if (isOrbiting) {
    const dx = e.clientX - orbitStart.x;
    const dy = e.clientY - orbitStart.y;
    spherical.theta -= dx * 0.005;
    spherical.phi -= dy * 0.005;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    updateCameraPosition();
    orbitStart = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('pointerup', () => {
  draggingMagnet = null;
  rotatingMagnet = null;
  draggingCompass = null;
  isOrbiting = false;
  isPanning = false;
  canvas.style.cursor = spaceKeyPressed ? 'move' : 'grab';
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  spherical.radius *= 1 + e.deltaY * 0.001;
  spherical.radius = Math.max(5, Math.min(30, spherical.radius));
  updateCameraPosition();
}, { passive: false });

canvas.addEventListener('contextmenu', e => e.preventDefault());

let touchState = null;
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const fake = { clientX: t.clientX, clientY: t.clientY, button: 0, shiftKey: false };
    canvas.dispatchEvent(new PointerEvent('pointerdown', fake));
  } else if (e.touches.length === 2) {
    window.dispatchEvent(new PointerEvent('pointerup'));
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    touchState = {
      d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
      midX, midY
    };
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: t.clientX, clientY: t.clientY }));
  } else if (e.touches.length === 2 && touchState) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const scale = touchState.d / d;
    spherical.radius *= scale;
    spherical.radius = Math.max(5, Math.min(30, spherical.radius));
    const dx = midX - touchState.midX;
    const dy = midY - touchState.midY;
    panCamera(dx, dy);
    updateCameraPosition();
    touchState.d = d;
    touchState.midX = midX;
    touchState.midY = midY;
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) {
    window.dispatchEvent(new PointerEvent('pointerup'));
    touchState = null;
  }
});

const densitySlider = document.getElementById('slider-density');
const strengthSlider = document.getElementById('slider-strength');
const speedSlider = document.getElementById('slider-speed');
let animSpeed = 1.0;

densitySlider.oninput = () => {
  document.getElementById('val-density').textContent = densitySlider.value;
  rebuildField();
};
strengthSlider.oninput = () => {
  const v = parseFloat(strengthSlider.value);
  document.getElementById('val-strength').textContent = v.toFixed(1);
  magnets.forEach(m => m.strength = v);
  rebuildField();
};
speedSlider.oninput = () => {
  animSpeed = parseFloat(speedSlider.value);
  document.getElementById('val-speed').textContent = animSpeed.toFixed(1);
};

document.getElementById('add-bar').onclick = () => {
  const x = (Math.random() - 0.5) * 6;
  const z = (Math.random() - 0.5) * 6;
  addMagnet(new THREE.Vector3(x, 0, z), Math.random() * Math.PI * 2, 'bar');
};
document.getElementById('add-u').onclick = () => {
  const x = (Math.random() - 0.5) * 6;
  const z = (Math.random() - 0.5) * 6;
  addMagnet(new THREE.Vector3(x, 0, z), Math.random() * Math.PI * 2, 'u');
};
document.getElementById('add-compass').onclick = () => {
  const x = (Math.random() - 0.5) * 6;
  const z = (Math.random() - 0.5) * 6;
  addCompass(new THREE.Vector3(x, 0, z));
};
document.getElementById('clear-all').onclick = () => {
  while (magnets.length) removeMagnet(magnets[0]);
  while (compasses.length) removeCompass(compasses[0]);
};

let vizMode = 'lines';
document.querySelectorAll('#viz-mode .toggle-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#viz-mode .toggle-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    vizMode = b.dataset.mode;
    fieldLineGroup.visible = vizMode === 'lines' || vizMode === 'both';
    particleGroup.visible = vizMode === 'particles' || vizMode === 'both';
    const modeTextEl = document.getElementById('mode-text');
    if (modeTextEl) modeTextEl.textContent = vizMode.toUpperCase();
  };
});

document.getElementById('toggle-compass').onclick = (e) => {
  e.currentTarget.classList.toggle('active');
  compassGroup.visible = e.currentTarget.classList.contains('active');
};

document.getElementById('reset-view').onclick = () => {
  const targetTarget = new THREE.Vector3(0, 0, 0);
  if (measureTargets.length >= 2) {
    targetTarget.addVectors(measureTargets[0].group.position, measureTargets[1].group.position).multiplyScalar(0.5);
  } else if (magnets.length >= 2) {
    magnets.forEach(m => targetTarget.add(m.group.position));
    targetTarget.divideScalar(magnets.length);
  } else if (magnets.length === 1) {
    targetTarget.copy(magnets[0].group.position);
  }
  const startTarget = cameraTarget.clone();
  const startSph = { r: spherical.radius, t: spherical.theta, p: spherical.phi };
  const targetSph = { r: 16.5, t: Math.atan2(8, 12), p: Math.acos(6 / 16.5) };
  const duration = 500;
  const startTime = performance.now();
  function step() {
    const t = Math.min(1, (performance.now() - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    cameraTarget.lerpVectors(startTarget, targetTarget, ease);
    spherical.radius = startSph.r + (targetSph.r - startSph.r) * ease;
    spherical.theta = startSph.t + (targetSph.t - startSph.t) * ease;
    spherical.phi = startSph.p + (targetSph.p - startSph.p) * ease;
    updateCameraPosition();
    if (t < 1) requestAnimationFrame(step);
  }
  step();
};

function rebuildField() {
  const density = parseInt(densitySlider.value);
  buildFieldLines(magnets, density);
  document.getElementById('lines').textContent = fieldLineGroup.children.length;
}

function updateReadout() {
  const el = document.getElementById('readout');
  const titleEl = document.getElementById('readout-title');
  if (selectedMagnet) {
    if (titleEl) titleEl.textContent = 'SELECTED · MAGNET POSITION';
    const p = selectedMagnet.group.position;
    el.textContent = `X:${p.x.toFixed(2)}  Y:${p.y.toFixed(2)}  Z:${p.z.toFixed(2)}`;
  } else if (selectedCompass) {
    if (titleEl) titleEl.textContent = 'SELECTED · COMPASS POSITION';
    const p = selectedCompass.group.position;
    el.textContent = `X:${p.x.toFixed(2)}  Y:${p.y.toFixed(2)}  Z:${p.z.toFixed(2)}`;
  } else {
    if (titleEl) titleEl.textContent = 'SELECTED · POSITION';
    el.textContent = 'X: —  Y: —  Z: —';
  }
}

function updateMetrics() {
  const targetLabelEl = document.getElementById('metric-target-label');
  if (measureTargets.length >= 2) {
    const A = measureTargets[0];
    const B = measureTargets[1];
    const aIdx = magnets.indexOf(A);
    const bIdx = magnets.indexOf(B);
    const aName = `#${String(aIdx + 1).padStart(2, '0')}`;
    const bName = `#${String(bIdx + 1).padStart(2, '0')}`;
    if (targetLabelEl) {
      targetLabelEl.innerHTML = `計測対象 <span style="color: var(--accent-glow);">A=${aName}</span> × <span style="color: var(--accent-glow);">B=${bName}</span>`;
    }
    const d = A.group.position.distanceTo(B.group.position);
    document.getElementById('metric-distance').innerHTML = `${d.toFixed(2)}<span class="unit">units</span>`;
    document.getElementById('bar-distance').style.width = Math.min(100, d * 10) + '%';
    const mid = new THREE.Vector3().addVectors(A.group.position, B.group.position).multiplyScalar(0.5);
    const Bfield = computeFieldAt(mid, magnets);
    const bMag = Bfield.length() * 10;
    document.getElementById('metric-field').innerHTML = `${bMag.toFixed(2)}<span class="unit">mT</span>`;
    document.getElementById('bar-field').style.width = Math.min(100, bMag * 2) + '%';
    const ANBS = A.poleN.distanceTo(B.poleS);
    const ANBN = A.poleN.distanceTo(B.poleN);
    let state, desc, color;
    if (ANBS < ANBN * 0.85) {
      state = '引き合う'; desc = `${aName} のN極と ${bName} のS極が向かい合っています`; color = 'var(--accent-n)';
    } else if (ANBN < ANBS * 0.85) {
      state = '反発する'; desc = `${aName} と ${bName} の同じ極が向かい合っています`; color = 'var(--accent-s)';
    } else {
      state = '中立'; desc = `${aName} と ${bName} の向きが直交に近い状態です`; color = 'var(--text-hi)';
    }
    const forceEl = document.getElementById('metric-force');
    forceEl.textContent = state;
    forceEl.style.color = color;
    document.getElementById('metric-force-desc').textContent = desc;
  } else {
    if (targetLabelEl) {
      if (magnets.length < 2) targetLabelEl.textContent = '磁石を2つ以上配置してください';
      else targetLabelEl.textContent = '左のパネルで計測対象を2つ選択してください';
    }
    document.getElementById('metric-distance').innerHTML = '—<span class="unit">units</span>';
    document.getElementById('metric-field').innerHTML = '—<span class="unit">mT</span>';
    document.getElementById('metric-force').textContent = '—';
    document.getElementById('metric-force').style.color = 'var(--text-hi)';
    document.getElementById('bar-distance').style.width = '0%';
    document.getElementById('bar-field').style.width = '0%';
    document.getElementById('metric-force-desc').textContent =
      magnets.length < 2 ? '磁石を2つ以上配置してください' : '計測対象の磁石を2つ選んでください';
  }
}

function resize() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let lastTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = lastTime;
let currentFps = 60;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  frameCount++;
  if (now - lastFpsUpdate > 500) {
    currentFps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
    document.getElementById('fps').textContent = currentFps;
    frameCount = 0;
    lastFpsUpdate = now;
  }
  magnets.forEach(m => { if (m.selected) m.ring.rotation.z += dt * 2; });
  if (particleGroup.visible) updateParticles(dt, magnets);
  if (fieldLineGroup.visible && animSpeed > 0) {
    const t = now * 0.001 * animSpeed;
    fieldLineGroup.children.forEach((line) => {
      line.material.opacity = 0.55 + 0.25 * Math.sin(t * 2 + line.id * 0.3);
    });
  }
  if (compassGroup.visible) updateAllCompasses();
  if (frameCount % 10 === 0) updateMetrics();
  renderer.render(scene, camera);
}

addMagnet(new THREE.Vector3(-2.5, 0, 0), 0);
addMagnet(new THREE.Vector3(2.5, 0, 0), Math.PI);
addCompass(new THREE.Vector3(0, 0, 2.5));
selectMagnet(magnets[0]);
if (measureTargets.length >= 2) {
  cameraTarget.addVectors(measureTargets[0].group.position, measureTargets[1].group.position).multiplyScalar(0.5);
  updateCameraPosition();
}

const menuToggle = document.getElementById('menu-toggle');
const drawerOverlay = document.getElementById('drawer-overlay');
const sidebarLeft = document.querySelector('.sidebar-left');
function setDrawerOpen(open) {
  menuToggle.classList.toggle('open', open);
  menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  sidebarLeft.classList.toggle('open', open);
  drawerOverlay.classList.toggle('visible', open);
}
menuToggle.addEventListener('click', () => setDrawerOpen(!sidebarLeft.classList.contains('open')));
drawerOverlay.addEventListener('click', () => setDrawerOpen(false));
window.addEventListener('resize', () => {
  if (window.innerWidth > 700) setDrawerOpen(false);
});

animate();
