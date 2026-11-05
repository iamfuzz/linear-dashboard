// Client-side count of issue edits whose server action has not finished yet.
// AutoRefresh skips its tick while this is non-zero, so a background refresh never
// races an in-flight optimistic change (the action refreshes the page itself on success).
let pending = 0;

export function beginEdit(): void {
  pending++;
}

export function endEdit(): void {
  pending = Math.max(0, pending - 1);
}

export function hasPendingEdits(): boolean {
  return pending > 0;
}
