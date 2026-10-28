import { useNavigate } from "@tanstack/react-router";
import { HashIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { isElectron } from "../../env";
import { useGroups } from "../../groups/groupStore";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";
import { SidebarInset } from "../ui/sidebar";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupAvatar } from "./GroupAvatar";

export function GroupsOverviewPage() {
  const groups = useGroups();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden" role="main">
      <WorkspacePageHeader className="gap-2 border-b border-border/60" electron={isElectron}>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">Grupos</h1>
          <p className="truncate text-xs text-muted-foreground">
            Canais compartilhados com agentes dos seus provedores
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <PlusIcon />
          Novo grupo
        </Button>
      </WorkspacePageHeader>

      <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {groups.length === 0 ? (
            <Empty size="hero">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum grupo ainda</EmptyTitle>
                <EmptyDescription>
                  Grupos são espaços de conversa com canais e vários agentes ao mesmo tempo. Cada
                  agente mantém uma thread própria no T3 Code.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setCreateOpen(true)} size="sm">
                  <PlusIcon />
                  Criar primeiro grupo
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => {
                const firstChannel = group.channels[0];
                return (
                  <li key={group.id}>
                    <button
                      className="flex w-full flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-border hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => {
                        if (firstChannel === undefined) return;
                        void navigate({
                          to: "/groups/$groupId",
                          params: { groupId: group.id },
                          search: { channel: firstChannel.id },
                        });
                      }}
                      type="button"
                    >
                      <div className="flex w-full items-start gap-3">
                        <GroupAvatar group={group} />
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-sm font-semibold text-foreground">
                            {group.name}
                          </h2>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {group.description || "Sem descrição"}
                          </p>
                        </div>
                        <Badge size="sm" variant="secondary">
                          {group.replyMode === "auto" ? "Automático" : "Menções"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <HashIcon className="size-3" />
                          {group.channels.length} {group.channels.length === 1 ? "canal" : "canais"}
                        </span>
                        <span className="flex items-center gap-1">
                          <UsersIcon className="size-3" />
                          {group.members.length} {group.members.length === 1 ? "agente" : "agentes"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <CreateGroupDialog onOpenChange={setCreateOpen} open={createOpen} />
    </SidebarInset>
  );
}
