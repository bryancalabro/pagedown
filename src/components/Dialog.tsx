// Dialog: the house modal primitive for React + Tailwind 4 + Vite apps. /new-app step 3 copies it
// to src/components/Dialog.tsx whenever the Build Prompt implies a modal, sheet, or overlay; never
// hand-roll one (meeple shipped aria-modal while Tab walked out, snip and stocks-ladder lost focus on
// unmount, yamlet lost it on Escape then Tab). Its e2e twin is templates/e2e/dialog.spec.ts.
//
// Render it only while it is open, so mounting opens it and unmounting closes it:
//
//   const [open, setOpen] = useState(false);
//   <button type="button" onClick={() => setOpen(true)}>Settings</button>
//   {open && (
//     <Dialog title="Settings" onClose={() => setOpen(false)}>
//       ...
//     </Dialog>
//   )}
//
// What it guarantees:
// - a native <dialog> opened with showModal(), so the page behind it is inert and it sits in the top layer
// - Tab and Shift+Tab wrap inside it, whatever the browser does at the edges of the top layer
// - Escape and the close button call onClose; the parent owns the open state, never the browser
// - focus returns to the opener (or returnFocusRef) in the effect cleanup, after the node is gone,
//   so the restore cannot be lost to the unmount itself
// - it is labeled by its title (and described by description when given)
// - colors, radius, and faces come only from the house tokens; motion runs only under
//   prefers-reduced-motion: no-preference
// Put data-autofocus on the control that should take focus first; otherwise the first focusable does.
import { useEffect, useEffectEvent, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';

type DialogProps = {
  /** the visible heading; it is also the dialog's accessible name */
  title: ReactNode;
  /** called on Escape, the close button, and a click on the backdrop; set the open state false here */
  onClose: () => void;
  children: ReactNode;
  /** one line under the title, read out as the dialog's description */
  description?: ReactNode;
  /** where focus goes on close when the opener itself is gone (a menu item that unmounted, say) */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** false keeps a backdrop click from closing it (a form with unsaved input) */
  closeOnBackdrop?: boolean;
};

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** the dialog's tabbable elements in document order, skipping anything hidden or inert */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

export default function Dialog({ title, onClose, children, description, returnFocusRef, closeOnBackdrop = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const requestClose = useEffectEvent(() => onClose());
  // read at close time, not at open time: the fallback target may mount while the dialog is up
  const fallbackTarget = useEffectEvent(() => returnFocusRef?.current ?? null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // <body> is what has focus when a global shortcut opens the dialog; it is not an opener, so
    // returnFocusRef (the control the shortcut stands for) is used instead of focusing nothing
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;

    // jsdom (Vitest) has no showModal; the open attribute is enough there
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? tabbables(dialog)[0] ?? dialog).focus();

    // Escape fires cancel: keep the browser from closing it behind React's back and let the parent decide
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    // Chromium skips cancel on a repeated Escape with no user activation between; it closes instead
    const onNativeClose = () => requestClose();
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);

    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      if (dialog.open) dialog.close();
      // runs after React removed the node, so nothing can steal focus back from here
      const target = opener?.isConnected ? opener : fallbackTarget();
      if (target?.isConnected) target.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const items = tabbables(dialog);
    if (!items.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof Node && dialog.contains(active);
    if (event.shiftKey && (!inside || active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  };

  // the dialog box has no padding of its own, so a pointer whose target is the dialog is on the backdrop;
  // it must go down there too, or a text selection dragged out of a field would close the dialog
  const onMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (closeOnBackdrop && pressedBackdrop.current && event.target === event.currentTarget) onClose();
    pressedBackdrop.current = false;
  };

  return (
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-(--radius) border border-(--muted)/30 bg-(--surface) p-0 text-(--ink) shadow-xl outline-none backdrop:bg-(--bg)/80 motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:ease-out motion-safe:starting:scale-95 motion-safe:starting:opacity-0"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-(family-name:--font-display-stack) text-2xl font-normal break-words">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-(--muted)">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius) text-(--muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
