import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { GroupPageEditor } from "./GroupPageEditor";

describe("GroupPageEditor", () => {
  it("writes Markdown while typing", async () => {
    const onChange = vi.fn();
    await using screen = await render(
      <GroupPageEditor onChange={onChange} onOpenPageLink={() => {}} value="" />,
    );

    await userEvent.click(screen.getByRole("textbox", { name: "Conteúdo da página" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Conteúdo da página" }), "Olá time");

    await expect
      .element(screen.getByRole("textbox", { name: "Conteúdo da página" }))
      .toHaveTextContent("Olá time");
    expect(onChange).toHaveBeenLastCalledWith("Olá time");
  });

  it("turns a slash command into a heading block", async () => {
    const onChange = vi.fn();
    await using screen = await render(
      <GroupPageEditor onChange={onChange} onOpenPageLink={() => {}} value="" />,
    );

    const editor = screen.getByRole("textbox", { name: "Conteúdo da página" });
    await userEvent.click(editor);
    await userEvent.type(editor, "/titulo");

    const command = page.getByRole("button", { name: /Título 1[\s\S]*Seção principal/ });
    await expect.element(command).toBeVisible();
    await userEvent.click(command);

    await userEvent.type(editor, "Bloco");
    expect(onChange).toHaveBeenLastCalledWith("# Bloco");
  });

  it("opens a wikilink through the page callback", async () => {
    const onOpenPageLink = vi.fn();
    await using screen = await render(
      <GroupPageEditor
        onChange={() => {}}
        onOpenPageLink={onOpenPageLink}
        value="Veja [[Pesquisa]]."
      />,
    );

    await userEvent.click(screen.getByText("[[Pesquisa]]"));
    expect(onOpenPageLink).toHaveBeenCalledWith("Pesquisa");
  });
});
