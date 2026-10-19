// Native modal <dialog>s (wallet picker, tip dialog, report dialog) sit in the browser's top
// layer and make everything else inert. WalletConnect's modal (@reown/appkit) is an ordinary
// fixed element, so while one of ours is open it would sit under it and take no clicks. While the
// WalletConnect modal is up, the open dialogs step aside and then come back as they were.
// Their onClose handlers must ignore that close (dialogsSuspended()), or the tip in progress or the
// report being written would be thrown away.

let suspended: HTMLDialogElement[] | null = null;

export const dialogsSuspended = () => suspended !== null;

/** Closes every open modal dialog, remembering them in top-layer order. */
export function suspendDialogs() {
  if (suspended) return;
  suspended = [...document.querySelectorAll("dialog")].filter((d) => d.open && d.matches(":modal"));
  for (const dialog of suspended) dialog.close();
}

/**
 * Reopens the dialogs, in the same order, except `skip` (one whose owner closed it meanwhile).
 * The flag clears after the close events above have run (they're queued tasks), so a close never
 * reaches its onClose handler as a real close.
 */
export function resumeDialogs(skip: (HTMLDialogElement | null)[] = []) {
  const list = suspended ?? [];
  for (const dialog of list) {
    if (dialog.isConnected && !dialog.open && !skip.includes(dialog)) dialog.showModal();
  }
  setTimeout(() => (suspended = null), 0);
}
