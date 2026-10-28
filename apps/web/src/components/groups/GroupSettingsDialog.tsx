import { useNavigate } from "@tanstack/react-router";
import type { EnvironmentId } from "@t3tools/contracts";
import { PlusIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { useState } from "react";

import { uniqueHandle } from "../../groups/groupLogic";
import { useGroupsStore } from "../../groups/groupStore";
import { parseProjectKey, projectKey } from "../../groups/projectKey";
import {
  GROUP_REPLY_MODE_DESCRIPTIONS,
  GROUP_REPLY_MODE_LABELS,
  GROUP_RUNTIME_MODE_LABELS,
  type Group,
  type GroupRuntimeMode,
} from "../../groups/types";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { useProjects } from "../../state/entities";
import { useEnvironmentProviders } from "../../state/environments";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { WizardPopup } from "../ui/wizard";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground">{children}</span>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export function GroupSettingsDialog({
  group,
  open,
  onOpenChange,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projects = useProjects();
  const providersByEnvironment = useEnvironmentProviders();
  const navigate = useNavigate();
  const updateGroup = useGroupsStore((store) => store.updateGroup);
  const deleteGroup = useGroupsStore((store) => store.deleteGroup);
  const addMember = useGroupsStore((store) => store.addMember);
  const updateMember = useGroupsStore((store) => store.updateMember);
  const removeMember = useGroupsStore((store) => store.removeMember);
  const addChannel = useGroupsStore((store) => store.addChannel);
  const deleteChannel = useGroupsStore((store) => store.deleteChannel);

  const environmentId = group.projectRef?.environmentId as EnvironmentId | undefined;
  const providerEntries =
    environmentId === undefined
      ? []
      : deriveProviderInstanceEntries(providersByEnvironment.get(environmentId) ?? []).filter(
          (entry) => entry.isAvailable,
        );

  const [memberName, setMemberName] = useState("");
  const [memberHandle, setMemberHandle] = useState("");
  const [memberInstanceId, setMemberInstanceId] = useState("");
  const [memberModel, setMemberModel] = useState("");
  const [memberAutoRespond, setMemberAutoRespond] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelError, setChannelError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedEntry =
    providerEntries.find((entry) => entry.instanceId === memberInstanceId) ?? providerEntries[0];
  const selectedModel =
    selectedEntry?.models.find((model) => model.slug === memberModel) ??
    selectedEntry?.models.find((model) => model.isDefault) ??
    selectedEntry?.models[0];

  const resetMemberForm = () => {
    setMemberName("");
    setMemberHandle("");
    setMemberAutoRespond(false);
  };

  const submitMember = () => {
    if (selectedEntry === undefined || selectedModel === undefined) return;
    const name = memberName.trim();
    if (name.length === 0) return;
    const handle = uniqueHandle(
      memberHandle.trim().length > 0 ? memberHandle : name,
      group.members.map((member) => member.handle),
    );
    addMember(group.id, {
      name,
      handle,
      instanceId: selectedEntry.instanceId,
      driverKind: selectedEntry.driverKind,
      model: selectedModel.slug,
      autoRespond: memberAutoRespond,
    });
    resetMemberForm();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <WizardPopup>
          <DialogHeader>
            <DialogTitle>Configurações de {group.name}</DialogTitle>
            <DialogDescription>
              Ajuste o workspace, os agentes e os canais deste grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6 px-6 py-5">
            <section className="flex flex-col gap-3">
              <SectionTitle>Geral</SectionTitle>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Nome</FieldLabel>
                <Input
                  onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                  value={group.name}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Descrição</FieldLabel>
                <Textarea
                  onChange={(event) => updateGroup(group.id, { description: event.target.value })}
                  placeholder="Contexto compartilhado com os agentes"
                  size="sm"
                  value={group.description}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Workspace</FieldLabel>
                <Select
                  onValueChange={(value) => {
                    if (typeof value !== "string") return;
                    updateGroup(group.id, {
                      projectRef:
                        value === "none" || value.length === 0 ? null : parseProjectKey(value),
                    });
                  }}
                  value={group.projectRef === null ? "none" : projectKey(group.projectRef)}
                >
                  <SelectTrigger aria-label="Workspace" className="w-full" size="sm">
                    <SelectValue>
                      {group.projectRef === null
                        ? "Sem workspace"
                        : (projects.find(
                            (project) =>
                              project.environmentId === group.projectRef?.environmentId &&
                              project.id === group.projectRef?.projectId,
                          )?.title ?? "Workspace indisponível")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="start" alignItemWithTrigger={false}>
                    <SelectItem value="none">Sem workspace</SelectItem>
                    {projects.map((project) => {
                      const key = projectKey({
                        environmentId: project.environmentId,
                        projectId: project.id,
                      });
                      return (
                        <SelectItem key={key} value={key}>
                          {project.title}
                        </SelectItem>
                      );
                    })}
                  </SelectPopup>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Quem responde</FieldLabel>
                <Select
                  onValueChange={(value) => {
                    if (value === "mentions" || value === "auto") {
                      updateGroup(group.id, { replyMode: value });
                    }
                  }}
                  value={group.replyMode}
                >
                  <SelectTrigger aria-label="Quem responde" className="w-full" size="sm">
                    <SelectValue>{GROUP_REPLY_MODE_LABELS[group.replyMode]}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="start" alignItemWithTrigger={false}>
                    <SelectItem value="mentions">{GROUP_REPLY_MODE_LABELS.mentions}</SelectItem>
                    <SelectItem value="auto">{GROUP_REPLY_MODE_LABELS.auto}</SelectItem>
                  </SelectPopup>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {GROUP_REPLY_MODE_DESCRIPTIONS[group.replyMode]}
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>Permissões dos agentes</FieldLabel>
                <Select
                  onValueChange={(value) => {
                    if (typeof value === "string" && value in GROUP_RUNTIME_MODE_LABELS) {
                      updateGroup(group.id, {
                        runtimeMode: value as GroupRuntimeMode,
                      });
                    }
                  }}
                  value={group.runtimeMode}
                >
                  <SelectTrigger aria-label="Permissões dos agentes" className="w-full" size="sm">
                    <SelectValue>{GROUP_RUNTIME_MODE_LABELS[group.runtimeMode]}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="start" alignItemWithTrigger={false}>
                    {Object.entries(GROUP_RUNTIME_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </label>
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle>Agentes</SectionTitle>
              {group.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum agente neste grupo. Adicione um abaixo.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                  {group.members.map((member) => {
                    const entry = providerEntries.find(
                      (candidate) => candidate.instanceId === member.instanceId,
                    );
                    return (
                      <li className="flex items-center gap-3 px-3 py-2" key={member.id}>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                          {entry ? (
                            <ProviderInstanceIcon
                              accentColor={entry.accentColor}
                              acpRegistryAgentId={entry.acpRegistryAgentId}
                              acpRegistryIconUrl={entry.acpRegistryIconUrl}
                              badgeContent="none"
                              displayName={entry.displayName}
                              driverKind={entry.driverKind}
                              size="compact"
                            />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {member.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              @{member.handle}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{member.model}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Switch
                            aria-label={`Resposta automática de ${member.name}`}
                            checked={member.autoRespond}
                            onCheckedChange={(checked) =>
                              updateMember(group.id, member.id, { autoRespond: checked })
                            }
                            size="sm"
                          />
                          <Button
                            aria-label={`Remover ${member.name}`}
                            onClick={() => {
                              removeMember(group.id, member.id);
                            }}
                            size="icon-xs"
                            variant="ghost-destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {environmentId === undefined ? (
                <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Escolha um workspace para carregar os provedores disponíveis.
                </p>
              ) : providerEntries.length === 0 ? (
                <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Nenhum provedor disponível neste workspace. Configure um em Configurações →
                  Providers.
                </p>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <FieldLabel>Nome</FieldLabel>
                      <Input
                        onChange={(event) => setMemberName(event.target.value)}
                        placeholder="Ana"
                        size="sm"
                        value={memberName}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <FieldLabel>Handle</FieldLabel>
                      <Input
                        onChange={(event) => setMemberHandle(event.target.value)}
                        placeholder="ana (opcional)"
                        size="sm"
                        value={memberHandle}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <FieldLabel>Provedor</FieldLabel>
                      <Select
                        onValueChange={(value) => {
                          if (typeof value === "string") {
                            setMemberInstanceId(value);
                            setMemberModel("");
                          }
                        }}
                        value={selectedEntry?.instanceId ?? ""}
                      >
                        <SelectTrigger aria-label="Provedor" className="w-full" size="sm">
                          <SelectValue>{selectedEntry?.displayName ?? "Provedor"}</SelectValue>
                        </SelectTrigger>
                        <SelectPopup align="start" alignItemWithTrigger={false}>
                          {providerEntries.map((entry) => (
                            <SelectItem key={entry.instanceId} value={entry.instanceId}>
                              {entry.displayName}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <FieldLabel>Modelo</FieldLabel>
                      <Select
                        onValueChange={(value) => {
                          if (typeof value === "string") setMemberModel(value);
                        }}
                        value={selectedModel?.slug ?? ""}
                      >
                        <SelectTrigger aria-label="Modelo" className="w-full" size="sm">
                          <SelectValue>{selectedModel?.name ?? "Modelo"}</SelectValue>
                        </SelectTrigger>
                        <SelectPopup align="start" alignItemWithTrigger={false}>
                          {(selectedEntry?.models ?? []).map((model) => (
                            <SelectItem key={model.slug} value={model.slug}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={memberAutoRespond}
                        onCheckedChange={setMemberAutoRespond}
                        size="sm"
                      />
                      Responder automaticamente
                    </label>
                    <Button
                      disabled={memberName.trim().length === 0 || selectedModel === undefined}
                      onClick={submitMember}
                      size="sm"
                      variant="outline"
                    >
                      <UserPlusIcon />
                      Adicionar agente
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle>Canais</SectionTitle>
              <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                {group.channels.map((channel) => (
                  <li className="flex items-center gap-2 px-3 py-2" key={channel.id}>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      #{channel.name}
                    </span>
                    {group.channels.length > 1 ? (
                      <Button
                        aria-label={`Excluir canal ${channel.name}`}
                        onClick={() => deleteChannel(group.id, channel.id)}
                        size="icon-xs"
                        variant="ghost-destructive"
                      >
                        <Trash2Icon />
                      </Button>
                    ) : (
                      <Badge size="sm" variant="secondary">
                        Único
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Nome do novo canal"
                  onChange={(event) => {
                    setChannelName(event.target.value);
                    setChannelError(false);
                  }}
                  placeholder="novo-canal"
                  size="sm"
                  value={channelName}
                />
                <Button
                  onClick={() => {
                    const created = addChannel(group.id, channelName);
                    if (created === null) {
                      setChannelError(true);
                      return;
                    }
                    setChannelName("");
                  }}
                  size="sm"
                  variant="outline"
                >
                  <PlusIcon />
                  Adicionar
                </Button>
              </div>
              {channelError ? (
                <p className="text-xs text-destructive-foreground">
                  Use um nome novo e não vazio para o canal.
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-2 rounded-lg border border-destructive/24 p-3">
              <SectionTitle>Zona de risco</SectionTitle>
              <p className="text-xs text-muted-foreground">
                Excluir o grupo remove os canais e o histórico local. As threads dos agentes
                continuam no T3 Code.
              </p>
              <div>
                <Button
                  onClick={() => setConfirmDelete(true)}
                  size="sm"
                  variant="destructive-outline"
                >
                  <Trash2Icon />
                  Excluir grupo
                </Button>
              </div>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Concluir
            </Button>
          </DialogFooter>
        </WizardPopup>
      </Dialog>

      <Dialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <WizardPopup>
          <DialogHeader>
            <DialogTitle>Excluir {group.name}?</DialogTitle>
            <DialogDescription>
              Esta ação remove o grupo e o histórico local. Não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmDelete(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmDelete(false);
                onOpenChange(false);
                deleteGroup(group.id);
                void navigate({ to: "/groups" });
              }}
              variant="destructive"
            >
              Excluir grupo
            </Button>
          </DialogFooter>
        </WizardPopup>
      </Dialog>
    </>
  );
}
