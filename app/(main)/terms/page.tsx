'use client'

import { useLanguage } from '@/components/LanguageContext'
import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

export default function TermsPage() {
  const { t } = useLanguage()

  return (
    <LegalPageLayout
      titleEn="Terms and Conditions"
      titleAr="الشروط والأحكام"
    >
      <p className="text-sm text-slate-500">
        {t(
          'Last updated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          'آخر تحديث: ' + new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('1. Agreement to terms', '1. الموافقة على الشروط')}
      </h2>
      <p>
        {t(
          'By accessing or using Bedi Delivery (“we”, “us”, “our”), including our website, applications, and services that connect customers, businesses, and delivery drivers, you agree to be bound by these Terms and Conditions. If you do not agree, do not use our services.',
          'باستخدامك أو دخولك إلى Bedi Delivery («نحن»، «الخدمة»)، بما في ذلك الموقع والتطبيقات والخدمات التي تربط العملاء والأعمال وسائقي التوصيل، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق، لا تستخدم خدماتنا.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('2. Description of service', '2. وصف الخدمة')}
      </h2>
      <p>
        {t(
          'Bedi Delivery is a platform that enables (a) businesses to publish menus and receive orders (dine-in and delivery), (b) customers to browse businesses, place orders, and track deliveries, and (c) independent delivery drivers to accept and fulfil delivery orders. We do not prepare, sell, or deliver food or goods ourselves; we only provide the technology and coordination.',
          'Bedi Delivery منصة تمكّن (أ) الأعمال من نشر القوائم واستقبال الطلبات (للجلوس والتوصيل)، (ب) العملاء من تصفح الأعمال وتقديم الطلبات وتتبع التوصيل، (ج) سائقي التوصيل المستقلين من قبول وتنفيذ طلبات التوصيل. نحن لا نعدّ ولا نبيع ولا نوصّل الطعام أو البضائع بأنفسنا؛ نقدّم فقط التقنية والتنسيق.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('3. Accounts and eligibility', '3. الحسابات والأهلية')}
      </h2>
      <p>
        {t(
          'You must be at least 18 years old (or the age of majority in your jurisdiction) and provide accurate information when registering. You are responsible for keeping your account secure and for all activity under your account. Businesses and drivers must comply with applicable laws and our policies.',
          'يجب أن يكون عمرك 18 عاماً على الأقل (أو سن الرشد في منطقتك) وتقديم معلومات صحيحة عند التسجيل. أنت مسؤول عن تأمين حسابك وعن كل النشاط تحت حسابك. على الأعمال والسائقين الالتزام بالقوانين المعمول بها وسياساتنا.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('4. Orders, payments, and delivery', '4. الطلبات والمدفوعات والتوصيل')}
      </h2>
      <p>
        {t(
          'Orders are contracts between the customer and the business. Delivery fees and payment terms are shown at checkout. In many cases, the customer pays the business (and delivery fee) and the driver pays the business in cash for the order amount; specific payment flows may vary. You agree to pay all amounts due and to resolve any payment disputes with the relevant party (business or customer) in accordance with our Refund Policy and applicable law.',
          'الطلبات عقود بين العميل والمتجر. رسوم التوصيل وشروط الدفع تظهر عند الدفع. في كثير من الحالات يدفع العميل للمتجر (ورسوم التوصيل) ويدفع السائق للمتجر نقداً مقابل الطلب؛ تدفقات الدفع قد تختلف. أنت توافق على دفع كل المبالغ المستحقة وحل أي نزاعات دفع مع الطرف المعني (المتجر أو العميل) وفق سياسة الاسترداد والقانون المعمول به.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('5. Conduct and prohibited use', '5. السلوك والاستخدام المحظور')}
      </h2>
      <p>
        {t(
          'You may not use the service for any illegal purpose, to harm others, or to abuse the platform. Prohibited conduct includes fraud, harassment, impersonation, misuse of personal data, and violation of any applicable terms or laws. We may suspend or terminate accounts that violate these terms.',
          'لا يجوز استخدام الخدمة لأي غرض غير قانوني أو لإلحاق الضرر بالآخرين أو إساءة استخدام المنصة. يشمل السلوك المحظور الاحتيال والمضايقة وانتحال الشخصية وإساءة استخدام البيانات الشخصية ومخالفة أي شروط أو قوانين معمول بها. يجوز لنا تعليق أو إنهاء الحسابات التي تنتهك هذه الشروط.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('6. Intellectual property and licence', '6. الملكية الفكرية والترخيص')}
      </h2>
      <p>
        {t(
          'Bedi Delivery and its logos, design, and content are owned by us or our licensors. We grant you a limited, non-exclusive licence to use the service for its intended purpose. You may not copy, modify, or exploit our branding or technology without written permission.',
          'Bedi Delivery وشعاراتها وتصميمها ومحتواها مملوكة لنا أو لمرخصينا. نمنحك ترخيصاً محدوداً وغير حصري لاستخدام الخدمة للغرض المقصود. لا يجوز نسخ أو تعديل أو استغلال علامتنا أو تقنيتنا دون إذن كتابي.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('7. Disclaimers and limitation of liability', '7. إخلاء المسؤولية وتحديد المسؤولية')}
      </h2>
      <p>
        {t(
          'The service is provided “as is”. We do not guarantee uninterrupted or error-free operation. We are not liable for the quality, safety, or legality of goods or services provided by businesses or drivers, or for any indirect, incidental, or consequential damages arising from your use of the service, to the maximum extent permitted by law.',
          'الخدمة مقدمة «كما هي». نحن لا نضمن تشغيلاً دون انقطاع أو خالٍ من الأخطاء. نحن غير مسؤولين عن جودة أو سلامة أو قانونية السلع أو الخدمات المقدمة من المتاجر أو السائقين، أو عن أي أضرار غير مباشرة أو عرضية أو تبعية ناتجة عن استخدامك للخدمة، إلى أقصى حد يسمح به القانون.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('8. Changes and termination', '8. التغييرات والإنهاء')}
      </h2>
      <p>
        {t(
          'We may update these terms from time to time; continued use after changes constitutes acceptance. We may suspend or terminate your access to the service for breach of terms, fraud, or other reasons we deem necessary. You may close your account at any time subject to outstanding obligations.',
          'قد نحدّث هذه الشروط من وقت لآخر؛ الاستمرار في الاستخدام بعد التغييرات يُعد قبولاً. قد نعلق أو ننهي وصولك إلى الخدمة بسبب خرق الشروط أو الاحتيال أو أسباب أخرى نراها ضرورية. يمكنك إغلاق حسابك في أي وقت مع الالتزام بالالتزامات المستحقة.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('9. Governing law and contact', '9. القانون الحاكم والتواصل')}
      </h2>
      <p>
        {t(
          'These terms are governed by the laws of the jurisdiction in which Bedi Delivery operates. For questions about these terms, please contact us through the contact information provided on our website or in the app.',
          'هذه الشروط تخضع لقوانين السلطة القضائية التي تعمل فيها Bedi Delivery. للاستفسارات حول هذه الشروط، يرجى التواصل معنا عبر معلومات الاتصال المتوفرة على موقعنا أو في التطبيق.'
        )}
      </p>
    </LegalPageLayout>
  )
}
