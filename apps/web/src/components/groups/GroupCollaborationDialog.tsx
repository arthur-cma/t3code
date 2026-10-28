import type { EnvironmentId } from "@t3tools/contracts";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { useState } from "react";

import { groupInitials, uniquePersonHandle } from "../../groups/groupLogic";
import { useGroupsStore } from "../../groups/groupStore";
import { buildSharePayload, decodeGroupShare, encodeGroupShare } from "../../groups/groupSync";
import { GROUP_ACCENT_CLASSES, type Group } from "../../groups/types";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { WizardPopup } from "../ui/wizard";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export function GroupCollaborationDialog({
  group,
  open,
  onOpenChange,
  onOpenGroup,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenGroup: (groupId: string) => void;
}) {
  const providersByEnvironment = useEnvironmentProviders();
  const messages = useGroupsStore((store) => store.messages);
  const addPerson = useGroupsStore((store) => store.addPerson);
  const removePerson = useGroupsStore((store) => store.removePerson);
  const addBinding = useGroupsStore((store) => store.addBinding);
  const removeBinding = useGroupsStore((store) => store.removeBinding);
  const importGroupShare = useGroupsStore((store) => store.importGroupShare);

  const environmentId = group.projectRef?.environmentId as EnvironmentId | undefined;
  const providerEntries =
    environmentId === undefined
      ? []
      : deriveProviderInstanceEntries(providersByEnvironment.get(environmentId) ?? []).filter(
          (entry) => entry.isAvailable,
        );

  const [personName, setPersonName] = useState("");
  const [personHandle, setPersonHandle] = useState("");
  const [personRole, setPersonRole] = useState("");

  const [bindingMemberId, setBindingMemberId] = useState("");
  const [bindingPersonId, setBindingPersonId] = useState("");
  const [bindingInstanceId, setBindingInstanceId] = useState("");
  const [bindingModel, setBindingModel] = useState("");

  const [inviteCode, setInviteCode] = useState("");
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedMember =
    group.members.find((member) => member.id === bindingMemberId) ?? group.members[0];
  const selectedPerson =
    group.people.find((person) => person.id === bindingPersonId) ?? group.people[0];
  const selectedEntry =
    providerEntries.find((entry) => entry.instanceId === bindingInstanceId) ?? providerEntries[0];
  const selectedModel =
    selectedEntry?.models.find((model) => model.slug === bindingModel) ??
    selectedEntry?.models.find((model) => model.isDefault) ??
    selectedEntry?.models[0];

  const submitPerson = () => {
    const name = personName.trim();
    if (name.length === 0) return;
    addPerson(group.id, {
      name,
      handle: uniquePersonHandle(personHandle.trim().length > 0 ? personHandle : name, [
        ...group.people,
        ...group.members,
      ]),
      role: personRole.trim(),
    });
    setPersonName("");
    setPersonHandle("");
    setPersonRole("");
  };

  const submitBinding = () => {
    if (selectedMember === undefined || selectedPerson === undefined) return;
    if (selectedEntry === undefined || selectedModel === undefined) return;
    addBinding(group.id, {
      memberId: selectedMember.id,
      personId: selectedPerson.id,
      instanceId: selectedEntry.instanceId,
      driverKind: selectedEntry.driverKind,
      model: selectedModel.slug,
      label: `${selectedPerson.name} · ${selectedEntry.displayName}`,
    });
    setBindingModel("");
  };

  const generateInvite = () => {
    const payload = buildSharePayload(group, messages);
    setInviteCode(encodeGroupShare(payload));
    setCopied(false);
  };

  const copyInvite = () => {
    if (inviteCode.length === 0) return;
    void navigator.clipboard
      .writeText(inviteCode)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  const submitImport = () => {
    const payload = decodeGroupShare(importCode);
    if (payload === null) {
      setImportError("Código inválido. Peça um código novo para quem convidou você.");
      return;
    }
    const groupId = importGroupShare(payload);
    setImportError("");
    setImportCode("");
    onOpenChange(false);
    onOpenGroup(groupId);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <WizardPopup size="wide">
        <DialogHeader>
          <DialogTitle>Colaboração em {group.name}</DialogTitle>
          <DialogDescription>
            Convide pessoas, conecte as IAs de cada uma aos agentes e mantenha a mesma organização
            de espaços, páginas e canais.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-6 py-5">
          <section className="flex flex-col gap-2">
            <SectionTitle>Pessoas</SectionTitle>
            <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
              {group.people.map((person) => (
                <li className="flex items-center gap-3 px-3 py-2" key={person.id}>
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${GROUP_ACCENT_CLASSES[person.accent]}`}
                  >
                    {groupInitials(person.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {person.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        @{person.handle}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {person.role.length > 0 ? person.role : "Sem cargo"}
                    </p>
                  </div>
                  {person.isOwner ? (
                    <Badge size="sm" variant="secondary">
                      Proprietário
                    </Badge>
                  ) : (
                    <Button
                      aria-label={`Remover ${person.name}`}
                      onClick={() => removePerson(group.id, person.id)}
                      size="icon-xs"
                      variant="ghost-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                aria-label="Nome da pessoa"
                onChange={(event) => setPersonName(event.target.value)}
                placeholder="Nome"
                size="sm"
                value={personName}
              />
              <Input
                aria-label="Handle da pessoa"
                onChange={(event) => setPersonHandle(event.target.value)}
                placeholder="handle (opcional)"
                size="sm"
                value={personHandle}
              />
              <Input
                aria-label="Cargo da pessoa"
                onChange={(event) => setPersonRole(event.target.value)}
                placeholder="Cargo (opcional)"
                size="sm"
                value={personRole}
              />
              <Button
                disabled={personName.trim().length === 0}
                onClick={submitPerson}
                size="sm"
                variant="outline"
              >
                <UserPlusIcon />
                Adicionar
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle>IAs conectadas aos agentes</SectionTitle>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cada pessoa pode conectar a própria IA a um agente existente. O agente continua sendo
              o mesmo, mas passa a poder rodar com o modelo de quem o opera.
            </p>
            {group.members.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Adicione agentes ao grupo para conectar IAs.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                {group.members.map((member) => {
                  const bindings = group.bindings.filter(
                    (binding) => binding.memberId === member.id,
                  );
                  return (
                    <li className="flex flex-col gap-1.5 px-3 py-2" key={member.id}>
                      <div className="flex items-center gap-2">
                        <ProviderInstanceIcon
                          badgeContent="none"
                          displayName={member.name}
                          driverKind={member.driverKind as never}
                          size="compact"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {member.name}
                        </span>
                        <span className="text-2xs text-muted-foreground">
                          {bindings.length} IA(s)
                        </span>
                      </div>
                      {bindings.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5 pl-6">
                          {bindings.map((binding) => {
                            const person = group.people.find(
                              (candidate) => candidate.id === binding.personId,
                            );
                            return (
                              <li
                                className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-2xs text-muted-foreground"
                                key={binding.id}
                              >
                                <span className="max-w-40 truncate">
                                  {person?.name ?? "Pessoa"} · {binding.model}
                                </span>
                                <button
                                  aria-label="Remover IA conectada"
                                  className="rounded-sm outline-hidden hover:text-destructive focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                  onClick={() => removeBinding(group.id, binding.id)}
                                  type="button"
                                >
                                  <Trash2Icon className="size-3" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="grid gap-2 sm:grid-cols-5">
              <Select
                onValueChange={(value) => {
                  if (typeof value === "string") setBindingMemberId(value);
                }}
                value={selectedMember?.id ?? ""}
              >
                <SelectTrigger aria-label="Agente" className="w-full" size="sm">
                  <SelectValue>{selectedMember?.name ?? "Agente"}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="start" alignItemWithTrigger={false}>
                  {group.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <Select
                onValueChange={(value) => {
                  if (typeof value === "string") setBindingPersonId(value);
                }}
                value={selectedPerson?.id ?? ""}
              >
                <SelectTrigger aria-label="Pessoa" className="w-full" size="sm">
                  <SelectValue>{selectedPerson?.name ?? "Pessoa"}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="start" alignItemWithTrigger={false}>
                  {group.people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <Select
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setBindingInstanceId(value);
                  setBindingModel("");
                }}
                value={selectedEntry?.instanceId ?? ""}
              >
                <SelectTrigger aria-label="Provedor da IA" className="w-full" size="sm">
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
              <Select
                onValueChange={(value) => {
                  if (typeof value === "string") setBindingModel(value);
                }}
                value={selectedModel?.slug ?? ""}
              >
                <SelectTrigger aria-label="Modelo da IA" className="w-full" size="sm">
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
              <Button
                disabled={
                  selectedMember === undefined ||
                  selectedPerson === undefined ||
                  selectedEntry === undefined ||
                  selectedModel === undefined
                }
                onClick={submitBinding}
                size="sm"
                variant="outline"
              >
                <PlusIcon />
                Conectar
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle>Convite</SectionTitle>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Gere um código e envie para a pessoa. Ela abre o T3 Code, cola o código em
              &quot;Entrar em um grupo&quot; e passa a ver os mesmos espaços, páginas, canais e
              agentes.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={generateInvite} size="sm" variant="outline">
                <DownloadIcon />
                Gerar código de convite
              </Button>
              {inviteCode.length > 0 ? (
                <Button onClick={copyInvite} size="sm" variant="secondary">
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? "Copiado" : "Copiar código"}
                </Button>
              ) : null}
            </div>
            {inviteCode.length > 0 ? (
              <textarea
                aria-label="Código de convite"
                className="max-h-40 min-h-20 w-full resize-y rounded-lg border border-input bg-muted/30 px-3 py-2 font-mono text-2xs break-all text-muted-foreground"
                readOnly
                value={inviteCode}
              />
            ) : null}

            <div className="mt-2 flex flex-col gap-2">
              <SectionTitle>Entrar em um grupo</SectionTitle>
              <textarea
                aria-label="Código recebido"
                className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-2xs break-all text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/24 focus-visible:ring-inset"
                onChange={(event) => setImportCode(event.target.value)}
                placeholder="Cole aqui o código que você recebeu"
                value={importCode}
              />
              {importError.length > 0 ? (
                <p className="text-xs text-destructive">{importError}</p>
              ) : null}
              <div className="flex justify-end">
                <Button disabled={importCode.trim().length === 0} onClick={submitImport} size="sm">
                  <DownloadIcon />
                  Importar grupo
                </Button>
              </div>
            </div>
          </section>
        </div>
      </WizardPopup>
    </Dialog>
  );
}
