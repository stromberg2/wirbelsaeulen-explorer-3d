// ============================================================================
// spineData.js — Anatomische Referenzdaten für die Wirbelsäulen-Visualisierung
// Alle Maße sind stilisiert-proportional (keine radiologische Exaktheit),
// aber in Reihenfolge, Krümmungsrichtung und relativen Proportionen anatomisch
// orientiert.
// ============================================================================

// Regionen der Wirbelsäule mit Farbcode, Kurztext und didaktischen Fakten.
export const REGIONS = {
  cervical: {
    id: 'cervical',
    label: 'Halswirbelsäule',
    abbr: 'HWS',
    range: 'C1–C7',
    color: 0x4fd1e0,
    count: 7,
    curveType: 'Halslordose (nach vorn gebogen)',
    curveAngle: '≈ 20–40°',
    facts: [
      '7 Halswirbel (C1–C7) tragen den Kopf und ermöglichen die größte Beweglichkeit der Wirbelsäule.',
      'C1 (Atlas) und C2 (Axis) sind spezialisiert: Der Atlas hat keinen Wirbelkörper, die Axis bildet den Dens für die Kopfdrehung.',
      'Die Halslordose ist eine physiologische Vorwärtskrümmung, die den Kopf über dem Schwerpunkt ausbalanciert.',
      'Kleine, filigrane Wirbelkörper – hohe Beweglichkeit, aber auch Anfälligkeit für Verschleiß (Zervikalsyndrom).',
    ],
  },
  thoracic: {
    id: 'thoracic',
    label: 'Brustwirbelsäule',
    abbr: 'BWS',
    range: 'T1–T12',
    color: 0x8b8bf0,
    count: 12,
    curveType: 'Brustkyphose (nach hinten gebogen)',
    curveAngle: '≈ 20–45°',
    facts: [
      '12 Brustwirbel (T1–T12) verbinden sich über Gelenke mit den 12 Rippenpaaren zum knöchernen Brustkorb.',
      'Die Rippenverbindung schränkt die Beweglichkeit stark ein – Stabilität geht vor Flexibilität.',
      'Die Brustkyphose ist die einzige seit der Fetalentwicklung unveränderte Primärkrümmung.',
      'Lange, dachziegelartig überlappende Dornfortsätze schützen das Rückenmark zusätzlich.',
    ],
  },
  lumbar: {
    id: 'lumbar',
    label: 'Lendenwirbelsäule',
    abbr: 'LWS',
    range: 'L1–L5',
    color: 0xf0b34f,
    count: 5,
    curveType: 'Lendenlordose (nach vorn gebogen)',
    curveAngle: '≈ 40–60°',
    facts: [
      '5 Lendenwirbel (L1–L5) sind die größten und massivsten Wirbel – sie tragen das meiste Körpergewicht.',
      'Die Lendenlordose gleicht die Brustkyphose aus und hält den Körperschwerpunkt über dem Becken.',
      'Die Bandscheiben L4/L5 und L5/S1 sind biomechanisch am stärksten belastet – häufigste Orte für Bandscheibenvorfälle.',
      'Kräftige Dornfortsätze und breite Querfortsätze bieten Ansatzflächen für die Rückenmuskulatur.',
    ],
  },
  sacral: {
    id: 'sacral',
    label: 'Kreuzbein',
    abbr: 'Os sacrum',
    range: 'S1–S5 (fusioniert)',
    color: 0xe08a4f,
    count: 5,
    curveType: 'Sakralkyphose (nach hinten gebogen)',
    curveAngle: '≈ 50–60°',
    facts: [
      '5 Kreuzbeinwirbel verschmelzen im Erwachsenenalter zu einem einzigen, dreieckigen Knochen.',
      'Das Kreuzbein verbindet die Wirbelsäule über die Iliosakralgelenke stabil mit dem Becken.',
      'Die Sakralkyphose führt die Krümmung nach hinten fort und leitet die Körperlast in das Becken.',
      'Da die Segmente fusioniert sind, gibt es hier keine beweglichen Bandscheiben oder Facettengelenke mehr.',
    ],
  },
  coccygeal: {
    id: 'coccygeal',
    label: 'Steißbein',
    abbr: 'Os coccygis',
    range: 'Co1–Co4 (fusioniert)',
    color: 0xe0708f,
    count: 4,
    curveType: 'Fortsetzung der Sakralkyphose',
    curveAngle: '– (rudimentär)',
    facts: [
      '3–4 rudimentäre, meist fusionierte Wirbelkörperreste bilden das Steißbein – Rest des ehemaligen Schwanzskeletts.',
      'Dient als Ansatzpunkt für Beckenboden- und Gesäßmuskulatur, trägt beim Sitzen mit zur Lastverteilung bei.',
      'Sehr variabel in Form und Segmentzahl, gelegentlich leicht beweglich zum Kreuzbein.',
      'Klinisch relevant vor allem bei Sturzverletzungen (Kokzygodynie).',
    ],
  },
};

