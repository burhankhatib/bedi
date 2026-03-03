import crypto from 'crypto'

const SIGNATURE_PREFIX = 'rsassa-pss-sha256='

/**
 * Decode base64url to Buffer (RFC 4648).
 * Base64url uses - and _ instead of + and /; add padding if needed.
 */
function base64UrlDecode(str: string): Buffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64
  return Buffer.from(padded, 'base64')
}

/**
 * Verify Prelude webhook signature (X-Webhook-Signature).
 * Prelude sends: rsassa-pss-sha256=<base64url-signature>
 * The signature is RSASSA-PSS over the SHA256 hash of the raw request body.
 *
 * @param rawBody - Exact UTF-8 body as received (e.g. from req.text())
 * @param signatureHeader - Value of X-Webhook-Signature header
 * @param publicKeyPem - PEM string (-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----)
 * @returns true if signature is valid
 */
export function verifyPreludeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  publicKeyPem: string
): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false
  }
  const b64url = signatureHeader.slice(SIGNATURE_PREFIX.length).trim()
  if (!b64url) return false

  let signature: Buffer
  try {
    signature = base64UrlDecode(b64url)
  } catch {
    return false
  }

  let key: crypto.KeyObject
  try {
    key = crypto.createPublicKey(publicKeyPem)
  } catch {
    return false
  }

  const data = Buffer.from(rawBody, 'utf8')
  return crypto.verify(
    'sha256',
    data,
    {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32, // SHA256 digest length for RSASSA-PSS
    },
    signature
  )
}
