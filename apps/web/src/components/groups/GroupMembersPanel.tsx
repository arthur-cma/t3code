import { AtSignIcon, BotIcon, SettingsIcon, Trash2Icon, UserIcon } from "lucide-react";
import { useState } from "react";

import { groupInitials } from "../../groups/groupLogic";
import { useGroupsStore } from "../../groups/groupStore";
import {
  GROUP_ACCENT_CLASSES,
  type Group,
  type GroupMember,
  type GroupPerson,
} from "../../groups/types";
import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { GroupConfirmDialog } from "./GroupActionDialogs";
import {
  GroupContextMenu,
  useGroupContextMenu,
  type GroupContextMenuItem,
} from "./GroupContextMenu";

function PersonRow({
  person,
  onContextMenu,
}: {
  person: GroupPerson;
  onContextMenu: (event: React.MouseEvent, person: GroupPerson) => void;
}) {
  return (
    <li
      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
      onContextMenu={(event) => onContextMenu(event, person)}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
          GROUP_ACCENT_CLASSES[person.accent],
        )}
      >
        {groupInitials(person.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm text-foreground">{person.name}</span>
          {person.isOwner ? (
            <span className="shrink-0 rounded-sm bg-primary/15 px-1 text-2xs text-primary">
              dono
            </span>
          ) : null}
        </span>
        <span className="block truncate text-2xs text-muted-foreground">
          {person.role.length > 0 ? `${person.role} · @${person.handle}` : `@${person.handle}`}
        </span>
      </span>
    </li>
  );
}

