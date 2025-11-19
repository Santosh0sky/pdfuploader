// Barrel export for Redux related exports
export { ReduxProvider } from './provider'
export { makeStore } from './store'
export { useAppDispatch, useAppSelector, useAppStore } from './hooks'
export type { AppStore, RootState, AppDispatch } from './store'

// Re-export API hooks and types
export {
  api,
  useGetPdfsQuery,
  useDeletePdfMutation,
  useUpdatePdfFolderMutation,
  useGetFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useGetAnnotationsQuery,
  useCreateAnnotationMutation,
  useDeleteAnnotationMutation,
} from './services/api'

export type {
  PDF,
  Folder,
  CreateFolderRequest,
  CreateFolderResponse,
  GetFoldersResponse,
  Annotation,
} from './types'
