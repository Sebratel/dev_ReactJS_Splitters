export type UsageModuleStat = {
  module: string
  events: number
  users: number
  avgDurationMs: number
}

export type UsageUserStat = {
  email: string
  name: string
  events: number
  modulesUsed: number
  lastSeen: string | null
}

export type UsageUserModuleStat = {
  email: string
  name: string
  module: string
  events: number
}

export type UsageHourStat = { hour: number; events: number }
export type UsageDayStat = { day: string; events: number; users: number }

export type UsageSummary = {
  range: { start: string; end: string }
  totals: { events: number; activeUsers: number; sessions: number }
  byModule: UsageModuleStat[]
  byUser: UsageUserStat[]
  byUserModule: UsageUserModuleStat[]
  byHour: UsageHourStat[]
  byDay: UsageDayStat[]
}
