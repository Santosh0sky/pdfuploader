// Shared TypeScript types for the application

export interface PDF {
  id: string
  filename: string
  file_path: string
  created_at: string
  folder_id?: string | null
  user_id?: string
}

export interface Folder {
  id: string
  name: string
  parent_folder_id?: string | null
  created_at?: string
  user_id?: string
}

export interface CreateFolderRequest {
  name: string
  parent_folder_id?: string | null
}

export interface CreateFolderResponse {
  folder: Folder
}

export interface GetFoldersResponse {
  folders: Folder[]
}

export interface Annotation {
  id: string
  pdf_id: string
  page_number: number
  content: string
  created_at: string
  user_id?: string
}
