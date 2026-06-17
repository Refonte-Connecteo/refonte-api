export interface CreateApplicationDto {
  job_id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  cv_url: string
  cover_letter?: string
}

export interface UpdateApplicationDto {
  status?: string
}

export interface ApplicationResponse {
  id: number
  job_id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  cv_url: string
  cover_letter: string | null
  status: string
  submitted_at: Date
}
