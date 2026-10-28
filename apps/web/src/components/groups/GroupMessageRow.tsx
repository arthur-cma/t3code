import { memo } from "react";

import ChatMarkdown from "../ChatMarkdown";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { groupInitials } from "../../groups/groupLogic";
import type { GroupMessage } from "../../groups/types";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export const GroupMessageRow = memo(function GroupMessageRow({
  message,
  workspaceRoot,
}: {
  message: GroupMessage;
  workspaceRoot: string | undefined;
}) {
  if (message.kind === "system") {
    return (
      <div className="flex justify-center">
        <p className="max-w-lg rounded-md bg-muted/40 px-2.5 py-1 text-center text-xs text-muted-foreground">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.kind === "user") {
    return (
      <article className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{message.authorName}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {message.text}
        </div>
      </article>
    );
  }

  return (
    <article className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
        {message.driverKind ? (
          <ProviderInstanceIcon
            badgeContent="none"
            displayName={message.authorName}
            driverKind={message.driverKind as never}
            size="compact"
          />
        ) : (
          groupInitials(message.authorName)
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-foreground">{message.authorName}</span>
          {message.model ? (
            <Badge size="sm" variant="outline">
              {message.model}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
        <div
          className={cn(
            "mt-1 text-sm leading-relaxed text-foreground",
            message.streaming &&
              "after:ml-0.5 after:inline-block after:h-4 after:w-1 after:animate-pulse after:rounded-sm after:bg-foreground/60 after:content-['']",
          )}
        >
          <ChatMarkdown
            cwd={workspaceRoot}
            isStreaming={message.streaming ?? false}
            text={message.text}
          />
        </div>
      </div>
    </article>
  );
});
