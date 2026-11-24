import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { Booking } from '../../shared/api/generated'
import { formatShortDate, formatTime } from '../../shared/lib/datetime'

interface BookingTopicModalProps {
  /** Booking whose guest topic is shown; null when the modal is closed. */
  booking: Booking | null
  onClose: () => void
}

/** Read-only view of the topic the guest gave when booking; the topic can't be changed. */
export function BookingTopicModal({ booking, onClose }: BookingTopicModalProps) {
  return (
    <Modal opened={booking !== null} onClose={onClose} title="Тема разговора" size="lg">
      {booking && (
        <Stack>
          <Text size="sm" c="dimmed">
            {booking.eventTypeTitle}, {booking.guestName} — {formatShortDate(booking.startAt)}{' '}
            {formatTime(booking.startAt)}–{formatTime(booking.endAt)}
          </Text>
          <Text style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{booking.topic}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Закрыть
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
