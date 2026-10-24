// Pure helpers for the WhatsApp worker rotation (kept separate so they can be
// unit-tested). Worker ids are NOT assumed to be consecutive.

export function cleanPhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

// Active workers that actually have a usable phone number, ordered by id.
export function eligibleWorkers(workers) {
  return (workers || [])
    .filter((w) => w && w.active === true && cleanPhone(w.phone).length >= 8)
    .sort((a, b) => Number(a.id) - Number(b.id));
}

// Returns { current, next } from an id-sorted, non-empty eligible list.
//  - current: the worker whose turn it is. If rotation.current_worker points
//    at someone inactive/deleted, we continue with the next eligible id after
//    it (wrapping to the first), instead of always restarting at the first.
//  - next: the eligible worker after `current` (wraps around).
export function pickTurn(eligible, currentWorkerId) {
  if (!eligible.length) return null;

  const currentId = Number(currentWorkerId);
  let current = Number.isFinite(currentId)
    ? eligible.find((w) => Number(w.id) === currentId)
    : undefined;

  if (!current && Number.isFinite(currentId)) {
    current = eligible.find((w) => Number(w.id) > currentId);
  }
  if (!current) current = eligible[0];

  const next = eligible.find((w) => Number(w.id) > Number(current.id)) || eligible[0];

  return { current, next };
}
