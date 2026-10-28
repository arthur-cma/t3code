import {
  BoldIcon,
  CheckSquareIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PlusIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TextIcon,
} from "lucide-react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRef, useState, type ReactNode } from "react";

import { wikiLinkTitleFromText } from "~/groups/pageLogic";
import { pageDocToMarkdown, pageMarkdownToDocJson } from "~/groups/pageDoc";
import { PAGE_EDITOR_EXTENSIONS } from "~/groups/pageEditorExtensions";
import { useStableCallback } from "~/hooks/useStableCallback";
import { cn } from "~/lib/utils";

interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: ReactNode;
  run: (editor: Editor) => void;
}

const SLASH_COMMANDS: ReadonlyArray<SlashCommand> = [
  {
    id: "text",
    label: "Texto",
    hint: "Parágrafo simples",
    keywords: "texto paragrafo paragrafo",
    icon: <TextIcon />,
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "h1",
    label: "Título 1",
    hint: "Seção principal",
    keywords: "titulo heading h1",
    icon: <Heading1Icon />,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Título 2",
    hint: "Subseção",
    keywords: "titulo heading h2",
    icon: <Heading2Icon />,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Título 3",
    hint: "Subseção menor",
    keywords: "titulo heading h3",
    icon: <Heading3Icon />,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Lista com marcadores",
    hint: "Itens simples",
    keywords: "lista bullet marcadores",
    icon: <ListIcon />,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Lista numerada",
    hint: "Passos em ordem",
    keywords: "lista numerada ordered",
    icon: <ListOrderedIcon />,
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task",
    label: "Lista de tarefas",
    hint: "Itens com caixa de seleção",
    keywords: "tarefa todo checklist checkbox",
    icon: <CheckSquareIcon />,
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "quote",
    label: "Citação",
    hint: "Destaque uma fala ou trecho",
    keywords: "citacao quote bloco",
    icon: <QuoteIcon />,
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Bloco de código",
    hint: "Trecho monoespaçado",
    keywords: "codigo code bloco",
    icon: <SquareCodeIcon />,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "Divisor",
    hint: "Linha horizontal",
    keywords: "divisor linha hr",
    icon: <MinusIcon />,
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "wikilink",
    label: "Link para página",
    hint: "[[Título]] cria a página se não existir",
    keywords: "link pagina wiki wikilink",
    icon: <Link2Icon />,
    run: (editor) => {
      editor.chain().focus().insertContent("[[]]").run();
      const caret = editor.state.selection.from - 2;
      editor.commands.setTextSelection(caret);
    },
  },
];

