export interface CreateCeoMessageDto {
  title: string
  description: string
  image_url?: string
}

export interface UpdateCeoMessageDto {
  title?: string
  description?: string
  image_url?: string
}

export interface CeoMessageResponse {
  id: number
  title: string
  description: string
  image_url: string | null
  updated_at: Date
}
