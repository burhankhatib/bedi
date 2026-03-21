import re

path = 'components/tracking/OrderTrackView.tsx'
with open(path, 'r') as f:
    text = f.read()

# Add sticky bottom bar for M3 native app feel
sticky_bar = """
      {/* Sticky Bottom Bar for Critical Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-lg flex gap-3">
          {isDelivery && isOutForDelivery && data.driver ? (
            <>
              <Button asChild className="flex-1 rounded-[1.25rem] h-14 bg-slate-900 text-white hover:bg-slate-800 font-bold shadow-sm active:scale-95 transition-all">
                <a href={`tel:+${normalizePhoneForWhatsApp(data.driver.phoneNumber, countryCode)}`}>
                  <Phone className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('Call Driver', 'الاتصال بالسائق')}
                </a>
              </Button>
              {getWhatsAppUrl(data.driver.phoneNumber, '', countryCode) && (
                <Button asChild className="flex-1 rounded-[1.25rem] h-14 bg-[#25D366] text-white hover:bg-[#20bd5a] font-bold shadow-sm active:scale-95 transition-all">
                  <a href={getWhatsAppUrl(data.driver.phoneNumber, '', countryCode)!} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </>
          ) : isDineIn && !['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') ? (
            <>
              <Button onClick={() => sendRequest('call_waiter')} disabled={requestSending} className="flex-1 rounded-[1.25rem] h-14 bg-slate-900 text-white hover:bg-slate-800 font-bold shadow-sm active:scale-95 transition-all">
                <HandHelping className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Call Waiter', 'استدعاء النادل')}
              </Button>
              <Button onClick={() => setShowCheckModal(true)} disabled={requestSending} variant="outline" className="flex-1 rounded-[1.25rem] h-14 border-slate-300 text-slate-800 hover:bg-slate-50 font-bold shadow-sm active:scale-95 transition-all">
                <CreditCard className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Check', 'الفاتورة')}
              </Button>
            </>
          ) : (
            <Button asChild className="flex-1 rounded-[1.25rem] h-14 bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold shadow-sm active:scale-95 transition-all">
              <Link href={`/t/${slug}`}>
                {t('Back to menu', 'العودة إلى القائمة')}
              </Link>
            </Button>
          )}
        </div>
      </div>
"""

# Insert before the end of the main div
text = text.replace("    </div>\n\n      {/* Modal: Split the Bill */}", sticky_bar + "\n    </div>\n\n      {/* Modal: Split the Bill */}")

# Make sure it inserts if it didn't find the exact match above
if sticky_bar not in text:
    text = text.replace("      {/* Modal: Split the Bill */}", sticky_bar + "\n      {/* Modal: Split the Bill */}")

with open(path, 'w') as f:
    f.write(text)
print("Sticky bar added")
