// ============================================================================
// spineBuilder.js — Prozedurale Geometrieerzeugung der Wirbelsäule
// ============================================================================
import * as THREE from 'three';
import {
  REGIONS,
  SPINE_CURVE_POINTS,
  MOBILE_VERTEBRAE,
  SACRUM_DEF,
  COCCYX_DEF,
  DISC_HEIGHT,
  PATHOLOGIES,
} from './spineData.js';

const BONE_COLOR = 0xe4d9c4;
const PROCESS_COLOR = 0xcdb68f;
const FACET_COLOR = 0xd8935a;
const DISC_ANULUS_COLOR = 0x5aa9c9;
const DISC_NUCLEUS_COLOR = 0x9adcee;

function makeBoneMaterial(color = BONE_COLOR) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.04 });
}

// ---------------------------------------------------------------------------
// Einzelwirbel-Geometrie
// ---------------------------------------------------------------------------
function buildVertebraGroup(def) {
  const group = new THREE.Group();
  group.name = def.id;

  const r = def.bodyRadius;
  const h = def.bodyHeight;
  const matBody = makeBoneMaterial(BONE_COLOR);
  const matProcess = makeBoneMaterial(PROCESS_COLOR);
  const matFacet = makeBoneMaterial(FACET_COLOR);

  const parts = {};

  // Wirbelkörper — leicht ovaler, gestauchter Zylinder
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.93, h, 22), matBody);
  body.scale.set(1.18, 1, 0.82);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData = { part: 'body', vertebraId: def.id, region: def.region };
  group.add(body);
  parts.body = body;

  // Pedikel (Wirbelbogenwurzeln) — verbinden Körper mit dem Wirbelbogen
  const pedGeo = new THREE.CylinderGeometry(r * 0.16, r * 0.19, r * 0.95, 8);
  const pedL = new THREE.Mesh(pedGeo, matProcess.clone());
  pedL.rotation.x = Math.PI / 2;
  pedL.position.set(-r * 0.62, 0, -r * 0.78);
  pedL.userData = { part: 'pedicle', vertebraId: def.id, region: def.region };
  const pedR = pedL.clone();
  pedR.position.x = r * 0.62;
  pedR.userData = { part: 'pedicle', vertebraId: def.id, region: def.region };
  group.add(pedL, pedR);
  parts.pedicleL = pedL;
  parts.pedicleR = pedR;

  // Wirbelbogen / Lamina — Halbring hinter dem Körper, umschließt das Foramen vertebrale
  const archGeo = new THREE.TorusGeometry(r * 0.92, h * 0.26, 8, 18, Math.PI * 0.92);
  const arch = new THREE.Mesh(archGeo, matProcess.clone());
  arch.rotation.y = Math.PI / 2;
  arch.rotation.z = Math.PI / 2 + (Math.PI - Math.PI * 0.92) / 2;
  arch.position.set(0, 0, -r * 1.55);
  arch.userData = { part: 'lamina', vertebraId: def.id, region: def.region };
  group.add(arch);
  parts.lamina = arch;

  // Dornfortsatz — zeigt nach dorsal-kaudal
  const spGeo = new THREE.ConeGeometry(r * 0.24, def.spinousLength, 7);
  const spinous = new THREE.Mesh(spGeo, matProcess.clone());
  spinous.rotation.x = Math.PI * 0.62;
  spinous.position.set(0, -h * 0.12, -r * 1.65 - def.spinousLength * 0.4);
  spinous.userData = { part: 'spinous', vertebraId: def.id, region: def.region };
  group.add(spinous);
  parts.spinous = spinous;

  // Querfortsätze — laterale Ansatzpunkte für Muskulatur/Rippen
  const trGeo = new THREE.CylinderGeometry(r * 0.13, r * 0.17, def.transverseLength, 8);
  const trL = new THREE.Mesh(trGeo, matProcess.clone());
  trL.rotation.z = Math.PI / 2;
  trL.position.set(-(r * 0.95 + def.transverseLength * 0.48), 0, -r * 0.9);
  trL.userData = { part: 'transverse', vertebraId: def.id, region: def.region };
  const trR = trL.clone();
  trR.position.x = r * 0.95 + def.transverseLength * 0.48;
  trR.userData = { part: 'transverse', vertebraId: def.id, region: def.region };
  group.add(trL, trR);
  parts.transverseL = trL;
  parts.transverseR = trR;

  // Facettengelenke (Procc. articulares) — je 2 superior + 2 inferior
  const facGeo = new THREE.BoxGeometry(r * 0.34, h * 0.55, r * 0.3);
  function makeFacet(xSign, ySign, key) {
    const f = new THREE.Mesh(facGeo, matFacet.clone());
    f.position.set(xSign * r * 0.78, ySign * h * 0.58, -r * 1.15);
    f.userData = { part: 'facet', vertebraId: def.id, region: def.region, side: xSign > 0 ? 'R' : 'L' };
    parts[key] = f;
    group.add(f);
    return f;
  }
  makeFacet(-1, 1, 'facetSupL');
  makeFacet(1, 1, 'facetSupR');
  makeFacet(-1, -1, 'facetInfL');
  makeFacet(1, -1, 'facetInfR');

  group.userData = { vertebraId: def.id, region: def.region, bodyRadius: r, bodyHeight: h, special: def.special || null };
  return { group, parts, def };
}

