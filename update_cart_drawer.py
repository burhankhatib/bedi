import re

with open('components/Cart/CartDrawer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace note input
content = content.replace(
"""                            <div className="mb-2">
                              <Input
                                placeholder={t('Special requests...', 'طلبات خاصة...')}
                                value={item.notes || ''}
                                onChange={(e) => updateNotes(item.cartItemId, e.target.value)}
                                className="text-sm h-9 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>""",
"""                            <div className="mb-2">
                              <Input
                                placeholder={t('Special requests...', 'طلبات خاصة...')}
                                value={item.notes || ''}
                                disabled={!canEdit}
                                onChange={(e) => updateNotes(item.cartItemId, e.target.value)}
                                className="text-sm h-9 bg-white disabled:opacity-50"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>"""
)

# Replace minus button
content = content.replace(
"""                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => {""",
"""                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={!canEdit}
                                  className="h-8 w-8 rounded-lg disabled:opacity-50"
                                  onClick={() => {"""
)

# Wait, there are multiple buttons matching that, but there are only two (minus and plus).
# So the above replace will replace BOTH the minus and plus buttons with disabled={!canEdit}.
# Then there's the X button (remove) at the end.

content = content.replace(
"""                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="shrink-0 rounded-full text-slate-400 hover:text-red-500"
                          >""",
"""                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="shrink-0 rounded-full text-slate-400 hover:text-red-500"
                            >
                              <X className="w-5 h-5" />
                            </Button>
                          )}"""
)
# Note: Since I included the <X /> in the replacement, but the old string didn't have it, I need to adjust or just replace the button tag and add {canEdit && ( around it. Wait, actually I can just add `disabled={!canEdit}` and `className={canEdit ? ... : 'hidden'}` or just wrap it.
content = content.replace(
"""                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="shrink-0 rounded-full text-slate-400 hover:text-red-500"
                            >
                              <X className="w-5 h-5" />
                            </Button>
                          )}
                            <X className="w-5 h-5" />
                          </Button>""",
"""                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="shrink-0 rounded-full text-slate-400 hover:text-red-500"
                            >
                              <X className="w-5 h-5" />
                            </Button>
                          )}"""
)

# And finally the send order button.
# Let's find: `onClick={handleSendOrder}`

content = content.replace(
"""                  {/* Main SEND Button */}
                  <Button
                    onClick={handleSendOrder}
                    disabled={isSendingOrder}
                    className="w-full h-16 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-[0.98] transition-all"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {isSendingOrder
                      ? t('Sending...', 'جارٍ الإرسال...')
                      : t('SEND ORDER', 'إرسال الطلب')
                    }
                  </Button>""",
"""                  {/* Main SEND Button */}
                  {isSharedCart && !isHost ? (
                    <Button
                      disabled={true}
                      className="w-full h-16 rounded-2xl font-black text-lg bg-slate-200 text-slate-500 shadow-none transition-all"
                    >
                      {t('Waiting for Host to send...', 'في انتظار المضيف لإرسال الطلب...')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSendOrder}
                      disabled={isSendingOrder}
                      className="w-full h-16 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-[0.98] transition-all"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      {isSendingOrder
                        ? t('Sending...', 'جارٍ الإرسال...')
                        : isSharedCart ? t('Review & Send Order', 'مراجعة وإرسال الطلب') : t('SEND ORDER', 'إرسال الطلب')
                      }
                    </Button>
                  )}"""
)

with open('components/Cart/CartDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated CartDrawer.tsx")
