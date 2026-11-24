import { Alert, Badge, Button, Loader, Stack, Table, Text, Title, VisuallyHidden } from '@mantine/core'
import { useEffect, useState } from 'react'
import { BookingNoteModal } from '../../features/booking-note/BookingNoteModal'
import { bookingsApi } from '../../shared/api/client'
import { type Booking, BookingStatus } from '../../shared/api/generated'
import { browserTimeZone, formatShortDate, formatTime } from '../../shared/lib/datetime'
import { getErrorMessage } from '../../shared/lib/errors'

const STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.Confirmed]: 'Подтверждена',
}

interface BookingsTableProps {
  bookings: Booking[]
  onEditNote: (booking: Booking) => void
}

function BookingsTable({ bookings, onEditNote }: BookingsTableProps) {
  return (
    <Table.ScrollContainer minWidth={860}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Время</Table.Th>
            <Table.Th>Встреча</Table.Th>
            <Table.Th>Гость</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Статус</Table.Th>
            <Table.Th>Заметка</Table.Th>
            <Table.Th>
              <VisuallyHidden>Действия</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bookings.map((booking) => (
            <Table.Tr key={booking.id}>
              <Table.Td>{formatShortDate(booking.startAt)}</Table.Td>
              <Table.Td>
                {formatTime(booking.startAt)}–{formatTime(booking.endAt)}
              </Table.Td>
              <Table.Td>{booking.eventTypeTitle}</Table.Td>
              <Table.Td>{booking.guestName}</Table.Td>
              <Table.Td>{booking.guestEmail}</Table.Td>
              <Table.Td>
                <Badge color="teal" variant="light">
                  {STATUS_LABELS[booking.status]}
                </Badge>
              </Table.Td>
              <Table.Td>
                {booking.note && (
                  // Long notes are clamped to two lines; the full text is shown in the edit modal.
                  <Text size="sm" lineClamp={2} maw={280} style={{ overflowWrap: 'anywhere' }}>
                    {booking.note}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Button
                  size="xs"
                  variant="default"
                  // Unique accessible name: every row has the same visible button text.
                  aria-label={`${booking.note ? 'Изменить' : 'Добавить'} заметку: ${booking.guestName}, ${formatShortDate(booking.startAt)} ${formatTime(booking.startAt)}`}
                  onClick={() => onEditNote(booking)}
                >
                  {booking.note ? 'Изменить заметку' : 'Добавить заметку'}
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Captured once per page visit, so the split into upcoming/past is stable between renders.
  const [now] = useState(() => Date.now())
  const [noteBooking, setNoteBooking] = useState<Booking | null>(null)

  const handleNoteSaved = (saved: Booking) => {
    setBookings((current) => current?.map((booking) => (booking.id === saved.id ? saved : booking)) ?? null)
    setNoteBooking(null)
  }

  useEffect(() => {
    bookingsApi
      .bookingsList()
      .then(setBookings)
      .catch(async (e: unknown) => setError(await getErrorMessage(e)))
  }, [])

  if (error) {
    return (
      <Alert color="red" title="Не удалось загрузить записи">
        {error}
      </Alert>
    )
  }

  if (bookings === null) {
    return <Loader />
  }

  const upcoming = bookings.filter((booking) => booking.endAt.getTime() > now)
  // Most recent past meetings first.
  const past = bookings.filter((booking) => booking.endAt.getTime() <= now).reverse()

  return (
    <Stack>
      <Title order={2}>Записи</Title>
      <Text c="dimmed" size="sm">
        Время указано в вашем часовом поясе ({browserTimeZone()}).
      </Text>

      <Title order={4}>Предстоящие</Title>
      {upcoming.length === 0 ? (
        <Text c="dimmed">Предстоящих записей нет.</Text>
      ) : (
        <BookingsTable bookings={upcoming} onEditNote={setNoteBooking} />
      )}

      {past.length > 0 && (
        <>
          <Title order={4}>Прошедшие</Title>
          <BookingsTable bookings={past} onEditNote={setNoteBooking} />
        </>
      )}

      <BookingNoteModal booking={noteBooking} onClose={() => setNoteBooking(null)} onSaved={handleNoteSaved} />
    </Stack>
  )
}
