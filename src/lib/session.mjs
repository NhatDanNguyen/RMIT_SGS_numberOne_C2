// A pending operation may finish after logout, permission refresh or navigation.
// Its result can only enter React state while its original scope is current.
export function createSessionGuard() {
  let scope = '';
  let revision = 0;
  return {
    update(next) { if (scope !== next) { scope = next; revision++; } },
    invalidate() { revision++; },
    ticket() {
      const issued = revision;
      return () => Boolean(scope) && issued === revision;
    },
  };
}
