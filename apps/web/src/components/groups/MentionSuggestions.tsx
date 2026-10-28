import { groupInitials, type MentionCandidate } from "../../groups/groupLogic";
import { GROUP_ACCENT_CLASSES } from "../../groups/types";
import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";

export function MentionSuggestions({
  candidates,
  activeIndex,
  onSelect,
  onHover,
}: {
  candidates: ReadonlyArray<MentionCandidate>;
  activeIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <div
      aria-label="Quem pode ser mencionado"
      className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
      role="listbox"
    >
      <p className="px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
        Mencionar
      </p>
      {candidates.map((candidate, index) => (
        <button
          aria-selected={index === activeIndex}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-hidden",
            index === activeIndex
              ? "bg-accent text-accent-foreground"
              : "text-popover-foreground hover:bg-accent/60",
          )}
          key={`${candidate.kind}-${candidate.id}`}
          onMouseDown={(event) => {
            // Keep the textarea focused so the mention lands at the caret.
            event.preventDefault();
            onSelect(candidate);
          }}
          onMouseEnter={() => onHover(index)}
          role="option"
          type="button"
        >
          {candidate.member !== null ? (
            <ProviderInstanceIcon
              badgeContent="none"
              displayName={candidate.member.name}
              driverKind={candidate.member.driverKind as never}
              size="compact"
            />
          ) : (
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
                candidate.person === null
                  ? "bg-muted text-muted-foreground"
                  : GROUP_ACCENT_CLASSES[candidate.person.accent],
              )}
            >
              {groupInitials(candidate.name)}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
          {candidate.role.length > 0 ? (
            <span className="shrink-0 truncate text-2xs text-muted-foreground">
              {candidate.role}
            </span>
          ) : null}
          <span className="shrink-0 font-mono text-2xs text-muted-foreground">
            @{candidate.handle}
          </span>
        </button>
      ))}
    </div>
  );
}
