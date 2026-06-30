export interface CreateReferenceDto {
  label: string
  image_url: string
  website_url?: string
  position?: number
  is_active?: boolean
}

export interface UpdateReferenceDto {
  label?: string
  image_url?: string
  website_url?: string
  position?: number
  is_active?: boolean
}

export interface ReferenceResponse {
  id: number
  label: string
  image_url: string
  website_url: string | null
  position: number
  is_active: boolean
}
