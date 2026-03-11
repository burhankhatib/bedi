# Location & service area behavior

## Current implementation

- **First visit, no saved city**: We auto-detect location via geolocation + geofencing/Nominatim. No modal is shown when the user is in a service area; we set their city and show the app.
- **User in service area**: Location is set automatically; user sees the homepage.
- **User outside service area**: We show the **Out of service** screen: apology, “Contact us” button (→ `/contact`), and “I’d still like to browse” with a city dropdown. Choosing a city lets them browse stores in that city (e.g. for future visits or pickup).
- **Geolocation denied / error**: We show the “Where are you?” gate with “Pick your area” so they can choose a city manually (modal with “Use current location” and city dropdown).

## Suggestions when user is outside delivery radius

1. **Homepage (implemented)**  
   - Show a dedicated out-of-service screen with apology, Contact link, and “Browse by city” so they can still explore.

2. **At checkout / delivery address**  
   - If the user chose “Browse this city” and then enters an address that is outside that city’s delivery zones:
     - Validate address against tenant delivery areas (e.g. polygon or radius).
     - Show a clear message: “Delivery isn’t available to this address yet” and suggest:
       - Pick a different address in [City], or
       - Contact us to request expansion.
     - Optionally collect “Notify me when you deliver here” (email/phone) and store it for marketing or expansion planning.

3. **Store / tenant page**  
   - If the user is browsing a city they selected manually (not their detected location), show a small notice: “You’re viewing stores in [City]. Delivery may not be available to your current location.” with a “Set my location” link to re-run geolocation.

4. **Contact form**  
   - Keep the prominent “Contact us” link on the out-of-service screen so users can ask for expansion or report incorrect detection.

5. **“Notify me when you’re here”**  
   - Optional: On the out-of-service screen, add an email field and “Notify me when you deliver to [Detected city]” to build a waitlist and signal demand.

6. **Analytics**  
   - Log out-of-service events (detected city, country) to prioritize which areas to expand to.

7. **Driver / delivery radius**  
   - For tenants: validate that the delivery address falls inside the tenant’s configured delivery polygon/radius before confirming the order, and return a clear error with the same “Delivery not available to this address” messaging and contact option.

These behaviors keep the flow clear, avoid dead-ends, and turn “out of area” into a chance to collect feedback and interest.
