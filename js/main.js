// ============================================================================
// main.js — Szene, Interaktion, UI-Verdrahtung
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { REGIONS, REGION_ORDER, STRUCTURES, PATHOLOGIES, GOLF_SWING_PHASES } from './spineData.js';
import { buildSpineModel } from './spineBuilder.js';
import { captureBaseTransforms, applyGolfPose, lerpPose } from './golfSwing.js';

// ----------------------------------------------------------------------------
// Theme (hell/dunkel)
// ----------------------------------------------------------------------------
(function initTheme() {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  function setIcon() {
    toggle.innerHTML =
      theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  setIcon();
  toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    setIcon();
    updateSceneBackground();
  });
})();

// ----------------------------------------------------------------------------
// Grundgerüst: Renderer / Scene / Kamera
// ----------------------------------------------------------------------------
const canvasHolder = document.getElementById('canvas-holder');
const canvas = document.getElementById('spine-canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById('css2d-layer').appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 500);

function resize() {
  const w = canvasHolder.clientWidth;
  const h = canvasHolder.clientHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ----------------------------------------------------------------------------
// Beleuchtung
// ----------------------------------------------------------------------------
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.3);
keyLight.position.set(30, 40, 40);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbfe6ff, 0.55);
fillLight.position.set(-35, -10, 20);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x9fd8ff, 0.6);
rimLight.position.set(0, 20, -40);
scene.add(rimLight);

function updateSceneBackground() {
  // Hintergrund über CSS-Gradient auf #canvas-holder gelöst (siehe style.css) —
  // der Three.js-Canvas bleibt transparent (alpha: true).
}

// ----------------------------------------------------------------------------
// Wirbelsäulenmodell aufbauen
// ----------------------------------------------------------------------------
const spineModel = buildSpineModel();
scene.add(spineModel.root);

// Alle labelfähigen Strukturnetze einsammeln + Ursprungsfarben zwischenspeichern
const allStructureMeshes = [];
spineModel.root.traverse((obj) => {
  if (obj.isMesh && obj.userData && obj.userData.region && obj.userData.part !== 'curveGuide') {
    const mat = obj.material;
    obj.userData.origColorHex = mat.color.getHex();
    obj.userData.origOpacity = mat.opacity !== undefined ? mat.opacity : 1;
    obj.userData.origTransparent = !!mat.transparent;
    obj.userData.origEmissiveHex = mat.emissive ? mat.emissive.getHex() : 0x000000;
    obj.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
    allStructureMeshes.push(obj);
  }
});

let activeRegion = null;
let isPathological = false;
let appMode = 'healthy'; // 'healthy' | 'pathological' | 'golf'
const DIM_COLOR = new THREE.Color(0x8a8f8f);

