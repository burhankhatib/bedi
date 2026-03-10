/** Report reason categories by reporter → reported. Used by API and UI. EN + AR. */

export const REPORT_CATEGORIES: Record<string, { value: string; labelEn: string; labelAr: string }[]> = {
  'business→driver': [
    { value: 'driver_late', labelEn: 'Driver was late', labelAr: 'السائق تأخر' },
    { value: 'driver_bad_conduct', labelEn: 'Driver not well behaved', labelAr: 'سلوك السائق غير لائق' },
    { value: 'driver_cancelled_no_reason', labelEn: 'Driver cancelled order without reason', labelAr: 'السائق ألغى الطلب بدون سبب' },
    { value: 'driver_no_show', labelEn: 'Driver did not show up', labelAr: 'السائق لم يحضر' },
    { value: 'driver_wrong_amount', labelEn: 'Driver disputed / wrong amount', labelAr: 'السائق اعترض على المبلغ أو مبلغ خاطئ' },
    { value: 'driver_rude_business', labelEn: 'Driver was rude to staff', labelAr: 'السائق كان وقحاً مع الطاقم' },
    { value: 'driver_other', labelEn: 'Other', labelAr: 'أخرى' },
  ],
  'business→customer': [
    { value: 'customer_not_nice', labelEn: 'Customer not cooperative', labelAr: 'العميل غير متعاون' },
    { value: 'customer_cancelled_after_prep', labelEn: 'Customer cancelled after order was prepared', labelAr: 'العميل ألغى بعد تحضير الطلب' },
    { value: 'customer_no_show', labelEn: 'Customer no-show / did not pick up', labelAr: 'العميل لم يحضر لاستلام الطلب' },
    { value: 'customer_fake_order', labelEn: 'Fake or prank order', labelAr: 'طلب وهمي أو مزعج' },
    { value: 'customer_abusive', labelEn: 'Customer was abusive or threatening', labelAr: 'العميل كان مسيئاً أو مهدداً' },
    { value: 'customer_payment_issue', labelEn: 'Payment or refund dispute', labelAr: 'نزاع دفع أو استرداد' },
    { value: 'customer_other', labelEn: 'Other', labelAr: 'أخرى' },
  ],
  'driver→customer': [
    { value: 'customer_late_receive', labelEn: 'Customer late to receive order', labelAr: 'العميل تأخر في استلام الطلب' },
    { value: 'customer_bad_conduct', labelEn: 'Customer bad behaviour', labelAr: 'سلوك العميل سيء' },
    { value: 'customer_not_at_location', labelEn: 'Customer not at location', labelAr: 'العميل غير موجود في الموقع' },
    { value: 'customer_wrong_address', labelEn: 'Wrong address or could not find', labelAr: 'عنوان خاطئ أو تعذّر الوصول' },
    { value: 'customer_refused_order', labelEn: 'Customer refused to take order', labelAr: 'العميل رفض استلام الطلب' },
    { value: 'customer_abusive_driver', labelEn: 'Customer was abusive or threatening', labelAr: 'العميل كان مسيئاً أو مهدداً' },
    { value: 'customer_no_answer', labelEn: 'Customer did not answer calls', labelAr: 'العميل لم يرد على المكالمات' },
    { value: 'customer_tip_not_paid', labelEn: 'Customer promised tip but did not pay', labelAr: 'العميل وعد بإكرامية لكن لم يدفعها' },
    { value: 'customer_other_driver', labelEn: 'Other', labelAr: 'أخرى' },
  ],
  'customer→business': [
    { value: 'restaurant_food_quality', labelEn: 'Food quality / cold or wrong', labelAr: 'جودة الطعام / بارد أو خاطئ' },
    { value: 'restaurant_bad_packaging', labelEn: 'Bad packaging', labelAr: 'تغليف سيء' },
    { value: 'restaurant_missing_items', labelEn: 'Missing items', labelAr: 'أصناف ناقصة' },
    { value: 'restaurant_late_prep', labelEn: 'Very late preparation', labelAr: 'تحضير متأخر جداً' },
    { value: 'restaurant_wrong_order', labelEn: 'Wrong order received', labelAr: 'تم استلام طلب خاطئ' },
    { value: 'restaurant_hygiene', labelEn: 'Hygiene or safety concern', labelAr: 'قلق نظافة أو سلامة' },
    { value: 'restaurant_rude_staff', labelEn: 'Rude or unprofessional staff', labelAr: 'طاقم وقح أو غير مهني' },
    { value: 'restaurant_other', labelEn: 'Other', labelAr: 'أخرى' },
  ],
  'customer→driver': [
    { value: 'driver_late_customer', labelEn: 'Driver was late', labelAr: 'السائق تأخر' },
    { value: 'driver_rude', labelEn: 'Driver rude / bad behaviour', labelAr: 'السائق وقح / سلوك سيء' },
    { value: 'driver_delivery_issue', labelEn: 'Driver did not deliver properly', labelAr: 'السائق لم يوصّل بشكل صحيح' },
    { value: 'driver_damaged_order', labelEn: 'Order damaged in delivery', labelAr: 'الطلب تلف أثناء التوصيل' },
    { value: 'driver_wrong_location', labelEn: 'Driver left order at wrong place', labelAr: 'السائق ترك الطلب في مكان خاطئ' },
    { value: 'driver_no_contact', labelEn: 'Driver did not call or contact', labelAr: 'السائق لم يتصل أو يتواصل' },
    { value: 'customer_removed_tip_after_arrival', labelEn: 'Removed tip after driver arrived on time', labelAr: 'أزال الإكرامية بعد وصول السائق في الوقت' },
    { value: 'driver_other_customer', labelEn: 'Other', labelAr: 'أخرى' },
  ],
}

export function getCategoriesKey(reporterType: string, reportedType: string): string {
  return `${reporterType}→${reportedType}`
}

export function getCategories(reporterType: string, reportedType: string) {
  return REPORT_CATEGORIES[getCategoriesKey(reporterType, reportedType)] ?? []
}

/** Get human-readable label for a category value (e.g. for admin list). */
export function getCategoryLabel(
  categoryValue: string,
  categoriesKey: string,
  lang: 'en' | 'ar' = 'en'
): string {
  const list = REPORT_CATEGORIES[categoriesKey]
  if (!list) return categoryValue
  const item = list.find((c) => c.value === categoryValue)
  if (!item) return categoryValue
  return lang === 'ar' ? item.labelAr : item.labelEn
}
