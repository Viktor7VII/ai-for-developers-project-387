import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { eventTypesApi } from '../../shared/api/client'
import type { EventType } from '../../shared/api/generated'
import { getErrorMessage, isResponseStatus } from '../../shared/lib/errors'

interface DeleteEventTypeModalProps {
  /** Event type to delete; null keeps the modal closed. */
  eventType: EventType | null
  onClose: () => void
  onDeleted: () => void
}

export function DeleteEventTypeModal({ eventType, onClose, onDeleted }: DeleteEventTypeModalProps) {
  return (
    <Modal opened={eventType !== null} onClose={onClose} title="Удаление типа встречи">
      {/* Re-mount for each event type to reset the error state. */}
      {eventType && <DeleteConfirmation key={eventType.id} eventType={eventType} onCancel={onClose} onDeleted={onDeleted} />}
    </Modal>
  )
}

interface DeleteConfirmationProps {
  eventType: EventType
  onCancel: () => void
  onDeleted: () => void
}

function DeleteConfirmation({ eventType, onCancel, onDeleted }: DeleteConfirmationProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await eventTypesApi.eventTypesDelete({ id: eventType.id })
      onDeleted()
    } catch (e) {
      setError(
        isResponseStatus(e, 409)
          ? 'Нельзя удалить: по нему уже есть записи.'
          : await getErrorMessage(e),
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack>
      <Text>
        Удалить тип встречи «{eventType.title}»? Ссылка для записи перестанет работать.
      </Text>
      {error && (
        <Alert color="red" title="Не удалось удалить">
          {error}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Отмена
        </Button>
        <Button color="red" onClick={handleDelete} loading={deleting}>
          Удалить
        </Button>
      </Group>
    </Stack>
  )
}
