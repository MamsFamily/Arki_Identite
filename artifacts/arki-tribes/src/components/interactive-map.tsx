import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "wouter";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { clamp, clampPan, coordsToImagePoint, formatCoords, getMapCalibration, nudgeCoords, pointToCoords, splitTribes, type LatLon, type TribeLike } from "@/lib/map-coordinates";
import type { MapLandmark } from "@/lib/map-landmarks";

const MAX_ZOOM = 6;

export function InteractiveMap({ image, mapName, tribes, landmarks = [], activeId, onActive, onBroken }: {
  image: string; mapName: string; tribes: TribeLike[]; activeId: number | null; onActive: (id: number | null) => void; onBroken: () => void;
  landmarks?: MapLandmark[];
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const suppress = useRef(false);
  const [ratio, setRatio] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<LatLon | null>(null);
  const [chosen, setChosen] = useState<LatLon | null>(null);
  const [tribeId, setTribeId] = useState<number | null>(null);
  const [landmarkId, setLandmarkId] = useState<string | null>(null);
  const selectedLandmark = landmarks.find(l => l.id === landmarkId);
  const { placed, unknown } = useMemo(() => splitTribes(tribes), [tribes]);
  const calibration = getMapCalibration(image);
  const selected = placed.find(({ t }) => t.id === tribeId) ?? null;
  useEffect(() => {
    if (tribeId !== null && !placed.some(({ t }) => t.id === tribeId)) {
      setTribeId(null);
      onActive(null);
    }
  }, [tribeId, placed, onActive]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const r = element.getBoundingClientRect();
      setPan(p => clampPan(p.x, p.y, zoom, r.width, r.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [zoom]);

  const setZ = (z: number) => {
    const nz = clamp(z, 1, MAX_ZOOM);
    const r = viewport.current?.getBoundingClientRect();
    setZoom(nz);
    setPan((p) => (r && nz > 1 ? clampPan(p.x * (nz / zoom), p.y * (nz / zoom), nz, r.width, r.height) : { x: 0, y: 0 }));
  };
  const read = (e: { clientX: number; clientY: number }) => { const r = img.current?.getBoundingClientRect(); return r ? pointToCoords(e.clientX, e.clientY, r, calibration) : null; };

  const down = (e: PointerEvent) => {
    if (zoom > 1 && e.button === 0) {
      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (d && zoom > 1) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
      if (d.moved) {
        const r = viewport.current?.getBoundingClientRect();
        if (r) setPan(clampPan(d.px + dx, d.py + dy, zoom, r.width, r.height));
        return;
      }
    }
    if (e.pointerType !== "touch") setHover(read(e));
  };
  const up = (e?: PointerEvent) => {
    if (drag.current?.moved) { suppress.current = true; setTimeout(() => { suppress.current = false; }, 0); }
    drag.current = null;
    if (e?.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const click = (e: React.MouseEvent) => {
    if (suppress.current) return;
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    const c = read(e);
    if (c) { setChosen(c); setTribeId(null); setLandmarkId(null); }
  };
  const key = (e: KeyboardEvent) => {
    const s = e.shiftKey ? 5 : 1;
    const m: Record<string, [number, number]> = { ArrowUp: [-s, 0], ArrowDown: [s, 0], ArrowLeft: [0, -s], ArrowRight: [0, s] };
    if (e.key in m && !(e.target as HTMLElement).closest("[data-pin]")) { e.preventDefault(); setChosen(nudgeCoords(chosen, ...m[e.key])); setTribeId(null); setLandmarkId(null); }
    else if (e.key === "Escape") { setChosen(null); setTribeId(null); setLandmarkId(null); onActive(null); }
    else if (e.key === "+" || e.key === "=") setZ(zoom + 0.5);
    else if (e.key === "-") setZ(zoom - 0.5);
  };

  const layer = { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" } as const;
  const counter = (lon: number, lat: number) => {
    const { x, y } = coordsToImagePoint({ lat, lon }, calibration);
    return { left: `${x}%`, top: `${y}%`, transform: `scale(${1 / zoom}) translate(-50%, -50%)`, transformOrigin: "0 0" };
  };
  const shown = hover ?? selectedLandmark ?? (selected ? { lat: Number(selected.t.latitude), lon: Number(selected.t.longitude) } : chosen);

  return (
    <div className="grid gap-3" data-testid="interactive-map">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Zoom de la carte">
          <button type="button" className="btn btn-ghost btn-sm !h-11 !w-11 !p-0" aria-label="Zoom avant" onClick={() => setZ(zoom + 0.5)} disabled={zoom >= MAX_ZOOM} data-testid="button-map-zoom-in"><Plus className="h-4 w-4" /></button>
          <button type="button" className="btn btn-ghost btn-sm !h-11 !w-11 !p-0" aria-label="Zoom arrière" onClick={() => setZ(zoom - 0.5)} disabled={zoom <= 1} data-testid="button-map-zoom-out"><Minus className="h-4 w-4" /></button>
          <button type="button" className="btn btn-ghost btn-sm !h-11 !px-3" aria-label="Réinitialiser le zoom à 1x" onClick={() => setZ(1)} disabled={zoom === 1 && pan.x === 0} data-testid="button-map-zoom-reset"><RotateCcw className="h-4 w-4" /> 1x</button>
        </div>
        <span className="text-xs text-muted-foreground" data-testid="text-map-zoom">Zoom {zoom.toFixed(1)}x</span>
        <div className="ml-auto font-mono text-xs rounded-full border border-white/15 px-3 py-2 min-h-11 flex items-center" aria-live="off" data-testid="text-map-reading">
           {shown ? <>{hover ? "Survol" : selectedLandmark ? selectedLandmark.name : selected ? "Base" : "Point"} : {formatCoords(shown)}</> : "Survolez ou touchez la carte"}
        </div>
      </div>

      <div ref={viewport} tabIndex={0} role="group" aria-label={`Carte interactive de ${mapName}. Flèches : déplacer le point choisi, Maj pour aller plus vite, Échap pour effacer.`}
        className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#65D8FF]"
        style={{ aspectRatio: String(ratio), touchAction: zoom > 1 ? "none" : "pan-y", cursor: zoom > 1 ? "grab" : "crosshair" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => { setHover(null); up(); }}
        onClick={click} onKeyDown={key} data-testid="cartography-frame">
        <div className="absolute inset-0" style={layer} data-testid="map-layer">
          <img ref={img} src={image} alt={`Carte officielle de ${mapName}`} draggable={false} className="block w-full h-full"
            onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) setRatio(i.naturalWidth / i.naturalHeight); }} onError={onBroken} />
          {placed.map(({ t }) => {
            const on = activeId === t.id || tribeId === t.id;
            return (
              <button key={t.id} type="button" data-pin data-testid={`pin-tribe-${t.id}`} aria-pressed={tribeId === t.id}
                aria-label={`${t.name}, base déclarée ${t.coords}`}
                title={`${t.name} — ${t.coords}`}
                onPointerDown={e => e.stopPropagation()}
                onClick={() => { setChosen(null); setHover(null); setLandmarkId(null); setTribeId(t.id); onActive(t.id); }}
                onMouseEnter={() => onActive(t.id)} onMouseLeave={() => onActive(null)} onFocus={() => onActive(t.id)} onBlur={() => onActive(null)}
                className={`absolute grid place-items-center h-11 w-11 rounded-full text-xs font-bold ${on ? "z-20" : "z-10"}`} style={counter(t.longitude as number, t.latitude as number)}>
                <span aria-hidden="true" className={`grid place-items-center h-7 w-7 rounded-full border-2 ${on ? "bg-[#9C7CFF] border-white text-white" : "bg-[#080C16] border-[#65D8FF] text-[#9AEAFF]"}`}><span className="h-2 w-2 rounded-full bg-current" /></span>
              </button>
            );
          })}
          {landmarks.map(l => (
            <button key={l.id} type="button" data-pin data-testid={`pin-landmark-${l.id}`}
              aria-label={`${l.name}, latitude ${l.lat}, longitude ${l.lon}`} aria-pressed={landmarkId === l.id}
              title={`${l.name} — Lat ${l.lat} / Lon ${l.lon}`}
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { setChosen(null); setHover(null); setTribeId(null); onActive(null); setLandmarkId(l.id); }}
              className="absolute z-20 h-16 w-16 !bg-transparent !border-0 !p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              style={counter(l.lon, l.lat)}>
              <img src={l.image} alt="" draggable={false} className="absolute bottom-1/2 mb-2 left-0 h-16 w-16 object-contain" />
              <span aria-hidden="true" data-testid={`point-landmark-${l.id}`} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#FF2020] border border-white shadow-sm" />
              <span className="absolute top-1/2 mt-2 left-1/2 -translate-x-1/2 text-white text-xs font-bold [text-shadow:0_1px_3px_#000,0_0_3px_#000]">{l.name}</span>
            </button>
          ))}
          {chosen && (
            <div className="absolute z-30 pointer-events-none" style={counter(chosen.lon, chosen.lat)} data-testid="pin-chosen-location" aria-hidden="true">
              <span className="block h-5 w-5 rotate-45 border-2 border-[#FFA078] bg-[#FFA078]/25" />
              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFA078]" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2 min-h-11" data-testid="panel-chosen-location">
          {chosen ? (<>
            <span className="inline-block h-3 w-3 rotate-45 border-2 border-[#FFA078]" aria-hidden="true" />
            <span>Point choisi : <b className="font-mono" data-testid="text-chosen-coords">{formatCoords(chosen)}</b></span>
            <button type="button" className="btn btn-ghost btn-sm !min-h-11" onClick={() => setChosen(null)} data-testid="button-clear-selection"><X className="h-4 w-4" /> Effacer la sélection</button>
          </>) : <span className="text-muted-foreground">Aucun point choisi. Cliquez ou touchez la carte pour verrouiller un point.</span>}
        </div>
        {selected && (
          <div className="rounded-lg border border-[#9C7CFF] p-3" data-testid="panel-selected-tribe">
            <p className="eyebrow mb-1">Tribu</p>
            <p><b>{selected.t.name}</b> — base déclarée <span className="font-mono">{selected.t.coords}</span> (Lat {selected.t.latitude?.toFixed(1)} / Lon {selected.t.longitude?.toFixed(1)})</p>
            <div className="mt-2 flex gap-2">
              <Link href={`/tribus/${selected.t.id}`} className="btn btn-ghost btn-sm" data-testid="link-selected-tribe">Ouvrir la fiche</Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTribeId(null)}>Fermer</button>
            </div>
          </div>
        )}
        {selectedLandmark && (
          <div className="rounded-lg border border-[#FFA078] p-3 flex gap-3 items-center" data-testid="panel-selected-landmark">
            <img src={selectedLandmark.image} alt={selectedLandmark.name} className="h-20 w-20 object-contain rounded-lg shrink-0" />
            <div><p className="eyebrow mb-1">Repère</p>
              <p><b>{selectedLandmark.name}</b> — <span className="font-mono">Lat {selectedLandmark.lat} / Lon {selectedLandmark.lon}</span></p>
              <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setLandmarkId(null)}>Fermer</button>
            </div>
          </div>
        )}
        {unknown.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="text-unplaced-tribes">Sans coordonnées exploitables, non placées : {unknown.map(({ t }) => t.name).join(", ")}.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Survolez pour lire, cliquez ou touchez pour verrouiller un point. Zoom puis glisser pour se déplacer ; flèches du clavier pour affiner.{" "}
          {calibration ? "Repères et lecture des coordonnées alignés sur les graduations imprimées de 10 à 90 : latitude de haut en bas, longitude de gauche à droite. Les marges de la photo ne sont pas prises pour les limites de la grille. L’alignement reste indicatif : vérifiez en jeu."
            : "Coordonnées indicatives, calculées sur une grille de 0 à 100 (latitude de haut en bas, longitude de gauche à droite) : l’image ne comporte aucune graduation de référence. Vérifiez en jeu."}
        </p>
      </div>
    </div>
  );
}
