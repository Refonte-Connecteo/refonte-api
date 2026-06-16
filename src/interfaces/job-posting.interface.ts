export interface CreateJobPostingDto {
  title: string
  contract_type: string
  description?: string
  external_url?: string
  fiche_url?: string
  is_active?: boolean
}

export interface UpdateJobPostingDto {
  title?: string
  contract_type?: string
  description?: string
  external_url?: string
  fiche_url?: string
  is_active?: boolean
}

export interface JobPostingResponse {
  id: number
  title: string
  contract_type: string
  description: string | null
  external_url: string | null
  fiche_url: string | null
  is_active: boolean
  created_at: Date
}
