import type { EnvironmentId } from "@t3tools/contracts";
import {
  BotIcon,
  FileTextIcon,
  FolderPlusIcon,
  HashIcon,
  MessageSquareIcon,
  UserPlusIcon,
} from "lucide-react";
import { useState } from "react";

import { uniqueHandle, uniquePersonHandle } from "../../groups/groupLogic";
import { useGroupsStore } from "../../groups/groupStore";
import { PAGE_TEMPLATES, pageTemplateById } from "../../groups/pageDoc";
import type { Group } from "../../groups/types";
import { cn } from "../../lib/utils";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { WizardFooter, WizardPopup } from "../ui/wizard";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground">{children}</span>;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint}
    </label>
  );
}

function ChannelDialogBody({
  group,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
}) {
  const addChannel = useGroupsStore((store) => store.addChannel);
  const openDm = useGroupsStore((store) => store.openDm);
  const [kind, setKind] = useState<"text" | "dm">("text");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [memberId, setMemberId] = useState(group.members[0]?.id ?? "");
  const [error, setError] = useState("");

  const canSubmit =
    kind === "text" ? name.trim().length > 0 : memberId.length > 0 && group.members.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const created =
      kind === "text" ? addChannel(group.id, name, topic) : openDm(group.id, memberId);
    if (created === null) {
      setError(
        kind === "text"
          ? "Já existe um canal com esse nome. Escolha outro."
          : "Não foi possível abrir a conversa direta com este agente.",
      );
      return;
    }
    onOpenChange(false);
    onCreated(created);
  };

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Criar canal</DialogTitle>
        <DialogDescription>
          Crie um canal de texto para o grupo ou abra uma conversa direta com um agente.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        <Field label="Tipo">
          <Select
            onValueChange={(value) => {
              if (value === "text" || value === "dm") {
                setKind(value);
                setError("");
              }
            }}
            value={kind}
          >
            <SelectTrigger aria-label="Tipo de canal" className="w-full" size="sm">
              <SelectValue>{kind === "text" ? "Canal de texto" : "Conversa direta"}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="start" alignItemWithTrigger={false}>
              <SelectItem value="text">Canal de texto</SelectItem>
              <SelectItem disabled={group.members.length === 0} value="dm">
                Conversa direta com agente
              </SelectItem>
            </SelectPopup>
          </Select>
        </Field>

        {kind === "text" ? (
          <>
            <Field label="Nome do canal">
              <Input
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="geral"
                value={name}
              />
            </Field>
            <Field
              hint={
                <span className="text-xs text-muted-foreground">
                  O tópico aparece abaixo do nome no cabeçalho do canal.
                </span>
              }
              label="Tópico (opcional)"
            >
              <Input
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Assuntos deste canal"
                value={topic}
              />
            </Field>
          </>
        ) : group.members.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Nenhum agente no grupo. Adicione um agente antes de abrir uma conversa direta.
          </p>
        ) : (
          <Field label="Agente">
            <Select
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setMemberId(value);
                  setError("");
                }
              }}
              value={memberId}
            >
              <SelectTrigger aria-label="Agente da conversa direta" className="w-full" size="sm">
                <SelectValue>
                  {group.members.find((member) => member.id === memberId)?.name ??
                    "Escolha um agente"}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                {group.members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} (@{member.handle})
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </Field>
        )}

        {error.length > 0 ? <p className="text-xs text-destructive-foreground">{error}</p> : null}
      </div>
      <WizardFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancelar
        </Button>
        <Button disabled={!canSubmit} onClick={submit}>
          {kind === "text" ? <HashIcon /> : <MessageSquareIcon />}
          {kind === "text" ? "Criar canal" : "Abrir conversa"}
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function CreateChannelDialog({
  group,
  open,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <ChannelDialogBody group={group} onCreated={onCreated} onOpenChange={onOpenChange} />
      ) : null}
    </Dialog>
  );
}

