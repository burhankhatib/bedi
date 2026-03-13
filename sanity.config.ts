'use client'

/**
 * This configuration is used to for the Sanity Studio that’s mounted on the `/app/studio/[[...tool]]/page.tsx` route
 */

import {visionTool} from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

import { apiVersion, dataset, projectId } from './sanity/env'
import { schema } from './sanity/schemaTypes'
import { structure, getDefaultDocumentNode } from './sanity/structure'

export default defineConfig({
  basePath: '/studio',
  projectId: projectId || 'missing-project-id',
  dataset: dataset || 'production',
  apiVersion,
  schema,
  plugins: [
    structureTool({ structure, defaultDocumentNode: getDefaultDocumentNode }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
})
