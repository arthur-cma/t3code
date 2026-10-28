import { ChevronRightIcon, ClockIcon, PlusIcon, StarIcon } from "lucide-react";
import { useState } from "react";

import { buildPageTree, searchPages, type PageTreeNode } from "../../groups/pageLogic";
import { favoritePages, recentPages } from "../../groups/groupStore";
import type { Group, GroupPage } from "../../groups/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-1 text-2xs font-medium tracking-wide text-sidebar-muted-foreground">
      {children}
    </div>
  );
}

function PageRow({
  page,
  depth,
  active,
  onOpenPage,
}: {
  page: GroupPage;
  depth: number;
  active: boolean;
  onOpenPage: (pageId: string) => void;
}) {
  return (
    <SidebarMenuButton
      isActive={active}
      onClick={() => onOpenPage(page.id)}
      size="sm"
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <span aria-hidden className="shrink-0 text-xs leading-none">
        {page.icon}
      </span>
      <span className="truncate">{page.title}</span>
      {page.favorite ? <StarIcon className="ml-auto size-3 shrink-0 text-warning" /> : null}
    </SidebarMenuButton>
  );
}

function TreeBranch({
  node,
  depth,
  activePageId,
  onOpenPage,
}: {
  node: PageTreeNode;
  depth: number;
  activePageId: string | null;
  onOpenPage: (pageId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <SidebarMenuItem>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            aria-label={expanded ? "Recolher subpáginas" : "Expandir subpáginas"}
            aria-expanded={expanded}
            className="flex size-4 shrink-0 items-center justify-center rounded-sm text-sidebar-muted-foreground outline-hidden hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => setExpanded((value) => !value)}
            style={{ marginLeft: `${2 + depth * 12}px` }}
            type="button"
          >
            <ChevronRightIcon
              className={cn("size-3 transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span
            aria-hidden
            className="size-4 shrink-0"
            style={{ marginLeft: `${2 + depth * 12}px` }}
          />
        )}
        <div className="min-w-0 flex-1">
          <PageRow
            active={node.page.id === activePageId}
            depth={0}
            onOpenPage={onOpenPage}
            page={node.page}
          />
        </div>
      </div>
      {hasChildren && expanded ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeBranch
              activePageId={activePageId}
              depth={depth + 1}
              key={child.page.id}
              node={child}
              onOpenPage={onOpenPage}
            />
          ))}
        </div>
      ) : null}
    </SidebarMenuItem>
  );
}

export function GroupPagesSidebar({
  group,
  activePageId,
  onOpenPage,
  onNewPage,
  onNewSpace,
}: {
  group: Group;
  activePageId: string | null;
  onOpenPage: (pageId: string) => void;
  onNewPage: (spaceId: string) => void;
  onNewSpace: (name: string) => void;
}) {
  const [spaceDraft, setSpaceDraft] = useState("");
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [query, setQuery] = useState("");
  const favorites = favoritePages(group);
  const recents = recentPages(group, 5);
  const results = query.trim().length > 0 ? searchPages(group.pages, query, 12) : [];
  const searching = query.trim().length > 0;

  const submitSpace = () => {
    const name = spaceDraft.trim();
    if (name.length > 0) onNewSpace(name);
    setSpaceDraft("");
    setCreatingSpace(false);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pr-1 pl-2">
        <SectionLabel>Espaço</SectionLabel>
        <Button
          aria-label="Novo espaço"
          onClick={() => setCreatingSpace((value) => !value)}
          size="icon-xs"
          variant="ghost"
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="px-2 pb-2">
        <Input
          aria-label="Buscar páginas"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar páginas"
          size="sm"
          value={query}
        />
      </div>

      {searching ? (
        <SidebarMenu>
          {results.length === 0 ? (
            <p className="px-2 pb-1 text-2xs leading-relaxed text-sidebar-muted-foreground">
              Nenhuma página encontrada.
            </p>
          ) : (
            results.map((page) => (
              <SidebarMenuItem key={page.id}>
                <PageRow
                  active={page.id === activePageId}
                  depth={0}
                  onOpenPage={onOpenPage}
                  page={page}
                />
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      ) : null}

      {searching ? null : creatingSpace ? (
        <div className="px-2 pb-2">
          <Input
            aria-label="Nome do novo espaço"
            autoFocus
            onChange={(event) => setSpaceDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitSpace();
              }
              if (event.key === "Escape") {
                setSpaceDraft("");
                setCreatingSpace(false);
              }
            }}
            placeholder="Pesquisa, Produto…"
            size="sm"
            value={spaceDraft}
          />
        </div>
      ) : null}

      {searching
        ? null
        : group.spaces.map((space) => {
            const tree = buildPageTree(group.pages, space.id);
            const spacePages = group.pages.filter((page) => page.spaceId === space.id).length;
            return (
              <div className="flex flex-col gap-0.5 pb-1" key={space.id}>
                <div className="flex items-center gap-1 pr-1 pl-2">
                  <span aria-hidden className="text-xs leading-none">
                    {space.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-sidebar-foreground">
                    {space.name}
                  </span>
                  <span className="text-2xs text-sidebar-muted-foreground">{spacePages}</span>
                  <Button
                    aria-label={`Nova página em ${space.name}`}
                    onClick={() => onNewPage(space.id)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <PlusIcon />
                  </Button>
                </div>
                {tree.length === 0 ? (
                  <p className="px-2 pb-1 pl-6 text-2xs leading-relaxed text-sidebar-muted-foreground">
                    Nenhuma página ainda.
                  </p>
                ) : (
                  <SidebarMenu>
                    {tree.map((node) => (
                      <TreeBranch
                        activePageId={activePageId}
                        depth={0}
                        key={node.page.id}
                        node={node}
                        onOpenPage={onOpenPage}
                      />
                    ))}
                  </SidebarMenu>
                )}
              </div>
            );
          })}

      {!searching && favorites.length > 0 ? (
        <>
          <SectionLabel>Favoritos</SectionLabel>
          <SidebarMenu>
            {favorites.map((page) => (
              <SidebarMenuItem key={page.id}>
                <PageRow
                  active={page.id === activePageId}
                  depth={0}
                  onOpenPage={onOpenPage}
                  page={page}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </>
      ) : null}

      {!searching && recents.length > 0 ? (
        <>
          <div className="flex items-center gap-1 px-2 pt-1 pb-1">
            <ClockIcon className="size-3 text-sidebar-muted-foreground" />
            <span className="text-2xs font-medium tracking-wide text-sidebar-muted-foreground">
              Recentes
            </span>
          </div>
          <SidebarMenu>
            {recents.map((page) => (
              <SidebarMenuItem key={page.id}>
                <PageRow
                  active={page.id === activePageId}
                  depth={0}
                  onOpenPage={onOpenPage}
                  page={page}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </>
      ) : null}
    </div>
  );
}
