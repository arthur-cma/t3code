import { groupInitials } from "../../groups/groupLogic";
import { GROUP_ACCENT_CLASSES, type Group } from "../../groups/types";
import { cn } from "../../lib/utils";

export function GroupAvatar({
  group,
  size = "default",
}: {
  group: Group;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        GROUP_ACCENT_CLASSES[group.accent],
        size === "sm" && "size-7 text-xs",
        size === "default" && "size-9 text-sm",
        size === "lg" && "size-12 text-base",
      )}
    >
      {groupInitials(group.name)}
    </span>
  );
}
