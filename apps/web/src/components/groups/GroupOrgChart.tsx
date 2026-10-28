import { NetworkIcon, UserIcon } from "lucide-react";

import { buildOrgChart, type OrgChartNode } from "../../groups/groupLogic";
import type { Group, GroupMember } from "../../groups/types";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { WizardPopup } from "../ui/wizard";

function OrgCard({
  title,
  subtitle,
  member,
  owner = false,
}: {
  title: string;
  subtitle: string;
  member?: GroupMember;
  owner?: boolean;
}) {
  return (
    <div className="flex w-44 flex-col items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-center shadow-xs">
      <span className="flex size-7 items-center justify-center rounded-full bg-muted">
        {member === undefined ? (
          <UserIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ProviderInstanceIcon
            badgeContent="none"
            displayName={member.name}
            driverKind={member.driverKind as never}
            size="compact"
          />
        )}
      </span>
      <span className="w-full truncate text-sm font-medium text-foreground">{title}</span>
      <span className="w-full truncate text-2xs text-muted-foreground">{subtitle}</span>
      {owner ? (
        <span className="rounded-sm bg-primary/10 px-1.5 text-2xs text-primary">Proprietário</span>
      ) : null}
    </div>
  );
}

function OrgBranch({ node }: { node: OrgChartNode }) {
  const { member } = node;
  return (
    <li className="relative flex flex-col items-center px-2 pt-6 before:absolute before:top-0 before:right-1/2 before:left-0 before:h-px before:bg-border after:absolute after:top-0 after:right-0 after:left-1/2 after:h-px after:bg-border first:before:bg-transparent last:after:bg-transparent">
      <span className="absolute top-0 left-1/2 h-6 w-px -translate-x-1/2 bg-border" />
      <OrgCard
        member={member}
        subtitle={
          member.role.length > 0 ? `${member.role} · @${member.handle}` : `@${member.handle}`
        }
        title={member.name}
      />
      {node.children.length > 0 ? (
        <ul className="flex items-start">
          {node.children.map((child) => (
            <OrgBranch key={child.member.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function GroupOrgChart({
  group,
  open,
  onOpenChange,
  onEditMembers,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditMembers: () => void;
}) {
  const roots = buildOrgChart(group.members);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <WizardPopup size="wide">
        <DialogHeader>
          <DialogTitle>Organograma de {group.name}</DialogTitle>
          <DialogDescription>
            Hierarquia dos agentes do grupo. Defina o cargo e o gestor de cada agente nas
            configurações.
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-gutter-both max-h-[60vh] overflow-auto px-6 py-6">
          {group.members.length === 0 ? (
            <Empty size="compact">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <NetworkIcon />
                </EmptyMedia>
                <EmptyTitle>Sem agentes para organizar</EmptyTitle>
                <EmptyDescription>
                  Adicione agentes ao grupo para montar o organograma.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex min-w-max justify-center">
              <li className="flex flex-col items-center">
                <OrgCard owner subtitle="Você" title="Você" />
                <ul className="flex items-start">
                  {roots.map((node) => (
                    <OrgBranch key={node.member.id} node={node} />
                  ))}
                </ul>
              </li>
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            {group.members.length} agentes · {roots.length} na raiz
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={onEditMembers} size="sm" variant="outline">
              Editar cargos
            </Button>
            <Button onClick={() => onOpenChange(false)} size="sm">
              Fechar
            </Button>
          </div>
        </div>
      </WizardPopup>
    </Dialog>
  );
}
