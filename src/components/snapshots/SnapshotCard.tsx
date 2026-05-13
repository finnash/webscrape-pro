import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Play, Sparkles, FileText, Users, FlaskConical, Settings2 } from "lucide-react";
import type { SnapshotKind } from "@/lib/snapshots";

const kindIcon: Record<SnapshotKind, any> = {
  medium: FileText,
  reddit: Sparkles,
  leads: Users,
  research: FlaskConical,
  custom: Settings2,
};

export const SnapshotCard = ({
  name,
  kind,
  description,
  badge,
  estimatedCredits,
  onRun,
  onEdit,
}: {
  name: string;
  kind: SnapshotKind;
  description: string;
  badge?: string;
  estimatedCredits?: number;
  onRun: () => void;
  onEdit?: () => void;
}) => {
  const Icon = kindIcon[kind] || Camera;
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/40 transition group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-fire/10 flex items-center justify-center text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{name}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{kind}</div>
          </div>
        </div>
        {badge && <Badge variant="secondary" className="text-[9px]">{badge}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{description}</p>
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border">
        {estimatedCredits != null ? (
          <span className="text-[10px] text-muted-foreground">~{estimatedCredits} credits / run</span>
        ) : <span />}
        <div className="flex gap-1.5">
          {onEdit && (
            <Button onClick={onEdit} variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
          )}
          <Button onClick={onRun} size="sm" className="h-7 text-xs bg-gradient-fire">
            <Play className="h-3 w-3 mr-1" /> Run
          </Button>
        </div>
      </div>
    </div>
  );
};