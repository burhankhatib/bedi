'use client'

/**
 * This configuration is used to for the Sanity Studio that’s mounted on the `/app/studio/[[...tool]]/page.tsx` route
 */

import {visionTool} from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

import { apiVersion, dataset, projectId } from './sanity/env'
import { schema } from './sanity/schemaTypes'

export default defineConfig({
  basePath: '/studio',
  projectId: projectId || 'missing-project-id',
  dataset: dataset || 'production',
  apiVersion,
  schema,
  plugins: [
    // Minimal stable setup. To restore custom structure (Banner Settings, Order history tab):
    // import { structure, getDefaultDocumentNode } from './sanity/structure'
    // then structureTool({ structure, defaultDocumentNode: getDefaultDocumentNode })
    structureTool(),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
})
