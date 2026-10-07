export interface RectLike { left: number; top: number; width: number; height: number }
export interface LatLon { lat: number; lon: number }
export interface AxisCalibration { from: number; to: number; fromPercent: number; toPercent: number }
export interface MapCalibration { latitude: AxisCalibration; longitude: AxisCalibration }

/** Calibration belongs to this exact image, not every image subsequently saved for Genesis. */
export function getMapCalibration(image: string): MapCalibration | null {
  if (image !== "/map-genesis-cartography.jpeg") return null;
  // Supplied 2048x2048 photo: printed 10/90 grid lines, measured on its 1024px preview.
  return {
    latitude: { from: 10, to: 90, fromPercent: 118 / 1024 * 100, toPercent: 914 / 1024 * 100 },
    longitude: { from: 10, to: 90, fromPercent: 116 / 1024 * 100, toPercent: 926 / 1024 * 100 },
  };
}

function percentToCoordinate(percent: number, axis?: AxisCalibration) {
  return axis ? axis.from + (percent - axis.fromPercent) / (axis.toPercent - axis.fromPercent) * (axis.to - axis.from) : percent;
}
function coordinateToPercent(value: number, axis?: AxisCalibration) {
  return axis ? axis.fromPercent + (value - axis.from) / (axis.to - axis.from) * (axis.toPercent - axis.fromPercent) : value;
}

/** Coordinates -> image percentages, shared by tribe markers and the chosen point. */
export function coordsToImagePoint(coords: LatLon, calibration: MapCalibration | null = null) {
  return { x: coordinateToPercent(coords.lon, calibration?.longitude), y: coordinateToPercent(coords.lat, calibration?.latitude) };
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pointer -> coordinates using the printed grid when calibrated. rect must be the rendered image bounds, including zoom/pan. */
export function pointToCoords(clientX: number, clientY: number, rect: RectLike, calibration: MapCalibration | null = null): LatLon | null {
  if (!(rect.width > 0) || !(rect.height > 0) || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  return {
    lat: round1(clamp(percentToCoordinate(((clientY - rect.top) / rect.height) * 100, calibration?.latitude), 0, 100)),
    lon: round1(clamp(percentToCoordinate(((clientX - rect.left) / rect.width) * 100, calibration?.longitude), 0, 100)),
  };
}

export const formatCoords = (c: LatLon) => `Lat ${c.lat.toFixed(1)} / Lon ${c.lon.toFixed(1)}`;

export function nudgeCoords(c: LatLon | null, dLat: number, dLon: number): LatLon {
  const b = c ?? { lat: 50, lon: 50 };
  return { lat: round1(clamp(b.lat + dLat, 0, 100)), lon: round1(clamp(b.lon + dLon, 0, 100)) };
}

/** Keeps the pan so the scaled content always covers the viewport. */
export function clampPan(tx: number, ty: number, zoom: number, w: number, h: number) {
  return { x: clamp(tx, w * (1 - zoom), 0), y: clamp(ty, h * (1 - zoom), 0) };
}

export interface TribeLike { id: number; name: string; coords: string; latitude: number | null; longitude: number | null }

export function splitTribes<T extends TribeLike>(tribes: T[]) {
  const placed: { t: T; n: number }[] = [];
  const unknown: { t: T; n: number }[] = [];
  tribes.forEach((t, i) => {
    const ok = typeof t.latitude === "number" && typeof t.longitude === "number" && Number.isFinite(t.latitude) && Number.isFinite(t.longitude) && t.latitude >= 0 && t.latitude <= 100 && t.longitude >= 0 && t.longitude <= 100;
    (ok ? placed : unknown).push({ t, n: i + 1 });
  });
  return { placed, unknown };
}

export type MapTabKey = "overview" | "residents" | "bosses";
export function initialMapTab(search: string): MapTabKey {
  const section = new URLSearchParams(search).get("section");
  return section === "residents" || section === "bosses" ? section : "overview";
}
