/**
 * Driver display names: Customer sees nickname; Business sees "name (nickname)".
 */

/** For business views: "ابراهيم خطيب (برهوم)" - real name with nickname in parens for identification. */
export function getDriverDisplayNameForBusiness(driver: { name?: string; nickname?: string } | null | undefined): string {
  if (!driver?.name) return ''
  const nick = driver.nickname?.trim()
  return nick ? `${driver.name} (${nick})` : driver.name
}