function setRegionEmphasis(regionId) {
  allStructureMeshes.forEach((obj) => {
    const mat = obj.material;
    const isActive = !regionId || obj.userData.region === regionId;
    const base = new THREE.Color(obj.userData.origColorHex);
    if (isActive) {
      mat.color.copy(base);
      mat.opacity = obj.userData.origOpacity;
      mat.transparent = obj.userData.origTransparent;
      if (mat.emissive) {
        mat.emissive.setHex(obj.userData.origEmissiveHex);
        mat.emissiveIntensity = obj.userData.origEmissiveIntensity;
      }
    } else {
      const gray = base.clone().lerp(DIM_COLOR, 0.8);
      mat.color.copy(gray);
      mat.transparent = true;
      mat.opacity = 0.14;
      if (mat.emissive) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  });
}

// ----------------------------------------------------------------------------
// Kamera-Framing Helfer
// ----------------------------------------------------------------------------
function getWholeSpineBox() {
  const box = new THREE.Box3();
  spineModel.vertebrae.forEach((v) => box.expandByPoint(v.worldPos));
  spineModel.discs.forEach((d) => box.expandByPoint(d.worldPos));
  box.expandByScalar(3);
  return box;
}

function getRegionBox(regionId) {
  const box = new THREE.Box3();
  let has = false;
  spineModel.vertebrae.forEach((v) => {
    if (v.region === regionId) {
      box.expandByPoint(v.worldPos);
      has = true;
    }
  });
  spineModel.discs.forEach((d) => {
    if (d.region === regionId) {
      box.expandByPoint(d.worldPos);
      has = true;
    }
  });
  if (!has) return null;
  const pad = regionId === 'lumbar' ? 4.2 : regionId === 'thoracic' ? 3.4 : regionId === 'sacral' ? 3 : 2.4;
  box.expandByScalar(pad);
  return box;
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 220;
controls.target.set(0, 0, 0);

let cameraAnim = null;
function animateCamera(targetPos, targetLookAt, duration = 850) {
  cameraAnim = {
    startPos: camera.position.clone(),
    endPos: targetPos.clone(),
    startTarget: controls.target.clone(),
    endTarget: targetLookAt.clone(),
    startTime: performance.now(),
    duration,
  };
}
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function focusOnBox(box, direction) {
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z * 1.4);
  const fov = (camera.fov * Math.PI) / 180;
  let dist = maxDim / 2 / Math.tan(fov / 2);
  dist = Math.max(dist * 1.5, 10);
  const dir = (direction || camera.position.clone().sub(controls.target)).clone().normalize();
  const newPos = center.clone().add(dir.multiplyScalar(dist));
  animateCamera(newPos, center);
}

const DEFAULT_DIR = new THREE.Vector3(1, 0.16, 0.62).normalize();
const LATERAL_DIR = new THREE.Vector3(1, 0.05, 0).normalize();
const FRONT_DIR = new THREE.Vector3(0.02, 0.05, 1).normalize();
const GOLF_DIR = new THREE.Vector3(0.42, 1.05, 0.85).normalize();

function resetView() {
  if (appMode === 'golf') {
    focusOnBox(getWholeSpineBox(), GOLF_DIR);
    return;
  }
  activeRegion = null;
  setRegionEmphasis(null);
  updateRegionButtons(null);
  showInfoDefault();
  updateStructureLabelVisibility();
  updateCurveLabelVisibility();
  focusOnBox(getWholeSpineBox(), DEFAULT_DIR);
}

// Initial camera placement (ohne Animation)
{
  const box = getWholeSpineBox();
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z * 1.4);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = Math.max((maxDim / 2 / Math.tan(fov / 2)) * 1.28, 12);
  camera.position.copy(center.clone().add(DEFAULT_DIR.clone().multiplyScalar(dist)));
  controls.target.copy(center);
}

// ----------------------------------------------------------------------------
// Beschriftungen (CSS2D) — Wirbelkörper / Bandscheibe / Dornfortsatz / Facettengelenk
// ----------------------------------------------------------------------------
function createLabelElement(text, colorHex) {
  const el = document.createElement('div');
  el.className = 'spine-label';
  const dot = document.createElement('span');
  dot.className = 'spine-label-dot';
  dot.style.background = colorHex;
  el.appendChild(dot);
  el.appendChild(document.createTextNode(text));
  return el;
}

const structureLabelObjects = {};
(function buildStructureLabels() {
  const l3 = spineModel.vertebrae.get('L3');
  const l4l5Disc = spineModel.discs.get('L4-L5') || spineModel.discs.get('L3-L4');

  // Die Krümmungs-Overlays sitzen auf der +X-Seite (Versatz +5.5). Die
  // Strukturbeschriftungen werden bewusst auf die -X-Seite und mit
  // vertikalem Versatz gesetzt, damit sich beide Beschriftungsgruppen in
  // der Standardansicht nicht überlappen.
  const anchors = [
    { key: 'body', text: 'Wirbelkörper (L3)', obj3d: l3.parts.body, extraOffset: new THREE.Vector3(-3.2, 0.9, 0.4) },
    { key: 'spinous', text: 'Dornfortsatz (L3)', obj3d: l3.parts.spinous, extraOffset: new THREE.Vector3(-1.6, -0.3, -1.1) },
    { key: 'facet', text: 'Facettengelenk (L3)', obj3d: l3.parts.facetSupL, extraOffset: new THREE.Vector3(-2.6, -1.6, 0.2) },
    { key: 'disc', text: 'Bandscheibe (L4/L5)', obj3d: l4l5Disc ? l4l5Disc.anulus : l3.parts.body, extraOffset: new THREE.Vector3(-3.4, -3.0, 0.4) },
  ];

  anchors.forEach((a) => {
    const worldPos = new THREE.Vector3();
    a.obj3d.getWorldPosition(worldPos);
    worldPos.add(a.extraOffset);
    const colorHex = '#' + STRUCTURES[a.key].color.toString(16).padStart(6, '0');
    const el = createLabelElement(a.text, colorHex);
    const labelObj = new CSS2DObject(el);
    labelObj.position.copy(worldPos);
    scene.add(labelObj);
    structureLabelObjects[a.key] = labelObj;
  });
})();

