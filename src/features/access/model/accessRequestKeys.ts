export const accessRequestQueryKeys = {
  all: ['splitters-access-requests'] as const,
  pending: () => [...accessRequestQueryKeys.all, 'pending'] as const,
  mine: (uid: string) => [...accessRequestQueryKeys.all, 'mine', uid] as const,
}
