import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { isSuperAdminEmail } from '@/lib/constants'
import { getEmailForUser } from '@/lib/getClerkEmail'
import { formatMetaWhatsAppApiError, sendWhatsAppTemplateMessage } from '@/lib/meta-whatsapp'
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
    const { targets, country, city, specificUsers, message } = body

    if ((!targets || !Array.isArray(targets) || targets.length === 0) && (!specificUsers || !Array.isArray(specificUsers) || specificUsers.length === 0)) {
      return NextResponse.json({ error: 'Targets array or specific users are required' }, { status: 400 })
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
      const drivers = await client.fetch<{ name?: string, phoneNumber?: string, country?: string, city?: string, isVerifiedByAdmin?: boolean }[]>(
        `*[_type == "driver" && isVerifiedByAdmin == true && defined(phoneNumber)] { name, phoneNumber, country, city, isVerifiedByAdmin }`
      )
      for (const d of drivers) {
        if (matchLocation(d.country, d.city) && d.phoneNumber && d.isVerifiedByAdmin) {
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

    if (specificUsers && Array.isArray(specificUsers)) {
      for (const u of specificUsers) {
        if (u.phone && u.name) {
          recipients.set(u.phone, u.name)
        }
      }
    }

    let sentCount = 0
    let failedCount = 0
    const errors: any[] = []
    const successfulNumbers: string[] = []
    const failedNumbers: string[] = []

    for (const [phone, name] of recipients.entries()) {
      // name is {{1}}, message is {{2}}
      const firstName = name.split(' ')[0] || 'User'
      let result = await sendWhatsAppTemplateMessage(
        phone,
        'broadcast_message',
        [firstName, message],
        'ar_EG'
      )

      if (!result.success) {
        const errorStr = formatMetaWhatsAppApiError(result.error)

        if (errorStr.includes('does not exist in ar_EG') || errorStr.includes('does not exist in ar')) {
          result = await sendWhatsAppTemplateMessage(
            phone,
            'broadcast_message',
            [firstName, message],
            'ar'
          )
        }
      }

      if (result.success) {
        sentCount++
        successfulNumbers.push(`${name} (${phone})`)
      } else {
        failedCount++
        failedNumbers.push(`${name} (${phone})`)
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
      specificNumbers: specificUsers && Array.isArray(specificUsers) ? specificUsers.map((u: any) => `${u.name} (${u.phone})`).join(', ') : '',
      successfulNumbers,
      failedNumbers,
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
