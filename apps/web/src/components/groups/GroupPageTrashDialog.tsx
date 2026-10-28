import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { trashedPages, useGroupsStore } from "../../groups/groupStore";
import type { Group, GroupPage } from "../../groups/types";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { WizardFooter, WizardPopup } from "../ui/wizard";
import { GroupConfirmDialog } from "./GroupActionDialogs";

function TrashDialogBody({
  group,
  onOpenChange,
  onRestore,
  onRequestPurge,
  onRequestEmpty,
}: {
  group: Group;
  onOpenChange: (open: boolean) => void;
  onRestore: (page: GroupPage) => void;
  onRequestPurge: (page: GroupPage) => void;
  onRequestEmpty: () => void;
}) {
  const pages = trashedPages(group);

  return (
    <WizardPopup size="wide">
      <DialogHeader>
        <DialogTitle>Lixeira</DialogTitle>
        <DialogDescription>
          Páginas excluídas ficam aqui até serem restauradas ou apagadas definitivamente.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 px-6 py-5">
        {pages.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            A lixeira está vazia.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pages.map((page) => {
              const space = group.spaces.find((candidate) => candidate.id === page.spaceId);
              return (
                <li
                  className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5"
                  key={page.id}
                >
                  <span aria-hidden className="text-sm leading-none">
                    {page.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{page.title}</span>
                    <span className="block truncate text-2xs text-muted-foreground">
                      {space?.name ?? "Espaço removido"}
                      {page.deletedAt === null
                        ? ""
                        : ` · ${new Date(page.deletedAt).toLocaleString("pt-BR")}`}
                    </span>
                  </span>
                  <Button
                    aria-label={`Restaurar ${page.title}`}
                    onClick={() => onRestore(page)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <RotateCcwIcon />
                  </Button>
                  <Button
                    aria-label={`Excluir ${page.title} definitivamente`}
                    onClick={() => onRequestPurge(page)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <WizardFooter>
        <Button disabled={pages.length === 0} onClick={onRequestEmpty} variant="outline">
          <Trash2Icon />
          Esvaziar lixeira
        </Button>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Fechar
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function GroupPageTrashDialog({
  group,
  open,
  onOpenChange,
  onRestored,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (pageId: string) => void;
}) {
  const restorePage = useGroupsStore((store) => store.restorePage);
  const deletePageForever = useGroupsStore((store) => store.deletePageForever);
  const emptyPageTrash = useGroupsStore((store) => store.emptyPageTrash);
  const [confirmPurge, setConfirmPurge] = useState<GroupPage | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        {open ? (
          <TrashDialogBody
            group={group}
            onOpenChange={onOpenChange}
            onRequestEmpty={() => setConfirmEmpty(true)}
            onRequestPurge={setConfirmPurge}
            onRestore={(page) => {
              if (!restorePage(group.id, page.id)) return;
              onRestored(page.id);
              onOpenChange(false);
            }}
          />
        ) : null}
      </Dialog>
      <GroupConfirmDialog
        confirmLabel="Excluir definitivamente"
        description="A página e as subpáginas serão apagadas para sempre. Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (confirmPurge !== null) deletePageForever(group.id, confirmPurge.id);
          setConfirmPurge(null);
        }}
        onOpenChange={(open) => {
          if (!open) setConfirmPurge(null);
        }}
        open={confirmPurge !== null}
        title={`Excluir ${confirmPurge?.title ?? "página"} para sempre?`}
      />
      <GroupConfirmDialog
        confirmLabel="Esvaziar lixeira"
        description="Todas as páginas da lixeira serão apagadas para sempre. Esta ação não pode ser desfeita."
        onConfirm={() => {
          emptyPageTrash(group.id);
          setConfirmEmpty(false);
        }}
        onOpenChange={setConfirmEmpty}
        open={confirmEmpty}
        title="Esvaziar a lixeira?"
      />
    </>
  );
}
