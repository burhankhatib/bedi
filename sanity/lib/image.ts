import createImageUrlBuilder from '@sanity/image-url'
import { SanityImageSource } from "@sanity/image-url/lib/types/types";

import { dataset, projectId } from '../env'

// https://www.sanity.io/docs/image-url
const builder = createImageUrlBuilder({ projectId, dataset })

/** Image URL builder with auto format (WebP/AVIF) and quality 80 for optimal delivery. */
export const urlFor = (source: SanityImageSource) => {
  return builder.image(source).auto('format').quality(80)
}
