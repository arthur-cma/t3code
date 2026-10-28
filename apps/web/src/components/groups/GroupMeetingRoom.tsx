import { CheckIcon, PlusIcon, SendIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import type { Group, GroupMember } from "../../groups/types";
import { cn } from "../../lib/utils";
import { useGroupsStore } from "../../groups/groupStore";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { WizardPopup } from "../ui/wizard";

function nextAgendaId(): string {
  return `agenda_${Date.now().toString(36)}`;
}

function formatElapsed(startedAt: string, now: number): string {
  const total = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function GroupMeetingRoom({
  group,
  open,
  onOpenChange,
  onSendSummary,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendSummary: (text: string) => Promise<void>;
}) {
  const startMeeting = useGroupsStore((store) => store.startMeeting);
  const updateMeeting = useGroupsStore((store) => store.updateMeeting);
  const deleteMeeting = useGroupsStore((store) => store.deleteMeeting);
  const [now, setNow] = useState(() => Date.now());
  const [agendaDraft, setAgendaDraft] = useState("");
  const [sending, setSending] = useState(false);

  const active = group.meetings.find((meeting) => meeting.endedAt === null) ?? null;
  const past = group.meetings.filter((meeting) => meeting.endedAt !== null);

  // The meeting clock only runs while the room is open.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- ticking wall clock
  useEffect(() => {
    if (!open || active === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, active]);

  const participants = active?.participants ?? [];
  const selectedMembers = group.members.filter((member) => participants.includes(member.id));

  const toggleParticipant = (member: GroupMember) => {
    if (active === null) return;
    const next = participants.includes(member.id)
      ? participants.filter((id) => id !== member.id)
      : [...participants, member.id];
    updateMeeting(group.id, active.id, { participants: next });
  };

  const addAgendaItem = () => {
    const text = agendaDraft.trim();
    if (active === null || text.length === 0) return;
    updateMeeting(group.id, active.id, {
      agenda: [...active.agenda, { id: nextAgendaId(), text, done: false }],
    });
    setAgendaDraft("");
  };

  const buildSummary = (): string => {
    if (active === null) return "";
    const mentions = selectedMembers.map((member) => `@${member.handle}`).join(" ");
    const agenda = active.agenda
      .map((item) => `- [${item.done ? "x" : " "}] ${item.text}`)
      .join("\n");
    return [
      mentions,
      `Resumo da reunião "${active.title}" (${formatElapsed(active.startedAt, now)}):`,
      agenda.length > 0 ? `Agenda:\n${agenda}` : null,
      active.notes.trim().length > 0 ? `Notas:\n${active.notes}` : null,
      "Traga decisões, riscos e próximos passos.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n\n");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <WizardPopup size="wide">
        <DialogHeader>
          <DialogTitle>Sala de reunião</DialogTitle>
          <DialogDescription>
            Uma reunião viva com pauta, notas e participantes. Os agentes convidados entram na
            conversa do canal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          {active === null ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma reunião em andamento neste grupo.
              </p>
              <Button
                onClick={() => {
                  startMeeting(group.id, `Reunião de ${group.name}`);
                }}
                size="sm"
              >
                <PlusIcon />
                Iniciar reunião
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Título</span>
                  <Input
                    onChange={(event) =>
                      updateMeeting(group.id, active.id, { title: event.target.value })
                    }
                    size="sm"
                    value={active.title}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <Badge size="sm" variant="secondary">
                    {formatElapsed(active.startedAt, now)}
                  </Badge>
                  <Button
                    onClick={() =>
                      updateMeeting(group.id, active.id, { endedAt: new Date().toISOString() })
                    }
                    size="sm"
                    variant="outline"
                  >
                    <SquareIcon />
                    Encerrar
                  </Button>
                </div>
              </div>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Participantes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((member) => {
                    const selected = participants.includes(member.id);
                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          selected
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted",
                        )}
                        key={member.id}
                        onClick={() => toggleParticipant(member)}
                        type="button"
                      >
                        <ProviderInstanceIcon
                          badgeContent="none"
                          displayName={member.name}
                          driverKind={member.driverKind as never}
                          size="compact"
                        />
                        {member.name}
                        {selected ? <CheckIcon className="size-3" /> : null}
                      </button>
                    );
                  })}
                  {group.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum agente no grupo para convidar.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Pauta
                </h3>
                {active.agenda.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum item na pauta ainda.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                    {active.agenda.map((item) => (
                      <li className="flex items-center gap-2 px-3 py-1.5" key={item.id}>
                        <button
                          aria-label={item.done ? "Reabrir item" : "Concluir item"}
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-sm border outline-hidden",
                            item.done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                          onClick={() =>
                            updateMeeting(group.id, active.id, {
                              agenda: active.agenda.map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, done: !candidate.done }
                                  : candidate,
                              ),
                            })
                          }
                          type="button"
                        >
                          {item.done ? <CheckIcon className="size-3" /> : null}
                        </button>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            item.done ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {item.text}
                        </span>
                        <Button
                          aria-label="Remover item"
                          onClick={() =>
                            updateMeeting(group.id, active.id, {
                              agenda: active.agenda.filter((candidate) => candidate.id !== item.id),
                            })
                          }
                          size="icon-xs"
                          variant="ghost"
                        >
                          <Trash2Icon />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Novo item da pauta"
                    onChange={(event) => setAgendaDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addAgendaItem();
                      }
                    }}
                    placeholder="Adicionar item da pauta"
                    size="sm"
                    value={agendaDraft}
                  />
                  <Button onClick={addAgendaItem} size="sm" variant="outline">
                    <PlusIcon />
                    Adicionar
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Notas
                </h3>
                <Textarea
                  aria-label="Notas da reunião"
                  onChange={(event) =>
                    updateMeeting(group.id, active.id, { notes: event.target.value })
                  }
                  placeholder="Decisões, riscos, próximos passos…"
                  size="sm"
                  value={active.notes}
                />
              </section>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {selectedMembers.length} participante(s) · {active.agenda.length} item(ns) na
                  pauta
                </p>
                <Button
                  disabled={sending || selectedMembers.length === 0}
                  onClick={() => {
                    setSending(true);
                    void onSendSummary(buildSummary()).finally(() => setSending(false));
                  }}
                  size="sm"
                >
                  <SendIcon />
                  Pedir resumo aos agentes
                </Button>
              </div>
            </>
          )}

          {past.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Reuniões anteriores
              </h3>
              <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                {past.map((meeting) => (
                  <li className="flex items-center gap-2 px-3 py-2" key={meeting.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{meeting.title}</p>
                      <p className="truncate text-2xs text-muted-foreground">
                        {new Date(meeting.startedAt).toLocaleString("pt-BR")} ·{" "}
                        {meeting.agenda.length} item(ns)
                      </p>
                    </div>
                    <Button
                      aria-label="Excluir reunião"
                      onClick={() => deleteMeeting(group.id, meeting.id)}
                      size="icon-xs"
                      variant="ghost-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </WizardPopup>
    </Dialog>
  );
}
