import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { EventType } from '../../shared/api/generated'
import { eventTypesApi } from '../../shared/api/client'
import { getErrorMessage, isResponseStatus } from '../../shared/lib/errors'
import { SLUG_PATTERN, slugify } from '../../shared/lib/slug'

interface FormValues {
  title: string
  slug: string
  description: string
  durationMinutes: number | string
}

interface EventTypeFormModalProps {
  opened: boolean
  /** Event type to edit; null to create a new one. */
  eventType: EventType | null
  onClose: () => void
  onSaved: (eventType: EventType) => void
}

export function EventTypeFormModal({ opened, eventType, onClose, onSaved }: EventTypeFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={eventType ? 'Редактирование типа встречи' : 'Новый тип встречи'}
      size="lg"
    >
      {/* Re-mount the form for each opened event type to reset its state. */}
      {opened && (
        <EventTypeForm key={eventType?.id ?? 'new'} eventType={eventType} onCancel={onClose} onSaved={onSaved} />
      )}
    </Modal>
  )
}

interface EventTypeFormProps {
  eventType: EventType | null
  onCancel: () => void
  onSaved: (eventType: EventType) => void
}

function EventTypeForm({ eventType, onCancel, onSaved }: EventTypeFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // When creating, the slug follows the title until the user edits it manually.
  const [slugTouched, setSlugTouched] = useState(eventType !== null)

  const form = useForm<FormValues>({
    initialValues: {
      title: eventType?.title ?? '',
      slug: eventType?.slug ?? '',
      description: eventType?.description ?? '',
      durationMinutes: eventType?.durationMinutes ?? 30,
    },
    validate: {
      title: (value) => (value.trim() ? null : 'Введите название'),
      slug: (value) =>
        SLUG_PATTERN.test(value) ? null : 'Только латинские буквы в нижнем регистре, цифры и дефисы',
      durationMinutes: (value) => {
        const minutes = Number(value)
        return Number.isInteger(minutes) && minutes >= 5 && minutes <= 720
          ? null
          : 'От 5 до 720 минут'
      },
    },
  })

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setError(null)
    const payload = {
      title: values.title.trim(),
      slug: values.slug,
      description: values.description.trim() || undefined,
      durationMinutes: Number(values.durationMinutes),
    }
    try {
      const saved = eventType
        ? await eventTypesApi.eventTypesUpdate({ id: eventType.id, eventTypeInput: payload })
        : await eventTypesApi.eventTypesCreate({ eventTypeInput: payload })
      onSaved(saved)
    } catch (e) {
      const message = await getErrorMessage(e)
      if (isResponseStatus(e, 409)) {
        form.setFieldError('slug', 'Такая ссылка уже используется')
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack>
        {error && (
          <Alert color="red" title="Не удалось сохранить">
            {error}
          </Alert>
        )}
        <TextInput
          label="Название"
          placeholder="Консультация"
          required
          {...form.getInputProps('title')}
          onChange={(event) => {
            const title = event.currentTarget.value
            form.setFieldValue('title', title)
            if (!slugTouched) {
              form.setFieldValue('slug', slugify(title))
            }
          }}
        />
        <TextInput
          label="Ссылка"
          description="Адрес публичной страницы записи: /book/<ссылка>"
          placeholder="konsultatsiya"
          required
          {...form.getInputProps('slug')}
          onChange={(event) => {
            setSlugTouched(true)
            form.setFieldValue('slug', event.currentTarget.value)
          }}
        />
        <Textarea
          label="Описание"
          placeholder="Что обсудим на встрече"
          autosize
          minRows={2}
          maxLength={2000}
          {...form.getInputProps('description')}
        />
        <NumberInput
          label="Длительность, минут"
          required
          min={5}
          max={720}
          step={5}
          allowDecimal={false}
          {...form.getInputProps('durationMinutes')}
        />
        <Group justify="flex-end">
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