export const REGION_ORDER = ['cervical', 'thoracic', 'lumbar', 'sacral', 'coccygeal'];

// Strukturtypen für Beschriftungen / Legende
export const STRUCTURES = {
  body: {
    id: 'body',
    label: 'Wirbelkörper',
    desc: 'Tragendes, zylindrisches Element jedes Wirbels; überträgt die axiale Last der Wirbelsäule.',
    color: 0xe4d9c4,
  },
  disc: {
    id: 'disc',
    label: 'Bandscheibe',
    desc: 'Faserknorpeliger Puffer zwischen Wirbelkörpern aus Anulus fibrosus (Faserring) und Nucleus pulposus (Gallertkern); dämpft Stöße und ermöglicht Beweglichkeit.',
    color: 0x5aa9c9,
  },
  spinous: {
    id: 'spinous',
    label: 'Dornfortsatz',
    desc: 'Nach hinten ragender Knochenfortsatz; Ansatzstelle für Bänder und Rückenmuskulatur, tastbar unter der Haut.',
    color: 0xc9b48a,
  },
  facet: {
    id: 'facet',
    label: 'Facettengelenk',
    desc: 'Paariges Wirbelbogengelenk (Articulatio zygapophysialis) zwischen benachbarten Wirbeln; führt die Bewegung und begrenzt Rotation/Extension.',
    color: 0xd8935a,
  },
};

// ----------------------------------------------------------------------------
// Kontrollpunkte der Wirbelsäulen-Sagittalkurve (x=lateral fix 0, y=Höhe, z=ventral/dorsal)
// Positive z = nach ventral (vorn), negative z = nach dorsal (hinten).
// Reihenfolge von kranial (oben, Kopf) nach kaudal (unten, Steißbeinspitze).
// ----------------------------------------------------------------------------
export const SPINE_CURVE_POINTS = [
  [0, 34.0, 0.0], // C1 – Atlas / Kopfgelenk
  [0, 29.5, 1.6], // C2/C3
  [0, 24.5, 3.0], // C4 – Apex Halslordose
  [0, 19.5, 2.2], // C5/C6
  [0, 15.0, 0.6], // C7 – zervikothorakaler Übergang
  [0, 10.0, -1.6], // T2/T3
  [0, 3.0, -4.2], // T6/T7 – Apex Brustkyphose
  [0, -4.0, -3.4], // T9/T10
  [0, -10.0, -0.8], // T12/L1 – thorakolumbaler Übergang
  [0, -15.0, 2.6], // L2
  [0, -20.0, 4.4], // L3/L4 – Apex Lendenlordose
  [0, -25.0, 2.4], // L5
  [0, -28.5, -0.6], // L5/S1 – lumbosakraler Übergang / Promontorium
  [0, -34.0, -5.4], // S2/S3 – Apex Sakralkyphose
  [0, -39.5, -6.4], // S5 / Steißbeinbasis
  [0, -44.0, -4.6], // Co2
  [0, -47.5, -2.4], // Steißbeinspitze
];

// Anteil der Gesamtkurve (t=0..1), an dem jede Region beginnt/endet — grob nach
// kumulierter Wirbelhöhe kalibriert (wird in main.js exakter berechnet, dies
// dient nur als Fallback/Referenz für Kurvensegment-Overlays).
export const REGION_T_RANGES = {
  cervical: [0.0, 0.235],
  thoracic: [0.235, 0.62],
  lumbar: [0.62, 0.83],
  sacral: [0.83, 0.93],
  coccygeal: [0.93, 1.0],
};

// ----------------------------------------------------------------------------
// Einzelwirbel-Definitionen (bewegliche Segmente: C1–L5 = 24 Wirbel)
// ----------------------------------------------------------------------------
function buildMobileVertebrae() {
  const list = [];
  for (let i = 1; i <= 7; i++) {
    list.push({
      id: `C${i}`,
      region: 'cervical',
      bodyRadius: 1.05 + i * 0.025,
      bodyHeight: 0.95,
      spinousLength: i <= 2 ? 0.5 : 0.85 + i * 0.05,
      transverseLength: 1.3,
      special: i === 1 ? 'atlas' : i === 2 ? 'axis' : null,
    });
  }
  for (let i = 1; i <= 12; i++) {
    list.push({
      id: `T${i}`,
      region: 'thoracic',
      bodyRadius: 1.45 + i * 0.035,
      bodyHeight: 1.2,
      spinousLength: 2.0 + (i > 4 && i < 10 ? 0.4 : 0),
      transverseLength: 1.6,
      special: null,
    });
  }
  for (let i = 1; i <= 5; i++) {
    list.push({
      id: `L${i}`,
      region: 'lumbar',
      bodyRadius: 2.05 + i * 0.06,
      bodyHeight: 1.55,
      spinousLength: 1.5,
      transverseLength: 2.1,
      special: null,
    });
  }
  return list;
}

