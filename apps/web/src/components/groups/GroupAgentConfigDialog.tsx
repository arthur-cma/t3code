import type { EnvironmentId } from "@t3tools/contracts";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { uniqueHandle } from "../../groups/groupLogic";
import { useGroupsStore } from "../../groups/groupStore";
import type { Group, GroupMember } from "../../groups/types";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { WizardPopup } from "../ui/wizard";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground">{children}</span>;
}

function AgentConfigBody({
  group,
  member,
  onOpenChange,
}: {
  group: Group;
  member: GroupMember;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMember = useGroupsStore((store) => store.updateMember);
  const removeMember = useGroupsStore((store) => store.removeMember);
  const providersByEnvironment = useEnvironmentProviders();
  const environmentId = group.projectRef?.environmentId as EnvironmentId | undefined;
  const providerEntries =
    environmentId === undefined
      ? []
      : deriveProviderInstanceEntries(providersByEnvironment.get(environmentId) ?? []).filter(
          (entry) => entry.isAvailable,
        );

  const [name, setName] = useState(member.name);
  const [handle, setHandle] = useState(member.handle);
  const [role, setRole] = useState(member.role);
  const [instanceId, setInstanceId] = useState(member.instanceId);
  const [model, setModel] = useState(member.model);
  const [autoRespond, setAutoRespond] = useState(member.autoRespond);
  const [reportsTo, setReportsTo] = useState(member.reportsTo ?? "none");
  const [personId, setPersonId] = useState(member.personId ?? "none");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const entry =
    providerEntries.find((candidate) => candidate.instanceId === instanceId) ?? providerEntries[0];
  const selectedModel =
    entry?.models.find((candidate) => candidate.slug === model) ??
    entry?.models.find((candidate) => candidate.isDefault) ??
    entry?.models[0];
  const trimmedName = name.trim();

  const save = () => {
    if (trimmedName.length === 0) return;
    const nextHandle = uniqueHandle(
      handle.trim().length > 0 ? handle : trimmedName,
      group.members
        .filter((candidate) => candidate.id !== member.id)
        .map((candidate) => candidate.handle),
    );
    updateMember(group.id, member.id, {
      name: trimmedName,
      handle: nextHandle,
      role: role.trim(),
      autoRespond,
      reportsTo: reportsTo === "none" ? null : reportsTo,
      personId: personId === "none" ? null : personId,
      ...(entry === undefined
        ? {}
        : { instanceId: entry.instanceId, driverKind: entry.driverKind }),
      ...(selectedModel === undefined ? {} : { model: selectedModel.slug }),
    });
    onOpenChange(false);
  };

  const bindings = group.bindings.filter((binding) => binding.memberId === member.id);

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Configurar agente</DialogTitle>
        <DialogDescription>
          Ajuste nome, cargo, modelo e permissões de resposta deste agente. As mudanças valem para
          todos os canais do grupo.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <ProviderInstanceIcon
            badgeContent="none"
            displayName={member.name}
            driverKind={member.driverKind as never}
            size="default"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{member.handle}
              {bindings.length > 0 ? ` · ${bindings.length} IA(s) conectada(s)` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <FieldLabel>Nome</FieldLabel>
            <Input
              aria-label="Nome do agente"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ana"
              size="sm"
              value={name}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Handle</FieldLabel>
            <Input
              aria-label="Handle do agente"
              onChange={(event) => setHandle(event.target.value)}
              placeholder="ana"
              size="sm"
              value={handle}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Cargo</FieldLabel>
            <Input
              aria-label="Cargo do agente"
              onChange={(event) => setRole(event.target.value)}
              placeholder="Design"
              size="sm"
              value={role}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Gestor</FieldLabel>
            <Select
              onValueChange={(value) => {
                if (typeof value === "string") setReportsTo(value);
              }}
              value={reportsTo}
            >
              <SelectTrigger aria-label="Gestor do agente" className="w-full" size="sm">
                <SelectValue>
                  {group.members.find((candidate) => candidate.id === reportsTo)?.name ??
                    "Sem gestor"}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                <SelectItem value="none">Sem gestor</SelectItem>
                {group.members
                  .filter((candidate) => candidate.id !== member.id)
                  .map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
              </SelectPopup>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Pessoa que opera</FieldLabel>
            <Select
              onValueChange={(value) => {
                if (typeof value === "string") setPersonId(value);
              }}
              value={personId}
            >
              <SelectTrigger aria-label="Pessoa que opera o agente" className="w-full" size="sm">
                <SelectValue>
                  {group.people.find((person) => person.id === personId)?.name ?? "Sem operador"}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                <SelectItem value="none">Sem operador</SelectItem>
                {group.people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Provedor</FieldLabel>
            <Select
              onValueChange={(value) => {
                if (typeof value !== "string") return;
                setInstanceId(value);
                setModel("");
              }}
              value={entry?.instanceId ?? ""}
            >
              <SelectTrigger aria-label="Provedor do agente" className="w-full" size="sm">
                <SelectValue>{entry?.displayName ?? "Provedor"}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                {providerEntries.map((candidate) => (
                  <SelectItem key={candidate.instanceId} value={candidate.instanceId}>
                    {candidate.displayName}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Modelo</FieldLabel>
            <Select
              onValueChange={(value) => {
                if (typeof value === "string") setModel(value);
              }}
              value={selectedModel?.slug ?? ""}
            >
              <SelectTrigger aria-label="Modelo do agente" className="w-full" size="sm">
                <SelectValue>{selectedModel?.name ?? "Modelo"}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                {(entry?.models ?? []).map((candidate) => (
                  <SelectItem key={candidate.slug} value={candidate.slug}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 sm:col-span-2">
            <span className="flex flex-col">
              <FieldLabel>Responder automaticamente</FieldLabel>
              <span className="text-xs text-muted-foreground">
                Responde sem precisar de menção quando o canal está em modo automático.
              </span>
            </span>
            <Switch
              aria-label="Responder automaticamente"
              checked={autoRespond}
              onCheckedChange={setAutoRespond}
              size="sm"
            />
          </label>
        </div>

        {providerEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum provedor disponível neste workspace. Conecte um provedor em Configurações para
            trocar o modelo.
          </p>
        ) : null}
      </div>

      <DialogFooter
        variant="bare"
        className="flex-col sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  removeMember(group.id, member.id);
                  onOpenChange(false);
                }}
                size="sm"
                variant="destructive"
              >
                Confirmar exclusão
              </Button>
              <Button onClick={() => setConfirmDelete(false)} size="sm" variant="ghost">
                Cancelar
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmDelete(true)} size="sm" variant="ghost-destructive">
              <Trash2Icon />
              Remover agente
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onOpenChange(false)} size="sm" variant="outline">
            Cancelar
          </Button>
          <Button disabled={trimmedName.length === 0} onClick={save} size="sm">
            Salvar
          </Button>
        </div>
      </DialogFooter>
    </WizardPopup>
  );
}

export function GroupAgentConfigDialog({
  group,
  member,
  open,
  onOpenChange,
}: {
  group: Group;
  member: GroupMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open && member !== null}>
      {member === null ? null : (
        <AgentConfigBody
          group={group}
          key={member.id}
          member={member}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  );
}
