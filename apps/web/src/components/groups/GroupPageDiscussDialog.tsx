import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import { SendIcon } from "lucide-react";
import { useState } from "react";

import { firstTextChannel } from "../../groups/groupStore";
import { useGroupSend } from "../../groups/useGroupSend";
import type { Group, GroupChannel, GroupPage } from "../../groups/types";
import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Spinner } from "../ui/spinner";
import { WizardPopup } from "../ui/wizard";

const MAX_PAGE_CHARS = 6000;

interface DiscussDialogProps {
  group: Group;
  page: GroupPage;
  project: EnvironmentProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (channelId: string) => void;
}

function DiscussDialogBody({
  group,
  page,
  project,
  open,
  onOpenChange,
  onSent,
  channel,
}: DiscussDialogProps & { channel: GroupChannel }) {
  const { send, sending } = useGroupSend(group, channel, project);
  const [selected, setSelected] = useState<string[]>(() =>
    group.members.filter((member) => member.autoRespond).map((member) => member.id),
  );
  const [instruction, setInstruction] = useState(
    "Revise esta página e aponte riscos, lacunas e próximos passos.",
  );

  const toggle = (memberId: string) => {
    setSelected((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  };

  const recipients = group.members.filter((member) => selected.includes(member.id));
  const content = page.content.trim();
  const excerpt =
    content.length > MAX_PAGE_CHARS
      ? `${content.slice(0, MAX_PAGE_CHARS)}\n\n(conteúdo truncado)`
      : content;

  const submit = () => {
    if (recipients.length === 0 || sending) return;
    const mentions = recipients.map((member) => `@${member.handle}`).join(" ");
    const text = [
      mentions,
      instruction.trim(),
      "",
      `Página: ${page.icon} ${page.title}`,
      excerpt.length > 0 ? excerpt : "(página vazia)",
    ]
      .filter((line) => line.length > 0)
      .join("\n\n");
    void send(text).then(() => {
      onSent(channel.id);
      onOpenChange(false);
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <WizardPopup size="wide">
        <DialogHeader>
          <DialogTitle>Discutir a página com agentes</DialogTitle>
          <DialogDescription>
            Envia a página para o canal #{channel.name} e pede uma resposta dos agentes escolhidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-5">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Agentes
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {group.members.map((member) => {
                const active = selected.includes(member.id);
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted",
                    )}
                    key={member.id}
                    onClick={() => toggle(member.id)}
                    type="button"
                  >
                    <ProviderInstanceIcon
                      badgeContent="none"
                      displayName={member.name}
                      driverKind={member.driverKind as never}
                      size="compact"
                    />
                    {member.name}
                  </button>
                );
              })}
              {group.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum agente no grupo. Adicione agentes para discutir páginas.
                </p>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Pedido
            </h3>
            <textarea
              aria-label="Pedido aos agentes"
              className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/24 focus-visible:ring-inset"
              onChange={(event) => setInstruction(event.target.value)}
              value={instruction}
            />
            <p className="text-2xs text-muted-foreground">
              A página é anexada como texto ({excerpt.length} caracteres).
            </p>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => onOpenChange(false)} size="sm" variant="outline">
              Cancelar
            </Button>
            <Button disabled={recipients.length === 0 || sending} onClick={submit} size="sm">
              {sending ? <Spinner /> : <SendIcon />}
              Enviar para #{channel.name}
            </Button>
          </div>
        </div>
      </WizardPopup>
    </Dialog>
  );
}

export function GroupPageDiscussDialog(props: DiscussDialogProps) {
  const channel = firstTextChannel(props.group);
  if (channel === null) return null;
  return <DiscussDialogBody {...props} channel={channel} />;
}