export const MOBILE_VERTEBRAE = buildMobileVertebrae();

// Fusionierte Blöcke
export const SACRUM_DEF = {
  id: 'Os sacrum',
  region: 'sacral',
  segments: 5,
  topRadius: 2.35,
  bottomRadius: 0.9,
  totalHeight: 9.5,
};

export const COCCYX_DEF = {
  id: 'Os coccygis',
  region: 'coccygeal',
  segments: 4,
  topRadius: 0.85,
  bottomRadius: 0.28,
  totalHeight: 4.2,
};

// Zwischenwirbelscheiben-Höhen je Region (relativ)
export const DISC_HEIGHT = {
  cervical: 0.42,
  thoracic: 0.48,
  lumbar: 0.72,
};

// ----------------------------------------------------------------------------
// Pathologien — exemplarisch an klinisch typischen Segmenten platziert
// ----------------------------------------------------------------------------
export const PATHOLOGIES = {
  herniation: {
    id: 'herniation',
    label: 'Bandscheibenvorfall',
    latin: 'Discushernie',
    level: 'L4/L5',
    color: 0xff5470,
    description:
      'Der Gallertkern (Nucleus pulposus) durchbricht den geschwächten Faserring (Anulus fibrosus) und wölbt sich nach dorsolateral in Richtung Spinalkanal bzw. Nervenwurzel vor.',
    functionalImpact: [
      'Kompression der austretenden Nervenwurzel (hier: L5) → ausstrahlender Schmerz ins Bein (Ischialgie/Lumboischialgie).',
      'Mögliche Sensibilitätsstörungen (Kribbeln, Taubheit) und Kraftminderung im versorgten Dermatom/Myotom.',
      'Reflexabschwächung (z. B. Achillessehnenreflex bei L5/S1-Beteiligung).',
      'Bei massivem medialem Vorfall: Cauda-equina-Syndrom mit Blasen-/Mastdarmstörung (Notfall).',
    ],
  },
  stenosis: {
    id: 'stenosis',
    label: 'Spinalkanalstenose',
    latin: 'Spinalstenose',
    level: 'L3/L4',
    color: 0xffb02e,
    description:
      'Verengung des Spinalkanals durch Facettengelenk-Hypertrophie, verdicktes Ligamentum flavum und Bandscheibenprotrusion – der verfügbare Raum für Rückenmark bzw. Cauda equina nimmt ab.',
    functionalImpact: [
      'Neurogene Claudicatio: belastungsabhängige Beinschmerzen, die sich beim Vorbeugen/Sitzen bessern.',
      'Diffuse beidseitige Schwäche und Schweregefühl in den Beinen bei längerem Gehen oder Stehen.',
      'Zunehmende Gehstrecken-Limitierung im Verlauf, oft schleichend progredient.',
      'Bei hochgradiger Stenose: Störung der Blasen-/Mastdarmfunktion möglich.',
    ],
  },
};

