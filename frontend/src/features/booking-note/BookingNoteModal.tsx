import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { bookingsApi } from '../../shared/api/client'
import type { Booking } from '../../shared/api/generated'
import { formatShortDate, formatTime } from '../../shared/lib/datetime'
import { getErrorMessage } from '../../shared/lib/errors'

/** Maximum note length after trimming, as in the API contract. */
const NOTE_MAX_LENGTH = 1000

interface BookingNoteModalProps {
  /** Booking whose note is added, changed or removed; null when the modal is closed. */
  booking: Booking | null
  onClose: () => void
  onSaved: (booking: Booking) => void
}

export function BookingNoteModal({ booking, onClose, onSaved }: BookingNoteModalProps) {
  return (
    <Modal opened={booking !== null} onClose={onClose} title="Заметка к записи" size="lg">
      {/* Re-mount the form for each booking to reset its state. */}
      {booking && <BookingNoteForm key={booking.id} booking={booking} onCancel={onClose} onSaved={onSaved} />}
    </Modal>
  )
}

interface BookingNoteFormProps {
  booking: Booking
  onCancel: () => void
  onSaved: (booking: Booking) => void
}

function BookingNoteForm({ booking, onCancel, onSaved }: BookingNoteFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // An existing note is edited with its full text; saving it empty removes it.
  const editing = Boolean(booking.note)

  const form = useForm({
    initialValues: { note: booking.note ?? '' },
    validate: {
      note: (value) => {
        const length = value.trim().length
        if (length === 0 && !editing) {
          return 'Введите заметку'
        }
        return length > NOTE_MAX_LENGTH ? `Не больше ${NOTE_MAX_LENGTH} символов` : null
      },
    },
  })

  const save = async (note: string) => {
    setSubmitting(true)
    setError(null)
    try {
      // The server trims the note and checks its length again; an empty note removes it.
      onSaved(await bookingsApi.bookingsSetNote({ id: booking.id, bookingNoteInput: { note } }))
    } catch (e) {
      setError(await getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = ({ note }: { note: string }) => save(note)

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack>
        <Text size="sm" c="dimmed">
          {booking.eventTypeTitle}, {booking.guestName} — {formatShortDate(booking.startAt)}{' '}
          {formatTime(booking.startAt)}–{formatTime(booking.endAt)}
        </Text>
        {error && (
          <Alert color="red" title="Не удалось сохранить заметку">
            {error}
          </Alert>
        )}
        <Textarea
          label="Заметка"
          description={`${form.values.note.trim().length} / ${NOTE_MAX_LENGTH}`}
          placeholder="Вопросы к разговору, договорённости"
          autosize
          minRows={3}
          maxRows={12}
          data-autofocus
          {...form.getInputProps('note')}
        />
        <Group justify="flex-end">
          {editing && (
            <Button variant="subtle" color="red" mr="auto" disabled={submitting} onClick={() => save('')}>
              Удалить заметку
            </Button>
          )}
          <Button variant="default" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit" loading={submitting}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
