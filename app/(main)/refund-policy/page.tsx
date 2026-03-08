'use client'

import { useLanguage } from '@/components/LanguageContext'
import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

export default function RefundPolicyPage() {
  const { t } = useLanguage()

  return (
    <LegalPageLayout
      titleEn="Refund Policy"
      titleAr="سياسة الاسترداد"
    >
      <p className="text-sm text-slate-500">
        {t(
          'Last updated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          'Last Updated: ' + new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('1. No refunds by Bedi Delivery', '1. عدم استرداد مبالغ من Bedi Delivery')}
      </h2>
      <p>
        {t(
          'Bedi Delivery is a technology platform that connects customers, businesses, and delivery drivers. We do not process payments for orders between customers and businesses, or between drivers and businesses. Therefore Bedi Delivery does not issue refunds. All payments for orders and delivery are made directly between the parties (e.g. customer to business, driver to business in cash).',
          'Bedi Delivery منصة تقنية تربط العملاء والأعمال وسائقي التوصيل. نحن لا نعالج مدفوعات الطلبات بين العملاء والمتاجر، أو بين السائقين والمتاجر. لذلك لا تصدر Bedi Delivery أي استردادات. جميع مدفوعات الطلبات والتوصيل تتم مباشرة بين الأطراف (مثل العميل للمتجر، السائق للمتجر نقداً).'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('2. Cash payments by drivers to businesses', '2. الدفع النقدي من السائقين للمتاجر')}
      </h2>
      <p>
        {t(
          'In our delivery flow, the driver typically pays the business in cash for the order amount (and may collect the total from the customer). Bedi Delivery does not hold or transfer these funds. Any dispute about the order amount, missing items, or wrong delivery is between the customer, the business, and/or the driver. We are not responsible for refunding or compensating any party for such disputes.',
          'في تدفق التوصيل لدينا، يدفع السائق عادةً للمتجر نقداً مقابل مبلغ الطلب (وقد يجمع المجموع من العميل). Bedi Delivery لا تحتفظ بهذه الأموال ولا تنقلها. أي نزاع حول مبلغ الطلب أو المنتجات الناقصة أو التوصيل الخاطئ يكون بين العميل والمتجر و/أو السائق. نحن لسنا مسؤولين عن استرداد أو تعويض أي طرف في مثل هذه النزاعات.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('3. Cancelled or unfulfilled orders', '3. الطلبات الملغاة أو غير المنفذة')}
      </h2>
      <p>
        {t(
          'If an order is cancelled before fulfilment (by the customer, business, or driver), or if it cannot be completed, the resolution of any payment or refund is solely between the customer and the business (and, where relevant, the driver). Bedi Delivery does not mediate payment refunds or chargebacks. We may update order status in our system (e.g. to “cancelled” or “refunded”) for record-keeping, but we do not process or guarantee any refund.',
          'إذا تم إلغاء طلب قبل التنفيذ (من العميل أو المتجر أو السائق)، أو إذا لم يمكن إكماله، فإن حل أي دفع أو استرداد يكون فقط بين العميل والمتجر (وحيث ينطبق، السائق). Bedi Delivery لا تتوسط في استردادات الدفع أو Chargebacks. قد نحدّث حالة الطلب في نظامنا (مثلاً إلى «ملغى» أو «مسترد») للسجلات، لكننا لا نعالج ولا نضمن أي استرداد.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('4. Your responsibility', '4. مسؤوليتك')}
      </h2>
      <p>
        {t(
          'By using our platform, you acknowledge that Bedi Delivery does not provide refunds. For any refund, compensation, or dispute regarding an order or delivery, you must deal directly with the business and/or the driver. We encourage customers and businesses to agree on refund or replacement policies between themselves and to document any agreements.',
          'باستخدامك منصتنا، فإنك تقر بأن Bedi Delivery لا تقدم استردادات. لأي استرداد أو تعويض أو نزاع بخصوص طلب أو توصيل، يجب عليك التعامل مباشرة مع المتجر و/أو السائق. نشجع العملاء والمتاجر على الاتفاق على سياسات الاسترداد أو الاستبدال بينهم وتوثيق أي اتفاقيات.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('5. Questions', '5. الاستفسارات')}
      </h2>
      <p>
        {t(
          'If you have questions about this Refund Policy, contact us through the contact information on our website or in the app. For order-specific payment or refund issues, please contact the business or driver involved in the order.',
          'إذا كانت لديك أسئلة حول سياسة الاسترداد هذه، تواصل معنا عبر معلومات الاتصال على موقعنا أو في التطبيق. بالنسبة لمشكلات الدفع أو الاسترداد المتعلقة بطلب معين، يرجى التواصل مع المتجر أو السائق المعني بالطلب.'
        )}
      </p>
    </LegalPageLayout>
  )
}
