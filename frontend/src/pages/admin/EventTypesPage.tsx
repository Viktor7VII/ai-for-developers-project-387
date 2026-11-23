import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { DeleteEventTypeModal } from '../../features/event-type-delete/DeleteEventTypeModal'
import { EventTypeFormModal } from '../../features/event-type-form/EventTypeFormModal'
import { eventTypesApi } from '../../shared/api/client'
import type { EventType } from '../../shared/api/generated'
import { formatDuration } from '../../shared/lib/datetime'
import { getErrorMessage } from '../../shared/lib/errors'

function bookingUrl(slug: string): string {
  return `${window.location.origin}/book/${slug}`
}

export function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpened, setModalOpened] = useState(false)
  const [editing, setEditing] = useState<EventType | null>(null)
  const [deleting, setDeleting] = useState<EventType | null>(null)

  // Incremented to reload the list after saving.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    eventTypesApi
      .eventTypesList()
      .then((data) => {
        setEventTypes(data)
        setError(null)
      })
      .catch(async (e: unknown) => setError(await getErrorMessage(e)))
  }, [reloadKey])

  const openCreate = () => {
    setEditing(null)
    setModalOpened(true)
  }

  const openEdit = (eventType: EventType) => {
    setEditing(eventType)
    setModalOpened(true)
  }

  const handleSaved = () => {
    setModalOpened(false)
    setReloadKey((key) => key + 1)
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Типы встреч</Title>
        <Button onClick={openCreate}>Новый тип встречи</Button>
      </Group>

      {error && (
        <Alert color="red" title="Не удалось загрузить типы встреч">
          {error}
        </Alert>
      )}

      {eventTypes === null && !error && <Loader />}

      {eventTypes?.length === 0 && (
        <Text c="dimmed">
          Пока нет ни одного типа встречи. Создайте первый, чтобы получить ссылку для записи.
        </Text>
      )}

      {eventTypes && eventTypes.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {eventTypes.map((eventType) => (
            <Card key={eventType.id} withBorder padding="lg">
              <Stack gap="xs" h="100%">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Text fw={600} size="lg">
                    {eventType.title}
                  </Text>
                  <Badge variant="light">{formatDuration(eventType.durationMinutes)}</Badge>
                </Group>
                {eventType.description && (
                  <Text size="sm" c="dimmed" lineClamp={3}>
                    {eventType.description}
                  </Text>
                )}
                <Anchor href={`/book/${eventType.slug}`} target="_blank" size="sm">
                  /book/{eventType.slug}
                </Anchor>
                <Group gap="xs" mt="auto">
                  <CopyButton value={bookingUrl(eventType.slug)}>
                    {({ copied, copy }) => (
                      <Button size="xs" variant="light" color={copied ? 'teal' : undefined} onClick={copy}>
                        {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                      </Button>
                    )}
                  </CopyButton>
                  <Button size="xs" variant="default" onClick={() => openEdit(eventType)}>
                    Изменить
                  </Button>
                  <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(eventType)}>
                    Удалить
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <EventTypeFormModal
        opened={modalOpened}
        eventType={editing}
        onClose={() => setModalOpened(false)}
        onSaved={handleSaved}
      />

      <DeleteEventTypeModal
        eventType={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          setReloadKey((key) => key + 1)
        }}
      />
    </Stack>
  )
}
