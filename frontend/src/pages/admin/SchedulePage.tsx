import {
  Alert,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { TimeInput } from '@mantine/dates'
import { useEffect, useMemo, useState } from 'react'
import { scheduleApi } from '../../shared/api/client'
import { DayOfWeek, type Schedule } from '../../shared/api/generated'
import { browserTimeZone } from '../../shared/lib/datetime'
import { getErrorMessage } from '../../shared/lib/errors'

const DAYS: { day: DayOfWeek; label: string }[] = [
  { day: DayOfWeek.Monday, label: 'Понедельник' },
  { day: DayOfWeek.Tuesday, label: 'Вторник' },
  { day: DayOfWeek.Wednesday, label: 'Среда' },
  { day: DayOfWeek.Thursday, label: 'Четверг' },
  { day: DayOfWeek.Friday, label: 'Пятница' },
  { day: DayOfWeek.Saturday, label: 'Суббота' },
  { day: DayOfWeek.Sunday, label: 'Воскресенье' },
]

interface TimeRange {
  startTime: string
  endTime: string
}

type WeekIntervals = Record<DayOfWeek, TimeRange[]>

const DEFAULT_RANGE: TimeRange = { startTime: '09:00', endTime: '17:00' }

function emptyWeek(): WeekIntervals {
  return Object.fromEntries(DAYS.map(({ day }) => [day, []])) as unknown as WeekIntervals
}

function toWeek(schedule: Schedule): WeekIntervals {
  const week = emptyWeek()
  for (const interval of schedule.intervals) {
    week[interval.dayOfWeek].push({ startTime: interval.startTime, endTime: interval.endTime })
  }
  return week
}

function toIntervals(week: WeekIntervals): Schedule['intervals'] {
  return DAYS.flatMap(({ day }) => week[day].map((range) => ({ dayOfWeek: day, ...range })))
}

/** Client-side check for obviously wrong ranges; overlaps are validated by the server. */
function findInvalidRange(week: WeekIntervals): string | null {
  for (const { day, label } of DAYS) {
    for (const range of week[day]) {
      if (!range.startTime || !range.endTime) {
        return `${label}: укажите время начала и окончания`
      }
      if (range.startTime >= range.endTime) {
        return `${label}: время окончания должно быть позже времени начала (${range.startTime}–${range.endTime})`
      }
    }
  }
  return null
}

function timeZoneOptions(current: string): string[] {
  const zones = new Set(Intl.supportedValuesOf('timeZone'))
  zones.add('UTC')
  zones.add(current)
  zones.add(browserTimeZone())
  return [...zones].sort()
}

export function SchedulePage() {
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [week, setWeek] = useState<WeekIntervals>(emptyWeek)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    scheduleApi
      .schedulesGet()
      .then((schedule) => {
        setTimeZone(schedule.timeZone)
        setWeek(toWeek(schedule))
      })
      .catch(async (e: unknown) => setLoadError(await getErrorMessage(e)))
  }, [])

  const zones = useMemo(() => timeZoneOptions(timeZone ?? 'UTC'), [timeZone])
  const myTimeZone = browserTimeZone()

  const updateDay = (day: DayOfWeek, ranges: TimeRange[]) => {
    setSaved(false)
    setWeek((current) => ({ ...current, [day]: ranges }))
  }

  const updateRange = (day: DayOfWeek, index: number, patch: Partial<TimeRange>) => {
    updateDay(
      day,
      week[day].map((range, i) => (i === index ? { ...range, ...patch } : range)),
    )
  }

  const addRange = (day: DayOfWeek) => {
    const ranges = week[day]
    const last = ranges.at(-1)
    // A new range after the last one, e.g. 18:00-19:00 after 09:00-17:00.
    const next = last && last.endTime < '23:00'
      ? { startTime: addHour(last.endTime), endTime: addHour(addHour(last.endTime)) }
      : DEFAULT_RANGE
    updateDay(day, [...ranges, next])
  }

  const handleSave = async () => {
    if (!timeZone) {
      return
    }
    const invalid = findInvalidRange(week)
    if (invalid) {
      setSaveError(invalid)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const schedule = await scheduleApi.schedulesUpdate({
        schedule: { timeZone, intervals: toIntervals(week) },
      })
      setTimeZone(schedule.timeZone)
      setWeek(toWeek(schedule))
      setSaved(true)
    } catch (e) {
      setSaveError(await getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <Alert color="red" title="Не удалось загрузить расписание">
        {loadError}
      </Alert>
    )
  }

  if (timeZone === null) {
    return <Loader />
  }

  return (
    <Stack maw={720}>
      <Title order={2}>Расписание</Title>
      <Text c="dimmed" size="sm">
        Дни и часы, когда вы готовы проводить встречи. Изменения не затрагивают уже созданные записи.
      </Text>

      <Card withBorder>
        <Stack gap="xs">
          <Select
            label="Часовой пояс"
            data={zones}
            value={timeZone}
            onChange={(value) => {
              if (value) {
                setSaved(false)
                setTimeZone(value)
              }
            }}
            searchable
            allowDeselect={false}
            maxDropdownHeight={280}
          />
          {timeZone !== myTimeZone && (
            <Button
              variant="subtle"
              size="compact-sm"
              w="fit-content"
              onClick={() => {
                setSaved(false)
                setTimeZone(myTimeZone)
              }}
            >
              Использовать мой часовой пояс ({myTimeZone})
            </Button>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="md">
          {DAYS.map(({ day, label }) => {
            const ranges = week[day]
            return (
              <Group key={day} align="flex-start" wrap="nowrap">
                <Checkbox
                  label={label}
                  checked={ranges.length > 0}
                  onChange={(event) =>
                    updateDay(day, event.currentTarget.checked ? [DEFAULT_RANGE] : [])
                  }
                  w={150}
                  mt={8}
                />
                {ranges.length === 0 ? (
                  <Text c="dimmed" size="sm" mt={8}>
                    Недоступен
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {ranges.map((range, index) => (
                      <Group key={index} gap="xs" wrap="nowrap">
                        <TimeInput
                          aria-label={`${label}: начало интервала ${index + 1}`}
                          value={range.startTime}
                          onChange={(event) =>
                            updateRange(day, index, { startTime: event.currentTarget.value })
                          }
                        />
                        <Text>—</Text>
                        <TimeInput
                          aria-label={`${label}: конец интервала ${index + 1}`}
                          value={range.endTime}
                          onChange={(event) =>
                            updateRange(day, index, { endTime: event.currentTarget.value })
                          }
                        />
                        <CloseButton
                          aria-label={`${label}: удалить интервал ${index + 1}`}
                          onClick={() => updateDay(day, ranges.filter((_, i) => i !== index))}
                        />
                      </Group>
                    ))}
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      w="fit-content"
                      onClick={() => addRange(day)}
                    >
                      + Добавить интервал
                    </Button>
                  </Stack>
                )}
              </Group>
            )
          })}
        </Stack>
      </Card>

      {saveError && (
        <Alert color="red" title="Не удалось сохранить расписание">
          {saveError}
        </Alert>
      )}
      {saved && <Alert color="teal">Расписание сохранено</Alert>}

      <Group>
        <Button onClick={handleSave} loading={saving}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  )
}

function addHour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const next = Math.min(hours + 1, 23)
  return `${String(next).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
