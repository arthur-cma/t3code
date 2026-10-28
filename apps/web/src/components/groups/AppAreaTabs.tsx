import { Link, useLocation } from "@tanstack/react-router";
import { Code2Icon, UsersIcon } from "lucide-react";

import { cn } from "../../lib/utils";

function AreaTab({
  to,
  active,
  label,
  icon,
}: {
  to: "/" | "/groups";
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
      to={to}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppAreaTabs({ className }: { className?: string }) {
  const inGroups = useLocation({
    select: (location) =>
      location.pathname === "/groups" || location.pathname.startsWith("/groups/"),
  });
  return (
    <div
      aria-label="Área do aplicativo"
      className={cn("flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5", className)}
      role="tablist"
    >
      <AreaTab
        active={!inGroups}
        icon={<Code2Icon className="size-3.5 shrink-0" />}
        label="Coding"
        to="/"
      />
      <AreaTab
        active={inGroups}
        icon={<UsersIcon className="size-3.5 shrink-0" />}
        label="Grupos"
        to="/groups"
      />
    </div>
  );
}