// ---------------------------------------------------------------------------
// Fusionierte Blöcke (Kreuzbein / Steißbein) — verjüngte, segmentierte Säule
// ---------------------------------------------------------------------------
function buildFusedBlock(defBlock, id) {
  const group = new THREE.Group();
  group.name = id;
  const matBody = makeBoneMaterial(BONE_COLOR);
  const matRidge = makeBoneMaterial(PROCESS_COLOR);
  const segH = defBlock.totalHeight / defBlock.segments;
  const parts = { segments: [], ridges: [] };

  for (let i = 0; i < defBlock.segments; i++) {
    const tSeg = i / (defBlock.segments - 1 || 1);
    const rTop = THREE.MathUtils.lerp(defBlock.topRadius, defBlock.bottomRadius, tSeg);
    const rBot = THREE.MathUtils.lerp(defBlock.topRadius, defBlock.bottomRadius, Math.min(tSeg + 1 / defBlock.segments, 1));
    const segGeo = new THREE.CylinderGeometry(rTop, rBot, segH * 1.02, 20);
    const seg = new THREE.Mesh(segGeo, matBody.clone());
    seg.scale.set(1.15, 1, 0.72);
    const yPos = defBlock.totalHeight / 2 - segH / 2 - i * segH;
    seg.position.set(0, yPos, defBlock.id === 'Os sacrum' ? -rTop * 0.15 : 0);
    seg.userData = { part: 'body', vertebraId: `${defBlock.id === 'Os sacrum' ? 'S' : 'Co'}${i + 1}`, region: defBlock.region, fused: true };
    group.add(seg);
    parts.segments.push(seg);

    // Mediane Crista (fusionierte Dornfortsätze) als schmaler Grat
    const ridgeGeo = new THREE.BoxGeometry(rTop * 0.22, segH * 0.9, rTop * 0.4);
    const ridge = new THREE.Mesh(ridgeGeo, matRidge.clone());
    ridge.position.set(0, yPos, -rTop * 0.85);
    ridge.userData = { part: 'spinous', vertebraId: `${defBlock.id === 'Os sacrum' ? 'S' : 'Co'}${i + 1}`, region: defBlock.region, fused: true };
    group.add(ridge);
    parts.ridges.push(ridge);
  }

  group.userData = { vertebraId: defBlock.id, region: defBlock.region, fused: true, totalHeight: defBlock.totalHeight, topRadius: defBlock.topRadius };
  return { group, parts };
}

