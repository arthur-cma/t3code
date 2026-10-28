import {
  MinusIcon,
  MousePointer2Icon,
  PlusIcon,
  SquareIcon,
  StickyNoteIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  GroupAccent,
  GroupCanvasNode,
  GroupCanvasNodeKind,
  GroupPage,
  GroupPageCanvas,
} from "../../groups/types";
import { GROUP_ACCENTS, GROUP_CANVAS_NODE_CLASSES } from "../../groups/types";
import { cn, randomUUID } from "../../lib/utils";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const GRID_SIZE = 24;

const NODE_DEFAULTS: Record<
  GroupCanvasNodeKind,
  { width: number; height: number; color: GroupAccent; text: string }
> = {
  note: { width: 220, height: 168, color: "amber", text: "" },
  shape: { width: 220, height: 140, color: "sky", text: "" },
  text: { width: 260, height: 72, color: "slate", text: "" },
};

const KIND_LABELS: Record<GroupCanvasNodeKind, string> = {
  note: "Nota",
  shape: "Forma",
  text: "Texto",
};

interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

type DragState =
  | {
      kind: "pan";
      pointerId: number;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      kind: "node";
      pointerId: number;
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
      moved: boolean;
    }
  | null;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active ?? false}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5",
        active === true && "bg-accent text-foreground",
      )}
      disabled={disabled ?? false}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function GroupPageCanvas({
  page,
  onChange,
}: {
  page: GroupPage;
  onChange: (canvas: GroupPageCanvas) => void;
}) {
  const [nodes, setNodes] = useState<GroupCanvasNode[]>(page.canvas.nodes);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, zoom: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  const viewRef = useRef(view);
  const dragRef = useRef<DragState>(null);

  const updateView = (next: ViewState) => {
    viewRef.current = next;
    setView(next);
  };

  const commit = (next: GroupCanvasNode[]) => {
    nodesRef.current = next;
    setNodes(next);
    onChange({ nodes: next });
  };

  const handleWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (surface === null) return;
    const current = viewRef.current;
    let next: ViewState;
    if (event.ctrlKey || event.metaKey) {
      const rect = surface.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const zoom = clampZoom(current.zoom * Math.exp(-event.deltaY * 0.0015));
      const worldX = (px - current.x) / current.zoom;
      const worldY = (py - current.y) / current.zoom;
      next = { zoom, x: px - worldX * zoom, y: py - worldY * zoom };
    } else {
      next = {
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      };
    }
    viewRef.current = next;
    setView(next);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the board transform in step with native wheel events while mounted
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) return;
    const listener = (event: WheelEvent) => handleWheel(event);
    surface.addEventListener("wheel", listener, { passive: false });
    return () => surface.removeEventListener("wheel", listener);
  }, []);

  const viewportCenter = () => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const current = viewRef.current;
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 500;
    return {
      x: (width / 2 - current.x) / current.zoom - 110,
      y: (height / 2 - current.y) / current.zoom - 80,
    };
  };

  const addNode = (kind: GroupCanvasNodeKind) => {
    const defaults = NODE_DEFAULTS[kind];
    const center = viewportCenter();
    const node: GroupCanvasNode = {
      id: `canvas_${randomUUID()}`,
      kind,
      x: Math.round(center.x + nodesRef.current.length * 8),
      y: Math.round(center.y + nodesRef.current.length * 8),
      width: defaults.width,
      height: defaults.height,
      color: defaults.color,
      text: "",
    };
    commit([...nodesRef.current, node]);
    setSelectedId(node.id);
    setEditingId(node.id);
  };

  const updateNode = (id: string, patch: Partial<GroupCanvasNode>) => {
    const next = nodesRef.current.map((node) => (node.id === id ? { ...node, ...patch } : node));
    nodesRef.current = next;
    setNodes(next);
  };

  const removeNode = (id: string) => {
    commit(nodesRef.current.filter((node) => node.id !== id));
    setSelectedId(null);
    setEditingId(null);
  };

  const startNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, node: GroupCanvasNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "node",
      pointerId: event.pointerId,
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      moved: false,
    };
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("[data-canvas-node]") !== null) return;
    setSelectedId(null);
    setEditingId(null);
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "pan") {
      updateView({
        ...viewRef.current,
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
      return;
    }
    const zoom = viewRef.current.zoom;
    drag.moved = true;
    updateNode(drag.id, {
      x: Math.round(drag.originX + (event.clientX - drag.startX) / zoom),
      y: Math.round(drag.originY + (event.clientY - drag.startY) / zoom),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.kind === "node" && drag.moved) {
      onChange({ nodes: nodesRef.current });
    }
  };

  const zoomBy = (factor: number) => {
    const current = viewRef.current;
    const rect = surfaceRef.current?.getBoundingClientRect();
    const px = (rect?.width ?? 800) / 2;
    const py = (rect?.height ?? 500) / 2;
    const zoom = clampZoom(current.zoom * factor);
    const worldX = (px - current.x) / current.zoom;
    const worldY = (py - current.y) / current.zoom;
    updateView({ zoom, x: px - worldX * zoom, y: py - worldY * zoom });
  };

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 px-2 py-1">
        <ToolbarButton label="Adicionar nota" onClick={() => addNode("note")}>
          <StickyNoteIcon />
        </ToolbarButton>
        <ToolbarButton label="Adicionar forma" onClick={() => addNode("shape")}>
          <SquareIcon />
        </ToolbarButton>
        <ToolbarButton label="Adicionar texto" onClick={() => addNode("text")}>
          <TypeIcon />
        </ToolbarButton>
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          disabled={selected === null}
          label="Apagar selecionado"
          onClick={() => {
            if (selected !== null) removeNode(selected.id);
          }}
        >
          <Trash2Icon />
        </ToolbarButton>
        {selected === null ? null : (
          <div className="ml-1 flex items-center gap-1">
            {GROUP_ACCENTS.map((color) => (
              <button
                aria-label={`Cor ${color}`}
                aria-pressed={selected.color === color}
                className={cn(
                  "size-4 rounded-full border outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  GROUP_CANVAS_NODE_CLASSES[color],
                  selected.color === color ? "ring-2 ring-ring" : "border-border/60",
                )}
                key={color}
                onClick={() => {
                  updateNode(selected.id, { color });
                  onChange({ nodes: nodesRef.current });
                }}
                type="button"
              />
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <span className="px-1 text-2xs tabular-nums text-muted-foreground">
            {Math.round(view.zoom * 100)}%
          </span>
          <ToolbarButton label="Diminuir zoom" onClick={() => zoomBy(0.85)}>
            <MinusIcon />
          </ToolbarButton>
          <ToolbarButton label="Aumentar zoom" onClick={() => zoomBy(1.18)}>
            <PlusIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Centralizar quadro"
            onClick={() => updateView({ x: 0, y: 0, zoom: 1 })}
          >
            <MousePointer2Icon />
          </ToolbarButton>
        </div>
      </div>

      <div
        aria-label="Quadro da página"
        className="page-canvas-grid relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden outline-hidden"
        data-canvas-surface="true"
        onDoubleClick={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-canvas-node]") !== null) return;
          addNode("note");
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Escape") {
            setSelectedId(null);
            return;
          }
          if (
            (event.key === "Delete" || event.key === "Backspace") &&
            selectedId !== null &&
            editingId === null
          ) {
            event.preventDefault();
            removeNode(selectedId);
          }
        }}
        onPointerDown={startPan}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        ref={surfaceRef}
        role="application"
        tabIndex={0}
        style={{
          backgroundSize: `${GRID_SIZE * view.zoom}px ${GRID_SIZE * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {nodes.map((node) => {
            const isSelected = node.id === selectedId;
            const isEditing = node.id === editingId;
            return (
              <div
                className={cn(
                  "absolute flex flex-col rounded-xl border p-3 text-left shadow-sm outline-hidden transition-shadow",
                  GROUP_CANVAS_NODE_CLASSES[node.color],
                  node.kind === "note" && "rounded-sm shadow-md",
                  node.kind === "text" && "border-transparent bg-transparent shadow-none",
                  isSelected && "ring-2 ring-ring",
                )}
                data-canvas-node={node.id}
                key={node.id}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditingId(node.id);
                }}
                onPointerDown={(event) => startNodeDrag(event, node)}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
              >
                {isEditing ? (
                  <textarea
                    aria-label={`${KIND_LABELS[node.kind]} do quadro`}
                    autoFocus
                    className="size-full resize-none bg-transparent text-sm leading-snug outline-none placeholder:text-current/40"
                    onBlur={() => {
                      setEditingId(null);
                      onChange({ nodes: nodesRef.current });
                    }}
                    onChange={(event) => updateNode(node.id, { text: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.currentTarget.blur();
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    placeholder={
                      node.kind === "note"
                        ? "Escreva uma nota"
                        : node.kind === "shape"
                          ? "Rótulo da forma"
                          : "Texto"
                    }
                    value={node.text}
                  />
                ) : (
                  <p
                    className={cn(
                      "whitespace-pre-wrap break-words text-sm leading-snug",
                      node.kind === "text" && "text-base font-medium text-foreground",
                      node.text.length === 0 && "text-current/40",
                    )}
                  >
                    {node.text.length === 0
                      ? node.kind === "note"
                        ? "Clique duas vezes para escrever"
                        : node.kind === "shape"
                          ? "Forma"
                          : "Texto"
                      : node.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">Quadro vazio</p>
            <p className="max-w-64 text-xs text-muted-foreground">
              Clique duas vezes para criar uma nota, ou use a barra acima para adicionar formas e
              textos.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
