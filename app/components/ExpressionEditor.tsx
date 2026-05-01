import React, { useState } from "react";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Assuming types from page.tsx (you may move these to a types file later)

type Props = {
  initialExpr: string;
  variables: any[];
  localVars: any[];
  objects: any[];
  currentObjId?: string;
  onApply: (expr: string) => void;
  onCancel: () => void;
};

export default function ExpressionEditor({
  initialExpr,
  variables,
  localVars,
  objects,
  currentObjId,
  onApply,
  onCancel,
}: Props) {
  const [expr, setExpr] = useState(initialExpr === "none" ? "" : initialExpr);
  const [expandedObj, setExpandedObj] = useState<string | null>(null);

  const insert = (val: string) => {
    setExpr((prev) =>
      prev ? prev + (prev.endsWith(" ") ? "" : " ") + val : val,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-[#333] shadow-2xl w-full max-w-3xl rounded-xl flex overflow-hidden max-h-[80vh]">
        {/* Left Side: Input */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex justify-between items-center mb-4 text-[#888]">
            <span className="text-xs font-bold uppercase tracking-widest text-white">
              Edit Expression
            </span>
          </div>

          <textarea
            autoFocus
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            className="w-full h-full min-h-[150px] bg-[#111] border border-[#3a3a3a] rounded p-3 text-sm font-mono focus:border-[#4a90e2] outline-none text-[#e0e0e0] mb-4 resize-none"
            placeholder="Enter value or expression..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onApply(expr);
              }
            }}
          />

          <div className="flex justify-end gap-2 mt-auto">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-[#333] hover:bg-[#444] text-[#aaa] rounded text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(expr)}
              className="px-4 py-2 bg-[#4a90e2] hover:bg-[#5b9cf2] text-white rounded text-xs font-bold"
            >
              Save
            </button>
          </div>
        </div>

        {/* Right Side: Properties Sidebar */}
        <div className="w-64 bg-[#222] border-l border-[#333] flex flex-col overflow-y-auto p-3 space-y-4 shadow-inner">
          <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider sticky top-0 bg-[#222] pb-2 z-10 border-b border-[#333]">
            Properties
          </div>

          {/* Math Utils */}
          <div>
            <div className="text-xs text-[#ccc] font-semibold mb-1">
              Math / Logics
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                "Math.sin(",
                "Math.cos(",
                "Math.abs(",
                "Math.floor(",
                "Math.random()",
                "true",
                "false",
                '""',
              ].map((m) => (
                <button
                  key={m}
                  onClick={() => insert(m)}
                  className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#444] text-[9px] text-[#e0e0e0] font-mono px-1.5 py-0.5 rounded"
                >
                  {m.replace("Math.", "")}
                </button>
              ))}
            </div>
          </div>

          {/* Globals */}
          {variables.length > 0 && (
            <div>
              <div className="text-xs text-[#ccc] font-semibold mb-1">
                Globals
              </div>
              <div className="flex flex-wrap gap-1">
                {variables.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => insert(`g.${v.name}`)}
                    className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#e2a84a]/30 text-[9px] text-[#e2a84a] font-mono px-1.5 py-0.5 rounded"
                  >
                    g.{v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Locals */}
          {localVars && localVars.length > 0 && (
            <div>
              <div className="text-xs text-[#ccc] font-semibold mb-1">
                Locals
              </div>
              <div className="flex flex-wrap gap-1">
                {localVars.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => insert(`l.${v.name}`)}
                    className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#4ae28e]/30 text-[9px] text-[#4ae28e] font-mono px-1.5 py-0.5 rounded"
                  >
                    l.{v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generic Touch State */}
          <div>
            <div className="text-xs text-[#ccc] font-semibold mb-1">
              Pointer Output Variables
            </div>
            <div className="grid grid-cols-2 gap-1 bg-[#1a1a1a] p-1 border border-[#333] rounded mb-2">
              {[
                "g.touchdown_x", "g.touchdown_y",
                "g.touchmove_x", "g.touchmove_y",
                "g.touchup_x", "g.touchup_y",
                "g.touchdelta_x", "g.touchdelta_y"
              ].map((val) => (
                <button
                  key={val}
                  onClick={() => insert(val)}
                  className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#ffb142]/20 text-[9px] text-[#ffb142] font-mono px-1 py-1 rounded text-left truncate"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Self Properties */}
          <div>
            <div className="text-xs text-[#ccc] font-semibold mb-1">
              Self Properties
            </div>
            <div className="grid grid-cols-2 gap-1 bg-[#1a1a1a] p-1 border border-[#333] rounded mb-2">
              {[
                { lbl: "Position X", val: "positionX" },
                { lbl: "Position Y", val: "positionY" },
                { lbl: "Velocity X", val: "velocityX" },
                { lbl: "Velocity Y", val: "velocityY" },
                { lbl: "Angle", val: "angle" },
                { lbl: "Scale X", val: "scaleX" },
                { lbl: "Scale Y", val: "scaleY" },
                { lbl: "Opacity", val: "opacity" },
              ].map((prop) => (
                <button
                  key={prop.val}
                  onClick={() => insert(prop.val)}
                  className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#ff6b6b]/20 text-[9px] text-[#ff6b6b] font-mono px-1 py-1 rounded text-left truncate"
                  title={prop.lbl}
                >
                  {prop.val}
                </button>
              ))}
            </div>
          </div>

          {/* Objects & Properties */}
          <div>
            <div className="text-xs text-[#ccc] font-semibold mb-1">
              Other Objects Properties
            </div>
            <div className="space-y-1">
              {objects.filter(o => o.id !== currentObjId).map((o) => (
                <div
                  key={o.id}
                  className="bg-[#1a1a1a] border border-[#333] rounded overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedObj(expandedObj === o.id ? null : o.id)
                    }
                    className="flex items-center justify-between w-full px-2 py-1 text-xs text-[#e0e0e0] hover:bg-[#2a2a2a] font-bold"
                  >
                    <span className="truncate">{o.name}</span>
                    {expandedObj === o.id ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                  </button>
                  {expandedObj === o.id && (
                    <div className="p-1 grid grid-cols-2 gap-1 bg-[#111]">
                      {[
                        { lbl: "Position X", val: "positionX" },
                        { lbl: "Position Y", val: "positionY" },
                        { lbl: "Velocity X", val: "velocityX" },
                        { lbl: "Velocity Y", val: "velocityY" },
                        { lbl: "Angle", val: "angle" },
                        { lbl: "Scale X", val: "scaleX" },
                        { lbl: "Scale Y", val: "scaleY" },
                      ].map((prop) => (
                        <button
                          key={prop.val}
                          onClick={() => insert(`obj('${o.name}').${prop.val}`)}
                          className="bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#4a90e2]/20 text-[9px] text-[#4a90e2] font-mono px-1 py-1 rounded text-left truncate"
                          title={prop.lbl}
                        >
                          {prop.val}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
