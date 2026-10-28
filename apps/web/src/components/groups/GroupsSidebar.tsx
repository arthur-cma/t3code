import { useLocation, useNavigate } from "@tanstack/react-router";
import type { EnvironmentId } from "@t3tools/contracts";
import { BotIcon, HashIcon, MessageSquareIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";

import { isElectron } from "../../env";
import { groupInitials } from "../../groups/groupLogic";
import {
  dmChannelForMember,
  firstTextChannel,
  textChannels,
  useGroups,
  useGroupsStore,
} from "../../groups/groupStore";
import { parseGroupsLocation } from "../../groups/groupRoutes";
import { GROUP_ACCENT_CLASSES, GROUP_REPLY_MODE_LABELS } from "../../groups/types";
import { cn } from "../../lib/utils";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { SidebarChromeFooter, SidebarChromeHeader } from "../sidebar/SidebarChrome";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { AppAreaTabs } from "./AppAreaTabs";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupPagesSidebar } from "./GroupPagesSidebar";

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
  const { groupId, channelId, pageId } = parseGroupsLocation(location.pathname, location.searchStr);
  const activeGroup = groups.find((group) => group.id === groupId) ?? null;
  const [createOpen, setCreateOpen] = useState(false);
  const addPage = useGroupsStore((store) => store.addPage);
  const addSpace = useGroupsStore((store) => store.addSpace);

  const providerEntries = activeGroup?.projectRef
    ? deriveProviderInstanceEntries(
        providersByEnvironment.get(activeGroup.projectRef.environmentId as EnvironmentId) ?? [],
      )
    : [];

  const openChannel = (targetGroupId: string, targetChannelId: string) => {
    void navigate({
      to: "/groups/$groupId",
      params: { groupId: targetGroupId },
      search: { channel: targetChannelId },
    });
  };

  const openPage = (targetGroupId: string, targetPageId: string) => {
    void navigate({
      to: "/groups/$groupId",
      params: { groupId: targetGroupId },
      search: { page: targetPageId },
    });
  };

  const newPage = (targetGroupId: string, spaceId: string) => {
    const created = addPage(targetGroupId, { spaceId });
    if (created === null) return;
    openPage(targetGroupId, created);
  };

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
                const firstChannel = firstTextChannel(group);
                return (
                  <SidebarMenuItem key={group.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        if (firstChannel === null) return;
                        openChannel(group.id, firstChannel.id);
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
              <GroupPagesSidebar
                activePageId={pageId}
                group={activeGroup}
                onNewPage={(spaceId) => newPage(activeGroup.id, spaceId)}
                onNewSpace={(name) => {
                  addSpace(activeGroup.id, name);
                }}
                onOpenPage={(targetPageId) => openPage(activeGroup.id, targetPageId)}
              />
            </SidebarGroup>

            <SidebarGroup>
              <div className="flex items-center justify-between pr-1 pl-2">
                <SectionLabel>Canais</SectionLabel>
              </div>
              <SidebarMenu>
                {textChannels(activeGroup).map((channel) => (
                  <SidebarMenuItem key={channel.id}>
                    <SidebarMenuButton
                      isActive={channel.id === channelId}
                      onClick={() => openChannel(activeGroup.id, channel.id)}
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
              <SectionLabel>Mensagens diretas</SectionLabel>
              {activeGroup.members.length === 0 ? (
                <p className="px-2 pb-1 text-xs leading-relaxed text-sidebar-muted-foreground">
                  Adicione agentes para conversar em particular.
                </p>
              ) : (
                <SidebarMenu>
                  {activeGroup.members.map((member) => {
                    const dm = dmChannelForMember(activeGroup, member.id);
                    return (
                      <SidebarMenuItem key={member.id}>
                        <SidebarMenuButton
                          isActive={dm !== null && dm.id === channelId}
                          onClick={() => {
                            const channelIdForDm =
                              dm?.id ?? useGroupsStore.getState().openDm(activeGroup.id, member.id);
                            if (channelIdForDm === null || channelIdForDm === undefined) return;
                            openChannel(activeGroup.id, channelIdForDm);
                          }}
                          size="sm"
                        >
                          <MessageSquareIcon />
                          <span className="truncate">{member.name}</span>
                          {member.autoRespond ? (
                            <span
                              aria-label="Responde automaticamente"
                              className="ml-auto size-1.5 shrink-0 rounded-full bg-success"
                            />
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
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
                          {member.role.length > 0 ? (
                            <span className="shrink-0 truncate text-2xs">{member.role}</span>
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
