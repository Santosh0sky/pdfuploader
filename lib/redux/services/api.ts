import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  PDF,
  Folder,
  CreateFolderRequest,
  CreateFolderResponse,
  GetFoldersResponse,
  Annotation
} from '../types'

// Define the API slice
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include', // Include cookies for authentication
  }),
  tagTypes: ['PDF', 'Folder', 'Annotation'],
  endpoints: (builder) => ({
    // PDF endpoints
    getPdfs: builder.query<PDF[], void>({
      query: () => '/pdfs',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'PDF' as const, id })),
              { type: 'PDF', id: 'LIST' },
            ]
          : [{ type: 'PDF', id: 'LIST' }],
    }),

    deletePdf: builder.mutation<void, string>({
      query: (id) => ({
        url: `/pdfs/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'PDF', id },
        { type: 'PDF', id: 'LIST' },
      ],
    }),

    updatePdfFolder: builder.mutation<PDF, { id: string; folder_id: string | null }>({
      query: ({ id, folder_id }) => ({
        url: `/pdfs/${id}`,
        method: 'PATCH',
        body: { folder_id },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'PDF', id },
        { type: 'PDF', id: 'LIST' },
      ],
    }),

    // Folder endpoints
    getFolders: builder.query<Folder[], void>({
      query: () => '/folders',
      transformResponse: (response: GetFoldersResponse) => response.folders,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Folder' as const, id })),
              { type: 'Folder', id: 'LIST' },
            ]
          : [{ type: 'Folder', id: 'LIST' }],
    }),

    createFolder: builder.mutation<Folder, CreateFolderRequest>({
      query: (body) => ({
        url: '/folders',
        method: 'POST',
        body,
      }),
      transformResponse: (response: CreateFolderResponse) => response.folder,
      invalidatesTags: [{ type: 'Folder', id: 'LIST' }],
    }),

    updateFolder: builder.mutation<Folder, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/folders/${id}`,
        method: 'PATCH',
        body: { name },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Folder', id },
        { type: 'Folder', id: 'LIST' },
      ],
    }),

    deleteFolder: builder.mutation<void, string>({
      query: (id) => ({
        url: `/folders/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Folder', id },
        { type: 'Folder', id: 'LIST' },
        { type: 'PDF', id: 'LIST' }, // Invalidate PDFs as they might be affected
      ],
    }),

    // Annotation endpoints
    getAnnotations: builder.query<Annotation[], string>({
      query: (pdfId) => `/annotations?pdf_id=${pdfId}`,
      providesTags: (result, error, pdfId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Annotation' as const, id })),
              { type: 'Annotation', id: `PDF-${pdfId}` },
            ]
          : [{ type: 'Annotation', id: `PDF-${pdfId}` }],
    }),

    createAnnotation: builder.mutation<
      Annotation,
      { pdf_id: string; page_number: number; content: string }
    >({
      query: (body) => ({
        url: '/annotations',
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { pdf_id }) => [
        { type: 'Annotation', id: `PDF-${pdf_id}` },
      ],
    }),

    deleteAnnotation: builder.mutation<void, { id: string; pdf_id: string }>({
      query: ({ id }) => ({
        url: `/annotations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id, pdf_id }) => [
        { type: 'Annotation', id },
        { type: 'Annotation', id: `PDF-${pdf_id}` },
      ],
    }),
  }),
})

// Export hooks for usage in functional components
export const {
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
} = api
