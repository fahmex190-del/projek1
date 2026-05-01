const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

const regex = /{editingExpr &&[\s\S]*?Cancel[\s\S]*?Save[\s\S]*?\}\)\(\)}/;

const replaceStr = `{editingExpr && (() => {
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
               onApply={applyExpr}
               onCancel={() => setEditingExpr(null)}
            />
          );
        })()}`;

if(code.match(regex)) {
   code = code.replace(regex, replaceStr);
   fs.writeFileSync('app/page.tsx', code);
   console.log('Replaced');
} else {
   console.log('Not matched');
}

