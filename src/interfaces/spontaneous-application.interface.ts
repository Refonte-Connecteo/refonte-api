export interface CreateSpontaneousApplicationDto {
  first_name: string
  last_name: string
  email: string
  phone?: string
  cv_url: string
  motivation?: string
}

export interface UpdateSpontaneousApplicationDto {
  status?: string
}

export interface SpontaneousApplicationResponse {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  cv_url: string
  motivation: string | null
  status: string
  submitted_at: Date
}
