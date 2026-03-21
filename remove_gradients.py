import re

path = 'components/tracking/OrderTrackView.tsx'
with open(path, 'r') as f:
    text = f.read()

# Replace gradients with solid colors for M3
text = text.replace(
    "'bg-gradient-to-b from-emerald-500 to-emerald-600'",
    "'bg-emerald-600'"
)
text = text.replace(
    "'bg-gradient-to-b from-blue-600 to-blue-700'",
    "'bg-slate-900'"
)

text = text.replace(
    "from-emerald-50 to-emerald-100/50",
    "bg-emerald-50"
)

text = text.replace(
    "from-amber-50 to-amber-100/50",
    "bg-amber-50"
)

text = text.replace(
    "from-rose-50 to-rose-100/50",
    "bg-rose-50"
)

text = text.replace(
    "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
    "bg-amber-500 text-slate-950"
)

text = text.replace(
    "bg-gradient-to-r from-purple-500 to-purple-600 text-white",
    "bg-slate-900 text-white"
)

text = text.replace(
    "border-blue-200/80",
    "border-slate-200"
)

with open(path, 'w') as f:
    f.write(text)
print("done")