const labelCategoryChecked = {};
Object.keys(STRUCTURES).forEach((k) => (labelCategoryChecked[k] = true));

// Die Strukturbeschriftungen sind fest an L3/L4-L5 verankert und werden nur
// gezeigt, sobald ein Abschnitt fokussiert ist -- so überlappen sie in der
// Gesamtübersicht nie mit den Krümmungs-Labels, unabhängig von Fenstergröße.
function updateStructureLabelVisibility() {
  const regionFocused = activeRegion !== null || isPathological;
  Object.keys(structureLabelObjects).forEach((key) => {
    structureLabelObjects[key].visible = regionFocused && labelCategoryChecked[key];
  });
}

function setLabelCategoryVisible(key, visible) {
  labelCategoryChecked[key] = visible;
  updateStructureLabelVisibility();
}

updateStructureLabelVisibility();

// ----------------------------------------------------------------------------
// Krümmungs-Overlay Sichtbarkeit + Apex-Beschriftungen
// ----------------------------------------------------------------------------
const CURVE_LABELS = {
  cervical: { title: 'Halslordose', sub: REGIONS.cervical.curveAngle, color: '#' + REGIONS.cervical.color.toString(16).padStart(6, '0') },
  thoracic: { title: 'Brustkyphose', sub: REGIONS.thoracic.curveAngle, color: '#' + REGIONS.thoracic.color.toString(16).padStart(6, '0') },
  lumbar: { title: 'Lendenlordose', sub: REGIONS.lumbar.curveAngle, color: '#' + REGIONS.lumbar.color.toString(16).padStart(6, '0') },
  sacral: { title: 'Sakralkyphose', sub: REGIONS.sacral.curveAngle, color: '#' + REGIONS.sacral.color.toString(16).padStart(6, '0') },
};

const curveApexLabels = [];
spineModel.curveGuides.forEach((g, regionId) => {
  const info = CURVE_LABELS[regionId];
  if (!info) return;
  const el = document.createElement('div');
  el.className = 'curve-apex-label';
  el.style.setProperty('--apex-color', info.color);
  el.innerHTML = `<strong>${info.title}</strong>${info.sub}`;
  const obj = new CSS2DObject(el);
  obj.position.copy(g.apexPoint);
  scene.add(obj);
  curveApexLabels.push({ obj, regionId });
});

let curvatureLabelsChecked = true;

// Sobald ein Abschnitt fokussiert ist (oder der Pathologie-Modus aktiv ist),
// zeigt das Info-Panel den passenden Krümmungswinkel bereits an -- daher wird
// die zugehörige Apex-Beschriftung im 3D-Raum ausgeblendet, damit sie nicht
// mit den Strukturbeschriftungen (Wirbelkörper/Bandscheibe/...) kollidiert.
function updateCurveLabelVisibility() {
  curveApexLabels.forEach(({ obj, regionId }) => {
    const suppressed = (activeRegion !== null && regionId === activeRegion) || (isPathological && regionId === 'lumbar');
    obj.visible = curvatureLabelsChecked && !suppressed;
  });
}

document.getElementById('toggle-curvature').addEventListener('change', (e) => {
  spineModel.guideGroup.visible = e.target.checked;
  curvatureLabelsChecked = e.target.checked;
  updateCurveLabelVisibility();
});

// ----------------------------------------------------------------------------
// Sidebar: Regionenliste
// ----------------------------------------------------------------------------
const regionListEl = document.getElementById('region-list');
REGION_ORDER.forEach((id) => {
  const r = REGIONS[id];
  const hex = '#' + r.color.toString(16).padStart(6, '0');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'region-item';
  btn.style.setProperty('--region-color', hex);
  btn.dataset.region = id;
  btn.setAttribute('role', 'listitem');
  btn.innerHTML = `<span class="region-dot"></span><span class="region-item-text"><strong>${r.label}</strong><span>${r.range}</span></span><span class="region-count">${r.count}</span>`;
  btn.addEventListener('click', () => onRegionClick(id));
  regionListEl.appendChild(btn);
});

function updateRegionButtons(activeId) {
  regionListEl.querySelectorAll('.region-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.region === activeId);
  });
}

