import { useNavigate } from "@tanstack/react-router";
import { ChartNoAxesColumnIcon, Code2Icon, MenuIcon, SettingsIcon, UsersIcon } from "lucide-react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";

export function MainMenu() {
  const navigate = useNavigate();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button aria-label="Menu principal" size="icon-sm" variant="ghost">
            <MenuIcon />
          </Button>
        }
      />
      <MenuPopup align="start" className="w-52" side="bottom">
        <MenuGroup>
          <MenuGroupLabel>Navegar</MenuGroupLabel>
          <MenuItem onClick={() => void navigate({ to: "/" })}>
            <Code2Icon />
            Coding
          </MenuItem>
          <MenuItem onClick={() => void navigate({ to: "/groups" })}>
            <UsersIcon />
            Grupos
          </MenuItem>
          <MenuItem onClick={() => void navigate({ to: "/usage" })}>
            <ChartNoAxesColumnIcon />
            Uso
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={() => void navigate({ to: "/settings" })}>
          <SettingsIcon />
          Configurações
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
