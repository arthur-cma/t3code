import { useLocation, useNavigate } from "@tanstack/react-router";
import type { EnvironmentId } from "@t3tools/contracts";
import { BotIcon, HashIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";

import { useEnvironmentProviders } from "../../state/environments";
import { isElectron } from "../../env";
import { cn } from "../../lib/utils";
import { groupInitials } from "../../groups/groupLogic";
import { useGroups } from "../../groups/groupStore";
import { parseGroupsLocation } from "../../groups/groupRoutes";
import { GROUP_ACCENT_CLASSES, GROUP_REPLY_MODE_LABELS } from "../../groups/types";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { SidebarChromeFooter, SidebarChromeHeader } from "../sidebar/SidebarChrome";
import {
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { AppAreaTabs } from "./AppAreaTabs";
import { CreateGroupDialog } from "./CreateGroupDialog";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-1 text-2xs font-medium tracking-wide text-sidebar-muted-foreground">
      {children}
    </div>
  );
}

export function GroupsSidebar() {
  const groups = useGroups();
  const providersByEnvironment = useEnvironmentProviders();
  const navigate = useNavigate();
  const location = useLocation({
    select: (current) => ({ pathname: current.pathname, searchStr: current.searchStr }),
  });
  const { groupId, channelId } = parseGroupsLocation(location.pathname, location.searchStr);
  const activeGroup = groups.find((group) => group.id === groupId) ?? null;
  const [createOpen, setCreateOpen] = useState(false);

  const providerEntries = activeGroup?.projectRef
    ? deriveProviderInstanceEntries(
        providersByEnvironment.get(activeGroup.projectRef.environmentId as EnvironmentId) ?? [],
      )
    : [];

  return (
    <>
      <SidebarChromeHeader isElectron={isElectron} />
      <SidebarContent
        className="min-h-full"
        fixedHeader={
          <div className="flex flex-col gap-2 pb-2">
            <SidebarGroup className="z-[1]">
              <AppAreaTabs className="mx-2" />
              <div className="flex items-center justify-between pr-1 pl-2">
                <SectionLabel>Grupos</SectionLabel>
                <Button
                  aria-label="Novo grupo"
                  onClick={() => setCreateOpen(true)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <PlusIcon />
                </Button>
              </div>
            </SidebarGroup>
          </div>
        }
      >
        <SidebarGroup>
          {groups.length === 0 ? (
            <p className="px-2 pb-2 text-xs leading-relaxed text-sidebar-muted-foreground">
              Crie um grupo para conversar com vários agentes em canais separados.
            </p>
          ) : (
            <SidebarMenu>
              {groups.map((group) => {
                const isActive = group.id === groupId;
                const firstChannel = group.channels[0];
                return (
                  <SidebarMenuItem key={group.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        if (firstChannel === undefined) return;
                        void navigate({
                          to: "/groups/$groupId",
                          params: { groupId: group.id },
                          search: { channel: firstChannel.id },
                        });
                      }}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md text-2xs font-semibold",
                          GROUP_ACCENT_CLASSES[group.accent],
                        )}
                      >
                        {groupInitials(group.name)}
                      </span>
                      <span className="truncate">{group.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}
        </SidebarGroup>

        {activeGroup ? (
          <>
            <SidebarGroup>
              <div className="flex items-center justify-between pr-1 pl-2">
                <SectionLabel>Canais</SectionLabel>
              </div>
              <SidebarMenu>
                {activeGroup.channels.map((channel) => (
                  <SidebarMenuItem key={channel.id}>
                    <SidebarMenuButton
                      isActive={channel.id === channelId}
                      onClick={() => {
                        void navigate({
                          to: "/groups/$groupId",
                          params: { groupId: activeGroup.id },
                          search: { channel: channel.id },
                        });
                      }}
                      size="sm"
                    >
                      <HashIcon />
                      <span className="truncate">{channel.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SectionLabel>Agentes</SectionLabel>
              {activeGroup.members.length === 0 ? (
                <p className="px-2 pb-1 text-xs leading-relaxed text-sidebar-muted-foreground">
                  Nenhum agente. Adicione um nas configurações do grupo.
                </p>
              ) : (
                <SidebarMenu>
                  {activeGroup.members.map((member) => {
                    const entry = providerEntries.find(
                      (candidate) => candidate.instanceId === member.instanceId,
                    );
                    return (
                      <SidebarMenuItem key={member.id}>
                        <div className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-sidebar-muted-foreground">
                          {entry ? (
                            <ProviderInstanceIcon
                              accentColor={entry.accentColor}
                              acpRegistryAgentId={entry.acpRegistryAgentId}
                              acpRegistryIconUrl={entry.acpRegistryIconUrl}
                              badgeContent="none"
                              displayName={entry.displayName}
                              driverKind={entry.driverKind}
                              size="compact"
                            />
                          ) : (
                            <BotIcon className="size-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{member.name}</span>
                          {member.autoRespond ? (
                            <span
                              aria-label="Responde automaticamente"
                              className="size-1.5 shrink-0 rounded-full bg-success"
                            />
                          ) : null}
                        </div>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      void navigate({ to: "/settings/groups" });
                    }}
                    size="sm"
                  >
                    <SettingsIcon />
                    <span>Configurações de grupos</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <div className="px-2 pb-3">
              <Badge size="sm" variant="secondary">
                {GROUP_REPLY_MODE_LABELS[activeGroup.replyMode]}
              </Badge>
            </div>
          </>
        ) : (
          <div className="px-2 pb-3">
            <Button
              className="w-full"
              onClick={() => setCreateOpen(true)}
              size="sm"
              variant="outline"
            >
              <PlusIcon />
              Novo grupo
            </Button>
          </div>
        )}
      </SidebarContent>
      <SidebarChromeFooter />
      <CreateGroupDialog onOpenChange={setCreateOpen} open={createOpen} />
    </>
  );
}
