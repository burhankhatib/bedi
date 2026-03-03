'use client'

import { useLanguage } from '@/components/LanguageContext'
import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

export default function PrivacyPage() {
  const { t } = useLanguage()

  return (
    <LegalPageLayout
      titleEn="Privacy Policy"
      titleAr="سياسة الخصوصية"
    >
      <p className="text-sm text-slate-500">
        {t(
          'Last updated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          'آخر تحديث: ' + new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('1. Introduction', '1. المقدمة')}
      </h2>
      <p>
        {t(
          'This Privacy Policy describes how Bedi Delivery collects, uses, stores, and protects information when you use our website, applications, and services—whether you are a customer, a business, or a delivery driver.',
          'تصف سياسة الخصوصية هذه كيف تجمع Bedi Delivery وتستخدم وتخزن وتحمي المعلومات عند استخدامك لموقعنا وتطبيقاتنا وخدماتنا—سواء كنت عميلاً أو صاحب عمل أو سائق توصيل.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('2. Information we collect', '2. المعلومات التي نجمعها')}
      </h2>
      <p>
        {t(
          'We may collect: (a) account and profile information (name, email, phone, address, profile photo) that you provide when signing up or updating your profile; (b) order and transaction data (items ordered, amounts, delivery addresses, status); (c) device and usage data (IP address, browser type, app version, how you use the service); (d) location data when you enable it (e.g. to show nearby businesses or for delivery); and (e) communications you send to us or that occur through our platform.',
          'قد نجمع: (أ) معلومات الحساب والملف الشخصي (الاسم، البريد الإلكتروني، الهاتف، العنوان، صورة الملف) التي تقدمها عند التسجيل أو تحديث الملف؛ (ب) بيانات الطلبات والمعاملات (المنتجات المطلوبة، المبالغ، عناوين التوصيل، الحالة)؛ (ج) بيانات الجهاز والاستخدام (عنوان IP، نوع المتصفح، إصدار التطبيق، طريقة استخدامك للخدمة)؛ (د) بيانات الموقع عند تفعيلك لها (مثلاً لعرض الأعمال القريبة أو للتوصيل)؛ (هـ) المراسلات التي ترسلها إلينا أو التي تتم عبر منصتنا.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('3. How we use your information', '3. كيف نستخدم معلوماتك')}
      </h2>
      <p>
        {t(
          'We use the information to: provide and improve our services; process orders and coordinate deliveries; communicate with you (e.g. order updates, notifications); personalise your experience (e.g. language, nearby businesses); enforce our terms and prevent fraud; comply with legal obligations; and send you relevant offers or updates if you have agreed. We do not sell your personal information to third parties for their marketing.',
          'نستخدم المعلومات من أجل: تقديم وتحسين خدماتنا؛ معالجة الطلبات وتنسيق التوصيل؛ التواصل معك (مثل تحديثات الطلبات والإشعارات)؛ تخصيص تجربتك (مثل اللغة والأعمال القريبة)؛ تطبيق شروطنا ومنع الاحتيال؛ الامتثال للالتزامات القانونية؛ وإرسال عروض أو تحديثات ذات صلة إذا وافقت. نحن لا نبيع معلوماتك الشخصية لأطراف ثالثة لأغراض تسويقهم.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('4. Sharing and disclosure', '4. المشاركة والإفصاح')}
      </h2>
      <p>
        {t(
          'We may share information with: (a) businesses and drivers when necessary to fulfil orders (e.g. delivery address with driver, order details with business); (b) service providers that help us operate (hosting, analytics, notifications), under strict confidentiality; (c) authorities when required by law or to protect rights and safety; (d) other users only as needed for the service (e.g. your name or phone to the driver or business for the order).',
          'قد نشارك المعلومات مع: (أ) المتاجر والسائقين عند الحاجة لتنفيذ الطلبات (مثل عنوان التوصيل مع السائق، تفاصيل الطلب مع المتجر)؛ (ب) مقدمي خدمات يساعدوننا في التشغيل (استضافة، تحليلات، إشعارات)، بسرية تامة؛ (ج) السلطات عند طلب القانون أو لحماية الحقوق والسلامة؛ (د) مستخدمين آخرين فقط حسب الحاجة للخدمة (مثل اسمك أو هاتفك للسائق أو المتجر للطلب).'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('5. Cookies and similar technologies', '5. ملفات تعريف الارتباط والتقنيات المشابهة')}
      </h2>
      <p>
        {t(
          'We use cookies, local storage, and similar technologies to keep you signed in, remember your preferences (e.g. language, city), and understand how the service is used. You can control cookies through your browser settings; disabling some may affect how the service works.',
          'نستخدم ملفات تعريف الارتباط والتخزين المحلي وتقنيات مشابهة لإبقائك مسجلاً الدخول وتذكر تفضيلاتك (مثل اللغة والمدينة) وفهم طريقة استخدام الخدمة. يمكنك التحكم في ملفات تعريف الارتباط عبر إعدادات المتصفح؛ تعطيل بعضها قد يؤثر على عمل الخدمة.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('6. Data retention and security', '6. الاحتفاظ بالبيانات والأمان')}
      </h2>
      <p>
        {t(
          'We retain your information for as long as your account is active or as needed to provide the service, resolve disputes, and comply with law. We implement technical and organisational measures to protect your data against unauthorised access, loss, or misuse; however, no system is completely secure, and you use the service at your own risk.',
          'نحتفظ بمعلوماتك طالما أن حسابك نشط أو حسب الحاجة لتقديم الخدمة وحل النزاعات والامتثال للقانون. نطبق إجراءات تقنية وتنظيمية لحماية بياناتك من الوصول غير المصرح به أو الفقدان أو إساءة الاستخدام؛ مع ذلك، لا يوجد نظام آمن بالكامل، وأنت تستخدم الخدمة على مسؤوليتك.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('7. Your rights', '7. حقوقك')}
      </h2>
      <p>
        {t(
          'Depending on your location, you may have the right to access, correct, delete, or restrict processing of your personal data, or to object to certain processing. You can update much of your information in your account settings. To exercise your rights or ask questions about our use of your data, contact us using the details on our website or in the app.',
          'حسب منطقتك، قد يكون لديك الحق في الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها أو تقييد معالجتها، أو الاعتراض على معالجة معينة. يمكنك تحديث كثير من معلوماتك في إعدادات حسابك. لممارسة حقوقك أو طرح أسئلة حول استخدامنا لبياناتك، تواصل معنا باستخدام التفاصيل على موقعنا أو في التطبيق.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('8. Children', '8. الأطفال')}
      </h2>
      <p>
        {t(
          'Our service is not directed at children under 16. We do not knowingly collect personal data from children. If you believe we have collected such data, please contact us so we can delete it.',
          'خدمتنا غير موجهة للأطفال دون 16 عاماً. نحن لا نجمع عن قصد بيانات شخصية من الأطفال. إذا كنت تعتقد أننا جمعنا مثل هذه البيانات، يرجى التواصل معنا حتى نتمكن من حذفها.'
        )}
      </p>

      <h2 className="mt-8 text-lg font-semibold text-white">
        {t('9. Changes and contact', '9. التغييرات والتواصل')}
      </h2>
      <p>
        {t(
          'We may update this Privacy Policy from time to time; we will indicate the “Last updated” date. Continued use after changes means you accept the updated policy. For privacy-related questions or requests, contact us through the contact information on our website or in the app.',
          'قد نحدّث سياسة الخصوصية هذه من وقت لآخر؛ سنوضح تاريخ «آخر تحديث». الاستمرار في الاستخدام بعد التغييرات يعني قبولك السياسة المحدثة. للأسئلة أو الطلبات المتعلقة بالخصوصية، تواصل معنا عبر معلومات الاتصال على موقعنا أو في التطبيق.'
        )}
      </p>

      <h2 id="business-details" className="mt-10 text-lg font-semibold text-white">
        {t('10. Business profile details', '10. بيانات الملف التجاري')}
      </h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="font-medium text-slate-400">{t('Registered business name', 'الاسم التجاري المسجل')}</dt>
          <dd className="mt-0.5 text-slate-200">Bedi Delivery</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Address', 'العنوان')}</dt>
          <dd className="mt-0.5 text-slate-200">University Street, Bethany, 9144002, Palestine.</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Legal business structure', 'الهيكل القانوني للأعمال')}</dt>
          <dd className="mt-0.5 text-slate-200">{t('Sole proprietorship', 'ملكية فردية')}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Owner / principal', 'المالك / المسؤول')}</dt>
          <dd className="mt-0.5 text-slate-200">Mr. Burhan Khatib</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Business ID number', 'رقم هوية الأعمال')}</dt>
          <dd className="mt-0.5 font-mono text-slate-200">*****1655</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Nationality', 'الجنسية')}</dt>
          <dd className="mt-0.5 text-slate-200">{t('Israeli', 'إسرائيلي')}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Primary contact number', 'رقم الاتصال الرئيسي')}</dt>
          <dd className="mt-0.5 font-mono text-slate-200" dir="ltr">+970569611116</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">{t('Key services provided', 'الخدمات الرئيسية المقدمة')}</dt>
          <dd className="mt-0.5 text-slate-200">
            {t(
              'Bedi Delivery is a modern SaaS system that enables businesses to create their e-commerce pages in minutes and connect with tens of delivery drivers.',
              'Bedi Delivery نظام SaaS حديث يمكّن الأعمال من إنشاء صفحات التجارة الإلكترونية الخاصة بها في دقائق والاتصال بعشرات سائقي التوصيل.'
            )}
          </dd>
        </div>
      </dl>
    </LegalPageLayout>
  )
}