function PageDialogBody({
  group,
  defaultSpaceId,
  defaultParentId,
  defaultTemplateId,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  defaultSpaceId?: string | undefined;
  defaultParentId?: string | null | undefined;
  defaultTemplateId?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated: (pageId: string) => void;
}) {
  const addPage = useGroupsStore((store) => store.addPage);
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? "blank");
  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? group.spaces[0]?.id ?? "");
  const [parentId, setParentId] = useState(defaultParentId ?? "none");

  const space = group.spaces.find((candidate) => candidate.id === spaceId) ?? null;
  const parents = group.pages.filter((page) => page.spaceId === spaceId && page.deletedAt === null);
  const parent = parents.find((page) => page.id === parentId) ?? null;
  const template = pageTemplateById(templateId) ?? PAGE_TEMPLATES[0]!;

  const submit = () => {
    if (title.trim().length === 0 || space === null) return;
    const created = addPage(group.id, {
      spaceId: space.id,
      parentId: parent === null ? null : parent.id,
      title: title.trim(),
      icon: template.icon,
      content: template.content,
      mode: template.mode,
    });
    if (created === null) return;
    onOpenChange(false);
    onCreated(created);
  };

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Criar página</DialogTitle>
        <DialogDescription>
          Páginas guardam notas, decisões e documentação compartilhada com os agentes.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        {group.spaces.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Crie um espaço antes de adicionar páginas.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Modelo</FieldLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {PAGE_TEMPLATES.map((candidate) => (
                  <button
                    aria-pressed={candidate.id === template.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-2 py-1.5 text-left outline-hidden transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      candidate.id === template.id ? "border-ring bg-muted/60" : "border-border/60",
                    )}
                    key={candidate.id}
                    onClick={() => {
                      setTemplateId(candidate.id);
                      if (title.trim().length === 0 || candidate.title.length === 0) return;
                      setTitle(candidate.title);
                    }}
                    type="button"
                  >
                    <span aria-hidden className="text-sm leading-5">
                      {candidate.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-foreground">
                        {candidate.label}
                      </span>
                      <span className="block text-2xs leading-snug text-muted-foreground">
                        {candidate.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Título">
              <Input
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder={template.title.length > 0 ? template.title : "Decisões da semana"}
                value={title}
              />
            </Field>
            <Field label="Espaço">
              <Select
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setSpaceId(value);
                  setParentId("none");
                }}
                value={spaceId}
              >
                <SelectTrigger aria-label="Espaço da página" className="w-full" size="sm">
                  <SelectValue>
                    {space === null ? "Escolha um espaço" : `${space.icon} ${space.name}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup align="start" alignItemWithTrigger={false}>
                  {group.spaces.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.icon} {candidate.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
            <Field label="Página-mãe">
              <Select
                onValueChange={(value) => {
                  if (typeof value === "string") setParentId(value);
                }}
                value={parent?.id ?? "none"}
              >
                <SelectTrigger aria-label="Página-mãe" className="w-full" size="sm">
                  <SelectValue>{parent?.title ?? "Nenhuma (raiz do espaço)"}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="start" alignItemWithTrigger={false}>
                  <SelectItem value="none">Nenhuma (raiz do espaço)</SelectItem>
                  {parents.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.icon} {candidate.title}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
          </>
        )}
      </div>
      <WizardFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancelar
        </Button>
        <Button disabled={title.trim().length === 0 || space === null} onClick={submit}>
          <FileTextIcon />
          Criar página
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function CreatePageDialog({
  group,
  open,
  defaultSpaceId,
  defaultParentId,
  defaultTemplateId,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  open: boolean;
  defaultSpaceId?: string | undefined;
  defaultParentId?: string | null | undefined;
  defaultTemplateId?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onCreated: (pageId: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <PageDialogBody
          defaultParentId={defaultParentId}
          defaultSpaceId={defaultSpaceId}
          defaultTemplateId={defaultTemplateId}
          group={group}
          onCreated={onCreated}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  );
}

const SPACE_ICONS = ["📁", "🚀", "🎨", "📊", "🧠", "📚", "🛠️", "🌱"] as const;

function SpaceDialogBody({
  group,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  onOpenChange: (open: boolean) => void;
  onCreated: (spaceId: string) => void;
}) {
  const addSpace = useGroupsStore((store) => store.addSpace);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(SPACE_ICONS[0]);
  const [error, setError] = useState("");

  const submit = () => {
    const created = addSpace(group.id, name, icon);
    if (created === null) {
      setError("Já existe um espaço com esse nome. Escolha outro.");
      return;
    }
    onOpenChange(false);
    onCreated(created);
  };

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Criar espaço</DialogTitle>
        <DialogDescription>
          Espaços agrupam páginas por área do grupo, como Produto, Pesquisa ou Operações.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        <Field label="Nome do espaço">
          <Input
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Pesquisa, Produto…"
            value={name}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Ícone</FieldLabel>
          <div className="flex flex-wrap items-center gap-1">
            {SPACE_ICONS.map((candidate) => (
              <button
                aria-label={`Ícone ${candidate}`}
                aria-pressed={candidate === icon}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md border text-base outline-hidden transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  candidate === icon ? "border-ring bg-muted" : "border-border/60 bg-transparent",
                )}
                key={candidate}
                onClick={() => setIcon(candidate)}
                type="button"
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>
        {error.length > 0 ? <p className="text-xs text-destructive-foreground">{error}</p> : null}
      </div>
      <WizardFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancelar
        </Button>
        <Button disabled={name.trim().length === 0} onClick={submit}>
          <FolderPlusIcon />
          Criar espaço
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function CreateSpaceDialog({
  group,
  open,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (spaceId: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <SpaceDialogBody group={group} onCreated={onCreated} onOpenChange={onOpenChange} />
      ) : null}
    </Dialog>
  );
}

function AgentDialogBody({
  group,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  onOpenChange: (open: boolean) => void;
  onCreated: (memberId: string) => void;
}) {
  const addMember = useGroupsStore((store) => store.addMember);
  const providersByEnvironment = useEnvironmentProviders();
  const environmentId = group.projectRef?.environmentId as EnvironmentId | undefined;
  const providerEntries =
    environmentId === undefined
      ? []
      : deriveProviderInstanceEntries(providersByEnvironment.get(environmentId) ?? []).filter(
          (entry) => entry.isAvailable,
        );

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [model, setModel] = useState("");
  const [autoRespond, setAutoRespond] = useState(false);

  const entry =
    providerEntries.find((candidate) => candidate.instanceId === instanceId) ?? providerEntries[0];
  const selectedModel =
    entry?.models.find((candidate) => candidate.slug === model) ??
    entry?.models.find((candidate) => candidate.isDefault) ??
    entry?.models[0];

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || entry === undefined || selectedModel === undefined) return;
    const memberId = addMember(group.id, {
      name: trimmed,
      handle: uniqueHandle(
        handle.trim().length > 0 ? handle : trimmed,
        group.members.map((member) => member.handle),
      ),
      instanceId: entry.instanceId,
      driverKind: entry.driverKind,
      model: selectedModel.slug,
      autoRespond,
      role: role.trim(),
      reportsTo: null,
      personId: null,
    });
    onOpenChange(false);
    onCreated(memberId);
  };

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Adicionar agente</DialogTitle>
        <DialogDescription>
          Escolha o provedor e o modelo que respondem por este agente em todos os canais do grupo.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Ana"
              size="sm"
              value={name}
            />
          </Field>
          <Field label="Handle">
            <Input
              onChange={(event) => setHandle(event.target.value)}
              placeholder="ana (opcional)"
              size="sm"
              value={handle}
            />
          </Field>
          <Field label="Cargo">
            <Input
              onChange={(event) => setRole(event.target.value)}
              placeholder="Design (opcional)"
              size="sm"
              value={role}
            />
          </Field>
          <Field label="Responder automaticamente">
            <span className="flex items-center gap-2">
              <Switch
                aria-label="Responder automaticamente"
                checked={autoRespond}
                onCheckedChange={setAutoRespond}
                size="sm"
              />
              <span className="text-xs text-muted-foreground">Sem precisar de menção</span>
            </span>
          </Field>
        </div>

        {environmentId === undefined ? (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Escolha um workspace nas configurações do grupo para carregar os provedores.
          </p>
        ) : providerEntries.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Nenhum provedor disponível neste workspace. Configure um em Configurações → Providers.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provedor">
              <Select
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setInstanceId(value);
                    setModel("");
                  }
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
            </Field>
            <Field label="Modelo">
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
            </Field>
          </div>
        )}
      </div>
      <WizardFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancelar
        </Button>
        <Button
          disabled={name.trim().length === 0 || entry === undefined || selectedModel === undefined}
          onClick={submit}
        >
          <BotIcon />
          Adicionar agente
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function CreateAgentDialog({
  group,
  open,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (memberId: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <AgentDialogBody group={group} onCreated={onCreated} onOpenChange={onOpenChange} />
      ) : null}
    </Dialog>
  );
}

function PersonDialogBody({
  group,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  onOpenChange: (open: boolean) => void;
  onCreated: (personId: string) => void;
}) {
  const addPerson = useGroupsStore((store) => store.addPerson);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const personId = addPerson(group.id, {
      name: trimmed,
      handle: uniquePersonHandle(handle.trim().length > 0 ? handle : trimmed, [
        ...group.people,
        ...group.members,
      ]),
      role: role.trim(),
    });
    if (personId === null) return;
    onOpenChange(false);
    onCreated(personId);
  };

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>Convidar pessoa</DialogTitle>
        <DialogDescription>
          Pessoas participam dos canais, entram nas reuniões e conectam as próprias IAs aos agentes
          do grupo.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Bruno"
              size="sm"
              value={name}
            />
          </Field>
          <Field label="Handle">
            <Input
              onChange={(event) => setHandle(event.target.value)}
              placeholder="bruno (opcional)"
              size="sm"
              value={handle}
            />
          </Field>
        </div>
        <Field label="Cargo">
          <Textarea
            onChange={(event) => setRole(event.target.value)}
            placeholder="Engenharia (opcional)"
            size="sm"
            value={role}
          />
        </Field>
      </div>
      <WizardFooter>
        <Button onClick={() => onOpenChange(false)} variant="outline">
          Cancelar
        </Button>
        <Button disabled={name.trim().length === 0} onClick={submit}>
          <UserPlusIcon />
          Adicionar pessoa
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function CreatePersonDialog({
  group,
  open,
  onOpenChange,
  onCreated,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (personId: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <PersonDialogBody group={group} onCreated={onCreated} onOpenChange={onOpenChange} />
      ) : null}
    </Dialog>
  );
}
