import dayjs from 'dayjs'

/** Calendar date key in the browser time zone, e.g. 2026-11-20. */
export function toDateKey(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD')
}

export function formatTime(date: Date): string {
  return dayjs(date).format('HH:mm')
}

/** e.g. "20 ноября 2026, пятница" */
export function formatLongDate(date: Date | string): string {
  return dayjs(date).format('D MMMM YYYY, dddd')
}

export function formatShortDate(date: Date): string {
  return dayjs(date).format('DD.MM.YYYY')
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `${rest} мин`
  }
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
