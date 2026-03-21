import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add state
    if 'const [showHostConfirmDialog, setShowHostConfirmDialog]' not in content:
        content = content.replace(
            "const [isSendingOrder, setIsSendingOrder] = useState(false)",
            "const [isSendingOrder, setIsSendingOrder] = useState(false)\n  const [showHostConfirmDialog, setShowHostConfirmDialog] = useState(false)"
        )

    # 2. Modify SEND Button onClick
    # We replace `onClick={handleSendOrder}` with `onClick={isSharedCart && isHost ? () => setShowHostConfirmDialog(true) : handleSendOrder}`
    content = content.replace(
        "onClick={handleSendOrder}\n                      disabled={isSendingOrder}",
        "onClick={isSharedCart && isHost ? () => setShowHostConfirmDialog(true) : handleSendOrder}\n                      disabled={isSendingOrder}"
    )

    # 3. Add Dialog JSX at the end, right before </Sheet> or similar wrapper.
    # In both CartDrawer and CartSlider, there is a UnifiedOrderDialog rendered.
    # Let's add it right after UnifiedOrderDialog.
    dialog_jsx = """      <Dialog open={showHostConfirmDialog} onOpenChange={setShowHostConfirmDialog}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-center">
              {t('Ready to send?', 'هل أنتم مستعدون للإرسال؟')}
            </DialogTitle>
            <DialogDescription className="text-center mt-2">
              {t('Are you sure everyone at the table is finished ordering?', 'هل أنت متأكد أن جميع من على الطاولة قد انتهوا من الطلب؟')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => {
                setShowHostConfirmDialog(false)
                handleSendOrder()
              }}
              className="w-full h-14 rounded-2xl font-black text-lg bg-green-600 hover:bg-green-700 text-white"
            >
              {t('Yes, send order', 'نعم، أرسل الطلب')}
            </Button>
            <Button
              onClick={() => setShowHostConfirmDialog(false)}
              variant="outline"
              className="w-full h-14 rounded-2xl font-bold"
            >
              {t('Wait, not yet', 'انتظر قليلاً')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
"""
    if "showHostConfirmDialog" not in content.split("UnifiedOrderDialog")[1]:
        # we need to import Dialog components if not present
        if "DialogContent" not in content:
            content = content.replace(
                "import { Button } from '@/components/ui/button'",
                "import { Button } from '@/components/ui/button'\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'"
            )
        
        # append after UnifiedOrderDialog
        content = re.sub(
            r'(<UnifiedOrderDialog[\s\S]*?/>)',
            r'\1\n' + dialog_jsx,
            content
        )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {filepath}")

update_file('components/Cart/CartSlider.tsx')
update_file('components/Cart/CartDrawer.tsx')