// ---------------------------------------------------------------------------
// Bandscheibe (Anulus fibrosus + Nucleus pulposus)
// ---------------------------------------------------------------------------
function buildDisc(radius, height, levelId, region) {
  const group = new THREE.Group();
  group.name = `disc-${levelId}`;

  const anulusMat = new THREE.MeshStandardMaterial({
    color: DISC_ANULUS_COLOR,
    roughness: 0.42,
    metalness: 0.04,
    transparent: true,
    opacity: 0.9,
  });
  const nucleusMat = new THREE.MeshStandardMaterial({
    color: DISC_NUCLEUS_COLOR,
    roughness: 0.28,
    metalness: 0.02,
    transparent: true,
    opacity: 0.85,
    emissive: 0x1c4f5c,
    emissiveIntensity: 0.18,
  });

  const anulus = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.02, radius * 0.98, height, 22), anulusMat);
  anulus.scale.set(1.18, 1, 0.84);
  anulus.userData = { part: 'disc', discPart: 'anulus', levelId, region };
  group.add(anulus);

  const nucleus = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, height * 1.08, 16), nucleusMat);
  nucleus.scale.set(1.0, 1, 0.72);
  nucleus.position.z = -radius * 0.04;
  nucleus.userData = { part: 'disc', discPart: 'nucleus', levelId, region };
  group.add(nucleus);

  // Herniations-Bulge (nur sichtbar im pathologischen Modus, nur an definiertem Level erzeugt)
  let herniationMesh = null;
  if (levelId === PATHOLOGIES.herniation.level.replace('/', '-')) {
    const bulgeGeo = new THREE.SphereGeometry(radius * 0.5, 16, 12);
    const bulgeMat = new THREE.MeshStandardMaterial({
      color: PATHOLOGIES.herniation.color,
      roughness: 0.4,
      metalness: 0.05,
      emissive: PATHOLOGIES.herniation.color,
      emissiveIntensity: 0.22,
    });
    herniationMesh = new THREE.Mesh(bulgeGeo, bulgeMat);
    herniationMesh.scale.set(1.3, 0.62, 0.85);
    herniationMesh.position.set(-radius * 0.32, 0, -radius * 1.28);
    herniationMesh.visible = false;
    herniationMesh.userData = { part: 'pathology', pathologyId: 'herniation', levelId, region };
    group.add(herniationMesh);
  }

  return { group, anulus, nucleus, herniationMesh, radius, height, levelId };
}

