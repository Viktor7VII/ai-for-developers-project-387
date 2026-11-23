import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { eventTypesApi } from '../../shared/api/client'
import type { EventType } from '../../shared/api/generated'
import { formatDuration } from '../../shared/lib/datetime'
import { bookingPath } from '../../shared/lib/bookingLink'
import { getErrorMessage } from '../../shared/lib/errors'

/** Landing page for guests: lists event types, each leading to its booking link. */
export function HomePage() {
  // null while loading, so "no event types" isn't shown before the list arrives.
  const [eventTypes, setEventTypes] = useState<EventType[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    eventTypesApi
      .eventTypesList()
      .then(setEventTypes)
      .catch(async (e: unknown) => setError(await getErrorMessage(e)))
  }, [])

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        {/* On narrow screens the title wraps, the owner link stays on the right. */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Title order={1}>Календарь звонков</Title>
          <Anchor component={Link} to="/admin" size="sm" c="dimmed" mt="xs" style={{ whiteSpace: 'nowrap' }}>
            Кабинет владельца
          </Anchor>
        </Group>
        <Text>Выберите тип встречи и запишитесь на удобное время — регистрация не нужна.</Text>

        {error && (
          <Alert color="red" title="Не удалось загрузить типы встреч">
            {error}
          </Alert>
        )}

        {eventTypes === null && !error && (
          <Loader role="status" aria-label="Загрузка типов встреч" />
        )}

        {eventTypes?.length === 0 && <Text c="dimmed">Владелец пока не открыл запись.</Text>}

        {eventTypes && eventTypes.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {eventTypes.map((eventType) => (
              <Card key={eventType.id} withBorder padding="lg">
                <Stack gap="xs" h="100%">
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Title order={3}>{eventType.title}</Title>
                    <Badge variant="light">{formatDuration(eventType.durationMinutes)}</Badge>
                  </Group>
                  {eventType.description && (
                    <Text size="sm" c="dimmed" lineClamp={3}>
                      {eventType.description}
                    </Text>
                  )}
                  <Button component={Link} to={bookingPath(eventType.slug)} mt="auto" w="fit-content">
                    Записаться
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  )
}
