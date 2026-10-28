import { useLocation, useNavigate } from "@tanstack/react-router";
import type { EnvironmentId } from "@t3tools/contracts";
import {
  BotIcon,
  CopyIcon,
  FilePlus2Icon,
  HashIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
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
import {
  GROUP_ACCENT_CLASSES,
  GROUP_REPLY_MODE_LABELS,
  type Group,
  type GroupChannel,
  type GroupMember,
} from "../../groups/types";
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
import { GroupConfirmDialog, GroupTextDialog } from "./GroupActionDialogs";
import { GroupAgentConfigDialog } from "./GroupAgentConfigDialog";
import {
  GroupContextMenu,
  useGroupContextMenu,
  type GroupContextMenuItem,
} from "./GroupContextMenu";
import { CreateChannelDialog, CreatePageDialog } from "./GroupCreateDialogs";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GroupPagesSidebar } from "./GroupPagesSidebar";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-1 text-2xs font-medium tracking-wide text-sidebar-muted-foreground">
      {children}
    </div>
  );
}

type RenameTarget =
  | {
      kind: "channel";
      groupId: string;
      channelId: string;
      field: "name" | "topic";
      value: string;
      channelName: string;
    }
  | { kind: "group"; groupId: string; value: string; name: string };

type ConfirmTarget =
  | { kind: "channel"; groupId: string; channelId: string; name: string }
  | { kind: "group"; groupId: string; name: string }
  | { kind: "agent"; groupId: string; memberId: string; name: string };