function MemberRow({
  member,
  person,
  bindingCount,
  onOpenDm,
  onConfigure,
  onContextMenu,
}: {
  member: GroupMember;
  person: GroupPerson | null;
  bindingCount: number;
  onOpenDm: (member: GroupMember) => void;
  onConfigure: (member: GroupMember) => void;
  onContextMenu: (event: React.MouseEvent, member: GroupMember) => void;
}) {
  return (
    <li
      className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent/60"
      onContextMenu={(event) => onContextMenu(event, member)}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => onOpenDm(member)}
        type="button"
      >
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <ProviderInstanceIcon
            badgeContent="none"
            displayName={member.name}
            driverKind={member.driverKind as never}
            size="compact"
          />
          <span
            aria-label="Disponível"
            className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background bg-success"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm text-foreground">{member.name}</span>
            {member.autoRespond ? (
              <span className="shrink-0 rounded-sm bg-success/15 px-1 text-2xs text-success">
                auto
              </span>
            ) : null}
          </span>
          <span className="block truncate text-2xs text-muted-foreground">
            {member.role.length > 0 ? `${member.role} · @${member.handle}` : `@${member.handle}`}
          </span>
          {person !== null || bindingCount > 0 ? (
            <span className="block truncate text-2xs text-muted-foreground">
              {person !== null ? `opera por ${person.name}` : "IA compartilhada"}
              {bindingCount > 0 ? ` · ${bindingCount} IA(s)` : ""}
            </span>
          ) : null}
        </span>
      </button>
      <button
        aria-label={`Configurar ${member.name}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-hidden transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover:opacity-100"
        onClick={() => onConfigure(member)}
        type="button"
      >
        <SettingsIcon className="size-3.5" />
      </button>
    </li>
  );
}

type ConfirmTarget =
  | { kind: "agent"; id: string; name: string }
  | { kind: "person"; id: string; name: string };

export function GroupMembersPanel({
  group,
  onOpenDm,
  onConfigure,
  className,
}: {
  group: Group;
  onOpenDm: (member: GroupMember) => void;
  onConfigure: (member: GroupMember) => void;
  className?: string;
}) {
  const removeMember = useGroupsStore((store) => store.removeMember);
  const removePerson = useGroupsStore((store) => store.removePerson);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const agentMenu = useGroupContextMenu<GroupMember>();
  const personMenu = useGroupContextMenu<GroupPerson>();

  const agentItems = (member: GroupMember): GroupContextMenuItem[] => [
    {
      id: "dm",
      label: "Abrir conversa direta",
      icon: <BotIcon />,
      onSelect: () => onOpenDm(member),
    },
    {
      id: "configure",
      label: "Configurar agente",
      icon: <SettingsIcon />,
      onSelect: () => onConfigure(member),
    },
    {
      id: "remove",
      label: "Remover agente",
      icon: <Trash2Icon />,
      separatorBefore: true,
      variant: "destructive",
      onSelect: () => setConfirm({ kind: "agent", id: member.id, name: member.name }),
    },
  ];

  const personItems = (person: GroupPerson): GroupContextMenuItem[] => [
    {
      id: "copy-handle",
      label: "Copiar @handle",
      icon: <AtSignIcon />,
      onSelect: () => {
        void navigator.clipboard.writeText(`@${person.handle}`);
      },
    },
    {
      id: "remove",
      label: "Remover pessoa",
      icon: <Trash2Icon />,
      separatorBefore: true,
      variant: "destructive",
      disabled: person.isOwner,
      onSelect: () => setConfirm({ kind: "person", id: person.id, name: person.name }),
    },
  ];

  const submitConfirm = () => {
    if (confirm === null) return;
    if (confirm.kind === "agent") removeMember(group.id, confirm.id);
    else removePerson(group.id, confirm.id);
    setConfirm(null);
  };

  return (
    <aside
      aria-label="Membros do grupo"
      className={cn(
        "flex w-60 shrink-0 flex-col border-l border-border/60 bg-sidebar/40",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h2 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          Membros
        </h2>
        <span className="text-2xs text-muted-foreground">
          {group.members.length + group.people.length}
        </span>
      </div>
      <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Pessoas ({group.people.length})
        </p>
        {group.people.length === 0 ? (
          <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
            <UserIcon className="size-3.5" />
            Nenhuma pessoa ainda.
          </p>
        ) : (
          <ul>
            {group.people.map((person) => (
              <PersonRow key={person.id} onContextMenu={personMenu.openMenu} person={person} />
            ))}
          </ul>
        )}

        <p className="mt-3 px-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Agentes ({group.members.length})
        </p>
        {group.members.length === 0 ? (
          <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
            <BotIcon className="size-3.5" />
            Nenhum agente no grupo.
          </p>
        ) : (
          <ul className="flex flex-col">
            {group.members.map((member) => (
              <MemberRow
                bindingCount={
                  group.bindings.filter((binding) => binding.memberId === member.id).length
                }
                key={member.id}
                member={member}
                onConfigure={onConfigure}
                onContextMenu={agentMenu.openMenu}
                onOpenDm={onOpenDm}
                person={
                  member.personId === null
                    ? null
                    : (group.people.find((person) => person.id === member.personId) ?? null)
                }
              />
            ))}
          </ul>
        )}
      </div>
      <p className="border-t border-border/60 px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
        Clique em um agente para abrir a conversa direta. Botão direito abre mais ações.
      </p>

      <GroupContextMenu
        items={agentMenu.state === null ? [] : agentItems(agentMenu.state.target)}
        onClose={agentMenu.closeMenu}
        point={agentMenu.state?.point ?? null}
      />
      <GroupContextMenu
        items={personMenu.state === null ? [] : personItems(personMenu.state.target)}
        onClose={personMenu.closeMenu}
        point={personMenu.state?.point ?? null}
      />
      <GroupConfirmDialog
        confirmLabel={confirm?.kind === "agent" ? "Remover agente" : "Remover pessoa"}
        description={
          confirm?.kind === "agent"
            ? "O agente sai do grupo e das conversas diretas. As threads dele continuam no T3 Code."
            : "A pessoa sai do grupo, das conversas e das conexões de IA."
        }
        onConfirm={submitConfirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        open={confirm !== null}
        title={
          confirm === null
            ? "Confirmar?"
            : confirm.kind === "agent"
              ? `Remover ${confirm.name}?`
              : `Remover ${confirm.name}?`
        }
      />
    </aside>
  );
}
