export interface CreateKpiStatDto {
  label: string
  value: string
  unit?: string
  position?: number
  is_active?: boolean
}

export interface UpdateKpiStatDto {
  label?: string
  value?: string
  unit?: string
  position?: number
  is_active?: boolean
}

export interface KpiStatResponse {
  id: number
  label: string
  value: string
  unit: string | null
  position: number
  is_active: boolean
}