function onRegionClick(id) {
  activeRegion = id;
  setRegionEmphasis(id);
  updateRegionButtons(id);
  showInfoRegion(id);
  updateStructureLabelVisibility();
  updateCurveLabelVisibility();
  const box = getRegionBox(id);
  if (box) focusOnBox(box, DEFAULT_DIR);
}

document.getElementById('btn-reset-region').addEventListener('click', resetView);

// Kurvenlegende
const curveLegendEl = document.getElementById('curve-legend');
[
  ['cervical', 'Halslordose'],
  ['thoracic', 'Brustkyphose'],
  ['lumbar', 'Lendenlordose'],
  ['sacral', 'Sakralkyphose'],
].forEach(([id, name]) => {
  const hex = '#' + REGIONS[id].color.toString(16).padStart(6, '0');
  const row = document.createElement('div');
  row.className = 'curve-legend-item';
  row.innerHTML = `<span class="curve-legend-swatch" style="background:${hex}"></span><span><strong>${name}</strong> · ${REGIONS[id].curveAngle}</span>`;
  curveLegendEl.appendChild(row);
});

// Beschriftungs-Kategorien
const labelTogglesEl = document.getElementById('label-toggles');
Object.values(STRUCTURES).forEach((s) => {
  const hex = '#' + s.color.toString(16).padStart(6, '0');
  const row = document.createElement('label');
  row.className = 'label-toggle-item';
  row.style.setProperty('--label-color', hex);
  row.innerHTML = `<input type="checkbox" checked data-key="${s.id}" /><span class="label-toggle-dot"></span><span>${s.label}</span>`;
  row.querySelector('input').addEventListener('change', (e) => setLabelCategoryVisible(s.id, e.target.checked));
  labelTogglesEl.appendChild(row);
});

// Strukturlegende (rechtes Panel)
const structureLegendEl = document.getElementById('structure-legend');
Object.values(STRUCTURES).forEach((s) => {
  const hex = '#' + s.color.toString(16).padStart(6, '0');
  const row = document.createElement('div');
  row.className = 'structure-legend-item';
  row.innerHTML = `<span class="structure-legend-swatch" style="background:${hex}"></span><span><strong>${s.label}</strong><span>${s.desc}</span></span>`;
  structureLegendEl.appendChild(row);
});

// ----------------------------------------------------------------------------
// Info-Panel Zustände
// ----------------------------------------------------------------------------
const infoDefault = document.getElementById('info-default');
const infoRegion = document.getElementById('info-region');
const infoPathology = document.getElementById('info-pathology');
const infoGolf = document.getElementById('info-golf');

function hideAllInfo() {
  infoDefault.hidden = true;
  infoRegion.hidden = true;
  infoPathology.hidden = true;
  infoGolf.hidden = true;
}

function showInfoGolf() {
  hideAllInfo();
  infoGolf.hidden = false;
  if (window.lucide) lucide.createIcons();
}

function showInfoDefault() {
  hideAllInfo();
  infoDefault.hidden = false;
}

function showInfoRegion(id) {
  hideAllInfo();
  const r = REGIONS[id];
  document.getElementById('info-region-title').innerHTML = `<i data-lucide="bookmark"></i> ${r.label}`;
  document.getElementById('info-region-range').textContent = r.range;
  document.getElementById('info-region-curve').textContent = r.curveType + (r.curveAngle !== '– (rudimentär)' ? ` · ${r.curveAngle}` : '');
  const factsEl = document.getElementById('info-region-facts');
  factsEl.innerHTML = '';
  r.facts.forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f;
    factsEl.appendChild(li);
  });
  infoRegion.hidden = false;
  if (window.lucide) lucide.createIcons();
}

function showInfoPathology() {
  hideAllInfo();
  infoPathology.hidden = false;
}

// Pathologie-Texte einmalig befüllen
document.getElementById('herniation-desc').textContent = PATHOLOGIES.herniation.description;
document.getElementById('stenosis-desc').textContent = PATHOLOGIES.stenosis.description;
const hImpact = document.getElementById('herniation-impact');
PATHOLOGIES.herniation.functionalImpact.forEach((t) => {
  const li = document.createElement('li');
  li.textContent = t;
  hImpact.appendChild(li);
});
const sImpact = document.getElementById('stenosis-impact');
PATHOLOGIES.stenosis.functionalImpact.forEach((t) => {
  const li = document.createElement('li');
  li.textContent = t;
  sImpact.appendChild(li);
});

