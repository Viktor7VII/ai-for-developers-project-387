/** Path of the booking link (see GLOSSARY.md) for an event type. */
export function bookingPath(slug: string): string {
  return `/book/${slug}`
}

/** Absolute booking link that the owner sends to a guest. */
export function bookingUrl(slug: string): string {
  return `${window.location.origin}${bookingPath(slug)}`
}
