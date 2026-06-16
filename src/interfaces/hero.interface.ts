export interface CreateHeroSlideDto {
  image_url: string
  title?: string
  description?: string
  cta_label?: string
  cta_url?: string
  position?: number
  is_active?: boolean
}

export interface UpdateHeroSlideDto {
  image_url?: string
  title?: string
  description?: string
  cta_label?: string
  cta_url?: string
  position?: number
  is_active?: boolean
}

export interface HeroSlideResponse {
  id: number
  image_url: string
  title: string | null
  description: string | null
  cta_label: string | null
  cta_url: string | null
  position: number
  is_active: boolean
}