// ----------------------------------------------------------------------------
// Pathologie-Visuals (Gesund ⇄ Pathologisch) — reine Geometrie-/Materialänderung
// ----------------------------------------------------------------------------
const herniationLevel = PATHOLOGIES.herniation.level.replace('/', '-');
const stenosisLevel = PATHOLOGIES.stenosis.level.replace('/', '-');
const stenosisVertebraIds = PATHOLOGIES.stenosis.level.split('/'); // ['L3','L4']

function applyPathologyVisuals(active) {
  isPathological = active;

  // --- Bandscheibenvorfall an L4/L5 ---
  const hernDisc = spineModel.discs.get(herniationLevel);
  if (hernDisc) {
    if (hernDisc.herniationMesh) hernDisc.herniationMesh.visible = active;
    const targetColor = active
      ? new THREE.Color(hernDisc.anulus.userData.origColorHex).lerp(new THREE.Color(PATHOLOGIES.herniation.color), 0.35)
      : new THREE.Color(hernDisc.anulus.userData.origColorHex);
    hernDisc.anulus.material.color.copy(targetColor);
  }

  // --- Spinalkanalstenose an L3/L4: Facetten-/Lamina-Hypertrophie ---
  stenosisVertebraIds.forEach((vid) => {
    const v = spineModel.vertebrae.get(vid);
    if (!v) return;
    const parts = [v.parts.lamina, v.parts.facetInfL, v.parts.facetInfR, v.parts.facetSupL, v.parts.facetSupR];
    parts.forEach((p) => {
      if (!p) return;
      const scale = active ? 1.32 : 1.0;
      if (!p.userData._baseScale) p.userData._baseScale = p.scale.clone();
      p.scale.copy(p.userData._baseScale.clone().multiplyScalar(scale));
      const baseColor = new THREE.Color(p.userData.origColorHex);
      const target = active ? baseColor.clone().lerp(new THREE.Color(PATHOLOGIES.stenosis.color), 0.45) : baseColor;
      p.material.color.copy(target);
    });
  });

  // --- Neuralkanal: Einengung bei Stenose, Kompression bei Vorfall ---
  spineModel.canalMeshes.forEach(({ mesh, a }) => {
    if (!mesh.userData._baseScale) mesh.userData._baseScale = mesh.scale.clone();
    if (!mesh.userData._basePos) mesh.userData._basePos = mesh.position.clone();
    const baseScale = mesh.userData._baseScale;
    const basePos = mesh.userData._basePos;
    const nearStenosis = a.levelId === stenosisLevel;
    const nearHerniation = a.levelId === herniationLevel;

    if (active && nearStenosis) {
      mesh.scale.set(baseScale.x * 0.42, baseScale.y, baseScale.z * 0.42);
      mesh.material.emissive.setHex(PATHOLOGIES.stenosis.color);
      mesh.material.emissiveIntensity = 0.5;
      mesh.material.color.set(PATHOLOGIES.stenosis.color);
    } else if (active && nearHerniation) {
      mesh.scale.set(baseScale.x * 0.55, baseScale.y, baseScale.z * 0.8);
      mesh.position.set(basePos.x + 0.55, basePos.y, basePos.z);
      mesh.material.emissive.setHex(PATHOLOGIES.herniation.color);
      mesh.material.emissiveIntensity = 0.5;
      mesh.material.color.set(PATHOLOGIES.herniation.color);
    } else {
      mesh.scale.copy(baseScale);
      mesh.position.copy(basePos);
      mesh.material.emissive.setHex(0x8a7a2a);
      mesh.material.emissiveIntensity = 0.12;
      mesh.material.color.set(0xf5e6a8);
    }
  });
}

// ----------------------------------------------------------------------------
// Golfschwung-Modus — Wirbelsäulenbewegung während des Golfschwungs
// ----------------------------------------------------------------------------
const golfBaseTransforms = captureBaseTransforms(spineModel);
const golfPivot = spineModel.vertebrae.get('Os sacrum').group.position.clone();

const golfPhaseListEl = document.getElementById('golf-phase-list');
const golfPlayBtn = document.getElementById('golf-play-btn');
const golfSpeedSlider = document.getElementById('golf-speed-slider');
const golfSpeedValueEl = document.getElementById('golf-speed-value');

let golfPhaseIndex = 0;
let golfPlaying = false;
let golfAnim = null;
let currentGolfPose = GOLF_SWING_PHASES[0];
let golfSpeed = 1;
const GOLF_PHASE_DURATION = 1500;

