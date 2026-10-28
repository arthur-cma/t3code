import { useState } from "react";

import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { WizardFooter, WizardPopup } from "../ui/wizard";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground">{children}</span>;
}

function TextDialogBody({
  title,
  description,
  label,
  initialValue,
  placeholder,
  confirmLabel,
  multiline,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  label: string;
  initialValue: string;
  placeholder: string;
  confirmLabel: string;
  multiline: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const submit = () => {
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };

  return (
    <WizardPopup>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5 px-6 py-5">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{label}</FieldLabel>
          {multiline ? (
            <Textarea
              aria-label={label}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              size="sm"
              value={value}
            />
          ) : (
            <Input
              aria-label={label}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={placeholder}
              value={value}
            />
          )}
        </label>
      </div>
      <WizardFooter>
        <Button onClick={onCancel} variant="outline">
          Cancelar
        </Button>
        <Button disabled={trimmed.length === 0} onClick={submit}>
          {confirmLabel}
        </Button>
      </WizardFooter>
    </WizardPopup>
  );
}

export function GroupTextDialog({
  open,
  title,
  description,
  label,
  initialValue = "",
  placeholder,
  confirmLabel,
  multiline = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  initialValue?: string;
  placeholder: string;
  confirmLabel: string;
  multiline?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {open ? (
        <TextDialogBody
          confirmLabel={confirmLabel}
          description={description}
          initialValue={initialValue}
          key={`${title}-${initialValue}`}
          label={label}
          multiline={multiline}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          placeholder={placeholder}
          title={title}
        />
      ) : null}
    </Dialog>
  );
}

export function GroupConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <WizardPopup>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <WizardFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancelar
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            {confirmLabel}
          </Button>
        </WizardFooter>
      </WizardPopup>
    </Dialog>
  );
}
