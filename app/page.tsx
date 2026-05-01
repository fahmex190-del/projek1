/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react/no-unescaped-entities */
"use client";

import React, {

  useState,
  useRef,
  PointerEvent as ReactPointerEvent,
  useEffect,
} from "react";
import {
  Move,
  Settings,
  Maximize,
  RotateCcw,
  Trash2,
  Copy,
  Plus,
  Settings2,
  Box,
  Image as ImageIcon,
  Check,
  X,
  MousePointer2,
  Bug,
  Play,
  Square,
  ChevronDown,
  ChevronLeft,
  Terminal,
  Database, Pencil, Folder,
  Download, Upload, MoreVertical, Music, Crosshair, Pause
} from "lucide-react";

const SimpleAudioPlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setTime(audio.currentTime);
    const onLoaded = () => setDur(audio.duration);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const formatT = (s: number) => {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="flex items-center space-x-2 bg-[#1a1a1a] px-2 py-1 rounded">
      <audio ref={audioRef} src={url} className="hidden" />
      <button 
        onClick={() => {
          if (isPlaying) audioRef.current?.pause();
          else audioRef.current?.play();
          setIsPlaying(!isPlaying);
        }}
        className="text-[#aaa] hover:text-white"
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <span className="text-[10px] text-[#888]">
        {formatT(time)} / {formatT(dur)}
      </span>
    </div>
  );
};
import ExpressionEditor from "@/app/components/ExpressionEditor";
import AssetSelector from "@/app/components/AssetSelector";
import { cn } from "@/lib/utils";
import { getProjects, saveProjectDB, deleteProjectDB, saveStorageDB, loadStorageDB } from "./lib/db";
import { compressImage } from "./lib/imageUtils";

type Transform = {
  x: number;
  y: number;
  sX: number;
  sY: number;
  rot: number;
  opacity?: number;
};

export type ComponentType = "rigidbody" | "sprite" | "collision" | "script" | "text" | "animation";

export interface BaseComponent {
  id: string;
  type: ComponentType;
}

export interface AnimationComponent extends BaseComponent {
  type: "animation";
  frames: string[]; // array of assetUrls
  fps: number;
  playing: boolean;
  loop: boolean;
}

export interface CollisionComponent extends BaseComponent {
  type: "collision";
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface RigidbodyComponent extends BaseComponent {
  type: "rigidbody";
  gravity: number;
  bodyType: "dynamic" | "static";
  sensorType: "solid" | "sensor" | "none";
}

export interface SpriteComponent extends BaseComponent {
  type: "sprite";
  color: string;
  assetUrl?: string;
  stretch?: boolean;
}

export interface TextComponent extends BaseComponent {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  shadow?: boolean;
  outlineWidth?: number;
  outlineColor?: string;
}

export type EntityComponent =
  | BaseComponent
  | CollisionComponent
  | RigidbodyComponent
  | SpriteComponent
  | ScriptComponent
  | TextComponent;

export type GlobalVariableType = "number" | "string" | "boolean";

export interface GlobalVariable {
  id: string;
  name: string;
  type: GlobalVariableType;
  value: any;
  logToConsole: boolean;
}

export type BlockType =
  | "event_run"
  | "event_load"
  | "event_screen_touch"
  | "event_obj_touch"
  | "event_tick"
  | "action_set_var"
  | "action_set_text"
  | "action_get_prop"
  | "action_destroy"
  | "action_create"
  | "action_set_sprite"
  | "action_set_opacity"
  | "action_play_sound"
  | "action_transform"
  | "action_velocity"
  | "action_camera_follow"
  | "action_save_ram"
  | "action_load_ram"
  | "action_save_storage"
  | "action_load_storage"
  | "control_if_var"
  | "control_if_col"
  | "control_wait"
  | "control_repeat"
  | "control_load_scene";

export interface ScriptNode {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  params: Record<string, string>;
}

export interface ScriptWire {
  id: string;
  fromNode: string;
  fromPin: string;
  toNode: string;
  toPin: string;
}

export interface ScriptComponent extends BaseComponent {
  type: "script";
  name: string;
  nodes: ScriptNode[];
  wires: ScriptWire[];
  localVars: GlobalVariable[];
}

const BLOCK_DEFS: Record<
  string,
  {
    label: string;
    category: string;
    params: string[];
    outPins: string[];
    inPin: boolean;
  }
> = {
  event_run: {
    label: "If Run",
    category: "event",
    params: [],
    outPins: ["out"],
    inPin: false,
  },
  event_tick: {
    label: "Update (Every Frame)",
    category: "event",
    params: [],
    outPins: ["out"],
    inPin: false,
  },
  event_load: {
    label: "On Start / Clone",
    category: "event",
    params: [],
    outPins: ["out"],
    inPin: false,
  },
  event_screen_touch: {
    label: "Screen Touched",
    category: "event",
    params: ["touchType"],
    outPins: ["out"],
    inPin: false,
  },
  event_obj_touch: {
    label: "Object Touched",
    category: "event",
    params: ["touchType"],
    outPins: ["out"],
    inPin: false,
  },

  action_set_var: {
    label: "Set Variable",
    category: "action",
    params: ["varName", "value"],
    outPins: ["out"],
    inPin: true,
  },
  action_set_text: {
    label: "Set Text!",
    category: "action",
    params: ["text"],
    outPins: ["out"],
    inPin: true,
  },
  action_get_prop: {
    label: "Get Property",
    category: "action",
    params: ["property", "targetVar"],
    outPins: ["out"],
    inPin: true,
  },
  action_set_sprite: {
    label: "Set Sprite Asset",
    category: "action",
    params: ["assetType", "assetValue"],
    outPins: ["out"],
    inPin: true,
  },
  action_set_opacity: {
    label: "Set Opacity",
    category: "action",
    params: ["opacity"],
    outPins: ["out"],
    inPin: true,
  },
  action_transform: {
    label: "Set Transform",
    category: "action",
    params: ["x", "y", "sX", "sY", "rot"],
    outPins: ["out"],
    inPin: true,
  },
  action_velocity: {
    label: "Set Velocity",
    category: "action",
    params: ["vx", "vy", "vrot"],
    outPins: ["out"],
    inPin: true,
  },
  action_destroy: {
    label: "Destroy Object",
    category: "action",
    params: [],
    outPins: ["out"],
    inPin: true,
  },
  action_play_sound: {
    label: "Play Sound",
    category: "action",
    params: ["soundAssetId", "volume"],
    outPins: ["out"],
    inPin: true,
  },
  action_create: {
    label: "Create Object",
    category: "action",
    params: ["objName", "x", "y", "vx", "vy"],
    outPins: ["out"],
    inPin: true,
  },
  action_camera_follow: {
    label: "Camera Follow",
    category: "action",
    params: ["targetObj", "smooth"],
    outPins: ["out"],
    inPin: true,
  },
  action_save_ram: {
    label: "Save (RAM)",
    category: "action",
    params: ["key", "value"],
    outPins: ["out"],
    inPin: true,
  },
  action_load_ram: {
    label: "Load (RAM)",
    category: "action",
    params: ["key", "targetVar"],
    outPins: ["out"],
    inPin: true,
  },
  action_save_storage: {
    label: "Save (Storage)",
    category: "action",
    params: ["key", "value"],
    outPins: ["out"],
    inPin: true,
  },
  action_load_storage: {
    label: "Load (Storage)",
    category: "action",
    params: ["key", "targetVar"],
    outPins: ["out"],
    inPin: true,
  },

  control_if_var: {
    label: "If Variable",
    category: "control",
    params: ["condition"],
    outPins: ["true", "false"],
    inPin: true,
  },
  control_if_col: {
    label: "If Collision",
    category: "control",
    params: ["targetName"],
    outPins: ["true", "false"],
    inPin: true,
  },
  control_wait: {
    label: "Wait (sec)",
    category: "control",
    params: ["time"],
    outPins: ["out"],
    inPin: true,
  },
  control_repeat: {
    label: "Repeat",
    category: "control",
    params: ["times"],
    outPins: ["loop", "out"],
    inPin: true,
  },
  control_load_scene: {
    label: "Load Scene",
    category: "control",
    params: ["sceneName"],
    outPins: [],
    inPin: true,
  },
};

const evalExpr = (
  expr: string,
  ctx: any,
  objects: RenderObject[] = [],
  velocities: any[] = [],
  currentObjId?: string,
) => {
  if (!expr || expr === "none") return null;
  try {
    const objFn = (name: string) => {
      const o = objects.find((ob) => ob.name === name);
      if (!o)
        return { x: 0, y: 0, scale_x: 0, scale_y: 0, angle: 0, vx: 0, vy: 0, positionX: 0, positionY: 0, scaleX: 0, scaleY: 0, velocityX: 0, velocityY: 0 };
      const vel = velocities.find((v) => v.id === o.id) || { vx: 0, vy: 0 };
      return {
        x: o.transform.x,
        y: o.transform.y,
        scale_x: o.transform.sX,
        scale_y: o.transform.sY,
        angle: o.transform.rot,
        vx: vel.vx,
        vy: vel.vy,
        positionX: o.transform.x,
        positionY: o.transform.y,
        scaleX: o.transform.sX,
        scaleY: o.transform.sY,
        velocityX: vel.vx,
        velocityY: vel.vy,
      };
    };

    let positionX = 0, positionY = 0, scaleX = 100, scaleY = 100, angle = 0, velocityX = 0, velocityY = 0, opacity = 1;
    if (currentObjId) {
      const o = objects.find(ob => ob.id === currentObjId);
      if (o) {
        const vel = velocities.find((v) => v.id === o.id) || { vx: 0, vy: 0 };
        positionX = o.transform.x;
        positionY = o.transform.y;
        scaleX = o.transform.sX;
        scaleY = o.transform.sY;
        angle = o.transform.rot;
        opacity = o.transform.opacity ?? 1;
        velocityX = vel.vx;
        velocityY = vel.vy;
      }
    }

    let processedExpr = expr
      .replace(/position\s*x/ig, "positionX")
      .replace(/position\s*y/ig, "positionY")
      .replace(/scale\s*x/ig, "scaleX")
      .replace(/scale\s*y/ig, "scaleY")
      .replace(/velocity\s*x/ig, "velocityX")
      .replace(/velocity\s*y/ig, "velocityY")
      .replace(/TRUE/g, "true")
      .replace(/FALSE/g, "false");

    const fn = new Function(
      "g",
      "l",
      "obj",
      "Math",
      "positionX",
      "positionY",
      "scaleX",
      "scaleY",
      "angle",
      "velocityX",
      "velocityY",
      "opacity",
      `return ${processedExpr};`,
    );
    const res = fn(ctx.g, ctx.l, objFn, Math, positionX, positionY, scaleX, scaleY, angle, velocityX, velocityY, opacity);
    if (res === undefined) {
      throw new Error(`Expression evaluated to undefined. Check if a variable you are using exists.`);
    }
    if (typeof res === "number" && isNaN(res)) {
      throw new Error(`Expression evaluated to NaN.`);
    }
    return res;
  } catch (e: any) {
    throw new Error(`Expression '${expr}' error: ${e.message}`);
  }
};

type RenderObject = {
  id: string;
  name: string;
  transform: Transform;
  color: string;
  components: EntityComponent[];
};

const DUMMY_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function DraggableNumber({
  label,
  value,
  onChange,
  step = 0.5,
  bg = "bg-[#2a2a2a]",
  border = "border-[#1a1a1a]",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  bg?: string;
  border?: string;
}) {
  const initDragX = useRef(0);
  const initValue = useRef(0);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);