function formatGolfSpeed(value) {
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2).replace(/0$/, '')}\u00d7`;
}

golfSpeedSlider.addEventListener('input', (e) => {
  golfSpeed = parseFloat(e.target.value);
  golfSpeedValueEl.textContent = formatGolfSpeed(golfSpeed);
  if (golfAnim) {
    // Restwegstrecke der laufenden Animation bei der neuen Geschwindigkeit fortsetzen,
    // ohne den aktuellen Zwischenstand der Pose zu verspringen.
    const now = performance.now();
    const elapsedFrac = Math.min((now - golfAnim.startTime) / golfAnim.duration, 1);
    const newDuration = GOLF_PHASE_DURATION / golfSpeed;
    golfAnim.duration = newDuration;
    golfAnim.startTime = now - elapsedFrac * newDuration;
  }
});

GOLF_SWING_PHASES.forEach((phase, idx) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'golf-phase-btn';
  btn.dataset.phaseIndex = String(idx);
  btn.innerHTML = `<span class="golf-phase-num">${idx + 1}</span><span class="golf-phase-text"><strong>${phase.label}</strong><span>${phase.sub}</span></span>`;
  btn.addEventListener('click', () => {
    golfPlaying = false;
    updateGolfPlayButton();
    goToGolfPhase(idx, true);
  });
  golfPhaseListEl.appendChild(btn);
});

function updateGolfPhaseUI(idx) {
  golfPhaseListEl.querySelectorAll('.golf-phase-btn').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.phaseIndex) === idx);
  });
}

function updateGolfReadout(pose) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${val >= 0 ? '+' : ''}${Math.round(val)}°`;
  };
  set('golf-read-thoracic', pose.axial.thoracic);
  set('golf-read-lumbar', pose.axial.lumbar);
  set('golf-read-cervical', pose.axial.cervical);
  set('golf-read-xfactor', pose.axial.thoracic - pose.axial.lumbar);
}

function updateGolfInfoText(idx) {
  const phase = GOLF_SWING_PHASES[idx];
  document.getElementById('info-golf-phase-tag').textContent = `${idx + 1} / ${GOLF_SWING_PHASES.length} · ${phase.label}`;
  const factsEl = document.getElementById('info-golf-facts');
  factsEl.innerHTML = '';
  phase.facts.forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f;
    factsEl.appendChild(li);
  });
  const sourcesEl = document.getElementById('info-golf-sources');
  sourcesEl.innerHTML = '';
  phase.sources.forEach((s) => {
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = s.label;
    sourcesEl.appendChild(a);
  });
}

function renderGolfPose(pose) {
  applyGolfPose(spineModel, golfBaseTransforms, golfPivot, pose);
  updateGolfReadout(pose);
}

function goToGolfPhase(index, animateTransition = true) {
  const total = GOLF_SWING_PHASES.length;
  const clamped = ((index % total) + total) % total;
  const targetPose = GOLF_SWING_PHASES[clamped];
  if (!animateTransition) {
    currentGolfPose = targetPose;
    renderGolfPose(targetPose);
    golfPhaseIndex = clamped;
    updateGolfPhaseUI(clamped);
    updateGolfInfoText(clamped);
    return;
  }
  golfAnim = {
    fromPose: currentGolfPose,
    toPose: targetPose,
    startTime: performance.now(),
    duration: GOLF_PHASE_DURATION / golfSpeed,
    targetIndex: clamped,
  };
}

function updateGolfPlayButton() {
  golfPlayBtn.innerHTML = golfPlaying
    ? '<i data-lucide="pause"></i> <span>Pausieren</span>'
    : '<i data-lucide="play"></i> <span>Abspielen</span>';
  if (window.lucide) lucide.createIcons();
}

golfPlayBtn.addEventListener('click', () => {
  golfPlaying = !golfPlaying;
  updateGolfPlayButton();
  if (golfPlaying && !golfAnim) {
    goToGolfPhase(golfPhaseIndex + 1, true);
  }
});

function enterGolfMode() {
  activeRegion = null;
  updateRegionButtons(null);
  setRegionEmphasis(null);
  spineModel.guideGroup.visible = false;
  spineModel.canalGroup.visible = false;
  Object.values(structureLabelObjects).forEach((o) => (o.visible = false));
  curveApexLabels.forEach(({ obj }) => (obj.visible = false));
  golfPhaseIndex = 0;
  golfPlaying = false;
  updateGolfPlayButton();
  goToGolfPhase(0, false);
  showInfoGolf();
  focusOnBox(getWholeSpineBox(), GOLF_DIR);
}

