import { BotIcon, MessageSquareIcon, UserIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import type { Group, GroupMember } from "../../groups/types";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";

function MemberRow({
  member,
  onOpenDm,
}: {
  member: GroupMember;
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
        <span className="text-2xs text-muted-foreground">{group.members.length + 1}</span>
      </div>
      <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <p className="px-2 pb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
          Pessoas
        </p>
        <ul>
          <li className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserIcon className="size-3.5 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">Você</span>
              <span className="block truncate text-2xs text-muted-foreground">Proprietário</span>
            </span>
          </li>
        </ul>

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
              <MemberRow key={member.id} member={member} onOpenDm={onOpenDm} />
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
