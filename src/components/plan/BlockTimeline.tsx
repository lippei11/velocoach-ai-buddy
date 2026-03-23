import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PHASE_COLORS, PHASE_LABELS, BlockContext } from "@/types/pipeline";
import type { Database } from "@/integrations/supabase/types";
import type { Phase } from "@/lib/coaching/velocoach-interfaces";

type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

interface BlockTimelineProps {
  blocks: BlockRow[];
  blockContext: BlockContext | null;
  loading?: boolean;
}

export function BlockTimeline({ blocks, blockContext, loading }: BlockTimelineProps) {
  if (loading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  if (!blocks || blocks.length === 0) {
    return null;
  }

  const totalWeeks = blocks.reduce((sum, b) => sum + b.weeks, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Block Timeline
        </h3>
        {blockContext && (
          <Badge variant="outline" className="text-[10px]">
            Block {blockContext.blockNumber} · Week {blockContext.weekInBlock}/{blockContext.blockWeeks}
            {blockContext.isDeloadWeek ? " (Deload)" : ""}
          </Badge>
        )}
      </div>

      {/* Visual block bar */}
      <div className="flex h-10 rounded-lg overflow-hidden border border-border">
        {blocks.map((block) => {
          const phase = block.phase as Phase;
          const color = PHASE_COLORS[phase] ?? "#6B7280";
          const isCurrent = blockContext?.blockNumber === block.block_number;
          const widthPercent = totalWeeks > 0 ? (block.weeks / totalWeeks) * 100 : 100 / blocks.length;

          return (
            <div
              key={block.id}
              className="relative flex items-center justify-center text-[10px] font-medium transition-all border-r border-border/50 last:border-r-0"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: isCurrent ? color : color + "33",
                opacity: isCurrent ? 1 : 0.6,
              }}
              title={`Block ${block.block_number}: ${PHASE_LABELS[phase] ?? phase} (${block.weeks}w)`}
            >
              <span className={isCurrent ? "text-white font-bold" : "text-foreground"}>
                {PHASE_LABELS[phase]?.[0] ?? phase[0]?.toUpperCase()}{block.block_number_in_phase}
              </span>
              {isCurrent && (
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Block legend */}
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {blocks.map((block) => {
          const phase = block.phase as Phase;
          const color = PHASE_COLORS[phase] ?? "#6B7280";
          const isCurrent = blockContext?.blockNumber === block.block_number;
          return (
            <span key={block.id} className={`flex items-center gap-1 ${isCurrent ? "font-semibold text-foreground" : ""}`}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {PHASE_LABELS[phase] ?? phase} {block.block_number_in_phase} ({block.weeks}w)
            </span>
          );
        })}
      </div>
    </div>
  );
}