function exitGolfMode() {
  golfPlaying = false;
  golfAnim = null;
  updateGolfPlayButton();
  golfBaseTransforms.forEach((base, group) => {
    group.position.copy(base.position);
    group.quaternion.copy(base.quaternion);
  });
  spineModel.canalGroup.visible = true;
  spineModel.guideGroup.visible = document.getElementById('toggle-curvature').checked;
}

// ----------------------------------------------------------------------------
// App-Modus (Gesund ⇄ Pathologisch ⇄ Golfschwung)
// ----------------------------------------------------------------------------
function setAppMode(mode) {
  if (mode === appMode) return;
  const prevMode = appMode;
  appMode = mode;

  if (prevMode === 'golf') exitGolfMode();

  applyPathologyVisuals(mode === 'pathological');

  document.getElementById('btn-healthy').classList.toggle('is-active', mode === 'healthy');
  document.getElementById('btn-pathological').classList.toggle('is-active', mode === 'pathological');
  document.getElementById('btn-golf').classList.toggle('is-active', mode === 'golf');

  document.getElementById('panel-regions').hidden = mode === 'golf';
  document.getElementById('panel-curvature').hidden = mode === 'golf';
  document.getElementById('panel-labels').hidden = mode === 'golf';
  document.getElementById('panel-golf').hidden = mode !== 'golf';

  if (mode === 'golf') {
    enterGolfMode();
    return;
  }

  activeRegion = null;
  updateRegionButtons(null);
  setRegionEmphasis(null);
  updateStructureLabelVisibility();
  updateCurveLabelVisibility();

  if (mode === 'pathological') {
    showInfoPathology();
    const box = getRegionBox('lumbar');
    if (box) focusOnBox(box, LATERAL_DIR);
  } else {
    showInfoDefault();
    focusOnBox(getWholeSpineBox(), DEFAULT_DIR);
  }
}

document.getElementById('btn-healthy').addEventListener('click', () => setAppMode('healthy'));
document.getElementById('btn-pathological').addEventListener('click', () => setAppMode('pathological'));
document.getElementById('btn-golf').addEventListener('click', () => setAppMode('golf'));

// ----------------------------------------------------------------------------
// View-Controls
// ----------------------------------------------------------------------------
document.getElementById('view-lateral').addEventListener('click', () => focusOnBox(activeRegion ? getRegionBox(activeRegion) : getWholeSpineBox(), LATERAL_DIR));
document.getElementById('view-front').addEventListener('click', () => focusOnBox(activeRegion ? getRegionBox(activeRegion) : getWholeSpineBox(), FRONT_DIR));
document.getElementById('view-reset').addEventListener('click', resetView);

// ----------------------------------------------------------------------------
// Render-Loop
// ----------------------------------------------------------------------------
let firstFrame = true;
function animate(now) {
  requestAnimationFrame(animate);

  if (cameraAnim) {
    const t = Math.min((now - cameraAnim.startTime) / cameraAnim.duration, 1);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(cameraAnim.startPos, cameraAnim.endPos, e);
    controls.target.lerpVectors(cameraAnim.startTarget, cameraAnim.endTarget, e);
    if (t >= 1) cameraAnim = null;
  }

  if (golfAnim) {
    const t = Math.min((now - golfAnim.startTime) / golfAnim.duration, 1);
    const e = easeInOutCubic(t);
    const pose = lerpPose(golfAnim.fromPose, golfAnim.toPose, e);
    currentGolfPose = pose;
    renderGolfPose(pose);
    if (t >= 1) {
      golfPhaseIndex = golfAnim.targetIndex;
      updateGolfPhaseUI(golfPhaseIndex);
      updateGolfInfoText(golfPhaseIndex);
      golfAnim = null;
      if (golfPlaying) goToGolfPhase(golfPhaseIndex + 1, true);
    }
  }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => {
      document.getElementById('loading-overlay').classList.add('is-hidden');
    });
  }
}

resize();
requestAnimationFrame(animate);

// Hinweis-Chip nach kurzer Zeit ausblenden
setTimeout(() => {
  const chip = document.getElementById('hint-chip');
  if (chip) chip.style.opacity = '0.55';
}, 5000);