// ----------------------------------------------------------------------------
// Golfschwung — Wirbelsäulenbewegung in fünf Phasen (vereinfachtes,
// schematisches Modell auf Basis qualitativer biomechanischer Literatur).
// „axial“ = Rotation um die Längsachse je Abschnitt in Grad, ABSOLUT bezogen
// auf das Kreuz-/Steißbein als rotatorischen Fixpunkt (0°). Positives Vorzeichen
// = Drehung weg vom Ziel (Rückschwungrichtung bei Rechtshändern), negatives
// Vorzeichen = Drehung zum Ziel hin (Durchschwungrichtung).
// „forwardFlexion“ = globale Vorbeuge der gesamten Säule (Hip-Hinge, in Grad,
// positiv = nach vorn). „lateralFlexion“ = globale seitliche Neigung (Grad).
// Diese Winkelwerte sind didaktische Näherungen aus mehreren Quellen, keine
// exakten Messdaten einer einzelnen Studie an einer Einzelperson.
// ----------------------------------------------------------------------------
export const GOLF_SWING_PHASES = [
  {
    id: 'address',
    label: 'Ansprechposition',
    sub: 'Address',
    axial: { cervical: 0, thoracic: 0, lumbar: 0 },
    forwardFlexion: 32,
    lateralFlexion: 0,
    facts: [
      'Der Oberkörper ist über ein Vorbeugen in den Hüften (Hip-Hinge) um ca. 30–35° nach vorn geneigt – die Wirbelsäule selbst bleibt dabei weitgehend neutral und kaum rotiert.',
      'Schulter- und Beckenachse stehen noch nahezu parallel: Der „X-Faktor“ (Rotationsunterschied zwischen Brust- und Lendenwirbelsäule) ist minimal.',
    ],
    sources: [
      { label: 'ATOS Kliniken', url: 'https://news.atos-kliniken.com/orthopaedische-spaetschaeden-bei-golfspielerinnen-und-spielern/' },
    ],
  },
  {
    id: 'backswing',
    label: 'Rückschwung – oberer Punkt',
    sub: 'Backswing Top',
    axial: { cervical: -8, thoracic: 46, lumbar: 22 },
    forwardFlexion: 34,
    lateralFlexion: -4,
    facts: [
      'Die Brustwirbelsäule dreht am weitesten mit – die Rumpfdrehung erreicht hier näherungsweise 45°.',
      'Die Lendenwirbelsäule lässt konstruktionsbedingt nur geringe Rotation zu und bleibt deutlich hinter der Brustwirbelsäule zurück.',
      'Die Halswirbelsäule dreht gegenläufig zur Brustwirbelsäule mit, damit der Blick fest auf den Ball fixiert bleiben kann.',
    ],
    sources: [
      { label: 'golfdoc.ch', url: 'https://www.golfdoc.ch/ruecken.htm' },
      { label: 'Orthozentrum Bergstraße', url: 'https://orthozentrum-bergstrasse.de/behandlung/rueckenschmerzen-beim-golf/' },
      { label: 'Schulthess Klinik', url: 'https://www.youtube.com/watch?v=tmxEsBiS_Zw' },
    ],
  },
  {
    id: 'downswing',
    label: 'Abschwung – X-Faktor-Stretch',
    sub: 'Downswing',
    axial: { cervical: -5, thoracic: 34, lumbar: -8 },
    forwardFlexion: 30,
    lateralFlexion: 8,
    facts: [
      'Becken und Lendenwirbelsäule beginnen sich bereits zum Ziel zu drehen, während die Brustwirbelsäule noch in der Rückschwungrotation „nachläuft“ – dieser kurzzeitig maximale Rotationsunterschied wird als „X-Faktor-Stretch“ bezeichnet.',
      'Gleichzeitig nimmt die seitliche Neigung (Lateralflexion) zu, was Bandscheiben und Facettengelenke zusätzlich belastet.',
    ],
    sources: [
      { label: 'Hirslanden Blog', url: 'https://www.hirslanden.ch/de/hirslandenblog/medizin/-der-golfschwung-ist-ein-komplizierter-bewegungsablauf-.html' },
      { label: 'ScienceDirect', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0949328X13000525' },
    ],
  },
  {
    id: 'impact',
    label: 'Ballkontakt',
    sub: 'Impact',
    axial: { cervical: 0, thoracic: -10, lumbar: -16 },
    forwardFlexion: 28,
    lateralFlexion: 12,
    facts: [
      'Im Moment des Ballkontakts sind Rotation, seitliche Neigung und axiale Kompression der Wirbelsäule gleichzeitig am größten – biomechanisch die am stärksten belastete Phase des Schwungs.',
      'Rumpf und Becken haben sich inzwischen fast synchron zurück in Richtung Ziel gedreht.',
    ],
    sources: [
      { label: 'Hirslanden Blog', url: 'https://www.hirslanden.ch/de/hirslandenblog/medizin/-der-golfschwung-ist-ein-komplizierter-bewegungsablauf-.html' },
      { label: 'ScienceDirect', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0949328X13000525' },
    ],
  },
  {
    id: 'finish',
    label: 'Durchschwung – Finish',
    sub: 'Follow-Through',
    axial: { cervical: 18, thoracic: -58, lumbar: -34 },
    forwardFlexion: -14,
    lateralFlexion: -10,
    facts: [
      'Der Oberkörper dreht sich vollständig zum Ziel und richtet sich auf – aus der Vorbeuge der Ansprechposition wird eine deutliche Rückneigung (Hyperlordose) der Lendenwirbelsäule.',
      'Diese endgradige Streckung bei gleichzeitiger Rotation gilt als eine der Hauptbelastungen für die unteren Bandscheiben im Golfsport.',
    ],
    sources: [
      { label: 'golfdoc.ch', url: 'https://www.golfdoc.ch/ruecken.htm' },
      { label: 'ATOS Kliniken', url: 'https://news.atos-kliniken.com/orthopaedische-spaetschaeden-bei-golfspielerinnen-und-spielern/' },
    ],
  },
];
