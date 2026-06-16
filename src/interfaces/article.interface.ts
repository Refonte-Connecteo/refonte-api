export interface CreateArticleDto {
  title: string
  description?: string
  type?: string
  cover_url?: string
  file_url?: string
  is_lead_magnet?: boolean
  is_published?: boolean
}

export interface UpdateArticleDto {
  title?: string
  description?: string
  type?: string
  cover_url?: string
  file_url?: string
  is_lead_magnet?: boolean
  is_published?: boolean
}

export interface ArticleResponse {
  id: number
  title: string
  description: string | null
  type: string
  cover_url: string | null
  file_url: string | null
  is_lead_magnet: boolean
  is_published: boolean
  published_at: Date
}
