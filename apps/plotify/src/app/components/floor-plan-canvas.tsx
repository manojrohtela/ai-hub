import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  RotateCcw,
  Undo2,
  Redo2,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Layout, LayoutRoom } from "../App";

const S = 10,
  PAD = 40,
  GRID_FT = 1,
  SNAP_TH = 0.75,
  MIN_W = 4,
  MIN_H = 4,
  HS = 6,
  WALL_PX = 3;
type RDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DoorSide = "north" | "south" | "east" | "west";

interface DragS {
  ri: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}
interface ResS {
  ri: number;
  dir: RDir;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
}
interface SLine {
  o: "h" | "v";
  p: number;
}

function overlaps(a: LayoutRoom, b: LayoutRoom) {
  const e = 0.05;
  return (
    a.x < b.x + b.width - e &&
    a.x + a.width > b.x + e &&
    a.y < b.y + b.height - e &&
    a.y + a.height > b.y + e
  );
}
function hasOL(rooms: LayoutRoom[], i: number) {
  for (let j = 0; j < rooms.length; j++)
    if (j !== i && overlaps(rooms[i], rooms[j])) return true;
  return false;
}
function findSnaps(
  rooms: LayoutRoom[],
  i: number,
  nx: number,
  ny: number,
  w: number,
  h: number,
  pw: number,
  pl: number,
) {
  let sx = nx,
    sy = ny;
  const ls: SLine[] = [];
  const mx = [nx, nx + w / 2, nx + w],
    my = [ny, ny + h / 2, ny + h];
  const tx: number[] = [0, pw],
    ty: number[] = [0, pl];
  for (let j = 0; j < rooms.length; j++) {
    if (j === i) continue;
    const r = rooms[j];
    tx.push(r.x, r.x + r.width);
    ty.push(r.y, r.y + r.height);
  }
  let bx = SNAP_TH;
  for (const m of mx)
    for (const t of tx) {
      const d = Math.abs(m - t);
      if (d < bx) {
        bx = d;
        sx = nx + (t - m);
        ls.length = 0;
        ls.push({ o: "v", p: t * S + PAD });
      }
    }
  let by = SNAP_TH;
  for (const m of my)
    for (const t of ty) {
      const d = Math.abs(m - t);
      if (d < by) {
        by = d;
        sy = ny + (t - m);
        ls.push({ o: "h", p: t * S + PAD });
      }
    }
  return { x: sx, y: sy, lines: ls };
}
const snap = (v: number) => Math.round(v / GRID_FT) * GRID_FT;
const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * MERGE overrides with new layout — preserves user's drag/resize for rooms that still exist.
 * Matches by roomType+name. New rooms get engine positions. Removed rooms get dropped.
 */
function mergeOverrides(
  prev: LayoutRoom[] | undefined,
  newRooms: LayoutRoom[],
): LayoutRoom[] | undefined {
  if (!prev || prev.length === 0) return undefined; // no overrides → use engine layout

  const overrideMap = new Map<string, LayoutRoom>();
  for (const r of prev) overrideMap.set(`${r.roomType}::${r.name}`, r);

  let hasAnyOverride = false;
  const merged = newRooms.map((nr) => {
    const key = `${nr.roomType}::${nr.name}`;
    const ov = overrideMap.get(key);
    if (ov) {
      hasAnyOverride = true;
      // Keep user's position & size, but update color/zone/door from engine
      return {
        ...nr,
        x: ov.x,
        y: ov.y,
        width: ov.width,
        height: ov.height,
        door: ov.door,
      };
    }
    return nr; // new room → use engine position
  });

  return hasAnyOverride ? merged : undefined;
}

