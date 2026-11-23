import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { publicBookingApi } from '../../shared/api/client'
import type { EventType, GuestBooking, TimeSlot } from '../../shared/api/generated'
import {
  browserTimeZone,
  formatDuration,
  formatLongDate,
  formatTime,
  toDateKey,
} from '../../shared/lib/datetime'
import { getErrorMessage, isResponseStatus } from '../../shared/lib/errors'

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

export function BookingPage() {
  const { slug = '' } = useParams()
  const [eventType, setEventType] = useState<LoadState<EventType>>({ status: 'loading' })
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    publicBookingApi
      .publicBookingGetEventType({ slug })
      .then((data) => setEventType({ status: 'ready', data }))
      .catch(async (e: unknown) => {
        if (isResponseStatus(e, 404)) {
          setNotFound(true)
        }
        setEventType({ status: 'error', message: await getErrorMessage(e) })
      })
  }, [slug])

  if (eventType.status === 'loading') {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  if (eventType.status === 'error') {
    return (
      <Center mih="100vh" p="md">
        <Stack align="center" gap="xs">
          <Title order={2}>{notFound ? 'Тип встречи не найден' : 'Не удалось загрузить тип встречи'}</Title>
          <Text c="dimmed">{notFound ? 'Проверьте ссылку, которую вам прислали.' : eventType.message}</Text>
        </Stack>
      </Center>
    )
  }

  return <BookingFlow eventType={eventType.data} />
}

