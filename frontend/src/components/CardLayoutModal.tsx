import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";

export type SideConfig = { character: boolean; pinyin: boolean; meaning: boolean; audio: boolean };

const FIELDS: { key: keyof SideConfig; label: string }[] = [
  { key: "character", label: "Character" },
  { key: "pinyin", label: "Pinyin" },
  { key: "meaning", label: "Meaning" },
  { key: "audio", label: "Audio" },
];

function FieldPicker({ value, onChange }: { value: SideConfig; onChange: (v: SideConfig) => void }) {
  return (
    <div className="flex gap-4">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Checkbox checked={value[f.key]} onCheckedChange={(c) => onChange({ ...value, [f.key]: !!c })} />
          {f.label}
        </label>
      ))}
    </div>
  );
}

/** Front/back card layout picker, reused by deck creation and deck layout settings. */
export function CardLayoutModal({
  open, onOpenChange, initialFront, initialBack, onSave, busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialFront?: SideConfig;
  initialBack?: SideConfig;
  onSave: (front: SideConfig, back: SideConfig) => void;
  busy?: boolean;
}) {
  const [front, setFront] = useState<SideConfig>(initialFront ?? { character: true, pinyin: false, meaning: false, audio: false });
  const [back, setBack] = useState<SideConfig>(initialBack ?? { character: false, pinyin: true, meaning: true, audio: false });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="paper max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-1.5">
            <Settings2 className="h-5 w-5 text-secondary" /> Card layout <InfoTip id="cardLayout" />
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Front shows</p>
            <FieldPicker value={front} onChange={setFront} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Back shows</p>
            <FieldPicker value={back} onChange={setBack} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSave(front, back)} disabled={busy}>Save layout</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
