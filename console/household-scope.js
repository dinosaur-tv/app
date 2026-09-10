/** Ответы старого дома не должны перерисовывать новый, даже при A → B → A. */
export function createHouseholdScope() {
  let id = "", revision = 0;
  return {
    get id() { return id; },
    select(next) { id = next || ""; revision++; },
    capture() {
      const current = revision;
      return { id, assertCurrent() { if (revision !== current) throw new Error("Дом переключён. Повторите действие в выбранном доме."); } };
    },
  };
}