function BookingFlow({ eventType }: { eventType: EventType }) {
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [booking, setBooking] = useState<GuestBooking | null>(null)
  const [conflict, setConflict] = useState(false)
  // Incremented to force reloading slots, e.g. after the chosen slot was taken by someone else.
  const [reloadKey, setReloadKey] = useState(0)

  const handleConflict = () => {
    setSelectedSlot(null)
    setConflict(true)
    setReloadKey((key) => key + 1)
  }

  const reset = () => {
    setBooking(null)
    setSelectedSlot(null)
    setConflict(false)
    setReloadKey((key) => key + 1)
  }

  let content
  if (booking) {
    content = <Confirmation booking={booking} onBookAgain={reset} />
  } else if (selectedSlot) {
    content = (
      <GuestForm
        eventType={eventType}
        slot={selectedSlot}
        onBack={() => setSelectedSlot(null)}
        onBooked={setBooking}
        onConflict={handleConflict}
      />
    )
  } else {
    content = (
      <Stack>
        {conflict && (
          <Alert color="orange" title="Это время уже занято">
            Пока вы заполняли форму, кто-то записался на это время. Выберите другое.
          </Alert>
        )}
        <SlotPicker
          slug={eventType.slug}
          reloadKey={reloadKey}
          onSelect={(slot) => {
            setConflict(false)
            setSelectedSlot(slot)
          }}
        />
      </Stack>
    )
  }

  return (
    <Container size="md" py="xl">
      <Card withBorder padding="xl" radius="lg">
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Stack gap="xs">
              <Title order={2}>{eventType.title}</Title>
              <Group gap="xs">
                <Badge variant="light">{formatDuration(eventType.durationMinutes)}</Badge>
              </Group>
              {eventType.description && (
                <Text c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                  {eventType.description}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                Часовой пояс: {browserTimeZone()}
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}>{content}</Grid.Col>
        </Grid>
      </Card>
    </Container>
  )
}

interface SlotPickerProps {
  slug: string
  reloadKey: number
  onSelect: (slot: TimeSlot) => void
}

function SlotPicker({ slug, reloadKey, onSelect }: SlotPickerProps) {
  // Month shown in the calendar; null until the guest navigates (then the active day's month is shown).
  const [month, setMonth] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // The server returns all free slots of the booking window (14 days) in one request.
  // The loaded result is stored with the request it belongs to; a result for another
  // request (before a reload) means the current one is still loading.
  const requestKey = `${slug}|${reloadKey}`
  const [result, setResult] = useState<{ key: string; state: LoadState<TimeSlot[]> } | null>(null)

  useEffect(() => {
    let cancelled = false
    const finish = (state: LoadState<TimeSlot[]>) => {
      if (!cancelled) {
        setResult({ key: requestKey, state })
      }
    }
    publicBookingApi
      .publicBookingListSlots({ slug })
      .then((data) => finish({ status: 'ready', data }))
      .catch(async (e: unknown) => finish({ status: 'error', message: await getErrorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [slug, requestKey])

  const slots = useMemo<LoadState<TimeSlot[]>>(
    () => (result?.key === requestKey ? result.state : { status: 'loading' }),
    [result, requestKey],
  )

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>()
    if (slots.status === 'ready') {
      for (const slot of slots.data) {
        const key = toDateKey(slot.startAt)
        map.set(key, [...(map.get(key) ?? []), slot])
      }
    }
    return map
  }, [slots])

  // Keep the guest's choice if it has slots, otherwise show the first available day of the window.
  const activeDate =
    selectedDate && slotsByDate.has(selectedDate)
      ? selectedDate
      : (slotsByDate.keys().next().value ?? null)
  const daySlots = activeDate ? (slotsByDate.get(activeDate) ?? []) : []
  const today = dayjs().format('YYYY-MM-DD')
  const lastSlotDate = [...slotsByDate.keys()].at(-1) ?? today
  const shownMonth = month ?? dayjs(activeDate ?? today).startOf('month').format('YYYY-MM-DD')

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="xs">
          <Text fw={600}>Выберите дату</Text>
          <DatePicker
            date={shownMonth}
            onDateChange={(date) => setMonth(dayjs(date).startOf('month').format('YYYY-MM-DD'))}
            value={activeDate}
            onChange={setSelectedDate}
            minDate={today}
            maxDate={lastSlotDate}
            excludeDate={(date) => !slotsByDate.has(date)}
            maxLevel="month"
          />
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="xs">
          {slots.status === 'loading' && <Loader size="sm" />}
          {slots.status === 'error' && (
            <Alert color="red" title="Не удалось загрузить слоты">
              {slots.message}
            </Alert>
          )}
          {slots.status === 'ready' && !activeDate && (
            <Text c="dimmed">В ближайшие 14 дней свободного времени нет.</Text>
          )}
          {activeDate && (
            <>
              <Text fw={600}>{formatLongDate(activeDate)}</Text>
              <SimpleGrid cols={2} spacing="xs">
                {daySlots.map((slot) => (
                  <Button key={slot.startAt.toISOString()} variant="outline" onClick={() => onSelect(slot)}>
                    {formatTime(slot.startAt)}
                  </Button>
                ))}
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}

interface GuestFormProps {
  eventType: EventType
  slot: TimeSlot
  onBack: () => void
  onBooked: (booking: GuestBooking) => void
  onConflict: () => void
}

function GuestForm({ eventType, slot, onBack, onBooked, onConflict }: GuestFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    initialValues: { guestName: '', guestEmail: '' },
    validate: {
      guestName: (value) => (value.trim() ? null : 'Введите имя'),
      guestEmail: (value) => (EMAIL_PATTERN.test(value.trim()) ? null : 'Введите корректный email'),
    },
  })

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true)
    setError(null)
    try {
      const booking = await publicBookingApi.publicBookingCreateBooking({
        slug: eventType.slug,
        bookingRequest: {
          startAt: slot.startAt,
          guestName: values.guestName.trim(),
          guestEmail: values.guestEmail.trim(),
        },
      })
      onBooked(booking)
    } catch (e) {
      if (isResponseStatus(e, 409)) {
        onConflict()
        return
      }
      setError(await getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack>
        <Title order={4}>Ваши данные</Title>
        <Card withBorder bg="var(--mantine-color-gray-0)">
          <Text fw={600}>{eventType.title}</Text>
          <Text size="sm">{formatLongDate(slot.startAt)}</Text>
          <Text size="sm">
            {formatTime(slot.startAt)}–{formatTime(slot.endAt)}
          </Text>
        </Card>
        {error && (
          <Alert color="red" title="Не удалось записаться">
            {error}
          </Alert>
        )}
        <TextInput label="Имя" placeholder="Иван Петров" required {...form.getInputProps('guestName')} />
        <TextInput
          label="Email"
          placeholder="ivan@example.com"
          type="email"
          required
          {...form.getInputProps('guestEmail')}
        />
        <Group justify="space-between">
          <Button variant="default" onClick={onBack}>
            Назад
          </Button>
          <Button type="submit" loading={submitting}>
            Записаться
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function Confirmation({ booking, onBookAgain }: { booking: GuestBooking; onBookAgain: () => void }) {
  return (
    <Stack>
      <Title order={3} c="teal">
        Запись подтверждена
      </Title>
      <Text>Будем ждать вас на встрече.</Text>
      <Divider />
      <Stack gap={4}>
        <Text fw={600}>{booking.eventTypeTitle}</Text>
        <Text>{formatLongDate(booking.startAt)}</Text>
        <Text>
          {formatTime(booking.startAt)}–{formatTime(booking.endAt)}
        </Text>
        <Text c="dimmed" size="sm">
          {booking.guestName}, {booking.guestEmail}
        </Text>
      </Stack>
      <Button variant="light" w="fit-content" onClick={onBookAgain}>
        Записаться ещё раз
      </Button>
    </Stack>
  )
}
