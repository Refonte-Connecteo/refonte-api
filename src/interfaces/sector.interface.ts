export interface CreateSectorDto {
  title: string
  description?: string
  icon?: string
  position?: number
  is_active?: boolean
}

export interface UpdateSectorDto {
  title?: string
  description?: string
  icon?: string
  position?: number
  is_active?: boolean
}

export interface SectorResponse {
  id: number
  title: string
  description: string | null
  icon: string | null
  service_id: number
  position: number
  is_active: boolean
}
