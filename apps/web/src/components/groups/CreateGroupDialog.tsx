import { useNavigate } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { useState } from "react";

import { useProjects } from "../../state/entities";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { WizardFooter, WizardPopup } from "../ui/wizard";
import { useGroupsStore } from "../../groups/groupStore";
import type { GroupProjectRef } from "../../groups/types";

const PROJECT_KEY_SEPARATOR = "::";

function projectKey(ref: GroupProjectRef): string {
  return `${ref.environmentId}${PROJECT_KEY_SEPARATOR}${ref.projectId}`;
}

function parseProjectKey(value: string): GroupProjectRef | null {
  const [environmentId, projectId] = value.split(PROJECT_KEY_SEPARATOR);
  if (!environmentId || !projectId) return null;
  return { environmentId, projectId };
}

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projects = useProjects();
  const navigate = useNavigate();
  const createGroup = useGroupsStore((store) => store.createGroup);
  const firstProject = projects[0];
  const firstProjectKey =
    firstProject === undefined
      ? ""
      : projectKey({ environmentId: firstProject.environmentId, projectId: firstProject.id });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>(firstProjectKey);
  const effectiveProject = selectedProject.length > 0 ? selectedProject : firstProjectKey;

  const reset = () => {
    setName("");
    setDescription("");
  };

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const groupId = createGroup({
      name: trimmed,
      description,
      projectRef: effectiveProject.length > 0 ? parseProjectKey(effectiveProject) : null,
    });
    const channelId = useGroupsStore.getState().groups.find((group) => group.id === groupId)
      ?.channels[0]?.id;
    onOpenChange(false);
    reset();
    void navigate({
      to: "/groups/$groupId",
      params: { groupId },
      search: { channel: channelId },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <WizardPopup>
        <DialogHeader>
          <DialogTitle>Novo grupo</DialogTitle>
          <DialogDescription>
            Crie um espaço com canais e agentes dos provedores que você já usa no T3 Code.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Nome</span>
            <Input
              autoFocus
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Estúdio"
              value={name}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Descrição</span>
            <Textarea
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Para que este grupo existe?"
              size="sm"
              value={description}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Workspace dos agentes</span>
            {projects.length === 0 ? (
              <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Nenhum projeto encontrado. Você pode criar o grupo agora e escolher o workspace
                depois nas configurações.
              </p>
            ) : (
              <Select
                onValueChange={(value) => {
                  if (typeof value === "string" && value.length > 0) setSelectedProject(value);
                }}
                value={effectiveProject}
              >
                <SelectTrigger aria-label="Workspace dos agentes" className="w-full" size="sm">
                  <SelectValue>
                    {projects.find(
                      (project) =>
                        projectKey({
                          environmentId: project.environmentId,
                          projectId: project.id,
                        }) === effectiveProject,
                    )?.title ?? "Escolha um projeto"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup align="start" alignItemWithTrigger={false}>
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
            )}
            <span className="text-xs text-muted-foreground">
              Cada agente conversa em uma thread própria dentro deste workspace.
            </span>
          </label>
        </div>
        <WizardFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancelar
          </Button>
          <Button disabled={name.trim().length === 0} onClick={submit}>
            <UsersIcon />
            Criar grupo
          </Button>
        </WizardFooter>
      </WizardPopup>
    </Dialog>
  );
}
