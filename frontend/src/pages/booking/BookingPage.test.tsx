import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, renderApp } from '../../test/render'

const { publicBookingApi } = vi.hoisted(() => ({
  publicBookingApi: {
    publicBookingGetEventType: vi.fn(),
    publicBookingListSlots: vi.fn(),
    publicBookingCreateBooking: vi.fn(),
  },
}))

vi.mock('../../shared/api/client', () => ({ publicBookingApi }))

// Tests run in UTC (see vite.config.ts), so local times equal UTC times.
const NOW = new Date('2026-11-15T12:00:00Z')

const eventType = {
  id: 1,
  slug: 'consultation',
  title: 'Консультация',
  description: 'Обсудим ваш проект',
  durationMinutes: 30,
}

function slot(startAt: string, endAt: string) {
  return { startAt: new Date(startAt), endAt: new Date(endAt) }
}

const SLOTS = [
  slot('2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z'),
  slot('2026-11-16T09:30:00Z', '2026-11-16T10:00:00Z'),
  slot('2026-11-17T10:00:00Z', '2026-11-17T10:30:00Z'),
]

describe('BookingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    publicBookingApi.publicBookingGetEventType.mockResolvedValue(eventType)
    publicBookingApi.publicBookingListSlots.mockResolvedValue(SLOTS)
  })

  it('shows event type and free time of the first available day', async () => {
    renderApp('/book/consultation')

    expect(await screen.findByRole('heading', { name: 'Консультация' })).toBeInTheDocument()
    expect(screen.getByText('30 мин')).toBeInTheDocument()
    expect(screen.getByText('Обсудим ваш проект')).toBeInTheDocument()
    expect(await screen.findByText('16 ноября 2026, понедельник')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '09:30' })).toBeInTheDocument()
    // 10:00 belongs to another day.
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument()

    // The whole booking window is requested at once; the server computes it.
    expect(publicBookingApi.publicBookingListSlots).toHaveBeenCalledTimes(1)
    expect(publicBookingApi.publicBookingListSlots).toHaveBeenCalledWith({ slug: 'consultation' })
  })

  it('books a slot and shows the confirmation', async () => {
    publicBookingApi.publicBookingCreateBooking.mockResolvedValue({
      id: 10,
      eventTypeId: 1,
      eventTypeTitle: 'Консультация',
      guestName: 'Иван Петров',
      guestEmail: 'ivan@example.com',
      startAt: SLOTS[1].startAt,
      endAt: SLOTS[1].endAt,
      status: 'CONFIRMED',
      createdAt: NOW,
    })
    const { user } = renderApp('/book/consultation')

    await user.click(await screen.findByRole('button', { name: '09:30' }))
    expect(screen.getByText('09:30–10:00')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Имя/), '  Иван Петров ')
    await user.type(screen.getByLabelText(/Email/), 'ivan@example.com')
    await user.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(await screen.findByRole('heading', { name: 'Запись подтверждена' })).toBeInTheDocument()
    expect(publicBookingApi.publicBookingCreateBooking).toHaveBeenCalledWith({
      slug: 'consultation',
      bookingRequest: {
        startAt: SLOTS[1].startAt,
        guestName: 'Иван Петров',
        guestEmail: 'ivan@example.com',
      },
    })
    expect(screen.getByText('16 ноября 2026, понедельник')).toBeInTheDocument()
    expect(screen.getByText('Иван Петров, ivan@example.com')).toBeInTheDocument()
  })

  it('validates guest data', async () => {
    const { user } = renderApp('/book/consultation')

    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.type(screen.getByLabelText(/Email/), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(screen.getByText('Введите имя')).toBeInTheDocument()
    expect(screen.getByText('Введите корректный email')).toBeInTheDocument()
    expect(publicBookingApi.publicBookingCreateBooking).not.toHaveBeenCalled()
  })

  it('returns to slot selection when the slot was taken', async () => {
    publicBookingApi.publicBookingCreateBooking.mockRejectedValue(apiError(409, 'not available'))
    publicBookingApi.publicBookingListSlots
      .mockResolvedValueOnce(SLOTS)
      .mockResolvedValueOnce(SLOTS.slice(1))
    const { user } = renderApp('/book/consultation')

    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.type(screen.getByLabelText(/Имя/), 'Иван')
    await user.type(screen.getByLabelText(/Email/), 'ivan@example.com')
    await user.click(screen.getByRole('button', { name: 'Записаться' }))

    expect(await screen.findByText('Это время уже занято')).toBeInTheDocument()
    await waitFor(() => expect(publicBookingApi.publicBookingListSlots).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: '09:30' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '09:00' })).not.toBeInTheDocument()
  })

  it('goes back from the form to slot selection', async () => {
    const { user } = renderApp('/book/consultation')

    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.click(screen.getByRole('button', { name: 'Назад' }))

    expect(screen.getByRole('button', { name: '09:30' })).toBeInTheDocument()
  })

  it('shows a message when there is no free time in the booking window', async () => {
    publicBookingApi.publicBookingListSlots.mockResolvedValue([])
    renderApp('/book/consultation')

    expect(await screen.findByText(/В ближайшие 14 дней свободного времени нет/)).toBeInTheDocument()
  })

  it('shows not found for an unknown event type', async () => {
    publicBookingApi.publicBookingGetEventType.mockRejectedValue(apiError(404, 'not found'))
    renderApp('/book/unknown')

    expect(await screen.findByRole('heading', { name: 'Тип встречи не найден' })).toBeInTheDocument()
    expect(publicBookingApi.publicBookingListSlots).not.toHaveBeenCalled()
  })
})
