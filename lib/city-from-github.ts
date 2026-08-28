export type ContributionDay = {
  date: string
  count: number
}

export type CityRepo = {
  name: string
  nameWithOwner: string
  description: string | null
  url: string
  stargazerCount: number
  forkCount: number
  primaryLanguage: string | null
  commitCount: number
}

export type CityPayload = {
  login: string
  displayName: string
  bio: string | null
  avatarUrl: string
  profileUrl: string
  followerCount: number | null
  isOrg: boolean
  totalContributions: number
  days: ContributionDay[]
  repos: CityRepo[]
}
