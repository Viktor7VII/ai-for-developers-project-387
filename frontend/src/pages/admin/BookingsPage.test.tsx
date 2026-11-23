import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../test/render'

const { bookingsApi } = vi.hoisted(() => ({
  bookingsApi: { bookingsList: vi.fn() },
}))

vi.mock('../../shared/api/client', () => ({ bookingsApi }))

function booking(id: number, startAt: string, endAt: string, guestName: string) {
  return {
    id,
    eventTypeId: 1,
    eventTypeTitle: 'Консультация',
    guestName,
    guestEmail: `${guestName.toLowerCase()}@example.com`,
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    status: 'CONFIRMED',
    createdAt: new Date('2026-11-01T00:00:00Z'),
  }
}

describe('BookingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'))
  })

  it('shows upcoming and past bookings', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(1, '2026-11-10T09:00:00Z', '2026-11-10T09:30:00Z', 'Past'),
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'),
      booking(3, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', 'Boris'),
    ])
    renderApp('/admin/bookings')

    expect(await screen.findByRole('heading', { name: 'Предстоящие' })).toBeInTheDocument()
    const [upcomingTable, pastTable] = screen.getAllByRole('table')

    const upcomingRows = within(upcomingTable).getAllByRole('row').slice(1)
    expect(upcomingRows).toHaveLength(2)
    expect(within(upcomingRows[0]).getByText('16.11.2026')).toBeInTheDocument()
    expect(within(upcomingRows[0]).getByText('09:00–09:30')).toBeInTheDocument()
    expect(within(upcomingRows[0]).getByText('Консультация')).toBeInTheDocument()
    expect(within(upcomingRows[0]).getByText('Anna')).toBeInTheDocument()
    expect(within(upcomingRows[0]).getByText('anna@example.com')).toBeInTheDocument()
    expect(within(upcomingRows[0]).getByText('Подтверждена')).toBeInTheDocument()
    expect(within(upcomingRows[1]).getByText('Boris')).toBeInTheDocument()

    expect(within(pastTable).getByText('Past')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    bookingsApi.bookingsList.mockResolvedValue([])
    renderApp('/admin/bookings')

    expect(await screen.findByText('Предстоящих записей нет.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
