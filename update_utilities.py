import re

path = 'components/tracking/OrderTrackView.tsx'
with open(path, 'r') as f:
    text = f.read()

# Remove the old Share link section
share_link_pattern = r'<div className="mt-8 px-4">\s*<div className="rounded-3xl border-2 border-dashed border-slate-200/80 bg-slate-50/50 p-6">.*?</div>\s*</div>'
share_link_match = re.search(share_link_pattern, text, re.DOTALL)
if share_link_match:
    text = text.replace(share_link_match.group(0), "")
    
# Remove the old Utility Actions section
utility_pattern = r'\{/\* Utility Actions \*/\}.*?</Button>\s*</div>'
utility_match = re.search(utility_pattern, text, re.DOTALL)
if utility_match:
    text = text.replace(utility_match.group(0), "")

# We want to place the combined Utility actions right above the Device Settings.
# The Device Settings start with: <div className="mt-8 px-4 border-t border-slate-200/60 pt-8 space-y-4">
device_settings_marker = '<div className="mt-8 px-4 border-t border-slate-200/60 pt-8 space-y-4">'

new_utilities = """      {/* Utility Actions */}
      <div className="mt-6 px-4 flex flex-col gap-3">
        <Button
          variant="outline"
          onClick={() => setShowSplitModal(true)}
          className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm justify-start px-6"
        >
          <Users className="w-5 h-5 mr-3 rtl:ml-3 rtl:mr-0 text-slate-500" />
          {t('Split the bill', 'تقسيم الفاتورة')}
        </Button>
        <Button
          variant="outline"
          onClick={copyTrackLink}
          className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm justify-start px-6"
        >
          <Copy className="w-5 h-5 mr-3 rtl:ml-3 rtl:mr-0 text-slate-500" />
          {copied ? t('Copied!', 'تم النسخ!') : t('Copy tracking link', 'نسخ رابط التتبع')}
        </Button>
        {trackUrl && (
          <Button asChild variant="outline" className="rounded-[2rem] border-slate-300 text-slate-800 h-14 font-medium hover:bg-slate-50 shadow-sm justify-start px-6">
            <a href={trackUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-5 h-5 mr-3 rtl:ml-3 rtl:mr-0 text-slate-500" />
              {t('Open in new tab', 'فتح في نافذة جديدة')}
            </a>
          </Button>
        )}
      </div>

      """

text = text.replace(device_settings_marker, new_utilities + device_settings_marker)

with open(path, 'w') as f:
    f.write(text)
print("Updated Utilities")
