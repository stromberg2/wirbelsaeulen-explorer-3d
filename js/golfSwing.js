// ============================================================================
// golfSwing.js — Transformationslogik für die Golfschwung-Animation
//
// Modell: Die gesamte Säule beugt/neigt sich global (Vorbeuge + Lateralflexion)
// um einen gemeinsamen Pivot am Kreuzbein. Die Achsendrehung ("X-Faktor") ist
// KEIN Sprung pro Abschnitt, sondern wird entlang der Kurvenposition (t, 0 =
// oben/Hals, 1 = unten/Steißbein) stückweise linear zwischen den in den
// Phasendaten angegebenen Abschnittswerten interpoliert. Das bildet nach, dass
// sich die Torsion Wirbel für Wirbel aufbaut, und vermeidet einen sichtbaren
// Versatz genau an den Abschnittsgrenzen (z. B. C7/T1).
//
//   relative       = P0 − pivot
//   θ(t)           = stückweise-lineare Interpolation von axial.* über t
//   relative_final = R_flex(φ) · R_lateral(λ) · R_axial(θ(t)) · relative
//   newPos         = pivot + relative_final
//   newQuat        = R_flex(φ) · R_lateral(λ) · R_axial(θ(t)) · Q0
// ============================================================================
import * as THREE from 'three';
import { REGION_T_RANGES } from './spineData.js';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Sammelt die Ruhe-Transformationen (Position + Rotation + Kurvenparameter t)
 * aller Wirbel- und Bandscheibengruppen, indiziert nach ihrem 3D-Gruppenobjekt.
 */
export function captureBaseTransforms(spineModel) {
  const base = new Map();
  spineModel.vertebrae.forEach((v) => {
    base.set(v.group, {
      position: v.group.position.clone(),
      quaternion: v.group.quaternion.clone(),
      region: v.region,
      t: v.t,
    });
  });
  spineModel.discs.forEach((d) => {
    base.set(d.group, {
      position: d.group.position.clone(),
      quaternion: d.group.quaternion.clone(),
      region: d.region,
      t: d.t,
    });
  });
  return base;
}

// Stützpunkte für die Achsendrehung entlang der Kurve, aufsteigend nach t
// sortiert (t=0 = oberste Halswirbel, t=1 = unterstes Steißbeinsegment).
// Kreuz- und Steißbein bleiben der rotatorische Fixpunkt (0°).
function buildAxialControlPoints(axial) {
  return [
    { t: 0, angle: axial.cervical || 0 },
    { t: REGION_T_RANGES.thoracic[0], angle: axial.thoracic || 0 },
    { t: REGION_T_RANGES.lumbar[0], angle: axial.lumbar || 0 },
    { t: REGION_T_RANGES.sacral[0], angle: 0 },
    { t: 1, angle: 0 },
  ];
}

function axialAngleAtT(controlPoints, t) {
  const clampedT = Math.min(1, Math.max(0, t ?? 0));
  for (let i = 0; i < controlPoints.length - 1; i += 1) {
    const a = controlPoints[i];
    const b = controlPoints[i + 1];
    if (clampedT >= a.t && clampedT <= b.t) {
      const span = b.t - a.t;
      const frac = span > 0 ? (clampedT - a.t) / span : 0;
      return a.angle + (b.angle - a.angle) * frac;
    }
  }
  return controlPoints[controlPoints.length - 1].angle;
}

/**
 * Wendet eine Golfschwung-Pose auf alle erfassten Gruppen an.
 * @param {object} spineModel - Rückgabe von buildSpineModel() (aktuell ungenutzt, für API-Konsistenz).
 * @param {Map} baseTransforms - Ergebnis von captureBaseTransforms().
 * @param {THREE.Vector3} pivot - Rotationspivot in der lokalen Koordinate des root-Objekts.
 * @param {object} pose - { forwardFlexion, lateralFlexion, axial: { cervical, thoracic, lumbar } }
 */
export function applyGolfPose(spineModel, baseTransforms, pivot, pose) {
  const flexQuat = new THREE.Quaternion().setFromAxisAngle(AXIS_X, degToRad(pose.forwardFlexion));
  const latQuat = new THREE.Quaternion().setFromAxisAngle(AXIS_Z, degToRad(pose.lateralFlexion));
  const globalQuat = flexQuat.clone().multiply(latQuat);
  const controlPoints = buildAxialControlPoints(pose.axial);

  baseTransforms.forEach((base, group) => {
    const angle = axialAngleAtT(controlPoints, base.t);
    const axialQuat = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, degToRad(angle));
    const totalQuat = globalQuat.clone().multiply(axialQuat);

    const rel = base.position.clone().sub(pivot).applyQuaternion(totalQuat);
    group.position.copy(pivot.clone().add(rel));
    group.quaternion.copy(totalQuat.clone().multiply(base.quaternion));
  });
}

/** Lineare Interpolation zwischen zwei Pose-Keyframes (t = 0..1). */
export function lerpPose(a, b, t) {
  const lerp = (x, y) => x + (y - x) * t;
  return {
    forwardFlexion: lerp(a.forwardFlexion, b.forwardFlexion),
    lateralFlexion: lerp(a.lateralFlexion, b.lateralFlexion),
    axial: {
      cervical: lerp(a.axial.cervical, b.axial.cervical),
      thoracic: lerp(a.axial.thoracic, b.axial.thoracic),
      lumbar: lerp(a.axial.lumbar, b.axial.lumbar),
    },
  };
}
