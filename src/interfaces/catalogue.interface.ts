export interface CreateCatalogueDto {
  title: string
  file_url: string
  is_lead_magnet?: boolean
}

export interface UpdateCatalogueDto {
  title?: string
  file_url?: string
  is_lead_magnet?: boolean
}

export interface CatalogueResponse {
  id: number
  title: string
  file_url: string
  is_lead_magnet: boolean
  uploaded_at: Date
}
