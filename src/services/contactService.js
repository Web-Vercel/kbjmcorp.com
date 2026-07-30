const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT?.trim()

export async function submitContact(payload) {
  if (!endpoint) {
    return {
      ok: false,
      message: 'Online messages are not connected yet. Please contact KBJM directly by phone or email.'
    }
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) throw new Error('We could not send your message. Please contact KBJM directly.')
  return { ok: true, message: 'Your message has been sent.' }
}
