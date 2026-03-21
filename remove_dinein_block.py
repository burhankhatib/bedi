import re

path = 'components/tracking/OrderTrackView.tsx'
with open(path, 'r') as f:
    text = f.read()

# Pattern to find the dine-in block
pattern = r'\{/\* Dine-in: Call waiter \/ Ask for check.*?</div>\n        </div>\n      \)}'

# The replacement should just be the alert message if active
replacement = """      {/* Dine-in: Call waiter alert (Buttons moved to sticky bottom bar) */}
      {isDineIn && !['completed', 'cancelled', 'refunded'].includes(data.order.status ?? '') && data.order.customerRequestedAt && !data.order.customerRequestAcknowledgedAt && (
        <div className="mt-5 px-4">
          <p className="text-sm font-medium text-amber-700 bg-amber-50 rounded-xl px-4 py-3 flex items-center gap-2 border border-amber-200">
            <Clock className="h-4 w-4 animate-pulse" />
            {t('Request sent — waiting for staff to respond.', 'تم إرسال الطلب — في انتظار رد الطاقم.')}
          </p>
        </div>
      )}"""

text = re.sub(pattern, replacement, text, flags=re.DOTALL)

with open(path, 'w') as f:
    f.write(text)
print("Removed old dine-in block")