function matchingCommands(query: string): SlashCommand[] {
  const needle = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (needle.length === 0) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter((command) => {
    const haystack = `${command.label} ${command.keywords}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

interface SlashState {
  query: string;
  from: number;
  to: number;
  top: number;
  left: number;
}

function readSlashState(editor: Editor): SlashState | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.type.name === "codeBlock") return null;
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, "\uFFFC");
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(text);
  if (match === null) return null;
  const query = match[1] ?? "";
  const from = $from.start() + (match[0].length - query.length - 1);
  const coords = editor.view.coordsAtPos($from.pos);
  return { query, from, to: $from.pos, top: coords.bottom + 6, left: coords.left };
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
  showLabel = false,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  showLabel?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active ?? false}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-4",
        showLabel ? "text-xs font-medium" : "min-w-8",
        active === true && "bg-accent text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}

export function GroupPageEditor({
  value,
  onChange,
  onOpenPageLink,
  ariaLabel = "Conteúdo da página",
}: {
  value: string;
  onChange: (markdown: string) => void;
  onOpenPageLink: (title: string) => void;
  ariaLabel?: string | undefined;
}) {
  const [isEmpty, setIsEmpty] = useState(() => value.trim().length === 0);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashRef = useRef<SlashState | null>(null);
  const slashIndexRef = useRef(0);
  const editorRef = useRef<Editor | null>(null);
  const openPageLink = useStableCallback(onOpenPageLink);

  const setSlashState = (next: SlashState | null) => {
    slashRef.current = next;
    slashIndexRef.current = 0;
    setSlash(next);
    setSlashIndex(0);
  };

  const applySlash = (command: SlashCommand) => {
    const instance = editorRef.current;
    const state = slashRef.current;
    if (instance === null || state === null) return;
    setSlashState(null);
    instance.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
    command.run(instance);
  };

  const editor = useEditor({
    extensions: PAGE_EDITOR_EXTENSIONS,
    content: pageMarkdownToDocJson(value),
    shouldRerenderOnTransaction: true,
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
    },
    editorProps: {
      attributes: {
        class: "page-tiptap min-h-[45vh] max-w-none text-sm text-foreground",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        spellcheck: "true",
      },
      handleClick(view, _pos, event) {
        const target = event.target;
        if (!(target instanceof Element)) return false;
        const link = target.closest<HTMLElement>("[data-page-wikilink]");
        if (link === null) return false;
        const title = wikiLinkTitleFromText(link.textContent ?? "");
        if (title === null) return false;
        event.preventDefault();
        openPageLink(title);
        return true;
      },
      handleKeyDown(view, event) {
        const state = slashRef.current;
        if (state === null || event.isComposing) return false;
        const commands = matchingCommands(state.query);
        if (commands.length === 0) return false;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          const next = (slashIndexRef.current + 1) % commands.length;
          slashIndexRef.current = next;
          setSlashIndex(next);
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          const next = (slashIndexRef.current - 1 + commands.length) % commands.length;
          slashIndexRef.current = next;
          setSlashIndex(next);
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setSlashState(null);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const command = commands[slashIndexRef.current] ?? commands[0];
          if (command === undefined) return false;
          event.preventDefault();
          applySlash(command);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: updated }) => {
      const markdown = pageDocToMarkdown(updated.state.doc);
      setIsEmpty(markdown.trim().length === 0);
      onChange(markdown);
      const next = readSlashState(updated);
      const current = slashRef.current;
      if (next?.query === current?.query && next !== null) return;
      if (next === null && current === null) return;
      setSlashState(next);
    },
    onSelectionUpdate: ({ editor: updated }) => {
      const next = readSlashState(updated);
      const current = slashRef.current;
      if (next === null && current === null) return;
      if (next !== null && current !== null && next.query === current.query) return;
      setSlashState(next);
    },
  });

  const commandItems = slash === null ? [] : matchingCommands(slash.query);

  const toolbar = [
    {
      id: "bold",
      label: "Negrito",
      icon: <BoldIcon />,
      run: () => editor?.chain().focus().toggleBold().run(),
      active: editor?.isActive("bold") ?? false,
    },
    {
      id: "italic",
      label: "Itálico",
      icon: <ItalicIcon />,
      run: () => editor?.chain().focus().toggleItalic().run(),
      active: editor?.isActive("italic") ?? false,
    },
    {
      id: "strike",
      label: "Tachado",
      icon: <StrikethroughIcon />,
      run: () => editor?.chain().focus().toggleStrike().run(),
      active: editor?.isActive("strike") ?? false,
    },
    {
      id: "code",
      label: "Código",
      icon: <CodeIcon />,
      run: () => editor?.chain().focus().toggleCode().run(),
      active: editor?.isActive("code") ?? false,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-background/95 px-1.5 py-1.5 shadow-xs backdrop-blur">
        {toolbar.map((item) => (
          <ToolbarButton
            active={item.active}
            key={item.id}
            label={item.label}
            onClick={() => item.run()}
          >
            {item.icon}
          </ToolbarButton>
        ))}
        <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
        <ToolbarButton
          active={editor?.isActive("heading", { level: 1 }) ?? false}
          label="Título 1"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("heading", { level: 2 }) ?? false}
          label="Título 2"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
        <ToolbarButton
          active={editor?.isActive("bulletList") ?? false}
          label="Lista com marcadores"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("orderedList") ?? false}
          label="Lista numerada"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("taskList") ?? false}
          label="Lista de tarefas"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <CheckSquareIcon />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("blockquote") ?? false}
          label="Citação"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("codeBlock") ?? false}
          label="Bloco de código"
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <SquareCodeIcon />
        </ToolbarButton>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
        <ToolbarButton
          label="Página"
          onClick={() => {
            if (editor === null) return;
            editor.chain().focus().insertContent("[[]]").run();
            editor.commands.setTextSelection(editor.state.selection.from - 2);
          }}
          showLabel
        >
          <Link2Icon />
        </ToolbarButton>
        <ToolbarButton
          label="Bloco"
          onClick={() => {
            if (editor === null) return;
            editor
              .chain()
              .focus()
              .insertContent({ type: "paragraph", content: [{ type: "text", text: "/" }] })
              .run();
          }}
          showLabel
        >
          <PlusIcon />
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty ? (
          <p className="pointer-events-none absolute inset-x-0 top-0 text-sm text-muted-foreground/60">
            Comece a escrever
          </p>
        ) : null}
        <EditorContent editor={editor} />
      </div>

      {slash === null || commandItems.length === 0 ? null : (
        <div
          className="fixed z-[120] w-64 rounded-lg border border-border bg-popover p-1 shadow-lg"
          style={{ top: slash.top, left: slash.left }}
        >
          <p className="px-2 py-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            Blocos
          </p>
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {commandItems.map((command, index) => (
              <button
                aria-selected={index === slashIndex}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-hidden",
                  index === slashIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted/60",
                )}
                key={command.id}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySlash(command);
                }}
                type="button"
              >
                <span
                  aria-hidden
                  className="flex size-4 items-center justify-center [&_svg]:size-3.5"
                >
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{command.label}</span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {command.hint}
                  </span>
                </span>
                <kbd className="text-2xs text-muted-foreground">↵</kbd>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