  const [localVal, setLocalVal] = useState(Number(value).toFixed(1));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setLocalVal(Number(value).toFixed(1));
  }, [value, isFocused]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    initDragX.current = e.clientX;
    initValue.current = value;
    isDragging.current = true;
    hasMoved.current = false;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      isDragging.current &&
      (e.target as HTMLElement).hasPointerCapture(e.pointerId)
    ) {
      const deltaX = e.clientX - initDragX.current;
      if (Math.abs(deltaX) > 2) {
        hasMoved.current = true;
      }
      if (hasMoved.current) {
        onChange(initValue.current + deltaX * step);
      }
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleInputKeyDownLocal = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className={`flex flex-row items-center space-x-1.5 w-full ${bg} rounded px-1.5 py-1 border ${border}`}
    >
      <div
        className="cursor-ew-resize font-bold text-[#888888] select-none hover:text-white shrink-0 text-[10px] w-3 flex justify-center touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {label}
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={isFocused ? localVal : Number(value).toFixed(1)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleInputKeyDownLocal}
        onBlur={() => {
          setIsFocused(false);
          const parsed = parseFloat(localVal);
          if (!isNaN(parsed)) onChange(parsed);
          else {
            // Reset to valid number if they leave it empty/invalid
            setLocalVal(Number(value).toFixed(1));
          }
        }}
        onChange={(e) => {
          // allow intermediate typing like '-' or '.'
          setLocalVal(e.target.value);
          const parsed = parseFloat(e.target.value);
          // Only update parent if it's a valid number. We don't force '0' if they clear it.
          if (!isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        className="w-full bg-transparent text-[#e0e0e0] outline-none text-[11px] font-mono touch-none min-w-[20px]"
      />
    </div>
  );
}

function GameEngineUI({ project, onBack }: { project: any, onBack: (p: any) => void }) {
  const [objects, setObjects] = useState<RenderObject[]>(
     project.scenes && project.scenes.length > 0 ? project.scenes[0].objects || [] : []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<
    "free" | "pos" | "scale" | "rotate"
  >("free");
  const [useGizmo, setUseGizmo] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Globals & Preview
  const [bottomPanelTab, setBottomPanelTab] = useState<"assets" | "variables">(
    "assets",
  );
  const [variables, setVariables] = useState<GlobalVariable[]>(
     project.scenes && project.scenes.length > 0 ? project.scenes[0].variables || [] : []
  );
  const [isVariablesExpanded, setIsVariablesExpanded] = useState(true);
  const [showAddVarMenu, setShowAddVarMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [resolutionMode, setResolutionMode] = useState<"default" | "fullscreen" | "fullscreen-notch">(
    project.resolutionMode || "default"
  );
  const [editorGrid, setEditorGrid] = useState(false);

  const [scenes, setScenes] = useState<{ id: string, name: string, objects: RenderObject[], variables: GlobalVariable[] }[]>(
    project.scenes && project.scenes.length > 0 ? project.scenes : [{ id: "1", name: "scene 1", objects: [], variables: [] }]
  );
  const [activeSceneId, setActiveSceneId] = useState(
    project.scenes && project.scenes.length > 0 ? project.scenes[0].id : "1"
  );
  const [showScenesMenu, setShowScenesMenu] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneMenuId, setSceneMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sceneHoldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showSoundManager, setShowSoundManager] = useState(false);

  const [assets, setAssets] = useState<{ id: string; name: string; url: string }[]>(
    project.assets || []
  );

  useEffect(() => {
     const timeoutId = setTimeout(() => {
        const nextScenes = [...scenes];
        const activeIdx = nextScenes.findIndex(s => s.id === activeSceneId);
        if (activeIdx !== -1) {
           nextScenes[activeIdx] = { ...nextScenes[activeIdx], objects, variables };
        }
        
        const toSave = {
           ...project,
           scenes: nextScenes,
           assets: assets,
           resolutionMode: resolutionMode,
           updatedAt: Date.now()
        };
        toSave.size = JSON.stringify(toSave).length;
        saveProjectDB(toSave).catch(e => console.error(e));
     }, 1000);
     return () => clearTimeout(timeoutId);
  }, [objects, variables, scenes, assets, activeSceneId, resolutionMode, project.id, project]);

  const [showAddObjectMenu, setShowAddObjectMenu] = useState(false);
  const [showAssetSelector, setShowAssetSelector] = useState<{
    compId?: string;
    forNewObject?: boolean;
    animCompId?: string;
    animFrameIndex?: number;
  } | null>(null);

  const [graphicsQuality, setGraphicsQuality] = useState<
    "low" | "balance" | "high"
  >("balance");
  const [previewMode, setPreviewMode] = useState<"edit" | "run" | "debugrun">(
    "edit",
  );
  const [debugLogs, setDebugLogs] = useState<{type: "error" | "log", msg: string}[]>([]);
  const [runObjects, setRunObjects] = useState<RenderObject[]>([]);
  const [editingScript, setEditingScript] = useState<{
    objId: string;
    compId: string;
  } | null>(null);
  const [editingExpr, setEditingExpr] = useState<{
    objId: string;
    compId: string;
    nodeId: string;
    paramKey: string;
    expr: string;
  } | null>(null);
  const [showLocalVars, setShowLocalVars] = useState(false);
  const [confirmDeleteVar, setConfirmDeleteVar] = useState<string | null>(null);
  const [confirmDeleteLocalVar, setConfirmDeleteLocalVar] = useState<
    string | null
  >(null);
  const [showAddLocalVarMenu, setShowAddLocalVarMenu] = useState(false);
  const [scriptTab, setScriptTab] = useState<"event" | "action" | "control">(
    "event",
  );
  const [collapsedComps, setCollapsedComps] = useState<Record<string, boolean>>(
    {},
  );

  const switchScene = (newSceneId: string) => {
    if (newSceneId === activeSceneId) return;
    setScenes(prev => {
      const next = [...prev];
      const activeIdx = next.findIndex(s => s.id === activeSceneId);
      if (activeIdx !== -1) {
        next[activeIdx] = { ...next[activeIdx], objects: [...objects], variables: [...variables] };
      }
      const tgt = next.find(s => s.id === newSceneId) || next[0];
      setObjects(JSON.parse(JSON.stringify(tgt.objects || [])));
      setVariables(JSON.parse(JSON.stringify(tgt.variables || [])));
      return next;
    });
    setActiveSceneId(newSceneId);
    setSelectedId(null);
  };

  const addScene = () => {
    const newId = Date.now().toString();
    setScenes(prev => {
      const next = [...prev];
      const activeIdx = next.findIndex(s => s.id === activeSceneId);
      if (activeIdx !== -1) {
        next[activeIdx] = { ...next[activeIdx], objects: [...objects], variables: [...variables] };
      }
      const newName = `scene ${next.length + 1}`;
      const newScene = { id: newId, name: newName, objects: [], variables: [] };
      return [...next, newScene];
    });
    setObjects([]);
    setVariables([]);
    setActiveSceneId(newId);
    setSelectedId(null);
  };


  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  // Graph editor state
  const [draggingWire, setDraggingWire] = useState<{
    fromNode: string;
    fromPin: string;
    x: number;
    y: number;
  } | null>(null);
  const [snappedPin, setSnappedPin] = useState<{
    id: string;
    pin: string;
    x: number;
    y: number;
  } | null>(null);
  const [graphTrans, setGraphTrans] = useState({ x: 0, y: 0, z: 1 });
  const pinchDist = useRef(0);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingNode = useRef<string | null>(null);
  const nodeDragOffset = useRef({ x: 0, y: 0 });
  const touchTracker = useRef<
    Record<string, { lastTap: number; holdTimer: any }>
  >({});

  const runStateRef = useRef({
    globals: {} as Record<string, any>,
    globalRAM: {} as Record<string, any>,
    locals: {} as Record<string, Record<string, any>>,
    objects: [] as RenderObject[],
    velocities: [] as { id: string; vx: number; vy: number; vrot?: number }[],
    camera: { x: 0, y: 0, targetId: null as string | null, smooth: 0 },
    isStopped: false,
    runningScripts: new Set<string>(),
  });

  // Canvas Transform (Pan & Zoom)
  const [canvasT, setCanvasT] = useState({ x: 50, y: 50, z: 0.8 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialCanvasZ = useRef<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const runCanvasRef = useRef<HTMLDivElement>(null);
  const runWrapperRef = useRef<HTMLDivElement>(null);
  const [runScale, setRunScale] = useState({ x: 1, y: 1 });

  useEffect(() => {
    if (previewMode !== "edit" && runWrapperRef.current) {
      const updateScale = () => {
        if (!runWrapperRef.current) return;
        const rect = runWrapperRef.current.getBoundingClientRect();
        if (resolutionMode === "fullscreen") {
          setRunScale({ x: rect.width / 800, y: rect.height / 450 });
        } else if (resolutionMode === "fullscreen-notch") {
          // Leave some blank space on the left (e.g. 8% black bar on the left)
          // We will use flex justify-end on wrapper to align right.
          setRunScale({ x: (rect.width * 0.92) / 800, y: rect.height / 450 });
        } else {
          const s = Math.min(rect.width / 800, rect.height / 450) * 0.95;
          setRunScale({ x: s, y: s });
        }
      };
      updateScale();
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
  }, [previewMode, resolutionMode]);

  useEffect(() => {
    if (containerRef.current) {
      setCanvasT({
        x: containerRef.current.clientWidth / 2,
        y: containerRef.current.clientHeight / 2,
        z: 0.8,
      });
    }
  }, []);

  const selectedObj = objects.find((o) => o.id === selectedId);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [contextMenuCompId, setContextMenuCompId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!selectedId) {
      setTransformMode("free");
    }
  }, [selectedId]);

  const addComponent = (type: ComponentType) => {
    if (!selectedObj) return;
    const newCompId = generateId();
    let newComp: EntityComponent;

    if (type === "collision") {
      newComp = {
        type: "collision",
        id: newCompId,
        offsetX: 0,
        offsetY: 0,
        width: selectedObj.transform.sX,
        height: selectedObj.transform.sY,
      } as CollisionComponent;
    } else if (type === "rigidbody") {
      newComp = {
        type: "rigidbody",
        id: newCompId,
        gravity: 1,
        bodyType: "dynamic",
        sensorType: "solid",
      } as RigidbodyComponent;
    } else if (type === "sprite") {
      newComp = {
        type: "sprite",
        id: newCompId,
        color: selectedObj.color,
      } as SpriteComponent;
    } else if (type === "animation") {
      newComp = {
        type: "animation",
        id: newCompId,
        frames: [],
        fps: 12,
        playing: false,
        loop: true,
      } as AnimationComponent;
    } else if (type === "text") {
      newComp = {
        type: "text",
        id: newCompId,
        text: "New Text",
        fontSize: 16,
        color: "#ffffff",
        fontFamily: "Arial",
        shadow: false,
      } as TextComponent;
    } else if (type === "script") {
      newComp = {
        type: "script",
        id: newCompId,
        name: "New Script",
        nodes: [],
        wires: [],
        localVars: [],
      } as ScriptComponent;
    } else {
      newComp = { type, id: newCompId } as BaseComponent;
    }

    let newComponents = [...(selectedObj.components || []), newComp];

    // Auto-add collision if rigidbody and missing collision
    if (
      type === "rigidbody" &&
      !newComponents.some((c) => c.type === "collision")
    ) {
      newComponents.push({
        type: "collision",
        id: generateId(),
        offsetX: 0,
        offsetY: 0,
        width: selectedObj.transform.sX,
        height: selectedObj.transform.sY,
      });
    }

    updateSelectedObject({ components: newComponents });
    setShowAddMenu(false);
  };

  const updateComponent = (compId: string, updates: any) => {
    if (!selectedObj) return;
    const comps = (selectedObj.components || []).map((c) =>
      c.id === compId ? { ...c, ...updates } : c,
    );
    updateSelectedObject({ components: comps });
  };

  const deleteComponent = (compId: string) => {
    if (!selectedObj) return;
    updateSelectedObject({
      components: (selectedObj.components || []).filter((c) => c.id !== compId),
    });
    setContextMenuCompId(null);
  };

  const handleAddObjectClick = () => {
    setShowAddObjectMenu(true);
  };

  const addObject = () => {
    setShowAddObjectMenu(false);
    const color = DUMMY_COLORS[objects.length % DUMMY_COLORS.length];
    const newObj: RenderObject = {
      id: generateId(),
      name: `objek ${objects.length + 1}`,
      // Offset from exact 0,0 preview point as requested
      transform: {
        x: 50 + objects.length * 10,
        y: 50 + objects.length * 10,
        sX: 50,
        sY: 50,
        rot: 0,
      },
      color,
      components: [
        {
          type: "sprite",
          id: generateId(),
          color: color,
        } as SpriteComponent
      ],
    };
    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
  };

  const addSpriteObject = (assetUrl: string) => {
    setShowAssetSelector(null);
    const newObj: RenderObject = {
      id: generateId(),
      name: `sprite ${objects.length + 1}`,
      // Offset from exact 0,0 preview point as requested
      transform: {
        x: 50 + objects.length * 10,
        y: 50 + objects.length * 10,
        sX: 50,
        sY: 50,
        rot: 0,
      },
      color: DUMMY_COLORS[objects.length % DUMMY_COLORS.length],
      components: [
        {
          type: "sprite",
          id: generateId(),
          assetUrl: assetUrl,
        } as SpriteComponent,
      ],
    };
    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
  };

  const updateSelectedObject = (
    updates: Partial<RenderObject> | ((obj: RenderObject) => RenderObject),
  ) => {
    setObjects((prev) =>
      prev.map((o) => {
        if (o.id === selectedId) {
          return typeof updates === "function"
            ? updates(o)
            : { ...o, ...updates };
        }
        return o;
      }),
    );
  };

  const updateTransform = (tUpdates: Partial<Transform>) => {
    updateSelectedObject((obj) => ({
      ...obj,
      transform: { ...obj.transform, ...tUpdates },
    }));
  };

  const duplicateSelected = () => {
    if (!selectedObj) return;
    const newObj = {
      ...selectedObj,
      id: generateId(),
      name: `${selectedObj.name} (Copy)`,
      transform: {
        ...selectedObj.transform,
        x: selectedObj.transform.x + 20,
        y: selectedObj.transform.y + 20,
      },
    };
    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setObjects((prev) => prev.filter((o) => o.id !== selectedId));
    setSelectedId(null);
    setShowDeleteConfirm(false);
  };

  // Variables logic
  const addVariable = (type: GlobalVariableType) => {
    const newVal: any =
      type === "string" ? "New Text" : type === "number" ? 0 : false;
    const newVar: GlobalVariable = {
      id: generateId(),
      name: `var_${variables.length + 1}`,
      type,
      value: newVal,
      logToConsole: false,
    };
    setVariables([...variables, newVar]);
    setShowAddVarMenu(false);
    setIsVariablesExpanded(true);
  };

  const updateVar = (id: string, updates: Partial<GlobalVariable>) => {
    setVariables((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    );
  };

  const runNode = async (
    nodeId: string,
    objId: string,
    script: ScriptComponent,
    ctx: any,
  ) => {
    if (runStateRef.current.isStopped) return;
    const node = script.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const getNextNodes = (pin: string) => {
      return (script.wires || [])
        .filter((w) => w.fromNode === nodeId && w.fromPin === pin)
        .map((w) => w.toNode);
    };

    const runNext = async (pin: string) => {
      const nextIds = getNextNodes(pin);
      for (const nid of nextIds) {
        await runNode(nid, objId, script, ctx);
      }
    };

    try {
      switch (node.type) {
      case "action_set_var":
        try {
          const varNameStr = String(node.params.varName || "").trim();
          const val = evalExpr(
            node.params.value,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          if (varNameStr.startsWith("g.")) ctx.g[varNameStr.substring(2)] = val;
          if (varNameStr.startsWith("l.")) ctx.l[varNameStr.substring(2)] = val;
        } catch (e) {}
        await runNext("out");
        break;
      case "action_set_text":
        try {
          const textVal = evalExpr(
            node.params.text,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const currentObj = runStateRef.current.objects.find(
            (o) => o.id === objId,
          );
          if (currentObj) {
            const textComp = currentObj.components?.find((c) => c.type === "text") as TextComponent;
            if (textComp) {
              textComp.text = String(textVal);
            }
          }
        } catch (e) {}
        await runNext("out");
        break;
      case "action_get_prop":
        try {
          const getPropName = node.params.property || "x";
          const targetVarStr = String(node.params.targetVar || "").trim();
          const objP = runStateRef.current.objects.find((o) => o.id === objId);
          let valP = 0;
          if (objP) {
            if (getPropName === "x") valP = objP.transform.x;
            else if (getPropName === "y") valP = objP.transform.y;
            else if (getPropName === "sX") valP = objP.transform.sX;
            else if (getPropName === "sY") valP = objP.transform.sY;
            else if (getPropName === "rot") valP = objP.transform.rot;
          }
          if (targetVarStr.startsWith("g."))
            ctx.g[targetVarStr.substring(2)] = valP;
          else if (targetVarStr.startsWith("l."))
            ctx.l[targetVarStr.substring(2)] = valP;
        } catch (e) {}
        await runNext("out");
        break;
      case "action_set_sprite":
        const currentObjS = runStateRef.current.objects.find(
          (o) => o.id === objId,
        );
        if (currentObjS) {
          const typeStr = node.params.assetType || "image";
          const valStr = node.params.assetValue;
          const sc = currentObjS.components.find((c) => c.type === "sprite") as any;
          
          if (typeStr === "image") {
            if (sc && valStr) {
                sc.assetUrl = valStr;
            }
            // Stop animations
            currentObjS.components.forEach(c => {
               if (c.type === "animation") {
                   (c as AnimationComponent).playing = false;
               }
            });
          } else if (typeStr === "animation") {
            // Stop other animations, start this one
            currentObjS.components.forEach(c => {
               if (c.type === "animation") {
                   const anim = c as AnimationComponent & { _idx?: number, _lastTime?: number };
                   if (anim.id === valStr) {
                       anim.playing = true;
                       anim._idx = 0;
                       anim._lastTime = 0;
                   } else {
                       anim.playing = false;
                   }
               }
            });
          }
        }
        await runNext("out");
        break;
      case "action_set_opacity":
        const currentObjO = runStateRef.current.objects.find(
          (o) => o.id === objId,
        );
        if (currentObjO) {
          const nop = evalExpr(
            node.params.opacity,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          if (nop !== null) {
            let n = Number(nop);
            if (!isNaN(n)) currentObjO.transform.opacity = Math.max(0, Math.min(1, n));
            else throw new Error("Opacity must be a valid number");
          }
        }
        await runNext("out");
        break;
      case "action_transform":
        const currentObjT = runStateRef.current.objects.find(
          (o) => o.id === objId,
        );
        if (currentObjT) {
          const nx = evalExpr(
            node.params.x,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const ny = evalExpr(
            node.params.y,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const nsX = evalExpr(
            node.params.sX,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const nsY = evalExpr(
            node.params.sY,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const nr = evalExpr(
            node.params.rot,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          if (nx !== null) { let n = Number(nx); if(isNaN(n)) throw new Error("Transform X must be a valid number"); currentObjT.transform.x = n; }
          if (ny !== null) { let n = Number(ny); if(isNaN(n)) throw new Error("Transform Y must be a valid number"); currentObjT.transform.y = n; }
          if (nsX !== null) { let n = Number(nsX); if(isNaN(n)) throw new Error("Transform Scale X must be a valid number"); currentObjT.transform.sX = n; }
          if (nsY !== null) { let n = Number(nsY); if(isNaN(n)) throw new Error("Transform Scale Y must be a valid number"); currentObjT.transform.sY = n; }
          if (nr !== null) { let n = Number(nr); if(isNaN(n)) throw new Error("Transform Rotation must be a valid number"); currentObjT.transform.rot = n; }
        }
        await runNext("out");
        break;
      case "action_velocity":
        const vel = runStateRef.current.velocities.find((v) => v.id === objId);
        if (vel) {
          const nvx = evalExpr(
            node.params.vx,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const nvy = evalExpr(
            node.params.vy,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          const nvr = evalExpr(
            node.params.vrot,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
          if (nvx !== null) { let n = Number(nvx); if(isNaN(n)) throw new Error("Velocity X must be a valid number"); vel.vx = n; }
          if (nvy !== null) { let n = Number(nvy); if(isNaN(n)) throw new Error("Velocity Y must be a valid number"); vel.vy = n; }
          if (nvr !== null && nvr !== undefined) { let n = Number(nvr); if(isNaN(n)) throw new Error("Velocity Rotation must be a valid number"); (vel as any).vrot = n; }
        }
        await runNext("out");
        break;
      case "action_destroy":
        runStateRef.current.objects = runStateRef.current.objects.filter(
          (o) => o.id !== objId,
        );
        await runNext("out");
        break;
      case "action_play_sound":
        {
          const eUrl = evalExpr(node.params.soundAssetId, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId) || "";
          const eVol = evalExpr(node.params.volume, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId);
          const assetUrl = project.assets?.find((a: any) => a.id === eUrl || a.name === eUrl)?.url || eUrl;
          if (assetUrl) {
            try {
              const audio = new Audio(String(assetUrl));
              const vol = Number(eVol);
              if (!isNaN(vol)) audio.volume = Math.max(0, Math.min(1, vol));
              audio.play().catch(e => console.error("Audio block error:", e));
            } catch(e) {}
          }
        }
        await runNext("out");
        break;
      case "action_create":
        const templateObjName = node.params.objName;
        const template = objects.find((o) => o.name === templateObjName);
        if (template) {
          const clone = JSON.parse(JSON.stringify(template));
          clone.id = generateId();
          runStateRef.current.locals[clone.id] = {};
          (clone.components || []).forEach((c: any) => {
            if (c.type === "script") {
              c.localVars.forEach((lv: any) => {
                runStateRef.current.locals[clone.id][lv.name] = lv.value;
              });
            }
          });

          if (node.params.x && node.params.x !== "none") {
            const px = evalExpr(
              node.params.x,
              ctx,
              runStateRef.current.objects,
              runStateRef.current.velocities, objId);
            if (px !== null) { let n = Number(px); if(!isNaN(n)) clone.transform.x = n; else throw new Error("Create X must be a valid number"); }
          }
          if (node.params.y && node.params.y !== "none") {
            const py = evalExpr(
              node.params.y,
              ctx,
              runStateRef.current.objects,
              runStateRef.current.velocities, objId);
            if (py !== null) { let n = Number(py); if(!isNaN(n)) clone.transform.y = n; else throw new Error("Create Y must be a valid number"); }
          }

          runStateRef.current.objects.push(clone);

          let initVx = 0;
          let initVy = 0;
          if (node.params.vx && node.params.vx !== "none") {
            const vx = evalExpr(
              node.params.vx,
              ctx,
              runStateRef.current.objects,
              runStateRef.current.velocities, objId);
            if (vx !== null) { let n = Number(vx); if(!isNaN(n)) initVx = n; else throw new Error("Create Vx must be a valid number"); }
          }
          if (node.params.vy && node.params.vy !== "none") {
            const vy = evalExpr(
              node.params.vy,
              ctx,
              runStateRef.current.objects,
              runStateRef.current.velocities, objId);
            if (vy !== null) { let n = Number(vy); if(!isNaN(n)) initVy = n; else throw new Error("Create Vy must be a valid number"); }
          }

          runStateRef.current.velocities.push({
            id: clone.id,
            vx: initVx,
            vy: initVy,
          });
          executeScripts("event_load", clone.id);
        }
        await runNext("out");
        break;
      case "action_camera_follow":
        {
          const tgName =
            evalExpr(
              node.params.targetObj,
              ctx,
              runStateRef.current.objects,
              runStateRef.current.velocities, objId) || "";
          const e_smooth = evalExpr(
              node.params.smooth,
              ctx,
              runStateRef.current.objects,
              runStateRef.current.velocities, objId);
          const smooth = Number(e_smooth) || 0;
          const target = runStateRef.current.objects.find(
            (o) => o.name === tgName,
          );
          if (target) {
            runStateRef.current.camera.targetId = target.id;
            runStateRef.current.camera.smooth = smooth;
          }
        }
        await runNext("out");
        break;
      case "action_save_ram":
        {
           const key = String(evalExpr(node.params.key, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId) || "").trim();
           const val = evalExpr(node.params.value, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId);
           if (key) {
               runStateRef.current.globalRAM[key] = val;
           }
        }
        await runNext("out");
        break;
      case "action_load_ram":
        {
           const key = String(evalExpr(node.params.key, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId) || "").trim();
           const targetVarStr = String(node.params.targetVar || "").trim();
           if (key && targetVarStr) {
               const val = runStateRef.current.globalRAM[key];
               if (val !== undefined && val !== null) {
                   if (targetVarStr.startsWith("g.")) ctx.g[targetVarStr.substring(2)] = val;
                   else ctx.l[targetVarStr.substring(2)] = val;
               }
           }
        }
        await runNext("out");
        break;
      case "action_save_storage":
        {
           const key = String(evalExpr(node.params.key, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId) || "").trim();
           const val = evalExpr(node.params.value, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId);
           if (key) {
               try {
                  localStorage.setItem(`ais_game_${key}`, JSON.stringify(val));
               } catch(e) {}
           }
        }
        await runNext("out");
        break;
      case "action_load_storage":
        {
           const key = String(evalExpr(node.params.key, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId) || "").trim();
           const targetVarStr = String(node.params.targetVar || "").trim();
           if (key && targetVarStr) {
               try {
                  const saved = localStorage.getItem(`ais_game_${key}`);
                  if (saved !== null) {
                     const val = JSON.parse(saved);
                     if (targetVarStr.startsWith("g.")) ctx.g[targetVarStr.substring(2)] = val;
                     else ctx.l[targetVarStr.substring(2)] = val;
                  }
               } catch(e) {}
           }
        }
        await runNext("out");
        break;
      case "control_load_scene":
        {
           const targetSceneName = String(evalExpr(node.params.sceneName, ctx, runStateRef.current.objects, runStateRef.current.velocities, objId) || "").trim();
           // Find scene
           // Since runNode is inside GameEngineUI, it has access to scenes but scenes is a captured closure.
           // Actually, we can use a ref for scenes to get the latest easily, or use setScenes to access it.
           // However, using the UI state setter directly within an async function can be tricky.
           // But `scenes` closure here is from the render that triggered `setPreviewMode("run")`. That means it contains the `scenes` from that moment.
           // Since `previewMode` disables editing, `scenes` wouldn't change during the run!
           const tgtScene = scenes.find(s => s.name === targetSceneName || s.name.trim() === targetSceneName.trim());
           if (tgtScene) {
               // Schedule the scene change via a state update to trigger UI re-render, 
               // but wait, we are currently inside the game loop where `evalExpr` runs!
               // Updating state might be asynchronous and break things unless we update `runStateRef` immediately natively.
               
               // First update React UI state:
               setActiveSceneId(tgtScene.id);
               setObjects(JSON.parse(JSON.stringify(tgtScene.objects || [])));
               setVariables(JSON.parse(JSON.stringify(tgtScene.variables || [])));
               
               // Second update the immediate run state:
               const nextGlobals = Object.fromEntries((tgtScene.variables || []).map((v) => {
                 let val: any = v.value;
                 if (typeof val === "string") {
                   if (val === "true") val = true;
                   else if (val === "false") val = false;
                   else if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
                 }
                 return [v.name, val];
               }));
               
               const nextObjects = JSON.parse(JSON.stringify(tgtScene.objects || [])) as RenderObject[];
               const nextLocals: Record<string, Record<string, any>> = {};
               
               nextObjects.forEach((obj) => {
                 nextLocals[obj.id] = {};
                 (obj.components || []).forEach((comp) => {
                   if (comp.type === "script") {
                     (comp as ScriptComponent).localVars.forEach((v) => {
                       let val: any = v.value;
                       if (typeof val === "string") {
                         if (val === "true") val = true;
                         else if (val === "false") val = false;
                         else if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
                       }
                       nextLocals[obj.id][v.name] = val;
                     });
                   }
                 });
               });

               runStateRef.current.globals = nextGlobals;
               runStateRef.current.locals = nextLocals;
               runStateRef.current.objects = nextObjects;
               runStateRef.current.velocities = nextObjects.map((o) => ({ id: o.id, vx: 0, vy: 0 }));
               runStateRef.current.camera = { x: 0, y: 0, targetId: null, smooth: 0 };
               runStateRef.current.runningScripts.clear();
               // We DELIBERATELY don't touch runStateRef.current.globalRAM and runStateRef.current.isStopped
               
               // End this node's execution by not calling runNext. 
               // This stops the current script from continuing under the old scene state.
               setRunObjects([...nextObjects]);
               setTimeout(() => {
                 if (!runStateRef.current.isStopped) {
                   executeScripts("event_load");
                 }
               }, 10);
               return; 
           } else {
             throw new Error(`Scene '${targetSceneName}' not found`);
           }
        }
        await runNext("out");
        break;
      case "control_wait":
        const e_t = evalExpr(
            node.params.time,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId);
        const t = Number(e_t) || 0;
        await new Promise((r) => setTimeout(r, t * 1000));
        await runNext("out");
        break;
      case "control_if_var":
        if (
          evalExpr(
            node.params.condition,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId)
        ) {
          await runNext("true");
        } else {
          await runNext("false");
        }
        break;
      case "control_if_col":
        let isColliding = false;
        const targetNameStr = node.params.targetName;
        const objA = runStateRef.current.objects.find((o) => o.id === objId);
        if (objA) {
          const collA = objA.components?.find(
            (c) => c.type === "collision",
          ) as CollisionComponent;
          if (collA) {
            const others = runStateRef.current.objects.filter(
              (o) => o.name === targetNameStr && o.id !== objId,
            );
            for (const objB of others) {
              const collB = objB.components?.find(
                (c) => c.type === "collision",
              ) as CollisionComponent;
              if (collB) {
                const leftA =
                  objA.transform.x + collA.offsetX - collA.width / 2;
                const rightA =
                  objA.transform.x + collA.offsetX + collA.width / 2;
                const topA =
                  objA.transform.y + collA.offsetY - collA.height / 2;
                const bottomA =
                  objA.transform.y + collA.offsetY + collA.height / 2;
                const leftB =
                  objB.transform.x + collB.offsetX - collB.width / 2;
                const rightB =
                  objB.transform.x + collB.offsetX + collB.width / 2;
                const topB =
                  objB.transform.y + collB.offsetY - collB.height / 2;
                const bottomB =
                  objB.transform.y + collB.offsetY + collB.height / 2;
                if (
                  leftA <= rightB &&
                  rightA >= leftB &&
                  topA <= bottomB &&
                  bottomA >= topB
                ) {
                  isColliding = true;
                  break;
                }
              }
            }
          }
        }
        if (isColliding) {
          await runNext("true");
        } else {
          await runNext("false");
        }
        break;
      case "control_repeat":
        const timesVal =
          evalExpr(
            node.params.times,
            ctx,
            runStateRef.current.objects,
            runStateRef.current.velocities, objId) || 0;
        const times = Math.floor(Number(timesVal) || 0);
        for (let i = 0; i < times; i++) {
          if (runStateRef.current.isStopped) break;
          await runNext("loop");
          // yield to allow other scripts and UI if large loop
          if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        await runNext("out");
        break;
      }
    } catch (err: any) {
      setDebugLogs(prev => {
        const msg = `Logic Error [Obj ${objId.slice(0, 4)}]: ${err.message || String(err)}`;
        if (prev.slice(-5).some(l => l.msg === msg)) {
          return prev;
        }
        return [...prev, {type: "error" as const, msg}].slice(-50);
      });
      // Safety recovery: continue execution if possible even after error
      try {
        if (BLOCK_DEFS[node.type]?.outPins.includes("out")) {
           await runNext("out");
        } else if (BLOCK_DEFS[node.type]?.outPins.includes("false_out")) {
           await runNext("false_out");
        }
      } catch (safeErr) {
        // ignore errors during safety recovery
      }
    }
  };

  const executeScripts = (
    eventType: BlockType,
    targetObjId?: string,
    condition?: (node: ScriptNode) => boolean,
  ) => {
    runStateRef.current.objects.forEach((obj) => {
      if (targetObjId && obj.id !== targetObjId) return;
      const scripts =
        (obj.components?.filter(
          (c) => c.type === "script",
        ) as ScriptComponent[]) || [];
      scripts.forEach((script) => {
        const eventNodes = (script.nodes || []).filter(
          (n) => n.type === eventType && (!condition || condition(n)),
        );
        const ctx = {
          g: runStateRef.current.globals,
          l: runStateRef.current.locals[obj.id] || {},
        };
        eventNodes.forEach((en) => {
          const scriptKey = `${obj.id}_${en.id}`;
          if (runStateRef.current.runningScripts.has(scriptKey)) return;
          runStateRef.current.runningScripts.add(scriptKey);

          const getNextNodes = (pin: string) => {
            return (script.wires || [])
              .filter((w) => w.fromNode === en.id && w.fromPin === pin)
              .map((w) => w.toNode);
          };
          const nextIds = getNextNodes("out");

          (async () => {
            for (const nid of nextIds) {
              if (runStateRef.current.isStopped) break;
              await runNode(nid, obj.id, script, ctx);
            }
          })()
            .catch((err) => {
              setDebugLogs(prev => {
                const msg = `Runtime Error [Obj ${obj.id.slice(0, 4)}]: ${err.message || String(err)}`;
                if (prev.slice(-5).some(l => l.msg === msg)) {
                  return prev;
                }
                return [...prev, {type: "error" as const, msg}].slice(-50);
              });
            })
            .finally(() => {
              runStateRef.current.runningScripts.delete(scriptKey);
            });
        });
      });
    });
  };

  const updateTouchGlobals = (e: React.PointerEvent, prefix: "touchdown" | "touchmove" | "touchup") => {
    if (runCanvasRef.current) {
      const rect = runCanvasRef.current.getBoundingClientRect();
      const actualScaleX = rect.width / 800;
      const actualScaleY = rect.height / 450;
      let x = (e.clientX - rect.left) / actualScaleX;
      let y = (e.clientY - rect.top) / actualScaleY;
      const cam = runStateRef.current.camera;
      x = x - 400 + cam.x;
      y = y - 225 + cam.y;
      
      runStateRef.current.globals[`${prefix}_x`] = x;
      runStateRef.current.globals[`${prefix}_y`] = y;
      
      if (prefix === "touchdown") {
        runStateRef.current.globals['last_touch_x'] = x;
        runStateRef.current.globals['last_touch_y'] = y;
      } else if (prefix === "touchmove") {
        runStateRef.current.globals['touchdelta_x'] = x - (runStateRef.current.globals['last_touch_x'] ?? x);
        runStateRef.current.globals['touchdelta_y'] = y - (runStateRef.current.globals['last_touch_y'] ?? y);
        runStateRef.current.globals['last_touch_x'] = x;
        runStateRef.current.globals['last_touch_y'] = y;
      }
    }
  };

  const handleRun = async (mode: "run" | "debugrun") => {
    // Sync current editing state before running
    setScenes(prev => {
      const next = [...prev];
      const activeIdx = next.findIndex(s => s.id === activeSceneId);
      if (activeIdx !== -1) {
        next[activeIdx] = { ...next[activeIdx], objects: [...objects], variables: [...variables] };
      }
      return next;
    });

    setDebugLogs([]);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if ("orientation" in screen && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock("landscape");
      }
    } catch (e) {
      console.warn("Fullscreen/Orientation lock failed");
    }

    runStateRef.current = {
      globals: Object.fromEntries(variables.map((v) => {
        let val: any = v.value;
        if (typeof val === "string") {
          if (val === "true") val = true;
          else if (val === "false") val = false;
          else if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
        }
        return [v.name, val];
      })),
      globalRAM: runStateRef.current.globalRAM || {},
      locals: {},
      objects: JSON.parse(JSON.stringify(objects)),
      velocities: objects.map((o) => ({ id: o.id, vx: 0, vy: 0 })),
      camera: { x: 0, y: 0, targetId: null, smooth: 0 },
      isStopped: false,
      runningScripts: new Set<string>(),
    };

    runStateRef.current.objects.forEach((obj) => {
      runStateRef.current.locals[obj.id] = {};
      (obj.components || []).forEach((comp) => {
        if (comp.type === "script") {
          (comp as ScriptComponent).localVars.forEach((v) => {
            let val: any = v.value;
            if (typeof val === "string") {
              if (val === "true") val = true;
              else if (val === "false") val = false;
              else if (!isNaN(Number(val)) && val.trim() !== "") val = Number(val);
            }
            runStateRef.current.locals[obj.id][v.name] = val;
          });
        }
      });
    });

    setPreviewMode(mode);
    setRunObjects([...runStateRef.current.objects]);
    setSelectedId(null);

    setTimeout(() => {
      executeScripts("event_run");
      executeScripts("event_load");
    }, 10);
  };

  const handleStopRun = async () => {
    runStateRef.current.isStopped = true;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      if ("orientation" in screen && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) {}
    setPreviewMode("edit");
  };

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (e) {
      console.warn("Fullscreen toggle failed", e);
    }
  };

  // Physics loop
  useEffect(() => {
    if (previewMode !== "edit") {
      let lastTime = performance.now();
      let lastFrameTime = performance.now();
      let frameId: number;

      const tick = (time: number) => {
        if (runStateRef.current.isStopped) return;

        if (graphicsQuality === "low") {
          if (time - lastFrameTime < 33) {
            frameId = requestAnimationFrame(tick);
            return;
          }
        }
        lastFrameTime = time;

        const dt = Math.min((time - lastTime) / 1000, 0.1); // max dt to prevent huge jumps
        lastTime = time;

        try {
          const currentObjects = runStateRef.current.objects;
          const velocities = runStateRef.current.velocities;

          const nextObjects = currentObjects.map((obj) => {
            // Process Animations
            const anims = obj.components?.filter((c) => c.type === "animation") as (AnimationComponent & { _lastTime?: number, _idx?: number })[];
            if (anims && anims.length > 0) {
              anims.forEach(anim => {
                if (anim.playing && anim.frames && anim.frames.length > 0 && anim.fps > 0) {
                    const now = time;
                    if (!anim._lastTime) {
                        anim._lastTime = now;
                        anim._idx = 0;
                    }
                    const delay = 1000 / anim.fps;
                    if (now - anim._lastTime >= delay) {
                        anim._idx = ((anim._idx || 0) + 1);
                        if (anim._idx >= anim.frames.length) {
                            if (anim.loop) anim._idx = 0;
                            else {
                                anim._idx = anim.frames.length - 1;
                                anim.playing = false;
                            }
                        }
                        anim._lastTime = now;
                        
                        // Also apply it to Sprite component if any
                        const sprite = obj.components?.find(c => c.type === "sprite") as any;
                        if (sprite) {
                            sprite.assetUrl = anim.frames[anim._idx];
                        }
                    }
                }
              });
            }

            const rb = obj.components?.find(
              (c) => c.type === "rigidbody",
            ) as RigidbodyComponent;
            if (rb && rb.bodyType === "dynamic") {
              const vel = velocities.find((v) => v.id === obj.id);
              if (vel) {
                // Apply gravity
                vel.vy += rb.gravity * 200 * dt;
                return {
                  ...obj,
                  transform: {
                    ...obj.transform,
                    x: obj.transform.x + vel.vx * dt,
                    y: obj.transform.y + vel.vy * dt,
                    rot: obj.transform.rot + ((vel as any).vrot || 0) * dt,
                  },
                };
              }
            }
            return obj;
          });

          // Simple AABB Collision resolution
          for (let i = 0; i < nextObjects.length; i++) {
            const objA = nextObjects[i];
            const rbA = objA.components?.find(
              (c) => c.type === "rigidbody",
            ) as RigidbodyComponent;
            const collA = objA.components?.find(
              (c) => c.type === "collision",
            ) as CollisionComponent;

            if (
              !rbA ||
              rbA.bodyType !== "dynamic" ||
              !collA ||
              rbA.sensorType === "none"
            )
              continue;

            for (let j = 0; j < nextObjects.length; j++) {
              if (i === j) continue;
              const objB = nextObjects[j];
              const collB = objB.components?.find(
                (c) => c.type === "collision",
              ) as CollisionComponent;
              if (!collB) continue;

              const rbB = objB.components?.find(
                (c) => c.type === "rigidbody",
              ) as RigidbodyComponent;
              if (rbB && rbB.sensorType === "none") continue;

              const isSensor =
                rbA.sensorType === "sensor" ||
                (rbB && rbB.sensorType === "sensor");
              if (isSensor) continue; // Sensors don't physically block

              const leftA = objA.transform.x + collA.offsetX - collA.width / 2;
              const rightA = objA.transform.x + collA.offsetX + collA.width / 2;
              const topA = objA.transform.y + collA.offsetY - collA.height / 2;
              const bottomA = objA.transform.y + collA.offsetY + collA.height / 2;

              const leftB = objB.transform.x + collB.offsetX - collB.width / 2;
              const rightB = objB.transform.x + collB.offsetX + collB.width / 2;
              const topB = objB.transform.y + collB.offsetY - collB.height / 2;
              const bottomB = objB.transform.y + collB.offsetY + collB.height / 2;

              if (
                leftA < rightB &&
                rightA > leftB &&
                topA < bottomB &&
                bottomA > topB
              ) {
                const velA = velocities.find((v) => v.id === objA.id);
                if (velA && velA.vy > 0 && topA < topB && bottomA > topB) {
                  velA.vy = 0;
                  objA.transform.y = topB - collA.offsetY - collA.height / 2;
                }
              }
            }
          }

          if (runStateRef.current.camera.targetId) {
            const targetObj = nextObjects.find(
              (o) => o.id === runStateRef.current.camera.targetId,
            );
            if (targetObj) {
              const cam = runStateRef.current.camera;
              if (cam.smooth > 0) {
                const factor =
                  1.0 - Math.pow(0.5, dt * Math.max(1, 11 - cam.smooth) * 2);
                cam.x += (targetObj.transform.x - cam.x) * factor;
                cam.y += (targetObj.transform.y - cam.y) * factor;
              } else {
                cam.x = targetObj.transform.x;
                cam.y = targetObj.transform.y;
              }
            }
          }

          runStateRef.current.objects = nextObjects;
          setRunObjects([...nextObjects]);

          if (!runStateRef.current.isStopped) {
            executeScripts("event_tick");
          }
        } catch (err: any) {
          setDebugLogs(prev => {
             const msg = `Engine Error: ${err.message || String(err)}`;
             if (prev.slice(-5).some(l => l.msg === msg)) return prev;
             return [...prev, {type: "error" as const, msg}].slice(-50);
          });
        }

        frameId = requestAnimationFrame(tick);
      };

      frameId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frameId);
    }
  }, [previewMode]);

  // Canvas Pan & Zoom Logic
  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Disable pan & zoom if in pos/scale/rotate mode to prioritize gizmos/transforming
    if (transformMode !== "free") return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const getDistance = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (transformMode !== "free") return;
    if (!pointers.current.has(e.pointerId)) return;

    const prevEntry = pointers.current.get(e.pointerId)!;
    const newEntry = { x: e.clientX, y: e.clientY };

    pointers.current.set(e.pointerId, newEntry);

    if (pointers.current.size === 2) {
      // Pinch to Zoom & Pan
      const pts = Array.from(pointers.current.values());
      const dist = getDistance(pts[0], pts[1]);

      const centerX = (pts[0].x + pts[1].x) / 2;
      const centerY = (pts[0].y + pts[1].y) / 2;

      if (initialPinchDist.current === null) {
        initialPinchDist.current = dist;
        initialCanvasZ.current = canvasT.z;
      } else {
        const scaleChange = dist / initialPinchDist.current;
        const newZ = Math.min(
          Math.max(0.1, initialCanvasZ.current * scaleChange),
          5,
        );
        setCanvasT((prev) => ({ ...prev, z: newZ }));
        // Note: Full center-based zoom panning is omitted for simplicity, basic zoom added.
      }
    } else if (pointers.current.size === 1) {
      // Pan
      const deltaX = newEntry.x - prevEntry.x;
      const deltaY = newEntry.y - prevEntry.y;
      setCanvasT((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    }
  };

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      initialPinchDist.current = null;
    }
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (transformMode !== "free") return;
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasT((prev) => ({
      ...prev,
      z: Math.min(Math.max(0.1, prev.z * scaleFactor), 5),
    }));
  };

  // Object Dragging Logic
  const isDraggingCanvasObj = useRef(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const dragStartTransform = useRef<Transform | null>(null);

  const handleObjPointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    id: string,
  ) => {
    // Game engine logic: Clicking an object selects it (and keeps it selected if already selected)
    setSelectedId(id);

    if (
      transformMode === "pos" ||
      transformMode === "scale" ||
      transformMode === "rotate"
    ) {
      e.stopPropagation();
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        isDraggingCanvasObj.current = true;
        dragStartTransform.current = { ...obj.transform };
        if (transformMode === "pos") {
          // Accounting for zoom when calculating object drag offset
          dragStartOffset.current = {
            x: e.clientX / canvasT.z - obj.transform.x,
            y: e.clientY / canvasT.z - obj.transform.y,
          };
        } else {
          dragStartOffset.current = {
            x: e.clientX,
            y: e.clientY,
          };
        }
      }
    }
  };

  const handleObjPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      isDraggingCanvasObj.current &&
      dragStartTransform.current &&
      (e.target as HTMLElement).hasPointerCapture(e.pointerId)
    ) {
      if (transformMode === "pos") {
        const st = dragStartTransform.current as any;
        if (st._axis) {
          const dx = (e.clientX - dragStartOffset.current.x) / canvasT.z;
          const dy = (e.clientY - dragStartOffset.current.y) / canvasT.z;
          const angle = st.rot * Math.PI / 180;
          
          const localDx = dx * Math.cos(angle) + dy * Math.sin(angle);
          const localDy = -dx * Math.sin(angle) + dy * Math.cos(angle);

          if (st._axis === "x") {
             updateTransform({
                x: st.x + localDx * Math.cos(angle),
                y: st.y + localDx * Math.sin(angle)
             });
          } else {
             updateTransform({
                x: st.x - localDy * Math.sin(angle),
                y: st.y + localDy * Math.cos(angle)
             });
          }
        } else {
          updateTransform({
            x: e.clientX / canvasT.z - dragStartOffset.current.x,
            y: e.clientY / canvasT.z - dragStartOffset.current.y,
          });
        }
      } else if (transformMode === "scale") {
        const st = dragStartTransform.current as any;
        if (st._scaleAxis) {
          const dx = (e.clientX - dragStartOffset.current.x) / canvasT.z;
          const dy = (e.clientY - dragStartOffset.current.y) / canvasT.z;
          const angle = st.rot * Math.PI / 180;
          
          const localDx = dx * Math.cos(angle) + dy * Math.sin(angle);
          const localDy = -dx * Math.sin(angle) + dy * Math.cos(angle);

          if (st._scaleAxis === "x") {
            updateTransform({ sX: Math.max(1, st.sX + localDx * 2) });
          } else {
            updateTransform({ sY: Math.max(1, st.sY + localDy * 2) });
          }
        } else if (st._scaleCorner) {
          const scrDx = (e.clientX - dragStartOffset.current.x) / canvasT.z;
          const scrDy = (e.clientY - dragStartOffset.current.y) / canvasT.z;

          const rad = (-st.rot * Math.PI) / 180;
          const ldx = scrDx * Math.cos(rad) - scrDy * Math.sin(rad);
          const ldy = scrDx * Math.sin(rad) + scrDy * Math.cos(rad);

          const signX =
            st._scaleCorner === "br" || st._scaleCorner === "tr" ? 1 : -1;
          const signY =
            st._scaleCorner === "br" || st._scaleCorner === "bl" ? 1 : -1;

          const newW = Math.max(1, st.sX + ldx * signX);
          const newH = Math.max(1, st.sY + ldy * signY);

          const eff_ldx = (newW - st.sX) * signX;
          const eff_ldy = (newH - st.sY) * signY;

          const dcx = eff_ldx / 2;
          const dcy = eff_ldy / 2;

          const radPos = (st.rot * Math.PI) / 180;
          const wdx = dcx * Math.cos(radPos) - dcy * Math.sin(radPos);
          const wdy = dcx * Math.sin(radPos) + dcy * Math.cos(radPos);

          updateTransform({
            x: st.x + wdx,
            y: st.y + wdy,
            sX: newW,
            sY: newH,
          });
        }
      } else if (transformMode === "rotate") {
        const st = dragStartTransform.current as any;
        if (st._rotStartCenter) {
          const cx = st._rotStartCenter.x;
          const cy = st._rotStartCenter.y;
          const oAng = Math.atan2(
            dragStartOffset.current.y - cy,
            dragStartOffset.current.x - cx,
          );
          const nAng = Math.atan2(e.clientY - cy, e.clientX - cx);
          const diff = (nAng - oAng) * (180 / Math.PI);
          updateTransform({
            rot: st.rot + diff,
          });
        }
      }
    }
  };

  const handleObjPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDraggingCanvasObj.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      isDraggingCanvasObj.current = false;
      dragStartTransform.current = null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#1e1e1e] text-[#cccccc] font-sans selection:bg-[#2c5d87] overflow-hidden text-[11px]">
      {previewMode === "edit" && (
        <div className="h-8 bg-[#282828] border-b border-[#1a1a1a] flex items-center justify-between px-4 shrink-0 shadow-sm z-30 touch-none relative">
          <div className="flex items-center">
            <button
               onClick={() => {
                  setScenes(prev => {
                    const next = [...prev];
                    const activeIdx = next.findIndex(s => s.id === activeSceneId);
                    if (activeIdx !== -1) {
                      next[activeIdx] = { ...next[activeIdx], objects, variables };
                    }
                    onBack({ ...project, scenes: next, assets });
                    return next;
                  });
               }}
               className="mr-3 p-1.5 bg-[#333] hover:bg-[#444] rounded text-white transition-colors flex items-center shadow-sm"
               title="Back to Home & Save"
            >
               <ChevronLeft size={14} /> Back
            </button>
            <div className="flex space-x-2 items-center">
              <button
                onClick={() => setShowSettings(true)}
                className="text-[#888] hover:text-[#fff] p-1"
                title="Settings"
              >
                <Settings size={12} />
              </button>
              <button
                onClick={toggleFullScreen}
                className="text-[#888] hover:text-[#fff] p-1"
                title="Toggle Fullscreen"
              >
                <Maximize size={12} />
              </button>
              <div className="w-3 h-3 rounded-full bg-red-500/80 ml-2"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="font-bold text-[#aaaaaa] ml-4 text-xs">
              {project.name || "Mobile 2D Engine"}
            </div>
          </div>

          <div className="absolute left-[50%] translate-x-[-50%] flex items-center">
            <div className="relative group">
              <button
                className="flex items-center justify-center space-x-2 px-3 py-1 rounded bg-[#1e1e1e] hover:bg-[#333] border border-[#333] min-w-[120px]"
                onClick={() => setShowScenesMenu(!showScenesMenu)}
              >
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-xs text-[#aaa] font-bold truncate max-w-[150px]">
                  {scenes.find((s) => s.id === activeSceneId)?.name}
                </span>
                <ChevronDown size={14} className="text-[#888]" />
              </button>
              
              {showScenesMenu && (
                <>
                  <div className="fixed inset-0 z-40" onPointerDown={() => { setShowScenesMenu(false); setSceneMenuId(null); setEditingSceneId(null); setConfirmDeleteId(null); }}></div>
                  <div className="absolute top-full left-[50%] -translate-x-1/2 mt-1 min-w-[200px] bg-[#1e1e1e] border border-[#333] rounded shadow-2xl z-50 py-1">
                    <div className="px-3 py-2 flex items-center justify-between border-b border-[#333] mb-1">
                      <span className="text-[10px] text-[#888] uppercase tracking-wider font-bold">Scenes</span>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addScene(); }} className="text-[#aaa] hover:text-white p-2 -mr-2 bg-[#2a2a2a] rounded cursor-pointer" title="Add Scene">
                        <Plus size={14} />
                      </button>
                    </div>
                    {scenes.map(s => (
                       <div 
                         key={s.id} 
                         className={`relative flex items-center px-1 py-1 ${activeSceneId === s.id ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'}`}
                         onPointerDown={(e) => {
                            if (editingSceneId !== s.id) {
                               sceneHoldTimeoutRef.current = setTimeout(() => {
                                  setSceneMenuId(s.id);
                               }, 400); // 400ms for hold
                            }
                         }}
                         onPointerUp={() => {
                            if (sceneHoldTimeoutRef.current) clearTimeout(sceneHoldTimeoutRef.current);
                         }}
                         onPointerLeave={() => {
                            if (sceneHoldTimeoutRef.current) clearTimeout(sceneHoldTimeoutRef.current);
                         }}
                         onPointerCancel={() => {
                            if (sceneHoldTimeoutRef.current) clearTimeout(sceneHoldTimeoutRef.current);
                         }}
                       >
                          {activeSceneId === s.id && <div className="w-1 h-3 bg-blue-400 rounded-full mr-2"></div>}
                          {editingSceneId === s.id ? (
                            <input
                               className="bg-[#111] outline-none border border-blue-400 text-xs text-[#fff] w-full px-2 py-1 rounded"
                               value={s.name}
                               onChange={(e) => {
                                 setScenes(prev => prev.map(sc => sc.id === s.id ? { ...sc, name: e.target.value } : sc));
                               }}
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') {
                                    setEditingSceneId(null);
                                 }
                               }}
                               autoFocus
                               onBlur={() => setEditingSceneId(null)}
                               onClick={(e) => e.stopPropagation()}
                               onPointerDown={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div 
                               className="text-xs text-[#ccc] w-full px-1 py-1 cursor-pointer select-none"
                               onClick={(e) => {
                                  if (activeSceneId !== s.id) {
                                     switchScene(s.id);
                                     setShowScenesMenu(false);
                                  }
                               }}
                            >
                               {s.name}
                            </div>
                          )}
                          
                          {sceneMenuId === s.id && (
                             <div className="absolute top-0 right-0 mt-8 mr-2 w-32 bg-[#222] border border-[#444] rounded shadow-xl z-50 py-1" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                                <button
                                   className="w-full text-left px-3 py-2 text-xs hover:bg-[#333] text-[#ddd] flex items-center space-x-2"
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingSceneId(s.id);
                                      setSceneMenuId(null);
                                   }}
                                >
                                   <Pencil size={14} /> <span>Rename</span>
                                </button>
                                {scenes.length > 1 && (
                                   confirmDeleteId === s.id ? (
                                      <button
                                         className="w-full text-left px-3 py-2 text-xs bg-red-600 hover:bg-red-500 text-white flex items-center space-x-2 border-t border-[#444] mt-1 pt-1"
                                         onClick={(e) => {
                                            e.stopPropagation();
                                            setScenes(prev => prev.filter(sc => sc.id !== s.id));
                                            if (activeSceneId === s.id) {
                                               switchScene(scenes.find(sc => sc.id !== s.id)!.id);
                                            }
                                            setSceneMenuId(null);
                                            setConfirmDeleteId(null);
                                         }}
                                      >
                                         <Trash2 size={14} /> <span>Confirm?</span>
                                      </button>
                                   ) : (
                                      <button
                                         className="w-full text-left px-3 py-2 text-xs hover:bg-red-500 hover:text-white text-red-500 flex items-center space-x-2 border-t border-[#444] mt-1 pt-1"
                                         onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(s.id);
                                         }}
                                      >
                                         <Trash2 size={14} /> <span>Delete</span>
                                      </button>
                                   )
                                )}
                             </div>
                          )}
                       </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex space-x-2 items-center">
            <div className="flex space-x-1 mr-4 bg-[#1e1e1e] p-0.5 rounded">
              <button
                onClick={() => handleRun("run")}
                className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center space-x-1 transition-colors hover:bg-[#333] text-[#aaa]"
                title="Run Preview"
              >
                <Play size={10} fill="currentColor" />
                <span>RUN</span>
              </button>
              <button
                onClick={() => handleRun("debugrun")}
                className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center space-x-1 transition-colors hover:bg-[#333] text-[#aaa]"
                title="Run with Debug Console"
              >
                <Bug size={10} />
                <span>DEBUG RUN</span>
              </button>
            </div>

            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="p-1 px-3 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[10px] font-semibold rounded text-[#e0e0e0] border border-[#1a1a1a] active:scale-95 transition-transform"
            >
              {isPanelOpen ? "Hide Panel" : "Show Panel"}
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {previewMode !== "edit" && (
          <button
            onClick={handleStopRun}
            className="absolute top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded shadow-2xl flex items-center justify-center border-2 border-white/20 active:scale-95 text-xs font-bold uppercase tracking-widest gap-2"
          >
            <Square size={14} fill="currentColor" /> STOP RUN
          </button>
        )}

        {/* Canvas Area */}
        {previewMode === "edit" ? (
          <div
            className="flex-1 relative bg-[#383838] overflow-hidden cursor-grab active:cursor-grabbing touch-none"
            ref={containerRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onWheel={handleCanvasWheel}
          >
            {/* Zoom & Pan Container */}
            <div
              className="absolute origin-top-left"
              style={{
                transform: `translate(${canvasT.x}px, ${canvasT.y}px) scale(${canvasT.z})`,
              }}
            >
              {/* Grid & Axis Previews */}
              {/* Main Axis Lines representing 0,0 */}
              <div className="absolute left-[0px] top-[-5000px] w-px h-[10000px] bg-red-500/80 pointer-events-none" />
              <div className="absolute top-[0px] left-[-5000px] h-px w-[10000px] bg-green-500/80 pointer-events-none" />
              <div className="absolute left-2 top-2 text-[10px] font-mono text-white/50 pointer-events-none font-bold">
                X:0, Y:0
              </div>

              {/* Camera Preview Border (centered at 0,0) */}
              <div
                className="absolute border-2 border-white/30 pointer-events-none shadow-[0_0_20px_rgba(0,0,0,0.5)] z-0 flex items-center justify-center backdrop-brightness-110"
                style={{
                  left: -400,
                  top: -225,
                  width: 800,
                  height: 450,
                }}
              >
                {/* Center indicator mapping to (0,0) */}
                <div className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm" />
                <div className="absolute bottom-1 right-1 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                  Preview Camera
                </div>
              </div>

              {/* Grid background effect pattern (100x100 blocks) */}
              {editorGrid && (
                <div
                  className="absolute inset-[-2000px] pointer-events-none opacity-10"
                  style={{
                    backgroundImage:
                      "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                    backgroundSize: "50px 50px",
                    backgroundPosition: "center center",
                  }}
                />
              )}

              {/* Render Objects */}
              {objects.map((obj) => {
                const spriteComp = obj.components?.find(
                  (c) => c.type === "sprite",
                ) as SpriteComponent;
                const textComp = obj.components?.find(
                  (c) => c.type === "text",
                ) as TextComponent;
                const bgColor = spriteComp ? (spriteComp.assetUrl && !spriteComp.stretch ? "transparent" : spriteComp.color) : "transparent";
                return (
                  <div
                    key={obj.id}
                    onPointerDown={(e) => handleObjPointerDown(e, obj.id)}
                    onPointerMove={handleObjPointerMove}
                    onPointerUp={handleObjPointerUp}
                    onPointerCancel={handleObjPointerUp}
                    className={cn(
                      "absolute flex items-center justify-center font-bold text-white/50 select-none shadow-sm touch-none",
                      transformMode === "free" || transformMode === "pos"
                        ? "cursor-move"
                        : "cursor-pointer",
                      selectedId === obj.id
                        ? "ring-2 ring-[#4a90e2] ring-offset-1 ring-offset-[#383838] z-10"
                        : "z-0 hover:ring-1 hover:ring-white/30",
                      !spriteComp && !textComp ? "border border-dashed border-white/20" : ""
                    )}
                    style={{
                      left: (typeof obj.transform.x === 'number' && !isNaN(obj.transform.x) && isFinite(obj.transform.x)) ? obj.transform.x : 0,
                      top: (typeof obj.transform.y === 'number' && !isNaN(obj.transform.y) && isFinite(obj.transform.y)) ? obj.transform.y : 0,
                      width: Math.abs((typeof obj.transform.sX === 'number' && !isNaN(obj.transform.sX) && isFinite(obj.transform.sX)) ? obj.transform.sX : 0),
                      height: Math.abs((typeof obj.transform.sY === 'number' && !isNaN(obj.transform.sY) && isFinite(obj.transform.sY)) ? obj.transform.sY : 0),
                      marginLeft: -Math.abs((typeof obj.transform.sX === 'number' && !isNaN(obj.transform.sX) && isFinite(obj.transform.sX)) ? obj.transform.sX : 0) / 2,
                      marginTop: -Math.abs((typeof obj.transform.sY === 'number' && !isNaN(obj.transform.sY) && isFinite(obj.transform.sY)) ? obj.transform.sY : 0) / 2,
                      transform: `scale(${obj.transform.sX < 0 ? -1 : 1}, ${obj.transform.sY < 0 ? -1 : 1}) rotate(${(typeof obj.transform.rot === 'number' && !isNaN(obj.transform.rot) && isFinite(obj.transform.rot)) ? obj.transform.rot : 0}deg)`,
                      transformOrigin: "50% 50%",
                      backgroundColor: bgColor, opacity: (typeof obj.transform.opacity === 'number' && !isNaN(obj.transform.opacity) && isFinite(obj.transform.opacity)) ? obj.transform.opacity : 1,
                    }}
                  >
                    {/* Visual for the sprite */}
                    {spriteComp && spriteComp.assetUrl ? (
                      <img
                        src={spriteComp.assetUrl}
                        alt={obj.name}
                        className={`w-full h-full pointer-events-none ${spriteComp.stretch ? 'object-fill' : 'object-contain'}`}
                      />
                    ) : (
                      obj.transform.sX > 20 &&
                      obj.transform.sY > 20 && !textComp && (
                        <span className="truncate px-1 text-[9px] mix-blend-overlay pointer-events-none">
                          {obj.name}
                        </span>
                      )
                    )}

                    {textComp && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
                           color: textComp.color,
                           fontSize: textComp.fontSize,
                           fontFamily: textComp.fontFamily || 'sans-serif',
                           textShadow: textComp.shadow ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none', WebkitTextStroke: textComp.outlineWidth ? `${textComp.outlineWidth}px ${textComp.outlineColor || '#000'}` : undefined,
                           textAlign: 'center',
                           wordBreak: 'break-word',
                           whiteSpace: 'pre-wrap',
                           transform: `scale(${obj.transform.sX < 0 ? -1 : 1}, ${obj.transform.sY < 0 ? -1 : 1})`,
                       }}>
                         {textComp.text}
                       </div>
                    )}

                    {/* Collision Visual */}
                    {selectedId === obj.id &&
                      (() => {
                        const coll = obj.components?.find(
                          (c) => c.type === "collision",
                        ) as CollisionComponent;
                        if (coll) {
                          return (
                            <div
                              className="absolute border-[2px] border-blue-400 pointer-events-none z-20"
                              style={{
                                left: "50%",
                                top: "50%",
                                width: coll.width,
                                height: coll.height,
                                marginLeft: -coll.width / 2 + coll.offsetX,
                                marginTop: -coll.height / 2 + coll.offsetY,
                              }}
                            />
                          );
                        }
                        return null;
                      })()}

                    {/* Visual Gizmos */}
                    {selectedId === obj.id && transformMode === "pos" && (
                      useGizmo ? (
                        <>
                          <div
                            className="absolute w-20 h-4 bg-red-500/80 hover:bg-red-500 top-1/2 left-1/2 -mt-2 cursor-ew-resize pointer-events-auto rounded-r z-20 flex items-center justify-end pr-1"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              (e.target as HTMLElement).setPointerCapture(e.pointerId);
                              isDraggingCanvasObj.current = true;
                              dragStartTransform.current = { ...obj.transform, _axis: "x" } as any;
                              dragStartOffset.current = { x: e.clientX, y: e.clientY };
                            }}
                          ><div className="w-0 h-0 border-[5px] border-transparent border-l-white"></div></div>
                          <div
                            className="absolute w-4 h-20 bg-green-500/80 hover:bg-green-500 top-1/2 left-1/2 -ml-2 cursor-ns-resize pointer-events-auto rounded-b z-20 flex items-end justify-center pb-1"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              (e.target as HTMLElement).setPointerCapture(e.pointerId);
                              isDraggingCanvasObj.current = true;
                              dragStartTransform.current = { ...obj.transform, _axis: "y" } as any;
                              dragStartOffset.current = { x: e.clientX, y: e.clientY };
                            }}
                          ><div className="w-0 h-0 border-[5px] border-transparent border-t-white"></div></div>
                        </>
                      ) : (
                        <div className="absolute w-4 h-4 rounded-full bg-blue-500 top-1/2 left-1/2 -ml-2 -mt-2 opacity-50 pointer-events-none animate-pulse"></div>
                      )
                    )}
                    {selectedId === obj.id && transformMode === "scale" && (
                      useGizmo ? (
                        <>
                          {/* Scale X Axis Box */}
                          <div
                            className="absolute w-20 h-4 bg-red-500/80 hover:bg-red-500 top-1/2 left-1/2 -mt-2 cursor-ew-resize pointer-events-auto rounded-r z-20 flex items-center justify-end pr-1"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              isDraggingCanvasObj.current = true;
                              dragStartTransform.current = {
                                ...obj.transform,
                                _scaleAxis: "x",
                              } as any;
                              dragStartOffset.current = {
                                x: e.clientX,
                                y: e.clientY,
                              };
                              (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            }}
                          >
                            <div className="w-3 h-3 bg-white border border-red-800 pointer-events-none rounded-sm"></div>
                          </div>
                          {/* Scale Y Axis Box */}
                          <div
                            className="absolute w-4 h-20 bg-green-500/80 hover:bg-green-500 top-1/2 left-1/2 -ml-2 cursor-ns-resize pointer-events-auto rounded-b z-20 flex items-end justify-center pb-1"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              isDraggingCanvasObj.current = true;
                              dragStartTransform.current = {
                                ...obj.transform,
                                _scaleAxis: "y",
                              } as any;
                              dragStartOffset.current = {
                                x: e.clientX,
                                y: e.clientY,
                              };
                              (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            }}
                          >
                            <div className="w-3 h-3 bg-white border border-green-800 pointer-events-none rounded-sm"></div>
                          </div>
                        </>
                      ) : (
                      <>
                        <div
                          className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-400 border border-black rounded-sm pointer-events-auto cursor-nwse-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            isDraggingCanvasObj.current = true;
                            dragStartTransform.current = {
                              ...obj.transform,
                              _scaleCorner: "tl",
                            } as any;
                            dragStartOffset.current = {
                              x: e.clientX,
                              y: e.clientY,
                            };
                            (e.target as HTMLElement).setPointerCapture(
                              e.pointerId,
                            );
                          }}
                        ></div>
                        <div
                          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-400 border border-black rounded-sm pointer-events-auto cursor-nesw-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            isDraggingCanvasObj.current = true;
                            dragStartTransform.current = {
                              ...obj.transform,
                              _scaleCorner: "tr",
                            } as any;
                            dragStartOffset.current = {
                              x: e.clientX,
                              y: e.clientY,
                            };
                            (e.target as HTMLElement).setPointerCapture(
                              e.pointerId,
                            );
                          }}
                        ></div>
                        <div
                          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-400 border border-black rounded-sm pointer-events-auto cursor-nesw-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            isDraggingCanvasObj.current = true;
                            dragStartTransform.current = {
                              ...obj.transform,
                              _scaleCorner: "bl",
                            } as any;
                            dragStartOffset.current = {
                              x: e.clientX,
                              y: e.clientY,
                            };
                            (e.target as HTMLElement).setPointerCapture(
                              e.pointerId,
                            );
                          }}
                        ></div>
                        <div
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-400 border border-black rounded-sm pointer-events-auto cursor-nwse-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            isDraggingCanvasObj.current = true;
                            dragStartTransform.current = {
                              ...obj.transform,
                              _scaleCorner: "br",
                            } as any;
                            dragStartOffset.current = {
                              x: e.clientX,
                              y: e.clientY,
                            };
                            (e.target as HTMLElement).setPointerCapture(
                              e.pointerId,
                            );
                          }}
                        ></div>
                      </>
                      )
                    )}
                    {selectedId === obj.id && transformMode === "rotate" && (
                      <>
                        <div
                          className="absolute -top-10 left-1/2 -ml-2 w-4 h-4 bg-green-400 border border-black rounded-full pointer-events-auto cursor-grab active:cursor-grabbing"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (containerRef.current) {
                              const rect =
                                containerRef.current.getBoundingClientRect();
                              isDraggingCanvasObj.current = true;
                              dragStartTransform.current = {
                                ...obj.transform,
                                _rotStartCenter: {
                                  x:
                                    rect.left +
                                    canvasT.x +
                                    obj.transform.x * canvasT.z,
                                  y:
                                    rect.top +
                                    canvasT.y +
                                    obj.transform.y * canvasT.z,
                                },
                              } as any;
                              dragStartOffset.current = {
                                x: e.clientX,
                                y: e.clientY,
                              };
                              (e.target as HTMLElement).setPointerCapture(
                                e.pointerId,
                              );
                            }
                          }}
                        ></div>
                        <div className="absolute -top-6 left-1/2 -ml-[0.5px] w-[1px] h-6 bg-green-400/50 pointer-events-none"></div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Floating Transform UI + Draggable inputs context */}
            <div
              className="absolute top-4 left-4 bg-[#282828]/95 backdrop-blur-sm border border-[#1a1a1a] p-1.5 rounded-lg flex flex-col space-y-1.5 shadow-xl z-20 touch-none"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col space-y-1">
                <div className="flex space-x-0.5 justify-between bg-[#1e1e1e] rounded p-0.5">
                  <button
                    className={cn(
                      "p-1.5 rounded",
                      transformMode === "free"
                        ? "bg-[#4a90e2]/20 text-[#4a90e2]"
                        : "hover:bg-[#3a3a3a] text-[#888]",
                    )}
                    onClick={() => setTransformMode("free")}
                    title="Free Select"
                  >
                    <MousePointer2 size={14} />
                  </button>
                  <button
                    className={cn(
                      "p-1.5 rounded",
                      transformMode === "pos"
                        ? "bg-[#4a90e2]/20 text-[#4a90e2]"
                        : !selectedId
                          ? "opacity-50 cursor-not-allowed text-[#555]"
                          : "hover:bg-[#3a3a3a] text-[#888]",
                    )}
                    onClick={() => selectedId && setTransformMode("pos")}
                    title="Position"
                  >
                    <Move size={14} />
                  </button>
                  <button
                    className={cn(
                      "p-1.5 rounded",
                      transformMode === "scale"
                        ? "bg-[#4a90e2]/20 text-[#4a90e2]"
                        : !selectedId
                          ? "opacity-50 cursor-not-allowed text-[#555]"
                          : "hover:bg-[#3a3a3a] text-[#888]",
                    )}
                    onClick={() => selectedId && setTransformMode("scale")}
                    title="Scale"
                  >
                    <Maximize size={14} />
                  </button>
                  <button
                    className={cn(
                      "p-1.5 rounded",
                      transformMode === "rotate"
                        ? "bg-[#4a90e2]/20 text-[#4a90e2]"
                        : !selectedId
                          ? "opacity-50 cursor-not-allowed text-[#555]"
                          : "hover:bg-[#3a3a3a] text-[#888]",
                    )}
                    onClick={() => selectedId && setTransformMode("rotate")}
                    title="Rotate"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <div className="w-[1px] bg-[#333] my-1 mx-1"></div>
                  <button
                    className={cn(
                      "p-1.5 rounded",
                      useGizmo
                        ? "bg-[#b5e24a]/20 text-[#b5e24a]"
                        : "hover:bg-[#3a3a3a] text-[#888]",
                    )}
                    onClick={() => setUseGizmo(!useGizmo)}
                    title="Toggle Mod Arrows (Gizmos)"
                  >
                    <Crosshair size={14} />
                  </button>
                </div>

                {/* Contextual Draggable UI based on tool */}
                {selectedObj && (
                  <div className="pt-1 px-0.5 flex flex-col space-y-1 w-32 border-b border-[#3a3a3a] pb-1.5">
                    {transformMode === "pos" && (
                      <>
                        <DraggableNumber
                          label="X"
                          value={selectedObj.transform.x}
                          onChange={(v) => updateTransform({ x: v })}
                          step={1}
                          bg="bg-[#1e1e1e]"
                          border="border-[#3a3a3a]"
                        />
                        <DraggableNumber
                          label="Y"
                          value={selectedObj.transform.y}
                          onChange={(v) => updateTransform({ y: v })}
                          step={1}
                          bg="bg-[#1e1e1e]"
                          border="border-[#3a3a3a]"
                        />
                      </>
                    )}
                    {transformMode === "scale" && (
                      <>
                        <DraggableNumber
                          label="W"
                          value={selectedObj.transform.sX}
                          onChange={(v) => updateTransform({ sX: v })}
                          step={1}
                          bg="bg-[#1e1e1e]"
                          border="border-[#3a3a3a]"
                        />
                        <DraggableNumber
                          label="H"
                          value={selectedObj.transform.sY}
                          onChange={(v) => updateTransform({ sY: v })}
                          step={1}
                          bg="bg-[#1e1e1e]"
                          border="border-[#3a3a3a]"
                        />
                      </>
                    )}
                    {(transformMode === "rotate" ||
                      transformMode === "free") && (
                      <DraggableNumber
                        label="R"
                        value={selectedObj.transform.rot}
                        onChange={(v) => updateTransform({ rot: v })}
                        step={1}
                        bg="bg-[#1e1e1e]"
                        border="border-[#3a3a3a]"
                      />
                    )}
                  </div>
                )}
              </div>

              {selectedObj && (
                <div className="flex justify-between px-1 pb-0.5">
                  <button
                    className="p-1 px-2 rounded hover:bg-[#3a3a3a] text-[#888] hover:text-[#e0e0e0] flex items-center space-x-1"
                    onClick={duplicateSelected}
                    title="Duplicate"
                  >
                    <Copy size={12} /> <span className="text-[9px]">Dup</span>
                  </button>
                  <button
                    className="p-1 px-2 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 relative flex items-center space-x-1"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Delete"
                  >
                    <Trash2 size={12} /> <span className="text-[9px]">Del</span>
                  </button>
                </div>
              )}
            </div>

            {/* Delete Confirmation Modal Overlay inside Canvas */}
            {showDeleteConfirm && (
              <div
                className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center p-4 touch-none"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="bg-[#282828] border border-[#1a1a1a] rounded-lg shadow-2xl p-4 w-full max-w-[240px]">
                  <h3 className="text-[13px] font-bold text-white mb-2">
                    Padam Objek?
                  </h3>
                  <p className="text-[#888] mb-4">
                    Adakah anda pasti mahu memadam '{selectedObj?.name}'?
                  </p>
                  <div className="flex space-x-2 justify-end">
                    <button
                      className="px-3 py-1.5 rounded bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white font-medium text-xs"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Batal
                    </button>
                    <button
                      className="px-3 py-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white font-medium flex items-center text-xs"
                      onClick={deleteSelected}
                    >
                      <Check size={14} className="mr-1" /> Padam
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Canvas View Info */}
            <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white/30 pointer-events-none">
              Zoom: {Math.round(canvasT.z * 100)}%
            </div>
          </div>
        ) : (
          <div
            ref={runWrapperRef}
            className={cn(
               "flex-1 relative bg-black flex items-center overflow-hidden touch-none select-none",
               resolutionMode === "fullscreen-notch" ? "justify-end" : "justify-center"
            )}
            onPointerDown={(e) => {
              updateTouchGlobals(e, "touchdown");
              executeScripts("event_screen_touch", undefined, (n) => n.params.touchType === "down" || n.params.touchType === "tap" || n.params.touchType === "none" || !n.params.touchType);
            }}
            onPointerMove={(e) => {
              updateTouchGlobals(e, "touchmove");
              executeScripts("event_screen_touch", undefined, (n) => n.params.touchType === "move");
            }}
            onPointerUp={(e) => {
              updateTouchGlobals(e, "touchup");
              executeScripts("event_screen_touch", undefined, (n) => n.params.touchType === "up");
            }}
            onPointerCancel={(e) => {
              executeScripts("event_screen_touch", undefined, (n) => n.params.touchType === "up");
            }}
          >
            {/* The exact 800x450 preview container, centered and scaled to fit the window */}
            <div
              ref={runCanvasRef}
              className="relative bg-[#383838] shadow-2xl overflow-hidden"
              style={{
                width: 800,
                height: 450,
                transform: `scale(${runScale.x}, ${runScale.y})`,
                transformOrigin: "center center"
              }}
            >
              {runObjects.map((obj) => {
                const spriteComp = obj.components?.find(
                  (c) => c.type === "sprite",
                ) as SpriteComponent;
                const textComp = obj.components?.find(
                  (c) => c.type === "text",
                ) as TextComponent;
                const bgColor = spriteComp ? (spriteComp.assetUrl && !spriteComp.stretch ? "transparent" : spriteComp.color) : "transparent";
                const cam = runStateRef.current.camera;
                return (
                  <div
                    key={obj.id}
                    className="absolute flex items-center justify-center select-none touch-none"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      updateTouchGlobals(e, "touchdown");
                      executeScripts(
                        "event_screen_touch",
                        undefined,
                        (n) => n.params.touchType === "down" || n.params.touchType === "tap" || n.params.touchType === "none" || !n.params.touchType
                      );

                      executeScripts(
                        "event_obj_touch",
                        obj.id,
                        (n) => n.params.touchType === "down" || n.params.touchType === "tap" || n.params.touchType === "none" || !n.params.touchType,
                      );
                    }}
                    onPointerMove={(e) => {
                      e.stopPropagation();
                      updateTouchGlobals(e, "touchmove");
                      executeScripts(
                        "event_screen_touch",
                        undefined,
                        (n) => n.params.touchType === "move"
                      );
                      executeScripts(
                        "event_obj_touch",
                        obj.id,
                        (n) => n.params.touchType === "move",
                      );
                    }}
                    onPointerUp={(e) => {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                      updateTouchGlobals(e, "touchup");
                      executeScripts(
                        "event_screen_touch",
                        undefined,
                        (n) => n.params.touchType === "up"
                      );
                      executeScripts(
                        "event_obj_touch",
                        obj.id,
                        (n) => n.params.touchType === "up",
                      );
                    }}
                    onPointerOut={(e) => {
                    }}
                    onPointerCancel={(e) => {
                      executeScripts(
                        "event_screen_touch",
                        undefined,
                        (n) => n.params.touchType === "up"
                      );
                      executeScripts(
                        "event_obj_touch",
                        obj.id,
                        (n) => n.params.touchType === "up",
                      );
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }}
                    style={{
                      left: 400 + ((typeof obj.transform.x === 'number' && !isNaN(obj.transform.x) && isFinite(obj.transform.x)) ? obj.transform.x : 0) - cam.x,
                      top: 225 + ((typeof obj.transform.y === 'number' && !isNaN(obj.transform.y) && isFinite(obj.transform.y)) ? obj.transform.y : 0) - cam.y,
                      width: Math.abs((typeof obj.transform.sX === 'number' && !isNaN(obj.transform.sX) && isFinite(obj.transform.sX)) ? obj.transform.sX : 0),
                      height: Math.abs((typeof obj.transform.sY === 'number' && !isNaN(obj.transform.sY) && isFinite(obj.transform.sY)) ? obj.transform.sY : 0),
                      marginLeft: -Math.abs((typeof obj.transform.sX === 'number' && !isNaN(obj.transform.sX) && isFinite(obj.transform.sX)) ? obj.transform.sX : 0) / 2,
                      marginTop: -Math.abs((typeof obj.transform.sY === 'number' && !isNaN(obj.transform.sY) && isFinite(obj.transform.sY)) ? obj.transform.sY : 0) / 2,
                      transform: `scale(${obj.transform.sX < 0 ? -1 : 1}, ${obj.transform.sY < 0 ? -1 : 1}) rotate(${(typeof obj.transform.rot === 'number' && !isNaN(obj.transform.rot) && isFinite(obj.transform.rot)) ? obj.transform.rot : 0}deg)`,
                      transformOrigin: "50% 50%",
                      backgroundColor: bgColor,
                    }}
                  >
                    {/* Invisible Touch Bounds based on Collision if available */}
                    {(() => {
                      const coll = obj.components?.find((c) => c.type === "collision") as CollisionComponent;
                      if (coll) {
                        return (
                          <div
                            className="absolute pointer-events-auto"
                            style={{
                                left: "50%",
                                top: "50%",
                                width: coll.width,
                                height: coll.height,
                                marginLeft: -coll.width / 2 + coll.offsetX,
                                marginTop: -coll.height / 2 + coll.offsetY,
                            }}
                          />
                        );
                      }
                      return <div className="absolute inset-0 pointer-events-auto" />;
                    })()}

                    {spriteComp && spriteComp.assetUrl && (
                      <img
                        src={spriteComp.assetUrl}
                        alt={obj.name}
                        className={`w-full h-full pointer-events-none ${spriteComp.stretch ? 'object-fill' : 'object-contain'}`}
                      />
                    )}
                    
                    {textComp && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
                           color: textComp.color,
                           fontSize: textComp.fontSize,
                           fontFamily: textComp.fontFamily || 'sans-serif',
                           textShadow: textComp.shadow ? '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' : 'none',
                           textAlign: 'center',
                           wordBreak: 'break-word',
                           whiteSpace: 'pre-wrap',
                           transform: `scale(${obj.transform.sX < 0 ? -1 : 1}, ${obj.transform.sY < 0 ? -1 : 1})`,
                       }}>
                         {textComp.text}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
            {previewMode === "debugrun" && (
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-black/80 border-t border-white/20 p-2 font-mono text-[10px] text-green-400 overflow-y-auto">
                <div className="text-white/50 mb-1 border-b border-white/10 pb-1 flex justify-between">
                  <span>DEBUG CONSOLE</span>
                  <button onClick={() => setDebugLogs([])} className="hover:text-white">CLEAR</button>
                </div>
                {debugLogs.map((log, i) => (
                    <div key={i} className={log.type === 'error' ? "text-red-400 font-bold" : ""}>
                        &gt; {log.msg}
                    </div>
                ))}
                {variables
                  .filter((v) => v.logToConsole)
                  .map((v) => (
                    <div key={v.id}>
                      &gt; {v.name} : {String(runStateRef.current.globals[v.name] ?? v.value)}
                    </div>
                  ))}
                {objects.map(obj => {
                    const localVarsToLog = (obj.components || [])
                       .filter(c => c.type === 'script')
                       .flatMap(c => (c as ScriptComponent).localVars || [])
                       .filter(v => v.logToConsole);
                    if (localVarsToLog.length === 0) return null;
                    return (
                        <div key={`locallog-${obj.id}`}>
                           <div className="text-white/30 text-[9px] mt-1">- {obj.name} -</div>
                           {localVarsToLog.map(v => (
                               <div key={v.id}>
                                  &gt; l.{v.name} : {String(runStateRef.current.locals[obj.id]?.[v.name] ?? v.value)}
                               </div>
                           ))}
                        </div>
                    );
                })}
              </div>
            )}
          </div>
        )}

        {/* Right Panel (Responsive Width) */}
        {previewMode === "edit" && isPanelOpen && (
          <div
            className="flex flex-col bg-[#282828] border-l border-[#1a1a1a] w-[200px] sm:w-56 shrink-0 z-20 h-full overflow-hidden touch-none"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Tabs for Top Half */}
            <div className="flex border-b border-[#1a1a1a] bg-[#222] shrink-0">
              <button
                onClick={() => setBottomPanelTab("assets")}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1",
                  bottomPanelTab === "assets"
                    ? "text-[#e0e0e0] border-b-2 border-[#4a90e2] bg-[#282828]"
                    : "text-[#888] hover:bg-[#2a2a2a]",
                )}
              >
                <Box size={12} />
                <span>Assets</span>
              </button>
              <button
                onClick={() => setBottomPanelTab("variables")}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1",
                  bottomPanelTab === "variables"
                    ? "text-[#e0e0e0] border-b-2 border-[#4a90e2] bg-[#282828]"
                    : "text-[#888] hover:bg-[#2a2a2a]",
                )}
              >
                <Database size={12} />
                <span>Variables</span>
              </button>
            </div>

            {/* Assets Section (Top Half) */}
            {bottomPanelTab === "assets" && (
              <div className="flex flex-col max-h-[35%] shrink-0 border-b border-[#1a1a1a]">
                <div className="bg-[#282828] p-2 px-3 border-b border-[#1a1a1a] flex items-center justify-between shadow-sm shrink-0">
                  <div className="flex items-center space-x-2 font-semibold text-[#aaa] text-[9px] uppercase tracking-widest">
                    <span>Scene Objects</span>
                  </div>
                  <div className="relative flex space-x-1">
                    <button
                      onClick={handleAddObjectClick}
                      className="p-1 px-2 bg-[#4a90e2]/10 hover:bg-[#4a90e2]/20 text-[#4a90e2] rounded text-[10px] uppercase font-bold tracking-wider active:scale-95 transition-transform"
                    >
                      <Plus size={12} className="inline mr-1" /> Add
                    </button>
                    <button
                      onClick={() => setShowSoundManager(true)}
                      className="p-1 px-2 bg-[#b5e24a]/10 hover:bg-[#b5e24a]/20 text-[#b5e24a] rounded text-[10px] uppercase font-bold tracking-wider active:scale-95 transition-transform"
                    >
                      <Music size={12} className="inline mr-1" /> Sounds
                    </button>
                    {showAddObjectMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowAddObjectMenu(false)} />
                        <div className="absolute right-0 top-full mt-1 w-32 bg-[#282828] border border-[#1a1a1a] shadow-xl rounded z-50 py-1 overflow-hidden">
                          <button
                            onClick={() => addObject()}
                            className="w-full text-left px-3 py-2 text-xs text-[#e0e0e0] hover:bg-[#3a3a3a] transition-colors"
                          >
                            Add Cube
                          </button>
                          <button
                            onClick={() => {
                              setShowAddObjectMenu(false);
                              setShowAssetSelector({ forNewObject: true });
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-[#e0e0e0] hover:bg-[#3a3a3a] transition-colors"
                          >
                            Add Sprite
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#3a3a3a]">
                  <div className="flex flex-wrap gap-2">
                    {objects.map((obj) => (
                      <div
                        key={obj.id}
                        onClick={() => setSelectedId(obj.id)}
                        onDoubleClick={() => setSelectedId(null)}
                        className={cn(
                          "flex flex-col items-center p-2 rounded cursor-pointer transition-colors w-[68px] sm:w-[72px]",
                          selectedId === obj.id
                            ? "bg-[#3a3a3a] border border-[#4a90e2] shadow-sm"
                            : "bg-[#2a2a2a] border border-[#1a1a1a] hover:bg-[#333]",
                        )}
                      >
                        <div
                          className="w-8 h-8 rounded mb-1 shadow-inner flex flex-shrink-0 items-center justify-center mix-blend-screen"
                          style={{ backgroundColor: obj.color }}
                        >
                          <ImageIcon size={14} className="text-white/40" />
                        </div>
                        <div className="text-[9px] text-center w-full truncate px-0.5 text-[#aaa]">
                          {obj.name}
                        </div>
                      </div>
                    ))}
                    {objects.length === 0 && (
                      <div className="w-full py-8 text-center text-[#666] flex flex-col items-center justify-center">
                        <ImageIcon size={24} className="mb-2 opacity-20" />
                        <p className="text-[10px]">Tiada sprite.</p>
                        <button
                          onClick={handleAddObjectClick}
                          className="mt-2 text-[#4a90e2] text-[10px] underline"
                        >
                          Add Object
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {bottomPanelTab === "variables" && (
              <div className="flex flex-col max-h-[35%] shrink-0 border-b border-[#1a1a1a]">
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#3a3a3a]">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <button
                      onClick={() =>
                        setIsVariablesExpanded(!isVariablesExpanded)
                      }
                      className="flex items-center space-x-1 text-[#aaa] hover:text-[#fff]"
                    >
                      <ChevronDown
                        size={14}
                        className={cn(
                          "transition-transform",
                          isVariablesExpanded ? "" : "-rotate-90",
                        )}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Global Locals
                      </span>
                    </button>
                    {/* Dropdown to add variable */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAddVarMenu(!showAddVarMenu)}
                        className="text-[9px] bg-[#3a3a3a] hover:bg-[#4a4a4a] px-1.5 py-1 uppercase rounded text-[#e0e0e0] tracking-wider font-bold"
                      >
                        + Add Var
                      </button>
                      {showAddVarMenu && (
                        <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowAddVarMenu(false)} />
                        <div className="absolute top-full right-0 mt-1 w-24 bg-[#282828] border border-[#1a1a1a] rounded shadow-xl z-50 py-1">
                          {["number", "string", "boolean"].map((type) => (
                            <button
                              key={type}
                              onClick={() =>
                                addVariable(type as GlobalVariableType)
                              }
                              className="w-full text-left px-3 py-1.5 text-xs text-[#e0e0e0] hover:bg-[#3a3a3a] capitalize"
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        </>
                      )}
                    </div>
                  </div>

                  {isVariablesExpanded && (
                    <div className="space-y-2 px-1">
                      {variables.map((v) => (
                        <div
                          key={v.id}
                          className="flex flex-col bg-[#222] border border-[#1a1a1a] rounded p-1.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex space-x-1 items-center flex-1 mr-2">
                              <span className="text-[9px] uppercase text-[#666] font-bold w-[24px] text-center">
                                {v.type === "string"
                                  ? "txt"
                                  : v.type === "number"
                                    ? "num"
                                    : "bol"}
                              </span>
                              <input
                                value={v.name}
                                onKeyDown={handleInputKeyDown}
                                onChange={(e) =>
                                  updateVar(v.id, { name: e.target.value })
                                }
                                className="bg-transparent border-b border-[#3a3a3a] outline-none text-[#e0e0e0] text-xs w-full pb-0.5 focus:border-[#4a90e2]"
                                placeholder="Var Name"
                              />
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() =>
                                  updateVar(v.id, {
                                    logToConsole: !v.logToConsole,
                                  })
                                }
                                className={cn(
                                  "p-1.5 text-[9px] rounded font-bold tracking-wider uppercase flex items-center justify-center shrink-0 transition-colors",
                                  v.logToConsole
                                    ? "bg-[#4a90e2]/20 text-[#4a90e2]"
                                    : "hover:bg-[#333] text-[#666]",
                                )}
                                title={v.logToConsole ? "Log: ON" : "Log: OFF"}
                              >
                                <Terminal size={12} />
                              </button>
                              {confirmDeleteVar === v.id ? (
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => {
                                      setVariables((prev) =>
                                        prev.filter((x) => x.id !== v.id),
                                      );
                                      setConfirmDeleteVar(null);
                                    }}
                                    className="bg-red-500 text-white px-1 text-[9px] rounded"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteVar(null)}
                                    className="bg-[#555] text-white px-1 text-[9px] rounded"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteVar(v.id)}
                                  className="p-1 rounded hover:bg-red-500/20 text-red-500/70 hover:text-red-400"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center pl-[28px]">
                            {v.type === "number" && (
                              <input
                                type="number"
                                value={v.value}
                                onKeyDown={handleInputKeyDown}
                                onChange={(e) =>
                                  updateVar(v.id, {
                                    value: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 outline-none text-[#e0e0e0] text-xs font-mono"
                              />
                            )}
                            {v.type === "string" && (
                              <input
                                type="text"
                                value={v.value}
                                onKeyDown={handleInputKeyDown}
                                onChange={(e) =>
                                  updateVar(v.id, { value: e.target.value })
                                }
                                className="w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 outline-none text-[#e0e0e0] text-xs font-mono"
                              />
                            )}
                            {v.type === "boolean" && (
                              <button
                                onClick={() =>
                                  updateVar(v.id, { value: !v.value })
                                }
                                className={cn(
                                  "px-2 py-1 rounded text-xs w-full text-left font-mono font-bold tracking-wider",
                                  v.value
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                    : "bg-red-500/10 text-red-400 border border-red-500/20",
                                )}
                              >
                                {v.value ? "TRUE" : "FALSE"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {variables.length === 0 && (
                        <div className="text-center py-4 text-[#555] text-[10px]">
                          No variables yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Properties Section (Bottom Half) */}
            <div className="flex flex-col flex-1 min-h-0 bg-[#282828]">
              <div className="bg-[#222222] p-2 px-3 border-b border-[#1a1a1a] flex items-center justify-between font-semibold text-[#888] shadow-sm relative">
                <div className="flex items-center space-x-2">
                  <Settings2 size={14} />
                  <span>Properties</span>
                </div>
                {selectedObj && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddMenu(!showAddMenu);
                      }}
                      className="bg-[#4a90e2] hover:bg-[#357abd] text-white p-1 rounded border border-[#1a1a1a] text-[9px] uppercase tracking-widest font-bold px-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
                    >
                      + Add Component
                    </button>
                    {showAddMenu && (
                      <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                      <div className="absolute top-full right-0 mt-1 w-32 bg-[#282828] border border-[#1a1a1a] rounded shadow-xl z-50 py-1">
                        {["rigidbody", "sprite", "animation", "text", "collision", "script"].map(
                          (type) => (
                            <button
                              key={type}
                              onClick={(e) => {
                                e.stopPropagation();
                                addComponent(type as ComponentType);
                                setShowAddMenu(false);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#e0e0e0] hover:bg-[#3a3a3a] capitalize"
                            >
                              {type}
                            </button>
                          ),
                        )}
                      </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-[#3a3a3a]">
                {selectedObj ? (
                  <div className="space-y-2.5">
                    {/* Name Property */}
                    <div className="flex flex-col space-y-0.5">
                      <div
                        className="flex items-center cursor-pointer select-none group"
                        onClick={() =>
                          setCollapsedComps((prev) => ({
                            ...prev,
                            _name: !prev._name,
                          }))
                        }
                      >
                        <ChevronDown
                          size={12}
                          className={cn(
                            "text-[#888] mr-1 transition-transform group-hover:text-white",
                            collapsedComps._name ? "-rotate-90" : "",
                          )}
                        />
                        <label className="text-[#888] font-bold uppercase tracking-wider text-[9px] cursor-pointer group-hover:text-white">
                          Name
                        </label>
                      </div>
                      {!collapsedComps._name && (
                        <input
                          type="text"
                          value={selectedObj.name}
                          onKeyDown={handleInputKeyDown}
                          onChange={(e) =>
                            updateSelectedObject({ name: e.target.value })
                          }
                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 focus:border-[#4a90e2] outline-none text-[#e0e0e0] w-full text-xs mt-1"
                        />
                      )}
                    </div>

                    <div className="h-px bg-[#1a1a1a] my-1.5" />

                    <div>
                      <div
                        className="flex items-center mb-1 cursor-pointer select-none group"
                        onClick={() =>
                          setCollapsedComps((prev) => ({
                            ...prev,
                            _transform: !prev._transform,
                          }))
                        }
                      >
                        <ChevronDown
                          size={12}
                          className={cn(
                            "text-[#888] mr-1 transition-transform group-hover:text-white",
                            collapsedComps._transform ? "-rotate-90" : "",
                          )}
                        />
                        <label className="text-[#888] font-bold uppercase tracking-wider text-[9px] cursor-pointer group-hover:text-white block">
                          Transform
                        </label>
                      </div>

                      {!collapsedComps._transform && (
                        <div className="pl-0 mt-1">
                          {/* Position */}
                          <div className="flex space-x-2 mb-1">
                            <DraggableNumber
                              label="X"
                              value={selectedObj.transform.x}
                              onChange={(v) => updateTransform({ x: v })}
                              step={1}
                            />
                            <DraggableNumber
                              label="Y"
                              value={selectedObj.transform.y}
                              onChange={(v) => updateTransform({ y: v })}
                              step={1}
                            />
                          </div>

                          {/* Scale */}
                          <div className="flex space-x-2 mb-1">
                            <DraggableNumber
                              label="W"
                              value={selectedObj.transform.sX}
                              onChange={(v) => updateTransform({ sX: v })}
                              step={1}
                            />
                            <DraggableNumber
                              label="H"
                              value={selectedObj.transform.sY}
                              onChange={(v) => updateTransform({ sY: v })}
                              step={1}
                            />
                          </div>

                          {/* Rotation and Opacity */}
                          <div className="flex space-x-2">
                            <DraggableNumber
                              label="R"
                              value={selectedObj.transform.rot}
                              onChange={(v) => updateTransform({ rot: v })}
                              step={1}
                            />
                            <DraggableNumber
                              label="O"
                              value={selectedObj.transform.opacity ?? 1}
                              onChange={(v) => updateTransform({ opacity: Math.max(0, Math.min(1, v)) })}
                              step={0.1}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-[#1a1a1a] my-2" />

                    {/* Components section */}
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[#888] font-bold uppercase tracking-wider text-[9px] ml-0.5">
                        Components
                      </label>
                    </div>

                    {/* RENDER COMPONENTS */}
                    <div className="flex flex-col space-y-2 pb-10">
                      {selectedObj.components &&
                        selectedObj.components.map((comp) => {
                          // Count duplicates
                          const isDuplicate =
                            selectedObj.components.filter(
                              (c) => c.type === comp.type,
                            ).length > 1;

                          return (
                            <div
                              key={comp.id}
                              className="bg-[#222222] border border-[#1a1a1a] rounded p-2 relative"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenuCompId(comp.id);
                              }}
                            >
                              <div
                                className="flex justify-between items-center mb-1 cursor-pointer select-none"
                                onClick={() =>
                                  setCollapsedComps((prev) => ({
                                    ...prev,
                                    [comp.id]: !prev[comp.id],
                                  }))
                                }
                              >
                                <span className="text-[#aaa] hover:text-[#fff] font-bold uppercase tracking-wider text-[9px] capitalize flex items-center transition-colors">
                                  <ChevronDown
                                    size={12}
                                    className={cn(
                                      "inline mr-1 transition-transform",
                                      collapsedComps[comp.id]
                                        ? "-rotate-90"
                                        : "",
                                    )}
                                  />
                                  {comp.type}
                                  {isDuplicate && (
                                    <span className="text-red-500 ml-2 lowercase normal-case text-[8px]">
                                      (preview mungkin tak work)
                                    </span>
                                  )}
                                </span>
                              </div>

                              {!collapsedComps[comp.id] && (
                                <>
                                  {/* Collision properties */}
                                  {comp.type === "collision" && (
                                    <div className="space-y-2 mt-2">
                                      <div className="flex justify-end mb-1">
                                        <button
                                          onClick={() =>
                                            updateComponent(comp.id, {
                                              offsetX: 0,
                                              offsetY: 0,
                                              width: selectedObj.transform.sX,
                                              height: selectedObj.transform.sY,
                                            })
                                          }
                                          className="text-[9px] bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#888] px-1.5 py-0.5 rounded"
                                        >
                                          Auto scale pos
                                        </button>
                                      </div>
                                      <div className="flex space-x-2">
                                        <DraggableNumber
                                          label="x"
                                          value={
                                            (comp as CollisionComponent).offsetX
                                          }
                                          onChange={(v) =>
                                            updateComponent(comp.id, {
                                              offsetX: v,
                                            })
                                          }
                                          step={1}
                                        />
                                        <DraggableNumber
                                          label="y"
                                          value={
                                            (comp as CollisionComponent).offsetY
                                          }
                                          onChange={(v) =>
                                            updateComponent(comp.id, {
                                              offsetY: v,
                                            })
                                          }
                                          step={1}
                                        />
                                      </div>
                                      <div className="flex space-x-2">
                                        <DraggableNumber
                                          label="w"
                                          value={
                                            (comp as CollisionComponent).width
                                          }
                                          onChange={(v) =>
                                            updateComponent(comp.id, {
                                              width: v,
                                            })
                                          }
                                          step={1}
                                        />
                                        <DraggableNumber
                                          label="h"
                                          value={
                                            (comp as CollisionComponent).height
                                          }
                                          onChange={(v) =>
                                            updateComponent(comp.id, {
                                              height: v,
                                            })
                                          }
                                          step={1}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Rigidbody properties */}
                                  {comp.type === "rigidbody" && (
                                    <div className="space-y-2 mt-2 pt-1 border-t border-[#1a1a1a]">
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-[10px] text-[#888]">
                                          Type
                                        </span>
                                        <select
                                          value={
                                            (comp as RigidbodyComponent)
                                              .bodyType
                                          }
                                          onChange={(e) =>
                                            updateComponent(comp.id, {
                                              bodyType: e.target.value,
                                            })
                                          }
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none"
                                        >
                                          <option value="dynamic">
                                            Dynamic
                                          </option>
                                          <option value="static">Static</option>
                                        </select>
                                      </div>
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-[10px] text-[#888]">
                                          Sensor/Solid
                                        </span>
                                        <select
                                          value={
                                            (comp as RigidbodyComponent)
                                              .sensorType
                                          }
                                          onChange={(e) =>
                                            updateComponent(comp.id, {
                                              sensorType: e.target.value,
                                            })
                                          }
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none"
                                        >
                                          <option value="solid">
                                            Solid (Tak tembus)
                                          </option>
                                          <option value="sensor">
                                            Sensor (Tembus + Detect)
                                          </option>
                                          <option value="none">
                                            None (Tembus - No detect)
                                          </option>
                                        </select>
                                      </div>
                                      <div>
                                        <DraggableNumber
                                          label="g"
                                          value={
                                            (comp as RigidbodyComponent).gravity
                                          }
                                          onChange={(v) =>
                                            updateComponent(comp.id, {
                                              gravity: v,
                                            })
                                          }
                                          step={0.1}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Sprite properties */}
                                  {comp.type === "sprite" && (
                                    <div className="space-y-2 mt-2 pt-1 border-t border-[#1a1a1a]">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] w-6">
                                          Col
                                        </span>
                                        <input
                                          type="color"
                                          value={
                                            (comp as SpriteComponent).color
                                          }
                                          onChange={(e) =>
                                            updateComponent(comp.id, {
                                              color: e.target.value,
                                            })
                                          }
                                          className="w-full h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                                        />
                                      </div>
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-[10px] text-[#888]">
                                          Asset
                                        </span>
                                        <div className="flex flex-col items-center p-2 bg-[#1e1e1e] border border-[#3a3a3a] rounded">
                                          <div className="w-16 h-16 bg-[#111] mb-2 flex items-center justify-center rounded overflow-hidden">
                                            {(comp as SpriteComponent)
                                              .assetUrl ? (
                                              <img
                                                src={
                                                  (comp as SpriteComponent)
                                                    .assetUrl
                                                }
                                                alt="sprite"
                                                className="w-full h-full object-contain"
                                              />
                                            ) : (
                                              <ImageIcon
                                                size={16}
                                                className="text-[#555]"
                                              />
                                            )}
                                          </div>
                                          <span className="text-[9px] text-[#aaa] font-mono truncate w-full text-center">
                                            {(comp as SpriteComponent).assetUrl
                                              ? (
                                                  comp as SpriteComponent
                                                ).assetUrl
                                                  ?.split("/")
                                                  .pop() || "sprite_image"
                                              : "cube (default)"}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() =>
                                            setShowAssetSelector({
                                              compId: comp.id,
                                            })
                                          }
                                          className="mt-1 w-full bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#ccc] py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors"
                                        >
                                          Change Asset
                                        </button>
                                      </div>
                                      {(comp as SpriteComponent).assetUrl && (
                                        <div className="flex items-center space-x-2 pt-1 border-t border-[#1a1a1a]">
                                          <span className="text-[10px] text-[#888] flex-1">
                                            Stretch Image
                                          </span>
                                          <button
                                            onClick={() => updateComponent(comp.id, {
                                               stretch: !(comp as SpriteComponent).stretch
                                            })}
                                            className={`w-8 h-4 rounded-full relative transition-colors ${(comp as SpriteComponent).stretch ? "bg-[#4ac5e2]" : "bg-[#555]"}`}
                                          >
                                            <div
                                              className={`absolute top-[2px] w-3 h-3 bg-white rounded-full transition-transform`}
                                              style={{ left: (comp as SpriteComponent).stretch ? "18px" : "2px" }}
                                            />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Animation properties */}
                                  {comp.type === "animation" && (
                                    <div className="space-y-2 mt-2 pt-1 border-t border-[#1a1a1a]">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">FPS</span>
                                        <input
                                          type="number"
                                          value={(comp as AnimationComponent).fps}
                                          onChange={(e) => updateComponent(comp.id, { fps: parseInt(e.target.value) || 1 })}
                                          className="w-16 bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">Play</span>
                                        <button
                                            onClick={() => updateComponent(comp.id, { playing: !(comp as AnimationComponent).playing })}
                                            className={`w-6 h-3 rounded-full relative transition-colors ${(comp as AnimationComponent).playing ? "bg-[#4ac5e2]" : "bg-[#555]"}`}
                                          >
                                            <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${(comp as AnimationComponent).playing ? "translate-x-3" : "translate-x-0"}`} />
                                          </button>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">Loop</span>
                                        <button
                                            onClick={() => updateComponent(comp.id, { loop: !(comp as AnimationComponent).loop })}
                                            className={`w-6 h-3 rounded-full relative transition-colors ${(comp as AnimationComponent).loop ? "bg-[#4ac5e2]" : "bg-[#555]"}`}
                                          >
                                            <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${(comp as AnimationComponent).loop ? "translate-x-3" : "translate-x-0"}`} />
                                          </button>
                                      </div>

                                      <div className="text-[10px] text-[#888] mb-1">Frames</div>
                                      <div className="flex flex-wrap gap-2">
                                        {(comp as AnimationComponent).frames?.map((f, i) => (
                                          <div key={i} className="relative group w-10 h-10 bg-[#1e1e1e] border border-[#3a3a3a] rounded flex items-center justify-center">
                                            <div className="absolute top-0 left-0 bg-black/60 text-white text-[8px] px-1 rounded-br z-10 pointer-events-none">{i + 1}</div>
                                            <img src={f} alt={`f${i}`} className="max-w-full max-h-full object-contain pointer-events-none" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-1 transition-opacity z-20">
                                               <button onClick={() => updateComponent(comp.id, { frames: (comp as AnimationComponent).frames.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-300"><X size={12}/></button>
                                               <button onClick={() => setShowAssetSelector({ animCompId: comp.id, animFrameIndex: i })} className="text-blue-400 hover:text-blue-300"><Pencil size={12}/></button>
                                            </div>
                                          </div>
                                        ))}
                                        <button
                                          onClick={() => setShowAssetSelector({ animCompId: comp.id, animFrameIndex: -1 })}
                                          className="w-10 h-10 border border-dashed border-[#555] rounded flex items-center justify-center hover:bg-[#333] transition-colors"
                                        >
                                          <Plus size={16} className="text-[#888]" />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Text Properties */}
                                  {comp.type === "text" && (
                                    <div className="space-y-2 mt-2 pt-1 border-t border-[#1a1a1a]">
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-[10px] text-[#888]">Text Content</span>
                                        <input
                                          type="text"
                                          value={(comp as TextComponent).text}
                                          onKeyDown={handleInputKeyDown}
                                          onChange={(e) => updateComponent(comp.id, { text: e.target.value })}
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">Size</span>
                                        <input
                                          type="number"
                                          value={(comp as TextComponent).fontSize}
                                          onChange={(e) => updateComponent(comp.id, { fontSize: Number(e.target.value) })}
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none w-16"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">Color</span>
                                        <input
                                          type="color"
                                          value={(comp as TextComponent).color}
                                          onChange={(e) => updateComponent(comp.id, { color: e.target.value })}
                                          className="w-16 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">Outline</span>
                                        <input
                                          type="number"
                                          value={(comp as TextComponent).outlineWidth || 0}
                                          onChange={(e) => updateComponent(comp.id, { outlineWidth: Number(e.target.value) })}
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none w-12"
                                          placeholder="px"
                                        />
                                        <input
                                          type="color"
                                          value={(comp as TextComponent).outlineColor || "#000000"}
                                          onChange={(e) => updateComponent(comp.id, { outlineColor: e.target.value })}
                                          className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-[#888] flex-1">Font</span>
                                        <select
                                          value={(comp as TextComponent).fontFamily || "sans-serif"}
                                          onChange={(e) => updateComponent(comp.id, { fontFamily: e.target.value })}
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none"
                                        >
                                          <option value="sans-serif">Sans Serif</option>
                                          <option value="serif">Serif</option>
                                          <option value="monospace">Monospace</option>
                                          <option value="cursive">Cursive</option>
                                          <option value="fantasy">Fantasy</option>
                                        </select>
                                      </div>
                                      <div className="flex items-center space-x-2 pt-1">
                                        <span className="text-[10px] text-[#888] flex-1">
                                          Shadow / Outline
                                        </span>
                                        <button
                                          onClick={() => updateComponent(comp.id, {
                                              shadow: !(comp as TextComponent).shadow
                                          })}
                                          className={`w-6 h-3 rounded-full relative transition-colors ${(comp as TextComponent).shadow ? "bg-[#4ac5e2]" : "bg-[#555]"}`}
                                        >
                                          <div
                                            className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform`}
                                            style={{ left: (comp as TextComponent).shadow ? "14px" : "2px" }}
                                          />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Script Properties */}
                                  {comp.type === "script" && (
                                    <div className="space-y-2 mt-2 pt-1 border-t border-[#1a1a1a]">
                                      <div className="flex flex-col space-y-1">
                                        <span className="text-[10px] text-[#888]">
                                          Script Name
                                        </span>
                                        <input
                                          type="text"
                                          value={(comp as ScriptComponent).name}
                                          onKeyDown={handleInputKeyDown}
                                          onChange={(e) =>
                                            updateComponent(comp.id, {
                                              name: e.target.value,
                                            })
                                          }
                                          className="bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2 py-1 text-xs text-[#e0e0e0] outline-none"
                                        />
                                      </div>
                                      <button
                                        onClick={() =>
                                          setEditingScript({
                                            objId: selectedObj.id,
                                            compId: comp.id,
                                          })
                                        }
                                        className="bg-[#4a90e2]/20 hover:bg-[#4a90e2]/40 text-[#4a90e2] text-[10px] uppercase font-bold tracking-wider py-1.5 px-2 rounded w-full border border-[#4a90e2]/30 transition-colors"
                                      >
                                        Open Editor
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Context Menu for Delete */}
                              {contextMenuCompId === comp.id && (
                                <div className="absolute top-0 right-0 mt-1 mr-1 bg-[#282828] border border-[#1a1a1a] shadow-xl rounded py-1 z-30 flex pl-0">
                                  <button
                                    className="px-2 py-1 hover:bg-[#3a3a3a] text-xs text-[#ccc]"
                                    onClick={() => setContextMenuCompId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-2 py-1 hover:bg-red-500/20 text-xs text-red-400"
                                    onClick={() => deleteComponent(comp.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[#666]">
                    <MousePointer2 size={24} className="mb-2 opacity-20" />
                    <p className="text-[10px]">Pilih objek di Assets</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {previewMode === "edit" &&
        editingScript &&
        (() => {
          const targetObj = objects.find((o) => o.id === editingScript.objId);
          const targetScript = targetObj?.components?.find(
            (c) => c.id === editingScript.compId,
          ) as ScriptComponent;
          if (!targetObj || !targetScript) return null;

          const nodes = targetScript.nodes || [];
          const wires = targetScript.wires || [];

          const updateScript = (updates: Partial<ScriptComponent>) => {
            setObjects((prev) =>
              prev.map((o) =>
                o.id === editingScript.objId
                  ? {
                      ...o,
                      components: o.components.map((c) =>
                        c.id === editingScript.compId
                          ? { ...c, ...updates }
                          : c,
                      ),
                    }
                  : o,
              ),
            );
          };

          const addNode = (type: string) => {
            const def = BLOCK_DEFS[type];
            const newParams: Record<string, string> = {};
            def.params.forEach((p) => {
              if (p === "touchType") newParams[p] = "down";
              else newParams[p] = "none";
            });

            const newNode: ScriptNode = {
              id: generateId(),
              type: type as BlockType,
              x: -graphTrans.x / graphTrans.z + 100 + Math.random() * 50,
              y: -graphTrans.y / graphTrans.z + 100 + Math.random() * 50,
              params: newParams,
            };
            updateScript({ nodes: [...nodes, newNode] });
          };

          const handlePinDown = (
            e: React.PointerEvent,
            nodeId: string,
            pin: string,
            isInput: boolean,
          ) => {
            e.stopPropagation();
            if (isInput) return; // We only drag from output pins
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setDraggingWire({
              fromNode: nodeId,
              fromPin: pin,
              x: e.clientX,
              y: e.clientY,
            });
          };

          const handleCanvasPointerMove = (e: React.PointerEvent) => {
            if (draggingWire) {
              let closest = null;
              let minD = 40; // max snap distance in screen space

              nodes.forEach((n) => {
                const el = document.getElementById(`pin-${n.id}-in`);
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const px = rect.left + rect.width / 2;
                const py = rect.top + rect.height / 2;
                const d = Math.hypot(e.clientX - px, e.clientY - py);
                if (d < minD) {
                  minD = d;
                  closest = { id: n.id, pin: "in", x: px, y: py };
                }
              });

              setSnappedPin(closest);
              setDraggingWire({ ...draggingWire, x: e.clientX, y: e.clientY });
            } else if (isDraggingNode.current) {
              const dx = (e.clientX - nodeDragOffset.current.x) / graphTrans.z;
              const dy = (e.clientY - nodeDragOffset.current.y) / graphTrans.z;
              nodeDragOffset.current = { x: e.clientX, y: e.clientY };
              updateScript({
                nodes: nodes.map((n) =>
                  n.id === isDraggingNode.current
                    ? { ...n, x: n.x + dx, y: n.y + dy }
                    : n,
                ),
              });
            } else if (pointers.current.has(e.pointerId)) {
              if (pointers.current.size === 1) {
                // Pan
                const p = pointers.current.get(e.pointerId)!;
                const dx = e.clientX - p.x;
                const dy = e.clientY - p.y;
                pointers.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                });
                setGraphTrans((prev) => ({
                  ...prev,
                  x: prev.x + dx,
                  y: prev.y + dy,
                }));
              } else if (pointers.current.size === 2) {
                // Pinch zoom!
                const pts = Array.from(pointers.current.values());
                const newDist = Math.hypot(
                  pts[0].x - pts[1].x,
                  pts[0].y - pts[1].y,
                );
                if (pinchDist.current > 0) {
                  const scaleBy = newDist / pinchDist.current;
                  setGraphTrans((prev) => ({
                    ...prev,
                    z: Math.max(0.1, Math.min(prev.z * scaleBy, 3)),
                  }));
                }
                pinchDist.current = newDist;
                pointers.current.set(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            }
          };

          const handleCanvasPointerUp = (e: React.PointerEvent) => {
            if (draggingWire) {
              if (snappedPin) {
                // Connect snapped!
                const newWires = wires.filter(
                  (w) =>
                    !(
                      w.fromNode === draggingWire.fromNode &&
                      w.fromPin === draggingWire.fromPin
                    ),
                );
                newWires.push({
                  id: generateId(),
                  fromNode: draggingWire.fromNode,
                  fromPin: draggingWire.fromPin,
                  toNode: snappedPin.id,
                  toPin: snappedPin.pin,
                });
                updateScript({ wires: newWires });
              } else {
                const newWires = wires.filter(
                  (w) =>
                    !(
                      w.fromNode === draggingWire.fromNode &&
                      w.fromPin === draggingWire.fromPin
                    ),
                );
                if (newWires.length !== wires.length)
                  updateScript({ wires: newWires });
              }
              setDraggingWire(null);
            }
            if (snappedPin) setSnappedPin(null);
            isDraggingNode.current = null;
            pinchDist.current = 0;
            pointers.current.delete(e.pointerId);
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          };

          const handlePinUp = (
            e: React.PointerEvent,
            nodeId: string,
            pin: string,
            isInput: boolean,
          ) => {
            e.stopPropagation();
            if (draggingWire && isInput) {
              // Connect wire!
              // Remove existing wire from output pin (only 1 connection per output)
              const newWires = wires.filter(
                (w) =>
                  !(
                    w.fromNode === draggingWire.fromNode &&
                    w.fromPin === draggingWire.fromPin
                  ),
              );
              newWires.push({
                id: generateId(),
                fromNode: draggingWire.fromNode,
                fromPin: draggingWire.fromPin,
                toNode: nodeId,
                toPin: pin,
              });
              updateScript({ wires: newWires });
            }
            setDraggingWire(null);
          };

          const autoArrange = () => {
            let curY = 100;
            let curX = 100;
            const visited = new Set<string>();
            const newNodes = [...nodes];

            const placeNode = (
              nodeId: string,
              x: number,
              y: number,
            ): number => {
              if (visited.has(nodeId)) return y;
              visited.add(nodeId);
              const nIndex = newNodes.findIndex((n) => n.id === nodeId);
              if (nIndex === -1) return y;

              newNodes[nIndex] = { ...newNodes[nIndex], x, y };

              let nextY = y;
              const def = BLOCK_DEFS[newNodes[nIndex].type];

              def.outPins.forEach((pin) => {
                const connected = wires
                  .filter((w) => w.fromNode === nodeId && w.fromPin === pin)
                  .map((w) => w.toNode);
                connected.forEach((childId) => {
                  nextY = placeNode(childId, x + 250, nextY);
                });
              });
              return Math.max(nextY, y + 150);
            };

            const roots = newNodes.filter((n) => !BLOCK_DEFS[n.type].inPin);
            roots.forEach((r) => {
              curY = placeNode(r.id, curX, curY);
            });
            newNodes
              .filter((n) => !visited.has(n.id))
              .forEach((n) => {
                curY = placeNode(n.id, curX, curY);
              });

            updateScript({ nodes: newNodes });
            setGraphTrans({ x: 0, y: 0, z: 1 });
          };

          const NodeUI = ({ node }: { node: ScriptNode }) => {
            const def = BLOCK_DEFS[node.type];
            return (
              <div
                className="absolute bg-[#222] border-2 border-[#333] hover:border-[#4a90e2] rounded shadow-lg flex flex-col w-48 touch-none shrink-0"
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isDraggingNode.current = node.id;
                  nodeDragOffset.current = { x: e.clientX, y: e.clientY };
                  (e.currentTarget as HTMLElement).setPointerCapture(
                    e.pointerId,
                  );
                }}
              >
                <div className="flex justify-between items-center bg-[#1a1a1a] p-1.5 px-2 rounded-t border-b border-[#333]">
                  <span
                    className={cn(
                      "uppercase tracking-wider text-[10px] font-bold",
                      def.category === "event"
                        ? "text-yellow-500"
                        : def.category === "action"
                          ? "text-blue-400"
                          : "text-green-400",
                    )}
                  >
                    {def.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateScript({
                        nodes: nodes.filter((n) => n.id !== node.id),
                        wires: wires.filter(
                          (w) => w.fromNode !== node.id && w.toNode !== node.id,
                        ),
                      });
                    }}
                    className="text-red-500 hover:text-red-400 p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="p-2 space-y-2 relative">
                  {/* IN PIN */}
                  {def.inPin && (
                    <div
                      className="absolute -left-2 top-2 w-3 h-3 bg-[#4a90e2] rounded-full cursor-crosshair ring-2 ring-[#222]"
                      onPointerUp={(e) => handlePinUp(e, node.id, "in", true)}
                      id={`pin-${node.id}-in`}
                    />
                  )}

                  {def.params.map((p) => (
                    <div
                      key={p}
                      className="text-[10px] flex flex-col bg-[#1a1a1a] p-1.5 rounded"
                    >
                      <span className="text-[#888] mb-1">{p}</span>
                      {p === "varName" || p === "targetVar" ? (
                        <select
                          value={node.params[p] || ""}
                          onChange={(e) =>
                            updateScript({
                              nodes: nodes.map((n) =>
                                n.id === node.id
                                  ? {
                                      ...n,
                                      params: {
                                        ...n.params,
                                        [p]: e.target.value,
                                      },
                                    }
                                  : n,
                              ),
                            })
                          }
                          className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                        >
                          <option value="">Select Var...</option>
                          {variables.map((v) => (
                            <option key={v.id} value={`g.${v.name}`}>
                              g.{v.name}
                            </option>
                          ))}
                          {targetScript.localVars?.map((v) => (
                            <option key={v.id} value={`l.${v.name}`}>
                              l.{v.name}
                            </option>
                          ))}
                        </select>
                      ) : p === "soundAssetId" ? (
                        <select
                          value={node.params[p] || ""}
                          onChange={(e) =>
                            updateScript({
                              nodes: nodes.map((n) =>
                                n.id === node.id
                                  ? { ...n, params: { ...n.params, [p]: e.target.value } }
                                  : n
                              ),
                            })
                          }
                          className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                        >
                          <option value="">Select Sound...</option>
                          {assets.filter(a => a.url.startsWith("data:audio")).map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      ) : p === "assetType" ? (
                        <select
                          value={node.params[p] || "image"}
                          onChange={(e) =>
                            updateScript({
                              nodes: nodes.map((n) =>
                                n.id === node.id
                                  ? {
                                      ...n,
                                      params: {
                                        ...n.params,
                                        [p]: e.target.value,
                                      },
                                    }
                                  : n,
                              ),
                            })
                          }
                          className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                        >
                          <option value="image">Image Asset</option>
                          <option value="animation">Animation</option>
                        </select>
                      ) : p === "assetValue" ? (
                        node.params.assetType === "animation" ? (
                             <select
                               value={node.params[p] || ""}
                               onChange={(e) =>
                                 updateScript({
                                   nodes: nodes.map((n) =>
                                     n.id === node.id
                                       ? { ...n, params: { ...n.params, [p]: e.target.value } }
                                       : n
                                   ),
                                 })
                               }
                               className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                             >
                               <option value="">Select Anim...</option>
                               {(targetObj.components.filter(c => c.type === 'animation') as AnimationComponent[]).map((c, i) => (
                                 <option key={c.id} value={c.id}>Anim {i+1} ({c.frames?.length || 0} frames)</option>
                               ))}
                             </select>
                        ) : (
                             <select
                               value={node.params[p] || ""}
                               onChange={(e) =>
                                 updateScript({
                                   nodes: nodes.map((n) =>
                                     n.id === node.id
                                       ? { ...n, params: { ...n.params, [p]: e.target.value } }
                                       : n
                                   ),
                                 })
                               }
                               className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                             >
                               <option value="">Select Asset...</option>
                               {assets.map((a) => (
                                 <option key={a.id} value={a.url}>{a.name}</option>
                               ))}
                             </select>
                        )
                      ) : p === "targetName" || p === "objName" ? (
                        <select
                          value={node.params[p] || ""}
                          onChange={(e) =>
                            updateScript({
                              nodes: nodes.map((n) =>
                                n.id === node.id
                                  ? {
                                      ...n,
                                      params: {
                                        ...n.params,
                                        [p]: e.target.value,
                                      },
                                    }
                                  : n,
                              ),
                            })
                          }
                          className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                        >
                          <option value="">Select Object...</option>
                          {objects
                            .filter(
                              (o) => p === "objName" || o.id !== targetObj.id,
                            )
                            .map((o) => (
                              <option key={o.id} value={o.name}>
                                {o.name}
                              </option>
                            ))}
                        </select>
                      ) : p === "property" ? (
                        <select
                          value={node.params[p] || ""}
                          onChange={(e) =>
                            updateScript({
                              nodes: nodes.map((n) =>
                                n.id === node.id
                                  ? {
                                      ...n,
                                      params: {
                                        ...n.params,
                                        [p]: e.target.value,
                                      },
                                    }
                                  : n,
                              ),
                            })
                          }
                          className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                        >
                          <option value="x">Position X</option>
                          <option value="y">Position Y</option>
                          <option value="sX">Scale X / Width</option>
                          <option value="sY">Scale Y / Height</option>
                          <option value="rot">Rotation</option>
                        </select>
                      ) : p === "touchType" ? (
                        <select
                          value={node.params[p] || "tap"}
                          onChange={(e) =>
                            updateScript({
                              nodes: nodes.map((n) =>
                                n.id === node.id
                                  ? {
                                      ...n,
                                      params: {
                                        ...n.params,
                                        [p]: e.target.value,
                                      },
                                    }
                                  : n,
                              ),
                            })
                          }
                          className="bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] outline-none text-[#e0e0e0] font-mono text-[9px]"
                        >
                          <option value="down">Touch Down</option>
                          <option value="up">Touch Up</option>
                          <option value="move">Touch Move</option>
                        </select>
                      ) : (
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            setEditingExpr({
                              objId: targetObj.id,
                              compId: targetScript.id,
                              nodeId: node.id,
                              paramKey: p,
                              expr: node.params[p],
                            })
                          }
                          className="group relative bg-[#111] px-2 py-1 rounded w-full text-left border border-[#333] hover:border-[#4a90e2] text-[#e0e0e0] font-mono text-[9px] flex items-center justify-between overflow-hidden"
                        >
                          <span className="truncate pr-4 flex-1">
                            {node.params[p] || "none"}
                          </span>
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-[#4a90e2] text-white text-[8px] px-1 rounded-sm shadow-sm transition-opacity">
                            ƒx
                          </span>
                        </button>
                      )}
                    </div>
                  ))}

                  {/* OUT PINS */}
                  <div className="flex flex-col space-y-2 mt-2 items-end">
                    {def.outPins.map((outPin) => (
                      <div
                        key={outPin}
                        className="relative w-full text-right pr-2"
                      >
                        <span className="text-[9px] uppercase font-bold text-[#888]">
                          {outPin}
                        </span>
                        <div
                          className="absolute -right-4 top-0.5 w-3 h-3 bg-green-500 rounded-full cursor-crosshair ring-2 ring-[#222]"
                          onPointerDown={(e) =>
                            handlePinDown(e, node.id, outPin, false)
                          }
                          id={`pin-${node.id}-${outPin}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          };

          return (
            <div className="fixed inset-4 bg-[#1e1e1e] z-40 flex flex-col sm:flex-row rounded-2xl shadow-2xl border border-[#333] overflow-hidden drop-shadow-[0_0_50px_rgba(0,0,0,0.8)]">
              <div className="w-full sm:w-48 bg-[#282828] border-r border-[#1a1a1a] flex flex-col h-1/3 sm:h-full shrink-0">
                <div className="p-2 border-b border-[#1a1a1a] bg-[#222]">
                  <button
                    onClick={() => setEditingScript(null)}
                    className="text-[#888] hover:text-[#fff] flex items-center text-[10px] font-bold"
                  >
                    <ChevronDown className="rotate-90 mr-1" size={14} /> Close
                  </button>
                  <div className="text-[#e0e0e0] font-bold mt-2 text-xs truncate">
                    Editing: {targetScript.name}
                  </div>
                  <button
                    onClick={autoArrange}
                    className="mt-2 w-full text-center bg-[#4a90e2]/20 hover:bg-[#4a90e2]/40 text-[#4a90e2] text-[10px] p-1.5 rounded font-bold uppercase tracking-wider transition-colors border border-[#4a90e2]/30"
                  >
                    Auto-Arrange
                  </button>
                  <button
                    onClick={() => setShowLocalVars(!showLocalVars)}
                    className="mt-2 w-full text-left bg-[#333] hover:bg-[#444] text-[#888] text-[10px] p-1.5 rounded font-bold uppercase tracking-wider flex justify-between"
                  >
                    Local Vars{" "}
                    <span>{targetScript.localVars?.length || 0}</span>
                  </button>
                </div>
                <div className="flex bg-[#1a1a1a] border-b border-[#333]">
                  {["event", "action", "control"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setScriptTab(cat as any)}
                      className={cn(
                        "flex-1 text-center py-2 text-[10px] font-bold uppercase tracking-wider",
                        scriptTab === cat
                          ? "text-[#e0e0e0] border-b-2 border-[#4a90e2]"
                          : "text-[#666] hover:text-[#aaa]",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {Object.entries(BLOCK_DEFS)
                    .filter(([k, d]) => d.category === scriptTab)
                    .map(([k, d]) => (
                      <button
                        key={k}
                        onClick={() => addNode(k)}
                        className="w-full text-left bg-[#333] hover:bg-[#4a90e2]/20 text-[#e0e0e0] text-[10px] p-1.5 rounded font-mono border border-transparent hover:border-[#4a90e2]/30 transition-colors"
                      >
                        {d.label}
                      </button>
                    ))}
                </div>
              </div>

              <div
                className="flex-1 overflow-hidden bg-[#2a2a2a] relative touch-none"
                ref={graphContainerRef}
                onPointerDown={(e) => {
                  pointers.current.set(e.pointerId, {
                    x: e.clientX,
                    y: e.clientY,
                  });
                  if (pointers.current.size === 2) {
                    const pts = Array.from(pointers.current.values());
                    pinchDist.current = Math.hypot(
                      pts[0].x - pts[1].x,
                      pts[0].y - pts[1].y,
                    );
                  }
                  (e.currentTarget as HTMLElement).setPointerCapture(
                    e.pointerId,
                  );
                }}
                onWheel={(e) => {
                  const scaleBy = e.deltaY > 0 ? 0.9 : 1.1;
                  const newZ = Math.max(
                    0.1,
                    Math.min(graphTrans.z * scaleBy, 3),
                  );
                  setGraphTrans((prev) => ({ ...prev, z: newZ }));
                }}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                style={{
                  backgroundImage: "radial-gradient(#444 1px, transparent 1px)",
                  backgroundSize: `${20 * graphTrans.z}px ${20 * graphTrans.z}px`,
                  backgroundPosition: `${graphTrans.x}px ${graphTrans.y}px`,
                }}
              >
                {/* Wire SVG rendering */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ zIndex: 0 }}
                >
                  {wires.map((w) => {
                    const fromEl = document.getElementById(
                      `pin-${w.fromNode}-${w.fromPin}`,
                    );
                    const toEl = document.getElementById(
                      `pin-${w.toNode}-${w.toPin}`,
                    );
                    if (!fromEl || !toEl || !graphContainerRef.current)
                      return null;
                    const containerRect =
                      graphContainerRef.current.getBoundingClientRect();
                    const fRect = fromEl.getBoundingClientRect();
                    const tRect = toEl.getBoundingClientRect();
                    const fx =
                      fRect.left + fRect.width / 2 - containerRect.left;
                    const fy = fRect.top + fRect.height / 2 - containerRect.top;
                    const tx =
                      tRect.left + tRect.width / 2 - containerRect.left;
                    const ty = tRect.top + tRect.height / 2 - containerRect.top;
                    return (
                      <path
                        key={w.id}
                        d={`M ${fx} ${fy} C ${fx + 50 * graphTrans.z} ${fy}, ${tx - 50 * graphTrans.z} ${ty}, ${tx} ${ty}`}
                        fill="none"
                        stroke="#fff"
                        strokeWidth={2 * graphTrans.z}
                        onPointerDown={() =>
                          updateScript({
                            wires: wires.filter((wire) => wire.id !== w.id),
                          })
                        }
                        style={{ pointerEvents: "auto", cursor: "pointer" }}
                      />
                    );
                  })}
                  {draggingWire &&
                    (() => {
                      const fromEl = document.getElementById(
                        `pin-${draggingWire.fromNode}-${draggingWire.fromPin}`,
                      );
                      if (!fromEl || !graphContainerRef.current) return null;
                      const containerRect =
                        graphContainerRef.current.getBoundingClientRect();
                      const fRect = fromEl.getBoundingClientRect();
                      const fx =
                        fRect.left + fRect.width / 2 - containerRect.left;
                      const fy =
                        fRect.top + fRect.height / 2 - containerRect.top;

                      // If we have a snapped pin, connect instantly
                      let tx = draggingWire.x - containerRect.left;
                      let ty = draggingWire.y - containerRect.top;
                      if (snappedPin) {
                        const snapEl = document.getElementById(
                          `pin-${snappedPin.id}-${snappedPin.pin}`,
                        );
                        if (snapEl) {
                          const sRect = snapEl.getBoundingClientRect();
                          tx =
                            sRect.left + sRect.width / 2 - containerRect.left;
                          ty = sRect.top + sRect.height / 2 - containerRect.top;
                        }
                      }

                      return (
                        <>
                          <path
                            d={`M ${fx} ${fy} C ${fx + 50 * graphTrans.z} ${fy}, ${tx - 50 * graphTrans.z} ${ty}, ${tx} ${ty}`}
                            fill="none"
                            stroke={snappedPin ? "#fff" : "#888"}
                            strokeDasharray={snappedPin ? "0" : "4"}
                            strokeWidth={2 * graphTrans.z}
                          />
                          {snappedPin && (
                            <circle
                              cx={tx}
                              cy={ty}
                              r={6 * graphTrans.z}
                              stroke="#fff"
                              strokeWidth="2"
                              fill="transparent"
                            />
                          )}
                        </>
                      );
                    })()}
                </svg>

                <div
                  style={{
                    transform: `translate(${graphTrans.x}px, ${graphTrans.y}px) scale(${graphTrans.z})`,
                    transformOrigin: "0 0",
                    position: "absolute",
                    inset: 0,
                  }}
                >
                  {nodes.map((n) => (
                    <NodeUI key={n.id} node={n} />
                  ))}
                </div>

                {showLocalVars && (
                  <div className="absolute top-4 right-4 w-64 bg-[#282828] border border-[#1a1a1a] rounded shadow-xl flex flex-col z-50">
                    <div className="flex justify-between items-center p-2 border-b border-[#1a1a1a]">
                      <span className="text-[#888] text-[10px] font-bold uppercase tracking-wider">
                        Local Variables
                      </span>
                      <button
                        onClick={() => setShowLocalVars(false)}
                        className="text-[#888] hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                      {targetScript.localVars &&
                        targetScript.localVars.map((v) => (
                          <div
                            key={v.id}
                            className="bg-[#1e1e1e] border border-[#3a3a3a] p-2 rounded"
                          >
                            <div className="flex space-x-1 mb-1 items-center">
                              <span className="text-[9px] uppercase text-[#666] font-bold w-[24px] text-center">
                                {v.type === "string"
                                  ? "txt"
                                  : v.type === "number"
                                    ? "num"
                                    : "bol"}
                              </span>
                              <input
                                className="bg-transparent text-[#e0e0e0] text-[11px] font-bold outline-none flex-1 border-b border-[#3a3a3a] focus:border-[#4a90e2]"
                                value={v.name}
                                onKeyDown={handleInputKeyDown}
                                onChange={(e) =>
                                  updateScript({
                                    localVars: targetScript.localVars.map(
                                      (lv) =>
                                        lv.id === v.id
                                          ? { ...lv, name: e.target.value }
                                          : lv,
                                    ),
                                  })
                                }
                              />
                              <button
                                onClick={() =>
                                  updateScript({
                                    localVars: targetScript.localVars.map(lv => lv.id === v.id ? { ...lv, logToConsole: !lv.logToConsole } : lv)
                                  })
                                }
                                className={cn(
                                  "p-1.5 text-[9px] rounded font-bold tracking-wider uppercase flex items-center justify-center shrink-0 transition-colors",
                                  v.logToConsole ? "bg-[#4a90e2]/20 text-[#4a90e2]" : "hover:bg-[#333] text-[#666]"
                                )}
                                title={v.logToConsole ? "Log: ON" : "Log: OFF"}
                              >
                                <Terminal size={12} />
                              </button>
                              {confirmDeleteLocalVar === v.id ? (
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() =>
                                      updateScript({
                                        localVars:
                                          targetScript.localVars.filter(
                                            (lv) => lv.id !== v.id,
                                          ),
                                      })
                                    }
                                    className="bg-red-500 text-white px-1 text-[9px] rounded"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteLocalVar(null)
                                    }
                                    className="bg-[#555] text-white px-1 text-[9px] rounded"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteLocalVar(v.id)}
                                  className="text-red-500 hover:text-red-400 p-1"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center pl-[28px]">
                              {v.type === "number" && (
                                <input
                                  type="number"
                                  value={v.value}
                                  onKeyDown={handleInputKeyDown}
                                  onChange={(e) =>
                                    updateScript({
                                      localVars: targetScript.localVars.map(
                                        (lv) =>
                                          lv.id === v.id
                                            ? {
                                                ...lv,
                                                value:
                                                  parseFloat(e.target.value) ||
                                                  0,
                                              }
                                            : lv,
                                      ),
                                    })
                                  }
                                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-2 py-1 outline-none text-[#e0e0e0] text-xs font-mono"
                                />
                              )}
                              {v.type === "string" && (
                                <input
                                  type="text"
                                  value={v.value}
                                  onKeyDown={handleInputKeyDown}
                                  onChange={(e) =>
                                    updateScript({
                                      localVars: targetScript.localVars.map(
                                        (lv) =>
                                          lv.id === v.id
                                            ? { ...lv, value: e.target.value }
                                            : lv,
                                      ),
                                    })
                                  }
                                  className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-2 py-1 outline-none text-[#e0e0e0] text-xs font-mono"
                                />
                              )}
                              {v.type === "boolean" && (
                                <button
                                  onClick={() =>
                                    updateScript({
                                      localVars: targetScript.localVars.map(
                                        (lv) =>
                                          lv.id === v.id
                                            ? { ...lv, value: !lv.value }
                                            : lv,
                                      ),
                                    })
                                  }
                                  className={cn(
                                    "px-2 py-1 rounded text-xs w-full text-left font-mono font-bold tracking-wider",
                                    v.value
                                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                      : "bg-red-500/10 text-red-400 border border-red-500/20",
                                  )}
                                >
                                  {v.value ? "TRUE" : "FALSE"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="p-2 border-t border-[#1a1a1a] flex flex-col items-center">
                      {!showAddLocalVarMenu ? (
                        <button
                          onClick={() => setShowAddLocalVarMenu(true)}
                          className="px-3 py-1 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-[#888] text-[9px] rounded-full uppercase font-bold tracking-wider flex items-center shadow-sm"
                        >
                          <Plus size={10} className="mr-1" /> Add
                        </button>
                      ) : (
                        <div className="flex space-x-2 w-full justify-center">
                          {["number", "string", "boolean"].map((type) => (
                            <button
                              key={type}
                              onClick={() => {
                                updateScript({
                                  localVars: [
                                    ...targetScript.localVars,
                                    {
                                      id: generateId(),
                                      name: `l_var${targetScript.localVars.length + 1}`,
                                      type: type as GlobalVariableType,
                                      value:
                                        type === "string"
                                          ? ""
                                          : type === "boolean"
                                            ? false
                                            : 0,
                                      logToConsole: false,
                                    },
                                  ],
                                });
                                setShowAddLocalVarMenu(false);
                              }}
                              className="px-2 py-1 bg-[#4a90e2]/10 hover:bg-[#4a90e2]/20 text-[#4a90e2] text-[9px] rounded uppercase font-bold tracking-wider border border-[#4a90e2]/30"
                            >
                              {type}
                            </button>
                          ))}
                          <button
                            onClick={() => setShowAddLocalVarMenu(false)}
                            className="px-2 py-1 text-[#888] hover:text-white"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {editingExpr &&
        (() => {
          const targetScript = objects
            .find((o) => o.id === editingExpr.objId)
            ?.components?.find(
              (c) => c.id === editingExpr.compId,
            ) as ScriptComponent;

          const applyExpr = (val: string) => {
            setObjects((prev) =>
              prev.map((o) =>
                o.id === editingExpr.objId
                  ? {
                      ...o,
                      components: o.components.map((c) => {
                        if (c.id !== editingExpr.compId) return c;
                        const sc = c as ScriptComponent;
                        return {
                          ...sc,
                          nodes: sc.nodes.map((n) =>
                            n.id === editingExpr.nodeId
                              ? {
                                  ...n,
                                  params: {
                                    ...n.params,
                                    [editingExpr.paramKey]: val,
                                  },
                                }
                              : n,
                          ),
                        };
                      }),
                    }
                  : o,
              ),
            );
            setEditingExpr(null);
          };

          return (
            <ExpressionEditor
              initialExpr={editingExpr.expr}
              variables={variables}
              localVars={targetScript?.localVars || []}
              objects={objects}
              currentObjId={editingScript?.objId}
              onApply={applyExpr}
              onCancel={() => setEditingExpr(null)}
            />
          );
        })()}
      {showAssetSelector && (
        <AssetSelector
          assets={assets.filter(a => a.url.startsWith("data:image") || !a.url.startsWith("data:audio"))}
          onAddAssets={(newAssets) => setAssets([...assets, ...newAssets])}
          onSelect={(url) => {
            if (showAssetSelector.forNewObject) {
              addSpriteObject(url);
            } else if (showAssetSelector.compId && selectedId) {
              updateSelectedObject((obj: any) => ({
                ...obj,
                components: obj.components.map((c: any) =>
                  c.id === showAssetSelector.compId
                    ? { ...c, assetUrl: url }
                    : c,
                ),
              }));
              setShowAssetSelector(null);
            } else if (showAssetSelector.animCompId && selectedId) {
              updateSelectedObject((obj: any) => ({
                ...obj,
                components: obj.components.map((c: any) => {
                  if (c.id === showAssetSelector.animCompId && c.type === "animation") {
                    const nextF = [...(c.frames || [])];
                    if (showAssetSelector.animFrameIndex !== undefined && showAssetSelector.animFrameIndex >= 0) {
                      nextF[showAssetSelector.animFrameIndex] = url;
                    } else {
                      nextF.push(url);
                    }
                    return { ...c, frames: nextF };
                  }
                  return c;
                })
              }));
              setShowAssetSelector(null);
            }
          }}
          onClose={() => setShowAssetSelector(null)}
        />
      )}

      {showSoundManager && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-[#333] shadow-2xl p-4 w-full max-w-lg rounded-xl flex flex-col h-[70vh]">
            <div className="flex justify-between items-center mb-4 text-[#888]">
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                Sound Manager
              </span>
              <button onClick={() => setShowSoundManager(false)} className="hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-[#aaa]">
                Upload music or sound effects.
              </p>
              <label className="px-3 py-1.5 bg-[#b5e24a]/20 hover:bg-[#b5e24a]/40 border border-[#b5e24a]/50 text-[#b5e24a] rounded flex items-center text-xs font-bold uppercase cursor-pointer">
                <Upload size={14} className="mr-1" /> Upload
                <input 
                  type="file" accept="audio/*" multiple className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      const newAssets: { id: string; name: string; url: string }[] = [];
                      for (const file of Array.from(files)) {
                        const url = await compressImage(file, 700000);
                        newAssets.push({ id: Math.random().toString(36).substr(2, 9), name: file.name, url });
                      }
                      setAssets(prev => [...prev, ...newAssets]);
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#111] border border-[#222] rounded p-2">
              {assets.filter(a => a.url.startsWith("data:audio")).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#666]">
                  <Music size={32} className="mb-2 opacity-20" />
                  <p className="text-xs">No sounds uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {assets.filter(a => a.url.startsWith("data:audio")).map(a => (
                    <div key={a.id} className="bg-[#2a2a2a] border border-[#3a3a3a] p-2 rounded flex items-center justify-between">
                       <span className="text-xs text-white truncate max-w-[200px]" title={a.name}>{a.name}</span>
                       <div className="flex items-center space-x-2">
                          <SimpleAudioPlayer url={a.url} />
                          <button onClick={() => {
                            const link = document.createElement('a');
                            link.href = a.url;
                            link.download = a.name;
                            link.click();
                          }} className="text-[#888] hover:text-white p-1" title="Download Music"><Download size={14} /></button>
                          <button onClick={() => {
                            setAssets(prev => prev.filter(x => x.id !== a.id));
                          }} className="text-red-400 hover:text-red-300 p-1" title="Delete Music"><Trash2 size={14} /></button>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#282828] border border-[#1a1a1a] shadow-2xl p-4 w-full max-w-sm rounded-xl flex flex-col">
            <div className="flex justify-between items-center mb-4 text-white">
              <span className="text-sm font-bold uppercase tracking-widest flex items-center">
                <Settings size={14} className="mr-2" /> Engine Settings
              </span>
              <button
                onClick={() => setShowSettings(false)}
                className="hover:text-red-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[#aaa] text-[10px] font-bold uppercase tracking-wider mb-2">
                  Editor
                </div>
                <div className="bg-[#1e1e1e] p-2 rounded border border-[#333] flex items-center justify-between">
                  <span className="text-[#ccc] text-xs font-semibold">
                    Show Background Grid
                  </span>
                  <button
                    onClick={() => setEditorGrid(!editorGrid)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${editorGrid ? "bg-[#4a90e2]" : "bg-[#555]"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform`}
                      style={{ left: editorGrid ? "18px" : "2px" }}
                    />
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[#aaa] text-[10px] font-bold uppercase tracking-wider mb-2">
                  Game Settings
                </div>
                <div className="bg-[#1e1e1e] p-2 rounded border border-[#333] flex flex-col space-y-2">
                  <span className="text-[#ccc] text-xs font-semibold">
                    Resolution Mode
                  </span>
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => setResolutionMode("default")}
                      className={cn(
                        "py-1 text-xs rounded border transition-colors",
                        resolutionMode === "default"
                          ? "bg-[#4a90e2]/20 border-[#4a90e2] text-[#4a90e2]"
                          : "border-transparent bg-[#333] hover:bg-[#444] text-[#888]",
                      )}
                    >
                      Default (Keep Aspect Ratio)
                    </button>
                    <button
                      onClick={() => setResolutionMode("fullscreen")}
                      className={cn(
                        "py-1 text-xs rounded border transition-colors",
                        resolutionMode === "fullscreen"
                          ? "bg-[#4a90e2]/20 border-[#4a90e2] text-[#4a90e2]"
                          : "border-transparent bg-[#333] hover:bg-[#444] text-[#888]",
                      )}
                    >
                      Fullscreen (Stretch)
                    </button>
                    <button
                      onClick={() => setResolutionMode("fullscreen-notch")}
                      className={cn(
                        "py-1 text-xs rounded border transition-colors",
                        resolutionMode === "fullscreen-notch"
                          ? "bg-[#4a90e2]/20 border-[#4a90e2] text-[#4a90e2]"
                          : "border-transparent bg-[#333] hover:bg-[#444] text-[#888]",
                      )}
                    >
                      Fullscreen (Left Safe Area)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[#aaa] text-[10px] font-bold uppercase tracking-wider mb-2">
                  Game Performance
                </div>
                <div className="bg-[#1e1e1e] p-2 rounded border border-[#333] flex flex-col space-y-2">
                  <span className="text-[#ccc] text-xs font-semibold">
                    Graphics Quality
                  </span>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setGraphicsQuality("low")}
                      className={cn(
                        "flex-1 py-1 text-xs rounded border transition-colors",
                        graphicsQuality === "low"
                          ? "bg-[#4a90e2]/20 border-[#4a90e2] text-[#4a90e2]"
                          : "border-transparent bg-[#333] hover:bg-[#444] text-[#888]",
                      )}
                    >
                      Low (30fps)
                    </button>
                    <button
                      onClick={() => setGraphicsQuality("balance")}
                      className={cn(
                        "flex-1 py-1 text-xs rounded border transition-colors",
                        graphicsQuality === "balance"
                          ? "bg-[#e2a84a]/20 border-[#e2a84a] text-[#e2a84a]"
                          : "border-transparent bg-[#333] hover:bg-[#444] text-[#888]",
                      )}
                    >
                      Balance
                    </button>
                    <button
                      onClick={() => setGraphicsQuality("high")}
                      className={cn(
                        "flex-1 py-1 text-xs rounded border transition-colors",
                        graphicsQuality === "high"
                          ? "bg-green-500/20 border-green-500 text-green-500"
                          : "border-transparent bg-[#333] hover:bg-[#444] text-[#888]",
                      )}
                    >
                      High
                    </button>
                  </div>
                  <p className="text-[9px] text-[#666] leading-tight mt-1">
                    If your game lags with multiple objects, switch to Low. Low
                    reduces rendering framerate to ~30fps.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-[#4a90e2] hover:bg-[#5b9cf2] text-white rounded text-xs font-bold w-full"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProjects().then(p => {
       const sorted = p.sort((a,b) => b.updatedAt - a.updatedAt);
       setProjects(sorted);
    }).catch(e => console.error("Could not load projects", e));
  }, []);

  const uploadThumbnail = async (id: string, e: any) => {
     const file = e.target.files?.[0];
     if (!file) return;
     const url = await compressImage(file, 700000);
     const p = projects.find(proj => proj.id === id);
     if (p) {
        p.thumbnailUrl = url;
        p.updatedAt = Date.now();
        p.size = JSON.stringify(p).length;
        await saveProjectDB(p);
        const allP = await getProjects();
        setProjects(allP.sort((a,b) => b.updatedAt - a.updatedAt));
     }
  };

  const handleCreateProject = async () => {
    const id = Date.now().toString();
    const newProj = {
      id,
      name: "New Game",
      size: 0,
      updatedAt: Date.now(),
      scenes: [],
      assets: []
    };
    await saveProjectDB(newProj);
    setProjects([newProj, ...projects]);
    setRenamingProjectId(id);
  };

  const handleImportProject = () => {
     const input = document.createElement("input");
     input.type = "file";
     input.accept = ".json,.zip";
     input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
           let proj: any = null;
           
           if (file.name.endsWith('.zip')) {
              const jszip = (await import("jszip")).default;
              const zip = await jszip.loadAsync(file);
              const jsonFile = zip.file("project.json");
              if (!jsonFile) throw new Error("project.json not found in ZIP");
              const jsonStr = await jsonFile.async("string");
              proj = JSON.parse(jsonStr);
              
              if (proj.assets) {
                 for (const asset of proj.assets) {
                    if (asset.url && asset.url.startsWith("assets/")) {
                       const assetFile = zip.file(asset.url);
                       if (assetFile) {
                          const base64 = await assetFile.async("base64");
                          const ext = asset.url.split('.').pop()?.toLowerCase();
                          let mimeType = "image/png";
                          if (ext === 'jpg' || ext === 'jpeg') mimeType = "image/jpeg";
                          else if (ext === 'gif') mimeType = "image/gif";
                          else if (ext === 'svg') mimeType = "image/svg+xml";
                          else if (ext === 'webp') mimeType = "image/webp";
                          else if (ext === 'mp3') mimeType = "audio/mpeg";
                          else if (ext === 'wav') mimeType = "audio/wav";
                          else if (ext === 'ogg') mimeType = "audio/ogg";
                          
                          asset.url = `data:${mimeType};base64,${base64}`;
                       }
                    }
                 }
              }
           } else {
              const text = await new Promise<string>((resolve, reject) => {
                 const reader = new FileReader();
                 reader.onload = (re) => resolve(re.target?.result as string);
                 reader.onerror = reject;
                 reader.readAsText(file);
              });
              proj = JSON.parse(text);
           }
           
           if (!proj || !proj.name) throw new Error("Invalid project");
           proj.id = Date.now().toString(); // always unique ID on import
           
           // Handle name collisions
           let newName = proj.name;
           let suffix = 1;
           while (projects.some(p => p.name === newName)) {
              newName = `${proj.name} (${suffix})`;
              suffix++;
           }
           proj.name = newName;
           proj.updatedAt = Date.now();
           await saveProjectDB(proj);
           const allP = await getProjects();
           setProjects(allP.sort((a,b) => b.updatedAt - a.updatedAt));
        } catch(err) {
           console.error("Import failed:", err);
           alert("Failed to import game. Invalid file or format.");
        }
     };
     input.click();
  };

  const handleDeleteProject = async (id: string) => {
     await deleteProjectDB(id);
     setProjects(projects.filter(p => p.id !== id));
  };

  const calculateSize = (proj: any) => {
     const str = JSON.stringify(proj);
     const kb = str.length / 1024;
     if (kb > 1024) return (kb / 1024).toFixed(2) + " MB";
     return kb.toFixed(1) + " KB";
  };

  const exportProject = async (proj: any, e: React.MouseEvent) => {
     e.stopPropagation();
     try {
       const jszip = (await import("jszip")).default;
       const zip = new jszip();
       const exportData = JSON.parse(JSON.stringify(proj));
       
       if (exportData.assets) {
          exportData.assets.forEach((asset: any) => {
             if (asset.url && (asset.url.startsWith("data:image") || asset.url.startsWith("data:audio"))) {
                const base64Data = asset.url.split(',')[1];
                const ext = asset.name.includes('.') ? asset.name.split('.').pop() : (asset.url.startsWith("data:image") ? 'png' : 'mp3');
                const fileName = `assets/${asset.id}.${ext}`;
                zip.file(fileName, base64Data, {base64: true});
                asset.url = fileName;
             }
          });
       }
       
       zip.file("project.json", JSON.stringify(exportData, null, 2));

       const nextConfigCode = `import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'export',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;`;
       zip.file("next.config.ts", nextConfigCode);

       // Transparent 1x1 png for image.png app icon placeholder
       const dummyImagePngObj = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAQSURBVBhXYzh8+PB/AAgwATEcAul3jW+mAAAAAElFTkSuQmCC";
       zip.file("image.png", dummyImagePngObj, {base64: true});

       const packageJsonCode = {
          "name": "my-game",
          "version": "1.0.0",
          "private": true,
          "scripts": {
             "dev": "next dev",
             "build": "next build",
             "start": "next start",
             "lint": "next lint"
          },
          "dependencies": {
             "next": "15.0.0",
             "react": "19.0.0",
             "react-dom": "19.0.0"
          }
       };
       zip.file("package.json", JSON.stringify(packageJsonCode, null, 2));

       const blob = await zip.generateAsync({ type: "blob" });
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `${proj.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
       a.click();
       URL.revokeObjectURL(url);
     } catch (err) {
       console.error("Failed to export:", err);
       alert("Failed to export project.");
     }
  };

  const handleSaveAndBack = async (projData: any) => {
     projData.updatedAt = Date.now();
     projData.size = JSON.stringify(projData).length;
     await saveProjectDB(projData);
     const p = await getProjects();
     setProjects(p.sort((a,b) => b.updatedAt - a.updatedAt));
     setCurrentProject(null);
  };

  if (currentProject) {
    return <GameEngineUI project={currentProject} onBack={handleSaveAndBack} />;
  }

  return (
    <div className="w-full h-screen bg-[#121212] flex flex-col text-[#e0e0e0] font-sans selection:bg-[#4a90e2] selection:text-white p-8 overflow-y-auto">
      {menuProjectId && (
         <div className="fixed inset-0 z-40" onPointerDown={() => { setMenuProjectId(null); setConfirmDeleteId(null); }}></div>
      )}
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => {
         const id = fileInputRef.current?.dataset.projectId;
         if (id) uploadThumbnail(id, e);
      }} />
      <div className="max-w-4xl w-full mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#333]">
           <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex justify-center items-center mr-4 shadow-lg">
                 <Box className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                APPLET ENGINE
              </h1>
           </div>
           <div className="flex space-x-3">
              <button 
                onClick={handleImportProject}
                className="px-4 py-2 bg-[#1e1e1e] border border-[#333] rounded hover:bg-[#333] flex items-center space-x-2 text-sm font-bold tracking-wider transition-colors"
               >
                 <Upload size={14} className="text-[#aaa]" />
                 <span>IMPORT</span>
              </button>
              <button 
                onClick={handleCreateProject}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded flex items-center space-x-2 text-sm font-bold tracking-wider transition-colors text-white shadow-lg"
               >
                 <Plus size={14} />
                 <span>NEW GAME</span>
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
           {projects.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-[#555]">
                 <Folder size={48} className="mb-4 opacity-50" />
                 <p className="font-bold tracking-widest uppercase">No games found</p>
                 <p className="text-sm mt-2">Create a new game to get started</p>
              </div>
           )}
           {projects.map(p => (
              <div 
                 key={p.id}
                 onClick={() => setCurrentProject(p)}
                 className="bg-[#1e1e1e] border border-[#333] rounded-xl overflow-hidden hover:border-[#555] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
              >
                 <div className="h-32 bg-[#2a2a2a] w-full flex items-center justify-center relative">
                    {p.thumbnailUrl ? ( <img src={p.thumbnailUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> ) : ( <Box size={40} className="text-[#444] group-hover:text-blue-500 transition-colors" /> )}
                    <div className="absolute top-2 right-2 flex space-x-1 opacity-100 transition-opacity">
                       <div className="relative">
                           <button onClick={(e) => { e.stopPropagation(); setMenuProjectId(menuProjectId === p.id ? null : p.id); setConfirmDeleteId(null); }} className="p-1 px-1.5 bg-black/50 hover:bg-black/80 rounded text-[#ddd] transition-colors"><MoreVertical size={16} /></button>
                           {menuProjectId === p.id && (
                              <div className="absolute top-full right-0 mt-1 w-32 bg-[#222] border border-[#444] rounded shadow-xl z-50 py-1" onClick={e => e.stopPropagation()}>
                                 <button onClick={(e) => { e.stopPropagation(); if(fileInputRef.current) { fileInputRef.current.dataset.projectId=p.id; fileInputRef.current.click(); } setConfirmDeleteId(null); setMenuProjectId(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-[#333] text-[#ddd] flex items-center space-x-2"><ImageIcon size={14} /> <span>Set Image</span></button>
                                 <button onClick={(e) => { e.stopPropagation(); exportProject(p, e); setConfirmDeleteId(null); setMenuProjectId(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-[#333] text-[#ddd] flex items-center space-x-2"><Download size={14} /> <span>Export</span></button>
                                 {confirmDeleteId === p.id ? (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); setConfirmDeleteId(null); }} className="w-full text-left px-3 py-2 text-xs bg-red-600 hover:bg-red-500 text-white flex items-center space-x-2 border-t border-[#444] mt-1 pt-1"><Trash2 size={14} /> <span>Confirm?</span></button>
                                 ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }} className="w-full text-left px-3 py-2 text-xs hover:bg-red-500 hover:text-white text-red-500 flex items-center space-x-2 border-t border-[#444] mt-1 pt-1"><Trash2 size={14} /> <span>Delete</span></button>
                                 )}
                              </div>
                           )}
                        </div>

                    </div>
                 </div>
                 <div className="p-4">
                    <div className="flex justify-between items-start mb-1 min-h[28px]">
                       {renamingProjectId === p.id ? (
                          <input 
                             autoFocus
                             defaultValue={p.name}
                             onBlur={(e) => {
                                const newName = e.target.value;
                                setProjects(projects.map(proj => proj.id === p.id ? { ...proj, name: newName } : proj));
                                saveProjectDB({ ...p, name: newName });
                                setRenamingProjectId(null);
                             }}
                             onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                             }}
                             onClick={(e) => e.stopPropagation()}
                             className="bg-[#333] text-white px-2 py-1 rounded w-full outline-none text-sm"
                          />
                       ) : (
                          <div className="flex w-full items-center justify-between">
                             <h3 className="font-bold text-lg truncate pr-2" onClick={(e) => {
                                e.stopPropagation();
                                setRenamingProjectId(p.id);
                             }} title="Click to rename">{p.name || "Untitled"}</h3>
                             <button 
                                onClick={(e) => {
                                   e.stopPropagation();
                                   setRenamingProjectId(p.id);
                                }}
                                className="text-[#666] hover:text-[#fff]"
                             >
                                <Pencil size={12} />
                             </button>
                          </div>
                       )}
                    </div>
                    <div className="flex justify-between items-center text-xs text-[#888] mt-2">
                       <span className="flex items-center"><Database size={10} className="mr-1" /> {p.size ? calculateSize(p) : '0 KB'}</span>
                       <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                 </div>
              </div>
           ))}
        </div>
      </div>
    </div>
  );
}
