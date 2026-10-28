import { NetworkIcon } from "lucide-react";

import { buildPageGraph } from "../../groups/pageLogic";
import type { Group } from "../../groups/types";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { WizardPopup } from "../ui/wizard";

const GRAPH_WIDTH = 640;
const GRAPH_HEIGHT = 420;

export function GroupPageGraph({
  group,
  open,
  onOpenChange,
  onOpenPage,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPage: (pageId: string) => void;
}) {
  const graph = buildPageGraph(group.pages);
  const count = graph.nodes.length;
  const radius = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) / 2 - 56;
  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;

  const positions = new Map(
    graph.nodes.map((node, index) => {
      const angle = count === 0 ? 0 : (index / count) * Math.PI * 2 - Math.PI / 2;
      return [
        node.id,
        {
          x: count === 1 ? centerX : centerX + Math.cos(angle) * radius,
          y: count === 1 ? centerY : centerY + Math.sin(angle) * radius,
        },
      ] as const;
    }),
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <WizardPopup size="wide">
        <DialogHeader>
          <DialogTitle>Grafo de páginas</DialogTitle>
          <DialogDescription>
            Conexões criadas com [[wikilinks]]. Clique em uma página para abrir.
          </DialogDescription>
        </DialogHeader>

        {count === 0 ? (
          <div className="px-6 py-8">
            <Empty size="compact">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <NetworkIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhuma página para mapear</EmptyTitle>
                <EmptyDescription>
                  Crie páginas e conecte-as com [[outra página]] para montar o grafo.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="scrollbar-gutter-both overflow-auto px-4 py-4">
            <svg
              aria-label="Grafo de páginas do grupo"
              className="mx-auto block max-w-full"
              role="img"
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            >
              {graph.edges.map((edge) => {
                const from = positions.get(edge.from);
                const to = positions.get(edge.to);
                if (from === undefined || to === undefined) return null;
                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    stroke="currentColor"
                    strokeOpacity={0.25}
                    strokeWidth={1}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const position = positions.get(node.id);
                if (position === undefined) return null;
                return (
                  <g
                    className="cursor-pointer text-foreground"
                    key={node.id}
                    onClick={() => {
                      onOpenPage(node.id);
                      onOpenChange(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onOpenPage(node.id);
                      onOpenChange(false);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <circle
                      cx={position.x}
                      cy={position.y}
                      fill="var(--color-card)"
                      r={node.links > 0 ? 8 : 5}
                      stroke="currentColor"
                      strokeOpacity={node.links > 0 ? 0.6 : 0.3}
                      strokeWidth={1.5}
                    />
                    <text
                      className="fill-current text-2xs"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      x={position.x}
                      y={position.y + 20}
                    >
                      {node.title.length > 18 ? `${node.title.slice(0, 17)}…` : node.title}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            {count} página(s) · {graph.edges.length} conexão(ões)
          </p>
          <Button onClick={() => onOpenChange(false)} size="sm">
            Fechar
          </Button>
        </div>
      </WizardPopup>
    </Dialog>
  );
}