export function GroupsSidebar() {
  const groups = useGroups();
  const providersByEnvironment = useEnvironmentProviders();
  const navigate = useNavigate();
  const location = useLocation({
    select: (current) => ({ pathname: current.pathname, searchStr: current.searchStr }),
  });
  const { groupId, channelId, pageId } = parseGroupsLocation(location.pathname, location.searchStr);
  const activeGroup = groups.find((group) => group.id === groupId) ?? null;
  const updateChannel = useGroupsStore((store) => store.updateChannel);
  const updateGroup = useGroupsStore((store) => store.updateGroup);
  const addChannel = useGroupsStore((store) => store.addChannel);
  const deleteChannel = useGroupsStore((store) => store.deleteChannel);
  const deleteGroup = useGroupsStore((store) => store.deleteGroup);
  const removeMember = useGroupsStore((store) => store.removeMember);

  const [createOpen, setCreateOpen] = useState(false);
  const [channelGroupId, setChannelGroupId] = useState<string | null>(null);
  const [pageGroupId, setPageGroupId] = useState<string | null>(null);
  const [configMember, setConfigMember] = useState<{ groupId: string; memberId: string } | null>(
    null,
  );
  const [rename, setRename] = useState<RenameTarget | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const groupMenu = useGroupContextMenu<Group>();
  const channelMenu = useGroupContextMenu<GroupChannel>();
  const agentMenu = useGroupContextMenu<GroupMember>();
  const groupSectionMenu = useGroupContextMenu<null>();
  const channelSectionMenu = useGroupContextMenu<null>();

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

  const openFirstChannel = (targetGroupId: string) => {
    const target = groups.find((group) => group.id === targetGroupId) ?? null;
    const first = target === null ? null : firstTextChannel(target);
    void navigate({
      to: "/groups/$groupId",
      params: { groupId: targetGroupId },
      search: first === null ? {} : { channel: first.id },
    });
  };

  const openDmFor = (targetGroupId: string, memberId: string) => {
    const target = groups.find((group) => group.id === targetGroupId) ?? null;
    if (target === null) return;
    const dm = dmChannelForMember(target, memberId);
    const targetChannelId = dm?.id ?? useGroupsStore.getState().openDm(targetGroupId, memberId);
    if (targetChannelId === null || targetChannelId === undefined) return;
    openChannel(targetGroupId, targetChannelId);
  };

  const duplicateChannel = (group: Group, channel: GroupChannel) => {
    const base = `${channel.name}-copia`;
    const existing = new Set(textChannels(group).map((candidate) => candidate.name.toLowerCase()));
    let candidate = base;
    let index = 2;
    while (existing.has(candidate.toLowerCase())) {
      candidate = `${base}-${index}`;
      index += 1;
    }
    const created = addChannel(group.id, candidate, channel.topic);
    if (created !== null) openChannel(group.id, created);
  };

  const channelItems = (group: Group, channel: GroupChannel): GroupContextMenuItem[] => [
    {
      id: "open",
      label: "Abrir canal",
      icon: <HashIcon />,
      onSelect: () => openChannel(group.id, channel.id),
    },
    {
      id: "rename",
      label: "Renomear canal",
      icon: <PencilIcon />,
      onSelect: () =>
        setRename({
          kind: "channel",
          groupId: group.id,
          channelId: channel.id,
          field: "name",
          value: channel.name,
          channelName: channel.name,
        }),
    },
    {
      id: "topic",
      label: "Editar tópico",
      icon: <PencilIcon />,
      onSelect: () =>
        setRename({
          kind: "channel",
          groupId: group.id,
          channelId: channel.id,
          field: "topic",
          value: channel.topic,
          channelName: channel.name,
        }),
    },
    {
      id: "duplicate",
      label: "Duplicar canal",
      icon: <CopyIcon />,
      onSelect: () => duplicateChannel(group, channel),
    },
    {
      id: "delete",
      label: "Excluir canal",
      icon: <Trash2Icon />,
      separatorBefore: true,
      variant: "destructive",
      disabled: textChannels(group).length <= 1,
      onSelect: () =>
        setConfirm({
          kind: "channel",
          groupId: group.id,
          channelId: channel.id,
          name: channel.name,
        }),
    },
  ];

  const agentItems = (group: Group, member: GroupMember): GroupContextMenuItem[] => [
    {
      id: "dm",
      label: "Abrir conversa direta",
      icon: <MessageSquareIcon />,
      onSelect: () => openDmFor(group.id, member.id),
    },
    {
      id: "configure",
      label: "Configurar agente",
      icon: <SettingsIcon />,
      onSelect: () => setConfigMember({ groupId: group.id, memberId: member.id }),
    },
    {
      id: "remove",
      label: "Remover agente",
      icon: <Trash2Icon />,
      separatorBefore: true,
      variant: "destructive",
      onSelect: () =>
        setConfirm({ kind: "agent", groupId: group.id, memberId: member.id, name: member.name }),
    },
  ];

  const groupItems = (group: Group): GroupContextMenuItem[] => [
    {
      id: "open",
      label: "Abrir grupo",
      icon: <MessageSquareIcon />,
      onSelect: () => openFirstChannel(group.id),
    },
    {
      id: "new-channel",
      label: "Novo canal",
      icon: <HashIcon />,
      onSelect: () => setChannelGroupId(group.id),
    },
    {
      id: "new-page",
      label: "Nova página",
      icon: <FilePlus2Icon />,
      disabled: group.spaces.length === 0,
      onSelect: () => setPageGroupId(group.id),
    },
    {
      id: "rename",
      label: "Renomear grupo",
      icon: <PencilIcon />,
      separatorBefore: true,
      onSelect: () =>
        setRename({ kind: "group", groupId: group.id, value: group.name, name: group.name }),
    },
    {
      id: "settings",
      label: "Configurações de grupos",
      icon: <SettingsIcon />,
      onSelect: () => {
        void navigate({ to: "/settings/groups" });
      },
    },
    {
      id: "delete",
      label: "Excluir grupo",
      icon: <Trash2Icon />,
      variant: "destructive",
      onSelect: () => setConfirm({ kind: "group", groupId: group.id, name: group.name }),
    },
  ];

  const submitRename = (value: string) => {
    if (rename === null) return;
    if (rename.kind === "group") {
      updateGroup(rename.groupId, { name: value });
      setRename(null);
      return;
    }
    updateChannel(
      rename.groupId,
      rename.channelId,
      rename.field === "name" ? { name: value.replace(/^#/, "") } : { topic: value },
    );
    setRename(null);
  };

  const submitConfirm = () => {
    if (confirm === null) return;
    if (confirm.kind === "channel") {
      const deleted = deleteChannel(confirm.groupId, confirm.channelId);
      if (deleted && confirm.channelId === channelId) openFirstChannel(confirm.groupId);
    } else if (confirm.kind === "group") {
      deleteGroup(confirm.groupId);
      if (confirm.groupId === groupId) void navigate({ to: "/groups" });
    } else {
      const target = groups.find((group) => group.id === confirm.groupId) ?? null;
      const dm = target === null ? null : dmChannelForMember(target, confirm.memberId);
      removeMember(confirm.groupId, confirm.memberId);
      if (dm !== null && dm.id === channelId) openFirstChannel(confirm.groupId);
    }
    setConfirm(null);
  };

  const channelDialogGroup = groups.find((group) => group.id === channelGroupId) ?? null;
  const pageDialogGroup = groups.find((group) => group.id === pageGroupId) ?? null;
  const configDialogGroup = groups.find((group) => group.id === configMember?.groupId) ?? null;

  return (
    <>
      <SidebarChromeHeader isElectron={isElectron} />
      <SidebarContent
        className="min-h-full"
        fixedHeader={
          <div className="flex flex-col gap-2 pb-2">
            <SidebarGroup className="z-[1]">
              <AppAreaTabs className="mx-2" />
              <div
                className="flex items-center justify-between pr-1 pl-2"
                onContextMenu={(event) => groupSectionMenu.openMenu(event, null)}
              >
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
                      onContextMenu={(event) => groupMenu.openMenu(event, group)}
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
                onClearPage={() => openFirstChannel(activeGroup.id)}
                onOpenPage={(targetPageId) => openPage(activeGroup.id, targetPageId)}
              />
            </SidebarGroup>

            <SidebarGroup>
              <div
                className="flex items-center justify-between pr-1 pl-2"
                onContextMenu={(event) => channelSectionMenu.openMenu(event, null)}
              >
                <SectionLabel>Canais</SectionLabel>
                <Button
                  aria-label="Novo canal"
                  onClick={() => setChannelGroupId(activeGroup.id)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <PlusIcon />
                </Button>
              </div>
              <SidebarMenu>
                {textChannels(activeGroup).map((channel) => (
                  <SidebarMenuItem key={channel.id}>
                    <SidebarMenuButton
                      isActive={channel.id === channelId}
                      onClick={() => openChannel(activeGroup.id, channel.id)}
                      onContextMenu={(event) => channelMenu.openMenu(event, channel)}
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
                          onClick={() => openDmFor(activeGroup.id, member.id)}
                          onContextMenu={(event) => agentMenu.openMenu(event, member)}
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
                        <div
                          className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-sidebar-muted-foreground hover:bg-accent/60"
                          onContextMenu={(event) => agentMenu.openMenu(event, member)}
                        >
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

      <GroupContextMenu
        items={groupMenu.state === null ? [] : groupItems(groupMenu.state.target)}
        onClose={groupMenu.closeMenu}
        point={groupMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={
          channelMenu.state === null || activeGroup === null
            ? []
            : channelItems(activeGroup, channelMenu.state.target)
        }
        onClose={channelMenu.closeMenu}
        point={channelMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={
          agentMenu.state === null || activeGroup === null
            ? []
            : agentItems(activeGroup, agentMenu.state.target)
        }
        onClose={agentMenu.closeMenu}
        point={agentMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={[
          {
            id: "new-group",
            label: "Novo grupo",
            icon: <PlusIcon />,
            onSelect: () => setCreateOpen(true),
          },
        ]}
        onClose={groupSectionMenu.closeMenu}
        point={groupSectionMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={[
          {
            id: "new-channel",
            label: "Novo canal",
            icon: <HashIcon />,
            disabled: activeGroup === null,
            onSelect: () => {
              if (activeGroup !== null) setChannelGroupId(activeGroup.id);
            },
          },
        ]}
        onClose={channelSectionMenu.closeMenu}
        point={channelSectionMenu.state?.point ?? null}
      />

      <CreateGroupDialog onOpenChange={setCreateOpen} open={createOpen} />
      {channelDialogGroup === null ? null : (
        <CreateChannelDialog
          group={channelDialogGroup}
          onCreated={(createdChannelId) => {
            setChannelGroupId(null);
            openChannel(channelDialogGroup.id, createdChannelId);
          }}
          onOpenChange={(open) => {
            if (!open) setChannelGroupId(null);
          }}
          open
        />
      )}
      {pageDialogGroup === null ? null : (
        <CreatePageDialog
          group={pageDialogGroup}
          onCreated={(createdPageId) => {
            setPageGroupId(null);
            openPage(pageDialogGroup.id, createdPageId);
          }}
          onOpenChange={(open) => {
            if (!open) setPageGroupId(null);
          }}
          open
        />
      )}
      {configDialogGroup === null || configMember === null ? null : (
        <GroupAgentConfigDialog
          group={configDialogGroup}
          member={
            configDialogGroup.members.find((member) => member.id === configMember.memberId) ?? null
          }
          onOpenChange={(open) => {
            if (!open) setConfigMember(null);
          }}
          open
        />
      )}
      <GroupTextDialog
        confirmLabel="Salvar"
        description={
          rename?.kind === "group"
            ? "O nome aparece no sidebar, nos convites e no cabeçalho dos canais."
            : rename?.field === "topic"
              ? `O tópico aparece abaixo do nome de #${rename.channelName}.`
              : "O novo nome aparece no sidebar e no cabeçalho do canal."
        }
        initialValue={rename?.value ?? ""}
        label={
          rename?.kind === "group"
            ? "Nome do grupo"
            : rename?.field === "topic"
              ? "Tópico"
              : "Nome do canal"
        }
        multiline={rename?.kind === "channel" && rename.field === "topic"}
        onOpenChange={(open) => {
          if (!open) setRename(null);
        }}
        onSubmit={submitRename}
        open={rename !== null}
        placeholder={
          rename?.kind === "group"
            ? "Estúdio"
            : rename?.field === "topic"
              ? "Assuntos deste canal"
              : "geral"
        }
        title={
          rename?.kind === "group"
            ? "Renomear grupo"
            : rename?.field === "topic"
              ? "Editar tópico"
              : "Renomear canal"
        }
      />
      <GroupConfirmDialog
        confirmLabel={
          confirm?.kind === "channel"
            ? "Excluir canal"
            : confirm?.kind === "group"
              ? "Excluir grupo"
              : "Remover agente"
        }
        description={
          confirm?.kind === "channel"
            ? "O histórico local deste canal será removido. Esta ação não pode ser desfeita."
            : confirm?.kind === "group"
              ? "O grupo, os canais e o histórico local serão removidos. As threads dos agentes continuam no T3 Code."
              : "O agente sai do grupo e das conversas diretas. As threads dele continuam no T3 Code."
        }
        onConfirm={submitConfirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        open={confirm !== null}
        title={
          confirm === null
            ? "Confirmar?"
            : confirm.kind === "channel"
              ? `Excluir canal #${confirm.name}?`
              : confirm.kind === "group"
                ? `Excluir grupo ${confirm.name}?`
                : `Remover ${confirm.name}?`
        }
      />
    </>
  );
}
