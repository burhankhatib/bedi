import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Prelude from "@prelude.so/sdk"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { phoneNumber } = await req.json()
    if (!phoneNumber) {
      return new NextResponse('Phone number is required', { status: 400 })
    }

    const client = new Prelude({
      apiToken: process.env.PRELUDE_API_KEY!,
    })

    // #region agent log
    fetch('http://127.0.0.1:7893/ingest/a956dccd-3cc7-4993-8038-2d7f86d93e5e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a2ec5'},body:JSON.stringify({sessionId:'9a2ec5',hypothesisId:'H2',location:'request/route.ts:22',message:'Before Prelude create v2',data:{phoneNumber},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const verification = await client.verification.create({
      target: {
        type: "phone_number",
        value: phoneNumber,
      },
    })

    // #region agent log
    fetch('http://127.0.0.1:7893/ingest/a956dccd-3cc7-4993-8038-2d7f86d93e5e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a2ec5'},body:JSON.stringify({sessionId:'9a2ec5',hypothesisId:'H2',location:'request/route.ts:31',message:'After Prelude create',data:{verification},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ success: true, data: verification })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7893/ingest/a956dccd-3cc7-4993-8038-2d7f86d93e5e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a2ec5'},body:JSON.stringify({sessionId:'9a2ec5',hypothesisId:'H1',location:'request/route.ts:catch',message:'Request route error',data:{errMsg: error instanceof Error ? error.message : String(error), errStack: error instanceof Error ? error.stack : undefined},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('Error in Prelude verification request:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
