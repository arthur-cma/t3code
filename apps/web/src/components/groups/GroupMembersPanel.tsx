import { BotIcon, MessageSquareIcon, UserIcon } from "lucide-react";

import { groupInitials } from "../../groups/groupLogic";
import {
  GROUP_ACCENT_CLASSES,
  type Group,
  type GroupMember,
  type GroupPerson,
} from "../../groups/types";
import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";

function PersonRow({ person }: { person: GroupPerson }) {
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5">
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
}: {
  member: GroupMember;
  person: GroupPerson | null;
  bindingCount: number;
  onOpenDm: (member: GroupMember) => void;
}) {
  return (
    <li>
      <button
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-hidden hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
        <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  );
}

export function GroupMembersPanel({
  group,
  onOpenDm,
  className,
}: {
  group: Group;
  onOpenDm: (member: GroupMember) => void;
  className?: string;
}) {
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
              <PersonRow key={person.id} person={person} />
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
        Clique em um agente para abrir uma conversa direta.
      </p>
    </aside>
  );
}
