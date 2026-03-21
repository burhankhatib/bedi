import re

path = 'components/tracking/OrderTrackView.tsx'
with open(path, 'r') as f:
    text = f.read()

# Add state
state_search = "const [splitPeople, setSplitPeople] = useState(1)"
state_replace = state_search + "\n  const [showSplitModal, setShowSplitModal] = useState(false)"
text = text.replace(state_search, state_replace)

# Replace the block with just a button and move the block to bottom
split_block_pattern = r"\{/\* Split the bill — local only, friendly \*/\}.*?(?=\{/\* Dine-in: Call waiter)"
split_block_match = re.search(split_block_pattern, text, re.DOTALL)

if split_block_match:
    split_block_original = split_block_match.group(0)
    
    # We will replace the original with the button group for utilities
    new_utility_group = """{/* Utility Actions */}
      <div className="mt-8 px-4 flex flex-col gap-3">
        <Button
          variant="outline"
          onClick={() => setShowSplitModal(true)}
          className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm"
        >
          <Users className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 text-slate-500" />
          {t('Split the bill', 'تقسيم الفاتورة')}
        </Button>
      </div>

      """
    
    text = text.replace(split_block_original, new_utility_group)

    # Now append the modal definition near the end of the return statement, for instance right before the last closing </div> of the main structure
    modal_insert = """
      {/* Modal: Split the Bill */}
      <AnimatePresence>
        {showSplitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-4"
            onClick={() => setShowSplitModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl relative"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="h-6 w-6 text-amber-500" />
                  {t('Split the bill', 'تقسيم الفاتورة')}
                </h3>
                <button
                  onClick={() => setShowSplitModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                {t('Dividing among friends? Choose how many people.', 'تقسمون بين الأصدقاء؟ اختروا عدد الأشخاص.')}
              </p>

              <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-6">
                <span className="font-medium text-slate-700">{t('People', 'الأشخاص')}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSplitPeople(n => Math.max(1, n - 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold text-slate-900 w-6 text-center">{splitPeople}</span>
                  <button
                    onClick={() => setSplitPeople(n => n + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-900">{t('Each pays', 'كل شخص يدفع')}</span>
                <span className="text-2xl font-black text-amber-600">
                  {perPerson.toFixed(2)} <span className="text-sm">{formatCurrency(currency)}</span>
                </span>
              </div>
              
              <Button
                onClick={() => setShowSplitModal(false)}
                className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 shadow-sm font-bold text-base"
              >
                {t('Done', 'تم')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
"""
    
    # insert modal before the last closing tag
    text = text.replace("    </CustomerTrackPushGate>\n  )", modal_insert + "    </CustomerTrackPushGate>\n  )")

with open(path, 'w') as f:
    f.write(text)
print("Split the bill moved to modal")