export function FloorPlanCanvas({ layout }: { layout: Layout | null }) {
  const ref = useRef<SVGSVGElement>(null);
  const [vi, setVi] = useState(0);
  const [ov, setOv] = useState<Record<number, LayoutRoom[]>>({});
  const [drag, setDrag] = useState<DragS | null>(null);
  const [rsz, setRsz] = useState<ResS | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [sls, setSls] = useState<SLine[]>([]);
  const [olI, setOlI] = useState<number | null>(null);
  const [grid, setGrid] = useState(false);
  const [lock, setLock] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [edit, setEdit] = useState(false);
  const [undo, setUndo] = useState<LayoutRoom[][]>([]);
  const [redo, setRedo] = useState<LayoutRoom[][]>([]);

  const has = (layout?.variants?.length ?? 0) > 0;
  const rooms: LayoutRoom[] = ov[vi] ?? (has ? layout!.variants[vi].rooms : []);
  const pw = layout?.plotWidth ?? 30,
    pl = layout?.plotLength ?? 60;
  const road = ((layout as any)?.roadDirection ?? "south") as string;

  // KEY FIX: When layout changes from backend, MERGE with existing overrides
  // instead of wiping them. This preserves user's drag/resize changes.
  useEffect(() => {
    if (!has) {
      setOv({});
      return;
    }
    setOv((prev) => {
      const next: Record<number, LayoutRoom[]> = {};
      for (let i = 0; i < layout!.variants.length; i++) {
        const merged = mergeOverrides(prev[i], layout!.variants[i].rooms);
        if (merged) next[i] = merged;
      }
      return next;
    });
    // Don't reset selection or undo — user might be in the middle of editing
  }, [layout]);

  const swV = (i: number) => {
    setVi(i);
    setDrag(null);
    setRsz(null);
    setSel(null);
    setSls([]);
  };

  const pU = useCallback(() => {
    setUndo((p) => [...p.slice(-30), rooms.map((r) => ({ ...r }))]);
    setRedo([]);
  }, [rooms]);
  const doUndo = () => {
    if (!undo.length) return;
    setRedo((r) => [...r, rooms.map((rm) => ({ ...rm }))]);
    setOv((o) => ({ ...o, [vi]: undo[undo.length - 1] }));
    setUndo((u) => u.slice(0, -1));
    setSel(null);
  };
  const doRedo = () => {
    if (!redo.length) return;
    setUndo((u) => [...u, rooms.map((rm) => ({ ...rm }))]);
    setOv((o) => ({ ...o, [vi]: redo[redo.length - 1] }));
    setRedo((r) => r.slice(0, -1));
    setSel(null);
  };
  const resetAll = () => {
    if (!has) return;
    pU();
    setOv((o) => {
      const c = { ...o };
      delete c[vi];
      return c;
    });
    setSel(null);
  };

  const gs = () => {
    if (!ref.current) return { sx: 1, sy: 1 };
    const r = ref.current.getBoundingClientRect();
    return {
      sx: (pw * S + PAD * 2) / zoom / r.width,
      sy: (pl * S + PAD * 2) / zoom / r.height,
    };
  };

  const onDown = (e: React.MouseEvent<SVGGElement>, i: number) => {
    if (lock) {
      setSel(i);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    pU();
    setDrag({
      ri: i,
      sx: e.clientX,
      sy: e.clientY,
      ox: rooms[i].x,
      oy: rooms[i].y,
    });
    setGrid(true);
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const { sx, sy } = gs();
    if (drag) {
      const dx = ((e.clientX - drag.sx) * sx) / S,
        dy = ((e.clientY - drag.sy) * sy) / S;
      const rm = rooms[drag.ri];
      let nx = cl(drag.ox + dx, 0, pw - rm.width),
        ny = cl(drag.oy + dy, 0, pl - rm.height);
      const s = findSnaps(rooms, drag.ri, nx, ny, rm.width, rm.height, pw, pl);
      nx = snap(cl(s.x, 0, pw - rm.width));
      ny = snap(cl(s.y, 0, pl - rm.height));
      setSls(s.lines);
      const nr = rooms.map((r, i) =>
        i === drag.ri ? { ...r, x: nx, y: ny } : r,
      );
      setOlI(hasOL(nr, drag.ri) ? drag.ri : null);
      setOv((p) => ({ ...p, [vi]: nr }));
    }
    if (rsz) {
      const dx = ((e.clientX - rsz.sx) * sx) / S,
        dy = ((e.clientY - rsz.sy) * sy) / S;
      let { ox: nx, oy: ny, ow: nw, oh: nh } = rsz;
      const d = rsz.dir;
      if (d.includes("e"))
        nw = Math.min(snap(Math.max(MIN_W, rsz.ow + dx)), pw - nx);
      if (d.includes("w")) {
        const dd = snap(dx),
          w2 = rsz.ow - dd;
        if (w2 >= MIN_W) {
          nx = Math.max(0, rsz.ox + dd);
          nw = w2;
        }
      }
      if (d.includes("s"))
        nh = Math.min(snap(Math.max(MIN_H, rsz.oh + dy)), pl - ny);
      if (d.includes("n")) {
        const dd = snap(dy),
          h2 = rsz.oh - dd;
        if (h2 >= MIN_H) {
          ny = Math.max(0, rsz.oy + dd);
          nh = h2;
        }
      }
      const nr = rooms.map((r, i) =>
        i === rsz.ri
          ? { ...r, x: r2(nx), y: r2(ny), width: r2(nw), height: r2(nh) }
          : r,
      );
      setOlI(hasOL(nr, rsz.ri) ? rsz.ri : null);
      setOv((p) => ({ ...p, [vi]: nr }));
    }
  };

  const onUp = () => {
    setDrag(null);
    setRsz(null);
    setSls([]);
    setGrid(false);
  };

  const onRszDown = (e: React.MouseEvent, i: number, d: RDir) => {
    if (lock) return;
    e.preventDefault();
    e.stopPropagation();
    pU();
    const rm = rooms[i];
    setRsz({
      ri: i,
      dir: d,
      sx: e.clientX,
      sy: e.clientY,
      ox: rm.x,
      oy: rm.y,
      ow: rm.width,
      oh: rm.height,
    });
    setGrid(true);
  };

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const t = e.target as SVGElement;
    if (
      t === ref.current ||
      (t.tagName === "rect" && t.getAttribute("data-role") !== "room")
    ) {
      setSel(null);
      setEdit(false);
      setOlI(null);
    }
  };

  const changeDoor = (side: DoorSide | null) => {
    if (sel === null) return;
    pU();
    setOv((p) => ({
      ...p,
      [vi]: rooms.map((r, i) => (i === sel ? { ...r, door: side } : r)),
    }));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
      }
      if (e.key === "Escape") {
        setSel(null);
        setDrag(null);
        setRsz(null);
        setEdit(false);
      }
      if (
        sel !== null &&
        !lock &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        pU();
        const rm = rooms[sel];
        let nx = rm.x,
          ny = rm.y;
        if (e.key === "ArrowLeft") nx = Math.max(0, rm.x - 1);
        if (e.key === "ArrowRight") nx = Math.min(pw - rm.width, rm.x + 1);
        if (e.key === "ArrowUp") ny = Math.max(0, rm.y - 1);
        if (e.key === "ArrowDown") ny = Math.min(pl - rm.height, rm.y + 1);
        const nr = rooms.map((r, i) =>
          i === sel ? { ...r, x: nx, y: ny } : r,
        );
        setOlI(hasOL(nr, sel) ? sel : null);
        setOv((p) => ({ ...p, [vi]: nr }));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const downloadPNG = () => {
    const svg = ref.current;
    if (!svg) return;
    const s = sel;
    setSel(null);
    setEdit(false);
    setTimeout(() => {
      const str = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const vb = svg.viewBox.baseVal;
        const c = document.createElement("canvas");
        c.width = vb.width * 2;
        c.height = vb.height * 2;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const a = document.createElement("a");
        a.download = `plotify-${layout!.variants[vi].label.toLowerCase().replace(" ", "-")}.png`;
        a.href = c.toDataURL("image/png");
        a.click();
        URL.revokeObjectURL(url);
      };
      img.src = url;
      setSel(s);
    }, 50);
  };

  const cur = drag
    ? "grabbing"
    : rsz
      ? rsz.dir === "n" || rsz.dir === "s"
        ? "ns-resize"
        : rsz.dir === "e" || rsz.dir === "w"
          ? "ew-resize"
          : rsz.dir === "ne" || rsz.dir === "sw"
            ? "nesw-resize"
            : "nwse-resize"
      : "default";

  return (
    <div className="h-full bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl p-4 overflow-hidden flex flex-col">
      <div className="mb-2 flex-shrink-0 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-800">Floor Plan</h2>
          <p className="text-xs text-gray-500 truncate">
            {has
              ? layout!.description
              : "Start chatting to build your floor plan"}
          </p>
        </div>
        {has && (
          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
            <Btn
              icon={<Undo2 className="w-3.5 h-3.5" />}
              onClick={doUndo}
              disabled={!undo.length}
              title="Undo"
            />
            <Btn
              icon={<Redo2 className="w-3.5 h-3.5" />}
              onClick={doRedo}
              disabled={!redo.length}
              title="Redo"
            />
            <Btn
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={resetAll}
              title="Reset"
            />
            <Btn
              icon={
                lock ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )
              }
              onClick={() => setLock((l) => !l)}
              className={lock ? "!bg-red-100 !text-red-600" : ""}
              title={lock ? "Unlock" : "Lock"}
            />
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <Btn
              icon={<ZoomOut className="w-3.5 h-3.5" />}
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              title="Out"
            />
            <span className="text-[10px] text-gray-400 w-8 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Btn
              icon={<ZoomIn className="w-3.5 h-3.5" />}
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              title="In"
            />
            <div className="w-px h-5 bg-gray-200 mx-0.5" />
            <button
              onClick={downloadPNG}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 text-white rounded-lg text-[11px] font-medium hover:bg-gray-700"
            >
              <Download className="w-3 h-3" /> PNG
            </button>
          </div>
        )}
      </div>
      {has && layout!.variants.length > 1 && (
        <div className="flex gap-1.5 mb-2 flex-shrink-0 items-center">
          {layout!.variants.map((v, i) => (
            <button
              key={v.id}
              onClick={() => swV(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${vi === i ? "bg-purple-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {v.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-gray-400">
            {lock ? "🔒 Locked" : "Drag • Resize • Arrow keys"}
          </span>
        </div>
      )}
      {sel !== null && rooms[sel] && (
        <div className="mb-2 flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-[11px] flex-wrap">
          <div
            className="w-3 h-3 rounded border border-purple-400"
            style={{ background: rooms[sel].color }}
          />
          <span className="font-bold text-purple-800">{rooms[sel].name}</span>
          <span className="text-purple-600">
            {rooms[sel].width.toFixed(1)}' × {rooms[sel].height.toFixed(1)}'
          </span>
          <span className="text-purple-400">
            ({(rooms[sel].width * rooms[sel].height).toFixed(0)} sqft)
          </span>
          {!lock && (
            <button
              onClick={() => setEdit((p) => !p)}
              className="ml-auto px-2 py-0.5 rounded bg-purple-600 text-white text-[10px] font-medium hover:bg-purple-700"
            >
              {edit ? "Close" : "Edit"}
            </button>
          )}
        </div>
      )}
      {edit && sel !== null && rooms[sel] && !lock && (
        <div className="mb-2 flex-shrink-0 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-[11px] font-semibold text-gray-700 mb-2">
            Door Position
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {(["north", "south", "east", "west"] as DoorSide[]).map((s) => (
              <button
                key={s}
                onClick={() => changeDoor(s)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium ${rooms[sel].door === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button
              onClick={() => changeDoor(null)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium ${rooms[sel].door === null ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              None
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 relative bg-white rounded-xl shadow-inner overflow-auto min-h-0 flex items-center justify-center">
        {!has ? (
          <div className="flex flex-col items-center justify-center gap-4 text-gray-300 select-none">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <rect
                x="10"
                y="50"
                width="100"
                height="60"
                rx="4"
                stroke="#d1d5db"
                strokeWidth="3"
                strokeDasharray="8 4"
              />
              <polyline
                points="10,50 60,10 110,50"
                stroke="#d1d5db"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeDasharray="8 4"
              />
              <rect
                x="45"
                y="80"
                width="30"
                height="30"
                rx="2"
                stroke="#d1d5db"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
            </svg>
            <p className="text-sm font-medium text-gray-400">
              Start chatting to build your floor plan
            </p>
          </div>
        ) : (
          <svg
            ref={ref}
            viewBox={`0 0 ${pw * S + PAD * 2} ${pl * S + PAD * 2}`}
            className="max-w-full max-h-full"
            style={{ cursor: cur }}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onClick={onSvgClick}
          >
            <rect
              width={pw * S + PAD * 2}
              height={pl * S + PAD * 2}
              fill="#f8fafc"
            />
            {grid && (
              <g opacity="0.12">
                {Array.from(
                  { length: Math.floor(pw / GRID_FT) + 1 },
                  (_, i) => (
                    <line
                      key={`gv${i}`}
                      x1={PAD + i * GRID_FT * S}
                      y1={PAD}
                      x2={PAD + i * GRID_FT * S}
                      y2={PAD + pl * S}
                      stroke="#6366f1"
                      strokeWidth="0.5"
                    />
                  ),
                )}
                {Array.from(
                  { length: Math.floor(pl / GRID_FT) + 1 },
                  (_, i) => (
                    <line
                      key={`gh${i}`}
                      x1={PAD}
                      y1={PAD + i * GRID_FT * S}
                      x2={PAD + pw * S}
                      y2={PAD + i * GRID_FT * S}
                      stroke="#6366f1"
                      strokeWidth="0.5"
                    />
                  ),
                )}
              </g>
            )}
            <DimL
              x1={PAD}
              y1={PAD - 20}
              x2={PAD + pw * S}
              y2={PAD - 20}
              label={`${pw}'`}
            />
            <DimL
              x1={PAD + pw * S + 20}
              y1={PAD}
              x2={PAD + pw * S + 20}
              y2={PAD + pl * S}
              label={`${pl}'`}
              vertical
            />
            <rect
              x={PAD}
              y={PAD}
              width={pw * S}
              height={pl * S}
              fill="none"
              stroke="#1f2937"
              strokeWidth={WALL_PX + 1}
            />
            {sls.map((s, i) =>
              s.o === "v" ? (
                <line
                  key={`s${i}`}
                  x1={s.p}
                  y1={PAD}
                  x2={s.p}
                  y2={PAD + pl * S}
                  stroke="#6366f1"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity="0.6"
                />
              ) : (
                <line
                  key={`s${i}`}
                  x1={PAD}
                  y1={s.p}
                  x2={PAD + pw * S}
                  y2={s.p}
                  stroke="#6366f1"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                  opacity="0.6"
                />
              ),
            )}
            <Walls rooms={rooms} pw={pw} pl={pl} />
            {rooms.map((room, i) => (
              <Room
                key={`${room.roomType}-${i}`}
                room={room}
                i={i}
                isDrag={drag?.ri === i}
                isRsz={rsz?.ri === i}
                isSel={sel === i}
                isOL={olI === i}
                lock={lock}
                onDown={onDown}
                onRsz={onRszDown}
              />
            ))}
            <ZL pw={pw} pl={pl} />
            <text
              x={PAD + (pw * S) / 2}
              y={PAD + pl * S + 22}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="10"
              fontWeight="500"
            >
              ▲ ROAD ({road.charAt(0).toUpperCase() + road.slice(1)})
            </text>
            <Comp x={PAD + pw * S - 30} y={PAD + 30} road={road} />
          </svg>
        )}
      </div>
      {olI !== null && (
        <div className="mt-1.5 flex-shrink-0 text-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-orange-600 font-medium">
            ⚠ Rooms overlap — adjust to fix
          </span>
        </div>
      )}
    </div>
  );
}

function Btn({
  icon,
  onClick,
  disabled,
  title,
  className = "",
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors ${className}`}
    >
      {icon}
    </button>
  );
}

function Walls({
  rooms,
  pw,
  pl,
}: {
  rooms: LayoutRoom[];
  pw: number;
  pl: number;
}) {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const r of rooms) {
    const rx = r.x * S + PAD,
      ry = r.y * S + PAD,
      rw = r.width * S,
      rh = r.height * S;
    segs.push(
      { x1: rx, y1: ry, x2: rx + rw, y2: ry },
      { x1: rx, y1: ry + rh, x2: rx + rw, y2: ry + rh },
      { x1: rx, y1: ry, x2: rx, y2: ry + rh },
      { x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh },
    );
  }
  const k = (s: (typeof segs)[0]) =>
    `${Math.round(s.x1)},${Math.round(s.y1)}-${Math.round(s.x2)},${Math.round(s.y2)}`;
  const cnt = new Map<string, number>();
  for (const s of segs) {
    const k1 = k(s),
      k2 = k({ x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 });
    cnt.set(k1, (cnt.get(k1) || 0) + 1);
    cnt.set(k2, (cnt.get(k2) || 0) + 1);
  }
  const drawn = new Set<string>(),
    ws: typeof segs = [];
  for (const s of segs) {
    const k1 = k(s),
      kr = k({ x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 });
    if (drawn.has(k1) || drawn.has(kr)) continue;
    if ((cnt.get(k1) || 0) >= 2 || (cnt.get(kr) || 0) >= 2) {
      ws.push(s);
      drawn.add(k1);
      drawn.add(kr);
    }
  }
  return (
    <g>
      {ws.map((s, i) => (
        <line
          key={`w${i}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="#374151"
          strokeWidth={WALL_PX}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Room({
  room,
  i,
  isDrag,
  isRsz,
  isSel,
  isOL,
  lock,
  onDown,
  onRsz,
}: {
  room: LayoutRoom;
  i: number;
  isDrag: boolean;
  isRsz: boolean;
  isSel: boolean;
  isOL: boolean;
  lock: boolean;
  onDown: (e: React.MouseEvent<SVGGElement>, i: number) => void;
  onRsz: (e: React.MouseEvent, i: number, d: RDir) => void;
}) {
  const rx = room.x * S + PAD,
    ry = room.y * S + PAD,
    rw = room.width * S,
    rh = room.height * S;
  const wL = room.width % 1 === 0 ? `${room.width}` : room.width.toFixed(1),
    hL = room.height % 1 === 0 ? `${room.height}` : room.height.toFixed(1);
  const act = isDrag || isRsz;
  let sc = "#374151",
    sw = 1.5;
  if (isOL) {
    sc = "#f97316";
    sw = 3;
  } else if (act) {
    sc = "#7c3aed";
    sw = 2.5;
  } else if (isSel) {
    sc = "#6366f1";
    sw = 2;
  }
  const wins: string[] = (room as any).windows || [];
  return (
    <g
      style={{ cursor: lock ? "default" : act ? "grabbing" : "grab" }}
      onMouseDown={(e) => onDown(e, i)}
    >
      <rect
        data-role="room"
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill={isOL ? "#fed7aa" : room.color}
        stroke={sc}
        strokeWidth={sw}
        opacity={act ? 0.85 : 1}
      />
      {room.roomType === "stairs" && (
        <Stairs
          rx={rx}
          ry={ry}
          rw={rw}
          rh={rh}
          type={(room as any).stairType}
        />
      )}
      {wins.map((s, wi) => (
        <Win key={`w${wi}`} rx={rx} ry={ry} rw={rw} rh={rh} side={s} />
      ))}
      {room.door && <Door rx={rx} ry={ry} rw={rw} rh={rh} side={room.door} />}
      <text
        x={rx + rw / 2}
        y={ry + rh / 2 - (rh > 60 ? 8 : 3)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1f2937"
        fontSize={rh > 60 ? "10" : "8"}
        fontWeight="600"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {room.name}
      </text>
      {rh > 40 && (
        <text
          x={rx + rw / 2}
          y={ry + rh / 2 + (rh > 60 ? 10 : 6)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize="7.5"
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          {wL}'×{hL}'
        </text>
      )}
      {isSel && !lock && (
        <>
          <RH
            x={rx + rw / 2 - HS / 2}
            y={ry - HS / 2}
            d="n"
            i={i}
            onRsz={onRsz}
          />
          <RH
            x={rx + rw / 2 - HS / 2}
            y={ry + rh - HS / 2}
            d="s"
            i={i}
            onRsz={onRsz}
          />
          <RH
            x={rx - HS / 2}
            y={ry + rh / 2 - HS / 2}
            d="w"
            i={i}
            onRsz={onRsz}
          />
          <RH
            x={rx + rw - HS / 2}
            y={ry + rh / 2 - HS / 2}
            d="e"
            i={i}
            onRsz={onRsz}
          />
          <RH x={rx - HS / 2} y={ry - HS / 2} d="nw" i={i} onRsz={onRsz} />
          <RH x={rx + rw - HS / 2} y={ry - HS / 2} d="ne" i={i} onRsz={onRsz} />
          <RH x={rx - HS / 2} y={ry + rh - HS / 2} d="sw" i={i} onRsz={onRsz} />
          <RH
            x={rx + rw - HS / 2}
            y={ry + rh - HS / 2}
            d="se"
            i={i}
            onRsz={onRsz}
          />
        </>
      )}
    </g>
  );
}

function RH({
  x,
  y,
  d,
  i,
  onRsz,
}: {
  x: number;
  y: number;
  d: RDir;
  i: number;
  onRsz: (e: React.MouseEvent, i: number, d: RDir) => void;
}) {
  const c =
    d === "n" || d === "s"
      ? "ns-resize"
      : d === "e" || d === "w"
        ? "ew-resize"
        : d === "ne" || d === "sw"
          ? "nesw-resize"
          : "nwse-resize";
  return (
    <rect
      x={x}
      y={y}
      width={HS}
      height={HS}
      rx={1.5}
      fill="white"
      stroke="#6366f1"
      strokeWidth="1.5"
      style={{ cursor: c }}
      onMouseDown={(e) => onRsz(e, i, d)}
    />
  );
}
function Stairs({
  rx,
  ry,
  rw,
  rh,
  type,
}: {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  type?: string;
}) {
  const steps = Math.max(6, Math.floor(rh / 6)),
    sh = rh / steps;
  if (type === "L-shaped") {
    const hs = Math.floor(steps / 2),
      my = ry + hs * sh;
    return (
      <g opacity="0.4" pointerEvents="none">
        {Array.from({ length: hs }, (_, i) => (
          <line
            key={`s1${i}`}
            x1={rx + 2}
            y1={ry + rh - i * sh}
            x2={rx + rw / 2 - 1}
            y2={ry + rh - i * sh}
            stroke="#374151"
            strokeWidth="0.8"
          />
        ))}
        <rect
          x={rx + 2}
          y={my - 1}
          width={rw - 4}
          height={sh + 2}
          fill="none"
          stroke="#374151"
          strokeWidth="0.8"
          strokeDasharray="2 1"
        />
        {Array.from({ length: hs }, (_, i) => (
          <line
            key={`s2${i}`}
            x1={rx + rw / 2 + 1}
            y1={my - i * sh}
            x2={rx + rw - 2}
            y2={my - i * sh}
            stroke="#374151"
            strokeWidth="0.8"
          />
        ))}
        <text
          x={rx + rw / 2}
          y={ry + 8}
          textAnchor="middle"
          fill="#6b7280"
          fontSize="7"
          fontWeight="600"
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          UP ↑
        </text>
      </g>
    );
  }
  return (
    <g opacity="0.4" pointerEvents="none">
      {Array.from({ length: steps }, (_, i) => (
        <line
          key={`st${i}`}
          x1={rx + 3}
          y1={ry + rh - i * sh}
          x2={rx + rw - 3}
          y2={ry + rh - i * sh}
          stroke="#374151"
          strokeWidth="0.8"
        />
      ))}
      <text
        x={rx + rw / 2}
        y={ry + 8}
        textAnchor="middle"
        fill="#6b7280"
        fontSize="7"
        fontWeight="600"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        UP ↑
      </text>
    </g>
  );
}
function Win({
  rx,
  ry,
  rw,
  rh,
  side,
}: {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  side: string;
}) {
  const wL = Math.min(
      20,
      (side === "north" || side === "south" ? rw : rh) * 0.4,
    ),
    g = 2;
  if (side === "north") {
    const cx = rx + rw / 2;
    return (
      <g>
        <line
          x1={cx - wL / 2}
          y1={ry}
          x2={cx + wL / 2}
          y2={ry}
          stroke="#3b82f6"
          strokeWidth="2.5"
        />
        <line
          x1={cx - wL / 2}
          y1={ry + g}
          x2={cx + wL / 2}
          y2={ry + g}
          stroke="#93c5fd"
          strokeWidth="1"
        />
      </g>
    );
  }
  if (side === "south") {
    const cx = rx + rw / 2;
    return (
      <g>
        <line
          x1={cx - wL / 2}
          y1={ry + rh}
          x2={cx + wL / 2}
          y2={ry + rh}
          stroke="#3b82f6"
          strokeWidth="2.5"
        />
        <line
          x1={cx - wL / 2}
          y1={ry + rh - g}
          x2={cx + wL / 2}
          y2={ry + rh - g}
          stroke="#93c5fd"
          strokeWidth="1"
        />
      </g>
    );
  }
  if (side === "west") {
    const cy = ry + rh / 2;
    return (
      <g>
        <line
          x1={rx}
          y1={cy - wL / 2}
          x2={rx}
          y2={cy + wL / 2}
          stroke="#3b82f6"
          strokeWidth="2.5"
        />
        <line
          x1={rx + g}
          y1={cy - wL / 2}
          x2={rx + g}
          y2={cy + wL / 2}
          stroke="#93c5fd"
          strokeWidth="1"
        />
      </g>
    );
  }
  if (side === "east") {
    const cy = ry + rh / 2;
    return (
      <g>
        <line
          x1={rx + rw}
          y1={cy - wL / 2}
          x2={rx + rw}
          y2={cy + wL / 2}
          stroke="#3b82f6"
          strokeWidth="2.5"
        />
        <line
          x1={rx + rw - g}
          y1={cy - wL / 2}
          x2={rx + rw - g}
          y2={cy + wL / 2}
          stroke="#93c5fd"
          strokeWidth="1"
        />
      </g>
    );
  }
  return null;
}
function Door({
  rx,
  ry,
  rw,
  rh,
  side,
}: {
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  side: string;
}) {
  const dw = Math.min(rw * 0.38, 24),
    off = 5;
  if (side === "south") {
    const hx = rx + off,
      hy = ry + rh;
    return (
      <g>
        <rect x={hx} y={hy - 1.5} width={dw} height={3} fill="white" />
        <line
          x1={hx}
          y1={hy}
          x2={hx + dw}
          y2={hy}
          stroke="#374151"
          strokeWidth="1.5"
        />
        <path
          d={`M ${hx + dw} ${hy} A ${dw} ${dw} 0 0 0 ${hx} ${hy - dw}`}
          stroke="#374151"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 1.5"
        />
      </g>
    );
  }
  if (side === "north") {
    const hx = rx + off,
      hy = ry;
    return (
      <g>
        <rect x={hx} y={hy - 1.5} width={dw} height={3} fill="white" />
        <line
          x1={hx}
          y1={hy}
          x2={hx + dw}
          y2={hy}
          stroke="#374151"
          strokeWidth="1.5"
        />
        <path
          d={`M ${hx + dw} ${hy} A ${dw} ${dw} 0 0 1 ${hx} ${hy + dw}`}
          stroke="#374151"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 1.5"
        />
      </g>
    );
  }
  const dh = Math.min(rh * 0.38, 24);
  if (side === "east") {
    const hx = rx + rw,
      hy = ry + off;
    return (
      <g>
        <rect x={hx - 1.5} y={hy} width={3} height={dh} fill="white" />
        <line
          x1={hx}
          y1={hy}
          x2={hx}
          y2={hy + dh}
          stroke="#374151"
          strokeWidth="1.5"
        />
        <path
          d={`M ${hx} ${hy + dh} A ${dh} ${dh} 0 0 0 ${hx - dh} ${hy}`}
          stroke="#374151"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 1.5"
        />
      </g>
    );
  }
  if (side === "west") {
    const hx = rx,
      hy = ry + off;
    return (
      <g>
        <rect x={hx - 1.5} y={hy} width={3} height={dh} fill="white" />
        <line
          x1={hx}
          y1={hy}
          x2={hx}
          y2={hy + dh}
          stroke="#374151"
          strokeWidth="1.5"
        />
        <path
          d={`M ${hx} ${hy + dh} A ${dh} ${dh} 0 0 1 ${hx + dh} ${hy}`}
          stroke="#374151"
          strokeWidth="1"
          fill="none"
          strokeDasharray="2 1.5"
        />
      </g>
    );
  }
  return null;
}
function DimL({
  x1,
  y1,
  x2,
  y2,
  label,
  vertical = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  vertical?: boolean;
}) {
  const mx = (x1 + x2) / 2,
    my = (y1 + y2) / 2;
  return (
    <g fill="#9ca3af" stroke="#9ca3af">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" />
      {vertical ? (
        <>
          <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} strokeWidth="1" />
          <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} strokeWidth="1" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} strokeWidth="1" />
          <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} strokeWidth="1" />
        </>
      )}
      <text
        x={mx}
        y={my}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#6b7280"
        fontSize="9"
        fontWeight="500"
        transform={vertical ? `rotate(-90, ${mx}, ${my})` : undefined}
        style={{ userSelect: "none" }}
      >
        {label}
      </text>
    </g>
  );
}
function ZL({ pw, pl }: { pw: number; pl: number }) {
  return (
    <>
      {[
        { l: "PRIVATE", y: 0.12 },
        { l: "SERVICE", y: 0.55 },
        { l: "PUBLIC", y: 0.88 },
      ].map((z) => (
        <text
          key={z.l}
          x={PAD + 6}
          y={PAD + pl * S * z.y}
          fill="#e5e7eb"
          fontSize="7"
          fontWeight="700"
          letterSpacing="2"
          style={{ userSelect: "none" }}
          pointerEvents="none"
        >
          {z.l}
        </text>
      ))}
    </>
  );
}
function Comp({ x, y, road }: { x: number; y: number; road: string }) {
  const c = (d: string) => (road.toLowerCase() === d ? "#ef4444" : "#9ca3af");
  const fw = (d: string) => (road.toLowerCase() === d ? "700" : "400");
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={16}
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="1.5"
      />
      <text
        x={x}
        y={y - 7}
        textAnchor="middle"
        fill={c("north")}
        fontSize="9"
        fontWeight={fw("north")}
      >
        N
      </text>
      <text
        x={x}
        y={y + 12}
        textAnchor="middle"
        fill={c("south")}
        fontSize="8"
        fontWeight={fw("south")}
      >
        S
      </text>
      <text
        x={x - 10}
        y={y + 3}
        textAnchor="middle"
        fill={c("west")}
        fontSize="8"
        fontWeight={fw("west")}
      >
        W
      </text>
      <text
        x={x + 10}
        y={y + 3}
        textAnchor="middle"
        fill={c("east")}
        fontSize="8"
        fontWeight={fw("east")}
      >
        E
      </text>
      <line
        x1={x}
        y1={y - 4}
        x2={x}
        y2={y + 4}
        stroke="#374151"
        strokeWidth="1"
      />
      <line
        x1={x - 4}
        y1={y}
        x2={x + 4}
        y2={y}
        stroke="#374151"
        strokeWidth="1"
      />
    </g>
  );
}
