"use client";

import React, { useCallback, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

// "Are you sure?" before actions that are easy to hit by mistake (printing marks
// the label printed on J&T, cancelling an order…).
//   const [confirm, confirmDialog] = useConfirm();
//   if (await confirm({ title: "...", message: "..." })) doIt();
//   …render {confirmDialog} somewhere in the component.
// The action runs right after the click on "تأكيد", so opening a print tab from it
// still counts as a user click for popup blockers.
interface ConfirmOptions {
  title:         string;
  message?:      React.ReactNode;
  confirmLabel?: string;
  danger?:       boolean;
}

export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);   // a previous dialog still open counts as "no"
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  function close(ok: boolean) {
    const r = resolver.current;
    resolver.current = null;
    setOpts(null);
    r?.(ok);
  }

  const dialog = (
    <Modal open={opts !== null} onClose={() => close(false)} title={opts?.title ?? ""} size="sm"
      footer={opts && (
        <>
          <Button variant="secondary" onClick={() => close(false)}>رجوع</Button>
          <Button variant={opts.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {opts.confirmLabel ?? "تأكيد"}
          </Button>
        </>
      )}>
      {opts?.message && <div className="text-sm text-[var(--text-secondary)] leading-relaxed">{opts.message}</div>}
    </Modal>
  );

  return [confirm, dialog];
}
