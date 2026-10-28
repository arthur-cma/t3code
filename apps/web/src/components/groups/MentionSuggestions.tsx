import type { GroupMember } from "../../groups/types";
import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";

export function MentionSuggestions({
  members,
  activeIndex,
  onSelect,
  onHover,
}: {
  members: ReadonlyArray<GroupMember>;
  activeIndex: number;
  onSelect: (member: GroupMember) => void;
  onHover: (index: number) => void;
}) {
  if (members.length === 0) return null;

  return (
    <div
      aria-label="Mencionar agente"
      className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
      role="listbox"
    >
      <p className="px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        Mencionar
      </p>
      {members.map((member, index) => (
        <button
          aria-selected={index === activeIndex}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden",
            index === activeIndex
              ? "bg-accent text-accent-foreground"
              : "text-popover-foreground hover:bg-accent/60",
          )}
          key={member.id}
          onMouseDown={(event) => {
            // Keep the textarea focused so the mention lands at the caret.
            event.preventDefault();
            onSelect(member);
          }}
          onMouseEnter={() => onHover(index)}
          role="option"
          type="button"
        >
          <ProviderInstanceIcon
            badgeContent="none"
            displayName={member.name}
            driverKind={member.driverKind as never}
            size="compact"
          />
          <span className="min-w-0 flex-1 truncate">{member.name}</span>
          {member.role.length > 0 ? (
            <span className="shrink-0 truncate text-2xs text-muted-foreground">{member.role}</span>
          ) : null}
          <span className="shrink-0 font-mono text-2xs text-muted-foreground">
            @{member.handle}
          </span>
        </button>
      ))}
    </div>
  );
}
