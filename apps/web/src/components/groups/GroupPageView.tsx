import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FilePlus2Icon,
  FileTextIcon,
  ImageIcon,
  LayoutGridIcon,
  LinkIcon,
  MessageSquareIcon,
  NetworkIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import {
  pageBacklinks,
  pageBreadcrumbs,
  pageHeadings,
  pageOutgoingLinks,
  pageWordCount,
  resolveWikiLink,
  type PageHeading,
} from "../../groups/pageLogic";
import { copyPageLink, exportPageMarkdown } from "../../groups/pageActions";
import { normalizePageTags, useGroupsStore } from "../../groups/groupStore";
import type { Group, GroupPage, GroupPageCoverId } from "../../groups/types";
import { GROUP_PAGE_COVER_CLASSES } from "../../groups/types";
import { isElectron } from "../../env";
import { WorkspacePageHeader } from "../WorkspacePageHeader";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { SidebarInset } from "../ui/sidebar";
import { GroupConfirmDialog } from "./GroupActionDialogs";
import { CreatePageDialog } from "./GroupCreateDialogs";
import { GroupPageCanvas } from "./GroupPageCanvas";
import { GroupPageCoverDialog } from "./GroupPageCoverDialog";
import { GroupPageDiscussDialog } from "./GroupPageDiscussDialog";
import { GroupPageEditor } from "./GroupPageEditor";
import { GroupPageGraph } from "./GroupPageGraph";
import { GroupPageTrashDialog } from "./GroupPageTrashDialog";

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: GroupPage["mode"];
  onChange: (mode: GroupPage["mode"]) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5">
      {(
        [
          { id: "document", label: "Documento", icon: <FileTextIcon /> },
          { id: "canvas", label: "Quadro", icon: <LayoutGridIcon /> },
        ] as const
      ).map((item) => (
        <button
          aria-label={item.label}
          aria-pressed={mode === item.id}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-3.5",
            mode === item.id
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.icon}
          <span className="max-sm:hidden">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function PageTitleInput({ page, onSave }: { page: GroupPage; onSave: (title: string) => void }) {
  return (
    <input
      aria-label="Título da página"
      className="w-full rounded-md bg-transparent text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 hover:bg-muted/30 focus-visible:bg-muted/30"
      onChange={(event) => onSave(event.target.value)}
      placeholder="Sem título"
      value={page.title}
    />
  );
}

function TagRow({ page, onSave }: { page: GroupPage; onSave: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const next = normalizePageTags([...page.tags, draft]);
    setDraft("");
    if (next.length === page.tags.length) return;
    onSave(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {page.tags.map((tag) => (
        <span
          className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
          key={tag}
        >
          {tag}
          <button
            aria-label={`Remover tag ${tag}`}
            className="rounded-sm outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => onSave(page.tags.filter((entry) => entry !== tag))}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span className="flex w-28 items-center gap-1">
          <PlusIcon className="size-3 shrink-0 text-muted-foreground" />
          <Input
            aria-label="Adicionar tag"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Tag"
            size="sm"
            value={draft}
          />
        </span>
      </form>
    </div>
  );
}

function HeadingSection({
  headings,
  onJump,
}: {
  headings: PageHeading[];
  onJump: (heading: PageHeading) => void;
}) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-l border-border/60 bg-sidebar/40 xl:flex">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
          Nesta página
        </h2>
      </div>
      <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {headings.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">Sem títulos</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {headings.map((heading) => (
              <li key={heading.id}>
                <button
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground outline-hidden hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onJump(heading)}
                  style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
                  type="button"
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ConnectionList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {empty ? <p className="text-xs text-muted-foreground">Nenhuma</p> : children}
    </div>
  );
}

export function GroupPageView({
  group,
  page,
  project,
  onOpenPage,
  onOpenChannel,
}: {
  group: Group;
  page: GroupPage;
  project: EnvironmentProject | null;
  onOpenPage: (pageId: string) => void;
  onOpenChannel: (channelId: string) => void;
}) {
  const updatePage = useGroupsStore((store) => store.updatePage);
  const deletePage = useGroupsStore((store) => store.deletePage);
  const duplicatePage = useGroupsStore((store) => store.duplicatePage);
  const togglePageFavorite = useGroupsStore((store) => store.togglePageFavorite);
  const addPage = useGroupsStore((store) => store.addPage);
  const [discussOpen, setDiscussOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [subpageOpen, setSubpageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const editorWrapRef = useRef<HTMLDivElement>(null);

  const space = group.spaces.find((candidate) => candidate.id === page.spaceId) ?? null;
  const crumbs = pageBreadcrumbs(group.pages, page.id).slice(0, -1);
  const outgoing = pageOutgoingLinks(group.pages, page);
  const backlinks = pageBacklinks(group.pages, page);
  const headings = pageHeadings(page.content);
  const words = pageWordCount(page.content);
  const isCanvas = page.mode === "canvas";

  const save = (
    patch: Partial<
      Pick<
        GroupPage,
        "title" | "content" | "icon" | "parentId" | "cover" | "tags" | "mode" | "canvas"
      >
    >,
  ) => {
    updatePage(group.id, page.id, patch);
  };

  const openLink = (title: string) => {
    const linked = resolveWikiLink(group.pages, title);
    if (linked !== null) {
      onOpenPage(linked.id);
      return;
    }
    const created = addPage(group.id, { spaceId: page.spaceId, title });
    if (created !== null) onOpenPage(created);
  };

  const jumpToHeading = (heading: PageHeading) => {
    const container = editorWrapRef.current;
    if (container === null) return;
    const elements = Array.from(container.querySelectorAll<HTMLElement>("h1, h2, h3, h4"));
    const target = elements.find(
      (element) => (element.textContent ?? "").trim() === heading.text.trim(),
    );
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const coverStrip =
    page.cover === "" ? null : (
      <div
        className={cn(
          "relative h-44 w-full border-b border-border/60",
          GROUP_PAGE_COVER_CLASSES[page.cover],
        )}
      >
        <div className="absolute right-4 bottom-4 flex items-center gap-1.5">
          <Button onClick={() => setCoverOpen(true)} size="xs" variant="outline">
            <ImageIcon />
            Trocar capa
          </Button>
          <Button
            aria-label="Remover capa"
            onClick={() => save({ cover: "" })}
            size="icon-xs"
            variant="outline"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    );

  const pageHeading = (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <input
          aria-label="Ícone da página"
          className="mt-0.5 w-12 shrink-0 rounded-lg bg-transparent py-0.5 text-center text-3xl outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
          maxLength={4}
          onChange={(event) => save({ icon: event.target.value })}
          value={page.icon}
        />
        <div className="min-w-0 flex-1">
          <PageTitleInput onSave={(title) => save({ title })} page={page} />
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="truncate">{words} palavra(s)</span>
            <span aria-hidden>·</span>
            <span className="truncate">
              atualizada em {new Date(page.updatedAt).toLocaleString("pt-BR")}
            </span>
          </p>
        </div>
      </div>
      <TagRow onSave={(tags) => save({ tags })} page={page} />
    </div>
  );

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden" role="main">
      <WorkspacePageHeader className="gap-3 border-b border-border/60" electron={isElectron}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden className="shrink-0 text-base leading-none">
            {space?.icon ?? "📁"}
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
              <span className="truncate">{space?.name ?? "Espaço"}</span>
              {crumbs.map((crumb) => (
                <span className="flex min-w-0 items-center gap-1" key={crumb.id}>
                  <span aria-hidden>/</span>
                  <button
                    className="max-w-32 truncate rounded-sm outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => onOpenPage(crumb.id)}
                    type="button"
                  >
                    {crumb.title}
                  </button>
                </span>
              ))}
            </div>
            <span className="truncate text-sm font-semibold text-foreground">{page.title}</span>
          </div>
        </div>

        <ModeSwitch mode={page.mode} onChange={(mode) => save({ mode })} />

        <Button
          aria-label={page.favorite ? "Remover dos favoritos" : "Favoritar página"}
          aria-pressed={page.favorite}
          onClick={() => togglePageFavorite(group.id, page.id)}
          size="icon-sm"
          variant="ghost"
        >
          <StarIcon className={cn(page.favorite && "fill-current text-warning")} />
        </Button>

        <Button
          aria-label="Discutir com agentes"
          onClick={() => setDiscussOpen(true)}
          size="sm"
          variant="outline"
        >
          <MessageSquareIcon />
          <span className="max-sm:hidden">Discutir</span>
        </Button>

        <Menu>
          <MenuTrigger render={<Button size="xs" variant="ghost" />}>
            <EllipsisIcon />
            Mais
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => setSubpageOpen(true)}>
              <FilePlus2Icon />
              Nova subpágina
            </MenuItem>
            <MenuItem onClick={() => setGraphOpen(true)}>
              <NetworkIcon />
              Grafo de páginas
            </MenuItem>
            <MenuItem onClick={() => setCoverOpen(true)}>
              <ImageIcon />
              {page.cover === "" ? "Adicionar capa" : "Trocar capa"}
            </MenuItem>
            <MenuItem onClick={() => exportPageMarkdown(page)}>
              <DownloadIcon />
              Exportar markdown
            </MenuItem>
            <MenuItem onClick={() => void copyPageLink(group.id, page.id)}>
              <CopyIcon />
              Copiar link
            </MenuItem>
            <MenuItem
              onClick={() => {
                const created = duplicatePage(group.id, page.id);
                if (created !== null) onOpenPage(created);
              }}
            >
              <FilePlus2Icon />
              Duplicar página
            </MenuItem>
            <MenuItem onClick={() => setTrashOpen(true)}>
              <Trash2Icon />
              Abrir lixeira
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => setConfirmDelete(true)} variant="destructive">
              <Trash2Icon />
              Mover para a lixeira
            </MenuItem>
          </MenuPopup>
        </Menu>
      </WorkspacePageHeader>

      {isCanvas ? (
        <>
          {coverStrip}
          <div className="mx-auto w-full max-w-3xl shrink-0 px-6 pt-6 pb-4 sm:px-10">
            {pageHeading}
          </div>
          <GroupPageCanvas
            key={`${page.id}:canvas`}
            onChange={(canvas) => save({ canvas })}
            page={page}
          />
        </>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="scrollbar-gutter-both min-h-0 flex-1 overflow-y-auto">
            {coverStrip}
            <article className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-6 pt-9 pb-14 sm:px-10">
              {pageHeading}

              <div ref={editorWrapRef}>
                <GroupPageEditor
                  key={page.id}
                  onChange={(markdown) => {
                    if (markdown === page.content) return;
                    save({ content: markdown });
                  }}
                  onOpenPageLink={openLink}
                  value={page.content}
                />
              </div>

              <details className="group rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-xs font-medium text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="flex items-center gap-1.5">
                    <LinkIcon className="size-3.5 text-muted-foreground" />
                    Conexões
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {outgoing.length} link(s) · {backlinks.length} backlink(s)
                  </span>
                </summary>
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <ConnectionList empty={outgoing.length === 0} title="Links desta página">
                    <ul className="flex flex-col gap-0.5">
                      {outgoing.map((link) => (
                        <li key={link.title}>
                          <button
                            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground outline-hidden hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            onClick={() => openLink(link.title)}
                            type="button"
                          >
                            <span aria-hidden>{link.page?.icon ?? "➕"}</span>
                            <span className="min-w-0 flex-1 truncate">{link.title}</span>
                            {link.page === null ? (
                              <span className="shrink-0 text-2xs text-muted-foreground">criar</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ConnectionList>
                  <ConnectionList empty={backlinks.length === 0} title="Backlinks">
                    <ul className="flex flex-col gap-0.5">
                      {backlinks.map((source) => (
                        <li key={source.id}>
                          <button
                            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground outline-hidden hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            onClick={() => onOpenPage(source.id)}
                            type="button"
                          >
                            <span aria-hidden>{source.icon}</span>
                            <span className="min-w-0 flex-1 truncate">{source.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ConnectionList>
                </div>
              </details>
            </article>
          </div>

          <HeadingSection headings={headings} onJump={jumpToHeading} />
        </div>
      )}

      <GroupPageDiscussDialog
        group={group}
        onOpenChange={setDiscussOpen}
        onSent={onOpenChannel}
        open={discussOpen}
        page={page}
        project={project}
      />
      <GroupPageGraph
        group={group}
        onOpenChange={setGraphOpen}
        onOpenPage={onOpenPage}
        open={graphOpen}
      />
      <CreatePageDialog
        defaultParentId={page.id}
        defaultSpaceId={page.spaceId}
        group={group}
        onCreated={(pageId) => {
          setSubpageOpen(false);
          onOpenPage(pageId);
        }}
        onOpenChange={setSubpageOpen}
        open={subpageOpen}
      />
      <GroupPageCoverDialog
        initial={page.cover}
        onOpenChange={setCoverOpen}
        onSubmit={(cover: GroupPageCoverId | "") => save({ cover })}
        open={coverOpen}
      />
      <GroupPageTrashDialog
        group={group}
        onOpenChange={setTrashOpen}
        onRestored={onOpenPage}
        open={trashOpen}
      />
      <GroupConfirmDialog
        confirmLabel="Mover para a lixeira"
        description="A página e as subpáginas vão para a lixeira e podem ser restauradas depois."
        onConfirm={() => {
          setConfirmDelete(false);
          deletePage(group.id, page.id);
        }}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        title={`Mover ${page.title} para a lixeira?`}
      />
    </SidebarInset>
  );
}
