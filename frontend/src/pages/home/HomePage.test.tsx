import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, renderApp } from '../../test/render'

const { eventTypesApi, publicBookingApi } = vi.hoisted(() => ({
  eventTypesApi: { eventTypesList: vi.fn() },
  publicBookingApi: {
    publicBookingGetEventType: vi.fn(),
    publicBookingListSlots: vi.fn(),
  },
}))

vi.mock('../../shared/api/client', () => ({ eventTypesApi, publicBookingApi }))

const consultation = {
  id: 1,
  slug: 'consultation',
  title: 'Консультация',
  description: 'Обсудим ваш проект',
  durationMinutes: 30,
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows event types with links to their booking pages', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([consultation])
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Консультация' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute(
      'href',
      '/book/consultation',
    )
  })

  it('leads the guest to the booking page of the chosen event type', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([consultation])
    publicBookingApi.publicBookingGetEventType.mockResolvedValue(consultation)
    publicBookingApi.publicBookingListSlots.mockResolvedValue([])
    const { user } = renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Записаться' }))

    expect(await screen.findByText('Выберите дату')).toBeInTheDocument()
    expect(publicBookingApi.publicBookingGetEventType).toHaveBeenCalledWith({ slug: 'consultation' })
  })

  it('shows duration and description of each event type', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([
      consultation,
      { id: 2, slug: 'strategy', title: 'Стратегическая сессия', durationMinutes: 90 },
    ])
    renderApp('/')

    expect(await screen.findByText('30 мин')).toBeInTheDocument()
    expect(screen.getByText('Обсудим ваш проект')).toBeInTheDocument()
    expect(screen.getByText('1 ч 30 мин')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Записаться' }).map((link) => link.getAttribute('href'))).toEqual([
      '/book/consultation',
      '/book/strategy',
    ])
  })

  it('shows a loading indicator until event types arrive', async () => {
    let resolveList: (eventTypes: (typeof consultation)[]) => void = () => {}
    eventTypesApi.eventTypesList.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve
      }),
    )
    renderApp('/')

    expect(screen.getByRole('status', { name: 'Загрузка типов встреч' })).toBeInTheDocument()
    expect(screen.queryByText('Владелец пока не открыл запись.')).not.toBeInTheDocument()

    resolveList([consultation])

    expect(await screen.findByRole('heading', { name: 'Консультация' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Загрузка типов встреч' })).not.toBeInTheDocument()
  })

  it('tells the guest when the owner has no event types yet', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([])
    renderApp('/')

    expect(await screen.findByText('Владелец пока не открыл запись.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Записаться' })).not.toBeInTheDocument()
  })

  it('shows an error when event types cannot be loaded', async () => {
    eventTypesApi.eventTypesList.mockRejectedValue(apiError(500, 'Boom'))
    renderApp('/')

    expect(await screen.findByText('Boom')).toBeInTheDocument()
    expect(screen.getByText('Не удалось загрузить типы встреч')).toBeInTheDocument()
    expect(screen.queryByText('Владелец пока не открыл запись.')).not.toBeInTheDocument()
  })

  it('introduces the service and links to the owner area', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([consultation])
    renderApp('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Календарь звонков' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Выберите тип встречи и запишитесь на удобное время — регистрация не нужна.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Кабинет владельца' })).toHaveAttribute('href', '/admin')
  })
})
