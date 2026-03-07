import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'
import { client } from '@/sanity/lib/client'
import { token } from '@/sanity/lib/token'

export async function POST(req: Request) {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = await getEmailForUser(userId, sessionClaims as Record<string, unknown> | null)
  if (!isSuperAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { targets, country, city, specificNumbers, message } = body

    if ((!targets || !Array.isArray(targets) || targets.length === 0) && !specificNumbers?.trim()) {
      return NextResponse.json({ error: 'Targets array or specific numbers are required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const countries = country ? country.split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean) : []
    const cities = city ? city.split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean) : []

    const recipients = new Map<string, string>() // phone -> name

    // Helper to check location
    const matchLocation = (docCountry?: string, docCity?: string) => {
      const cCode = (docCountry || '').trim().toLowerCase()
      const cName = (docCity || '').trim().toLowerCase()

      const countryMatch = countries.length === 0 || countries.includes(cCode)
      const cityMatch = cities.length === 0 || cities.includes(cName)
      
      return countryMatch && cityMatch
    }

    if (targets?.includes('businesses')) {
      const tenants = await client.fetch<{ name?: string, ownerPhone?: string, country?: string, city?: string }[]>(
        `*[_type == "tenant" && defined(ownerPhone)] { name, ownerPhone, country, city }`
      )
      for (const t of tenants) {
        if (matchLocation(t.country, t.city) && t.ownerPhone) {
          recipients.set(t.ownerPhone, t.name || 'صاحب العمل')
        }
      }
    }

    if (targets?.includes('drivers')) {
      const drivers = await client.fetch<{ name?: string, phoneNumber?: string, country?: string, city?: string }[]>(
        `*[_type == "driver" && defined(phoneNumber)] { name, phoneNumber, country, city }`
      )
      for (const d of drivers) {
        if (matchLocation(d.country, d.city) && d.phoneNumber) {
          recipients.set(d.phoneNumber, d.name || 'كابتن')
        }
      }
    }

    if (targets?.includes('customers')) {
      if (countries.length > 0 || cities.length > 0) {
        // If location filters are active, we must find customers based on the businesses they ordered from.
        const cFilter = countries.length > 0 ? `site->country in $countries` : `true`
        const tFilter = cities.length > 0 ? `site->city in $cities` : `true`
        
        // Due to GROQ limitations with dynamic arrays in string matching, we'll fetch orders and filter in JS if needed,
        // or just fetch all orders with customers and filter by site location in JS for simplicity,
        // since we're in an admin script and performance is less critical than correctness here.
        const orders = await client.fetch<{ customerName?: string, customerPhone?: string, country?: string, city?: string }[]>(
          `*[_type == "order" && defined(customerPhone)] { 
            customerName, 
            customerPhone, 
            "country": site->country, 
            "city": site->city 
          }`
        )
        for (const o of orders) {
          if (matchLocation(o.country, o.city) && o.customerPhone) {
            if (!recipients.has(o.customerPhone)) {
              recipients.set(o.customerPhone, o.customerName || 'عميلنا العزيز')
            }
          }
        }
      } else {
        // No location filter, just fetch all customers
        const customers = await client.fetch<{ name?: string, primaryPhone?: string }[]>(
          `*[_type == "customer" && defined(primaryPhone)] { name, primaryPhone }`
        )
        for (const c of customers) {
          if (c.primaryPhone && !recipients.has(c.primaryPhone)) {
            recipients.set(c.primaryPhone, c.name || 'عميلنا العزيز')
          }
        }
      }
    }

    if (specificNumbers) {
      const numbers = specificNumbers.split(',').map((n: string) => n.trim()).filter(Boolean)
      for (const n of numbers) {
        if (!recipients.has(n)) {
          recipients.set(n, 'مستخدم') // Default name for specific numbers
        }
      }
    }

    let sentCount = 0
    let failedCount = 0
    const errors: any[] = []

    for (const [phone, name] of recipients.entries()) {
      // name is {{1}}, message is {{2}}
      const firstName = name.split(' ')[0] || 'User'
      const result = await sendWhatsAppTemplateMessage(
        phone,
        'broadcast_message',
        [firstName, message],
        'ar_EG'
      )

      if (result.success) {
        sentCount++
      } else {
        failedCount++
        errors.push({ phone, error: result.error })
      }
    }

    const writeClient = client.withConfig({ token: token || undefined, useCdn: false })
    await writeClient.create({
      _type: 'broadcastHistory',
      message,
      targets: targets || [],
      countries: country || '',
      cities: city || '',
      specificNumbers: specificNumbers || '',
      sentCount,
      failedCount,
      totalFound: recipients.size,
      errors: errors.length > 0 ? JSON.stringify(errors, null, 2) : '',
    })

    return NextResponse.json({ 
      success: true, 
      totalFound: recipients.size,
      sentCount, 
      failedCount,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('[Admin Broadcast WhatsApp]', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
