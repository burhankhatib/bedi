import type { DefaultDocumentNodeResolver, StructureResolver } from 'sanity/structure'
import { OrderHistoryByPhone } from './components/OrderHistoryByPhone'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) => {
  const defaultListItems = S.documentTypeListItems()
  const customerItem = defaultListItems.find((item) => item.getId() === 'customer')
  const heroBannerItem = defaultListItems.find((item) => item.getId() === 'heroBanner')
  const businessCategoryItem = defaultListItems.find((item) => item.getId() === 'businessCategory')
  const businessSubcategoryItem = defaultListItems.find((item) => item.getId() === 'businessSubcategory')
  const rest = defaultListItems.filter(
    (item) => !['customer', 'heroBanner', 'bannerSettings', 'businessCategory', 'businessSubcategory'].includes(item.getId() ?? '')
  )

  const bannerSettingsItem = S.listItem()
    .title('Banner Settings')
    .id('bannerSettings')
    .child(S.document().schemaType('bannerSettings').documentId('bannerSettings'))

  const homepageItems = [heroBannerItem, bannerSettingsItem, businessCategoryItem, businessSubcategoryItem].filter(
    (x): x is NonNullable<typeof x> => x != null
  )

  const items = [
    ...homepageItems,
    ...(homepageItems.length ? [S.divider()] : []),
    ...(customerItem ? [customerItem] : []),
    S.divider(),
    ...rest,
  ]

  return S.list()
    .title('Content')
    .items(items)
}

/** Add "Order history (by phone)" view to Customer documents — UI only, no reference stored. */
export const getDefaultDocumentNode: DefaultDocumentNodeResolver = (S, { schemaType }) => {
  if (schemaType === 'customer') {
    return S.document().views([
      S.view.form(),
      S.view.component(OrderHistoryByPhone).title('Order history (by phone)'),
    ])
  }
  return S.document().views([S.view.form()])
}
