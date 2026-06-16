export interface CreateEventDto {
  title: string
  description?: string
  event_date?: string
  youtube_url?: string
  is_published?: boolean
}

export interface UpdateEventDto {
  title?: string
  description?: string
  event_date?: string
  youtube_url?: string
  is_published?: boolean
}

export interface EventResponse {
  id: number
  title: string
  description: string | null
  event_date: Date | null
  youtube_url: string | null
  is_published: boolean
}
