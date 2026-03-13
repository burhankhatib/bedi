import Image from 'next/image'
import { ChefHat, UtensilsCrossed, Clock } from 'lucide-react'

const loadingMessages = [
  { en: "Our chef is preparing something amazing... 👨‍🍳", ar: "الشيف يعد شيئاً رائعاً... 👨‍🍳" },
  { en: "Fresh ingredients loading... 🥬", ar: "جارٍ تحميل المكونات الطازجة... 🥬" },
  { en: "The chicken is still cooking... 🍗", ar: "الدجاج لا يزال يطبخ... 🍗" },
  { en: "Almost ready! Our menu is worth the wait! ⏳", ar: "تقريباً جاهز! قائمتنا تستحق الانتظار! ⏳" },
  { en: "Loading deliciousness... 🍽️", ar: "جارٍ تحميل اللذة... 🍽️" },
  { en: "Preparing your perfect meal... ✨", ar: "جارٍ إعداد وجبتك المثالية... ✨" },
]

export default function TenantLoading() {
  const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)]

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <div className="relative w-24 h-24 mx-auto mb-8 animate-pulse">
          <Image
            src="/logo.webp"
            alt="Bedi Delivery"
            fill
            sizes="96px"
            className="object-contain"
          />
        </div>
        <div className="mb-8 flex items-center justify-center gap-4">
          <ChefHat className="w-12 h-12 text-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <UtensilsCrossed className="w-12 h-12 text-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <Clock className="w-12 h-12 text-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">{randomMessage.en}</h2>
          <p className="text-xl md:text-2xl font-bold text-slate-600 mb-2" dir="rtl">
            {randomMessage.ar}
          </p>
        </div>
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-black rounded-full animate-spin" />
        </div>
        <p className="text-slate-500 text-lg">Please wait while we prepare the menu...</p>
        <p className="text-slate-500 text-lg mt-2" dir="rtl">
          يرجى الانتظار بينما نعد القائمة...
        </p>
      </div>
    </div>
  )
}