// ---------------------------------------------------------------------------
// Hauptaufbau
// ---------------------------------------------------------------------------
export function buildSpineModel() {
  const root = new THREE.Group();
  root.name = 'spine-root';

  const curve = new THREE.CatmullRomCurve3(
    SPINE_CURVE_POINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.5,
  );

  // ---- Höhen-Budget berechnen, um t-Parameter proportional zuzuweisen ----
  const items = []; // { type:'vertebra'|'disc'|'fused', id, height, region, def }
  MOBILE_VERTEBRAE.forEach((def, idx) => {
    if (idx > 0) {
      const prev = MOBILE_VERTEBRAE[idx - 1];
      const skipDisc = prev.id === 'C1' && def.id === 'C2'; // keine klassische Bandscheibe C1/C2
      if (!skipDisc) {
        items.push({ type: 'disc', id: `${prev.id}-${def.id}`, height: DISC_HEIGHT[def.region] || 0.5, region: def.region });
      }
    }
    items.push({ type: 'vertebra', id: def.id, height: def.bodyHeight, region: def.region, def });
  });
  // Lumbosakraler Übergang
  const lastLumbar = MOBILE_VERTEBRAE[MOBILE_VERTEBRAE.length - 1];
  items.push({ type: 'disc', id: `${lastLumbar.id}-S1`, height: DISC_HEIGHT.lumbar * 1.05, region: 'sacral' });
  items.push({ type: 'fused', id: 'Os sacrum', height: SACRUM_DEF.totalHeight, region: 'sacral', def: SACRUM_DEF });
  items.push({ type: 'gap', id: 'sacrococcygeal', height: 0.35, region: 'coccygeal' });
  items.push({ type: 'fused', id: 'Os coccygis', height: COCCYX_DEF.totalHeight, region: 'coccygeal', def: COCCYX_DEF });

  const totalHeight = items.reduce((s, it) => s + it.height, 0);

  // ---- Platzierung entlang der Kurve ----
  const vertebrae = new Map(); // id -> { group, parts, worldPos, region, t }
  const discs = new Map(); // levelId -> { group, anulus, nucleus, herniationMesh, worldPos, region, t }
  const canalSegments = []; // { mesh, t, region, baseRadius }
  const regionMeshes = new Map(); // region -> [meshes]
  REGIONS && Object.keys(REGIONS).forEach((r) => regionMeshes.set(r, []));

  let cumulative = 0;
  const up = new THREE.Vector3(0, 1, 0);

  items.forEach((it) => {
    const tCenter = (cumulative + it.height / 2) / totalHeight;
    const point = curve.getPointAt(Math.min(Math.max(tCenter, 0), 1));
    const tangent = curve.getTangentAt(Math.min(Math.max(tCenter, 0), 1)).normalize();

    if (it.type === 'vertebra') {
      const { group, parts, def } = buildVertebraGroup(it.def);
      group.position.copy(point);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, tangent);
      group.quaternion.copy(quat);
      root.add(group);
      vertebrae.set(it.id, { group, parts, def, worldPos: point.clone(), region: it.region, t: tCenter });
      regionMeshes.get(it.region).push(group, ...Object.values(parts).filter((p) => p instanceof THREE.Object3D));
    } else if (it.type === 'fused') {
      const { group, parts } = buildFusedBlock(it.def, it.id);
      group.position.copy(point);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, tangent);
      group.quaternion.copy(quat);
      root.add(group);
      vertebrae.set(it.id, { group, parts, def: it.def, worldPos: point.clone(), region: it.region, t: tCenter, fused: true });
      regionMeshes.get(it.region).push(group, ...parts.segments, ...parts.ridges);
    } else if (it.type === 'disc') {
      // Radius/Höhe aus benachbarten Wirbeln ableiten
      const approxRadius = it.region === 'cervical' ? 1.15 : it.region === 'thoracic' ? 1.6 : 2.15;
      const levelKey = it.id.replace('/', '-');
      const discData = buildDisc(approxRadius, it.height, levelKey, it.region);
      discData.group.position.copy(point);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, tangent);
      discData.group.quaternion.copy(quat);
      root.add(discData.group);
      discs.set(levelKey, { ...discData, worldPos: point.clone(), region: it.region, t: tCenter });
      regionMeshes.get(it.region).push(discData.group, discData.anulus, discData.nucleus);
    }

    // Neuralkanal-Segment (Rückenmark / Cauda equina), nur für Wirbel-/Bandscheiben-/Kreuzbeinbereich
    if (it.type !== 'gap') {
      const dorsalOffset = it.type === 'fused' ? (it.def.topRadius || 1) * 0.9 : it.type === 'disc'
        ? (it.region === 'cervical' ? 1.05 : it.region === 'thoracic' ? 1.5 : 2.0) * 0.95
        : it.def.bodyRadius * 1.0;
      const canalPoint = point.clone().add(new THREE.Vector3(0, 0, -dorsalOffset));
      const baseRadius = it.region === 'cervical' ? 0.5 : it.region === 'thoracic' ? 0.38 : it.region === 'lumbar' ? 0.55 : it.region === 'sacral' ? 0.4 : 0.14;
      canalSegments.push({ point: canalPoint, tangent: tangent.clone(), t: tCenter, region: it.region, baseRadius, levelId: it.type === 'disc' ? it.id.replace('/', '-') : null });
    }

    cumulative += it.height;
  });

  // ---- Neuralkanal als durchgehende Segmentkette ----
  const canalMat = new THREE.MeshStandardMaterial({
    color: 0xf5e6a8,
    roughness: 0.35,
    metalness: 0.02,
    transparent: true,
    opacity: 0.85,
    emissive: 0x8a7a2a,
    emissiveIntensity: 0.12,
  });
  const canalGroup = new THREE.Group();
  canalGroup.name = 'neural-canal';
  const canalMeshes = [];
  for (let i = 0; i < canalSegments.length - 1; i++) {
    const a = canalSegments[i];
    const b = canalSegments[i + 1];
    const segLen = a.point.distanceTo(b.point) * 1.15;
    const geo = new THREE.CylinderGeometry(a.baseRadius, b.baseRadius, segLen, 12, 1, true);
    const mesh = new THREE.Mesh(geo, canalMat.clone());
    const mid = a.point.clone().lerp(b.point, 0.5);
    mesh.position.copy(mid);
    const dir = b.point.clone().sub(a.point).normalize();
    mesh.quaternion.setFromUnitVectors(up, dir);
    mesh.userData = { part: 'canal', region: a.region, levelId: a.levelId, tIndex: i };
    canalGroup.add(mesh);
    canalMeshes.push({ mesh, a, b, geo });
  }
  root.add(canalGroup);

  // ---- Kurven-Overlays je Region (Krümmungsanzeige) ----
  const curveGuides = new Map();
  const regionTBounds = new Map();
  vertebrae.forEach((v) => {
    const cur = regionTBounds.get(v.region) || [Infinity, -Infinity];
    cur[0] = Math.min(cur[0], v.t);
    cur[1] = Math.max(cur[1], v.t);
    regionTBounds.set(v.region, cur);
  });
  discs.forEach((d) => {
    const cur = regionTBounds.get(d.region);
    if (cur) {
      cur[0] = Math.min(cur[0], d.t);
      cur[1] = Math.max(cur[1], d.t);
    }
  });

  const guideGroup = new THREE.Group();
  guideGroup.name = 'curvature-guides';

  // Die vier physiologischen Krümmungen: Sakralkyphose fasst Kreuzbein- und
  // Steißbeinbereich zu einer durchgehenden Kurve zusammen (anatomisch korrekt —
  // die Steißbeinkrümmung setzt die Sakralkyphose fort und gilt nicht als eigene
  // fünfte Krümmung).
  const CURVE_GROUPS = {
    cervical: { label: 'cervical', regions: ['cervical'] },
    thoracic: { label: 'thoracic', regions: ['thoracic'] },
    lumbar: { label: 'lumbar', regions: ['lumbar'] },
    sacral: { label: 'sacral', regions: ['sacral', 'coccygeal'] },
  };

  Object.keys(CURVE_GROUPS).forEach((regionId) => {
    const memberRegions = CURVE_GROUPS[regionId].regions;
    let t0 = Infinity;
    let t1 = -Infinity;
    memberRegions.forEach((mr) => {
      const b = regionTBounds.get(mr);
      if (b) {
        t0 = Math.min(t0, b[0]);
        t1 = Math.max(t1, b[1]);
      }
    });
    if (!isFinite(t0)) return;
    const bounds = [t0, t1];
    const samples = 24;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = THREE.MathUtils.lerp(Math.max(t0 - 0.015, 0), Math.min(t1 + 0.015, 1), i / samples);
      const p = curve.getPointAt(t).clone();
      p.x += 5.5; // seitlicher Versatz, damit die Linie neben der Wirbelsäule sichtbar ist
      pts.push(p);
    }
    const guideCurve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(guideCurve, 40, 0.16, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: REGIONS[regionId].color, transparent: true, opacity: 0.85 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.userData = { part: 'curveGuide', region: regionId };
    guideGroup.add(tube);

    // Apex-Marker (mittlerer Punkt) für Label-Anker
    const apexPoint = curve.getPointAt((t0 + t1) / 2).clone();
    apexPoint.x += 5.5;
    const apexMarker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshBasicMaterial({ color: REGIONS[regionId].color }));
    apexMarker.position.copy(apexPoint);
    guideGroup.add(apexMarker);

    curveGuides.set(regionId, { tube, apexMarker, apexPoint });
  });
  guideGroup.visible = true;
  root.add(guideGroup);

  // ---- Bounding Box & Zentrierung ----
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(new THREE.Vector3(center.x, center.y, 0));
  root.updateMatrixWorld(true);

  // Nach der Zentrierung Weltpositionen neu berechnen
  vertebrae.forEach((v) => {
    const wp = new THREE.Vector3();
    v.group.getWorldPosition(wp);
    v.worldPos = wp;
  });
  discs.forEach((d) => {
    const wp = new THREE.Vector3();
    d.group.getWorldPosition(wp);
    d.worldPos = wp;
  });
  curveGuides.forEach((g) => {
    g.apexPoint.add(root.position);
  });

  return {
    root,
    curve,
    vertebrae,
    discs,
    canalGroup,
    canalMeshes,
    curveGuides,
    guideGroup,
    regionMeshes,
    centerOffset: root.position.clone(),
  };
}

export { PATHOLOGIES };
