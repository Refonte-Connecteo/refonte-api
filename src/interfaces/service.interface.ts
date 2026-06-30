export interface CreateServiceDto {
  title: string
  description?: string
  icon?: string
  position?: number
  is_active?: boolean
}

export interface UpdateServiceDto {
  title?: string
  description?: string
  icon?: string
  position?: number
  is_active?: boolean
}

export interface ServiceResponse {
  id: number
  title: string
  description: string | null
  icon: string | null
  file_url: string | null
  position: number
  is_active: boolean
  created_at: Date
  sectors?: import('@/generated/prisma/client').Sector[]
}
