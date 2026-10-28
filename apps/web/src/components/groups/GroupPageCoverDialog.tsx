import { useState } from "react";

import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { WizardFooter, WizardPopup } from "../ui/wizard";
import { cn } from "../../lib/utils";
import {
  GROUP_PAGE_COVER_CLASSES,
  GROUP_PAGE_COVER_LABELS,
  type GroupPageCoverId,
} from "../../groups/types";

const COVERS = Object.keys(GROUP_PAGE_COVER_CLASSES) as GroupPageCoverId[];

function CoverDialogBody({
  initial,
  onOpenChange,
  onSubmit,
}: {
  initial: GroupPageCoverId | "";
  onOpenChange: (open: boolean) => void;
  onSubmit: (cover: GroupPageCoverId | "") => void;
}) {
  const [cover, setCover] = useState<GroupPageCoverId | "">(initial);

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Capa da página</DialogTitle>
        <DialogDescription>
          A capa aparece no topo da página e ajuda a reconhecer o documento no quadro de páginas.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            aria-pressed={cover === ""}
            className={cn(
              "flex h-16 items-center justify-center rounded-lg border text-xs text-muted-foreground outline-hidden transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              cover === "" ? "border-ring bg-muted/60" : "border-border/60",
            )}
            onClick={() => setCover("")}
            type="button"
          >
            Sem capa
          </button>
          {COVERS.map((id) => (
            <button
              aria-label={GROUP_PAGE_COVER_LABELS[id]}
              aria-pressed={cover === id}
              className={cn(
                "relative flex h-16 items-end justify-start overflow-hidden rounded-lg border p-2 text-xs font-medium text-foreground outline-hidden transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                GROUP_PAGE_COVER_CLASSES[id],
                cover === id ? "border-ring" : "border-border/60",
              )}
              key={id}
              onClick={() => setCover(id)}
              type="button"
            >
              {GROUP_PAGE_COVER_LABELS[id]}
            </button>
          ))}
        </div>
        <div
          className={cn(
            "flex h-24 items-center justify-center rounded-lg border border-border/60 text-xs text-muted-foreground",
            cover === "" ? "bg-muted/30" : GROUP_PAGE_COVER_CLASSES[cover],
          )}
        >
          Prévia da capa
        </div>
      </div>
      <WizardFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancelar
        </Button>
        <Button
          onClick={() => {
            onSubmit(cover);
            onOpenChange(false);
          }}
        >
          Salvar capa
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function GroupPageCoverDialog({
  open,
  initial,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  initial: GroupPageCoverId | "";
  onOpenChange: (open: boolean) => void;
  onSubmit: (cover: GroupPageCoverId | "") => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <CoverDialogBody initial={initial} onOpenChange={onOpenChange} onSubmit={onSubmit} />
      ) : null}
    </Dialog>
  );
}
