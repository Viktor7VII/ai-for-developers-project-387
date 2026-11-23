import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, renderApp } from '../../test/render'

const { eventTypesApi } = vi.hoisted(() => ({
  eventTypesApi: {
    eventTypesList: vi.fn(),
    eventTypesCreate: vi.fn(),
    eventTypesUpdate: vi.fn(),
    eventTypesDelete: vi.fn(),
  },
}))

vi.mock('../../shared/api/client', () => ({ eventTypesApi }))

const consultation = {
  id: 1,
  slug: 'consultation',
  title: 'Консультация',
  description: 'Обсудим ваш проект',
  durationMinutes: 30,
}

describe('EventTypesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects from /admin and shows admin navigation', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([])
    renderApp('/admin')

    expect(await screen.findByRole('heading', { name: 'Типы встреч' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Типы встреч' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Расписание' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Записи' })).toBeInTheDocument()
    expect(await screen.findByText(/Пока нет ни одного типа встречи/)).toBeInTheDocument()
  })

  it('lists event types with public links', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([consultation])
    renderApp('/admin/event-types')

    expect(await screen.findByText('Консультация')).toBeInTheDocument()
    expect(screen.getByText('30 мин')).toBeInTheDocument()
    expect(screen.getByText('Обсудим ваш проект')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '/book/consultation' })).toHaveAttribute(
      'href',
      '/book/consultation',
    )
    expect(screen.getByRole('button', { name: 'Скопировать ссылку' })).toBeInTheDocument()
  })

  it('creates an event type with a slug generated from the title', async () => {
    eventTypesApi.eventTypesList.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { ...consultation, slug: 'konsultatsiya', description: undefined },
    ])
    eventTypesApi.eventTypesCreate.mockResolvedValue({ ...consultation, slug: 'konsultatsiya' })
    const { user } = renderApp('/admin/event-types')

    await user.click(await screen.findByRole('button', { name: 'Новый тип встречи' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Название/), 'Консультация')
    expect(within(dialog).getByLabelText(/Ссылка/)).toHaveValue('konsultatsiya')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(eventTypesApi.eventTypesCreate).toHaveBeenCalledWith({
        eventTypeInput: {
          title: 'Консультация',
          slug: 'konsultatsiya',
          description: undefined,
          durationMinutes: 30,
        },
      }),
    )
    expect(await screen.findByText('/book/konsultatsiya')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('validates the form before sending', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([])
    const { user } = renderApp('/admin/event-types')

    await user.click(await screen.findByRole('button', { name: 'Новый тип встречи' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Ссылка/), 'Bad Slug')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(within(dialog).getByText('Введите название')).toBeInTheDocument()
    expect(within(dialog).getByText(/Только латинские буквы/)).toBeInTheDocument()
    expect(eventTypesApi.eventTypesCreate).not.toHaveBeenCalled()
  })

  it('shows a slug error when the slug is already taken', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([])
    eventTypesApi.eventTypesCreate.mockRejectedValue(apiError(409, 'already exists'))
    const { user } = renderApp('/admin/event-types')

    await user.click(await screen.findByRole('button', { name: 'Новый тип встречи' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Название/), 'Consultation')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(await within(dialog).findByText('Такая ссылка уже используется')).toBeInTheDocument()
  })

  it('edits an existing event type', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([consultation])
    eventTypesApi.eventTypesUpdate.mockResolvedValue({ ...consultation, durationMinutes: 45 })
    const { user } = renderApp('/admin/event-types')

    await user.click(await screen.findByRole('button', { name: 'Изменить' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText(/Ссылка/)).toHaveValue('consultation')
    const duration = within(dialog).getByLabelText(/Длительность/)
    await user.clear(duration)
    await user.type(duration, '45')
    // Changing the title must not change the slug of an existing event type.
    await user.type(within(dialog).getByLabelText(/Название/), '!')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(eventTypesApi.eventTypesUpdate).toHaveBeenCalledWith({
        id: 1,
        eventTypeInput: {
          title: 'Консультация!',
          slug: 'consultation',
          description: 'Обсудим ваш проект',
          durationMinutes: 45,
        },
      }),
    )
  })

  it('shows an error when the list cannot be loaded', async () => {
    eventTypesApi.eventTypesList.mockRejectedValue(apiError(500, 'Boom'))
    renderApp('/admin/event-types')

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })

  it('deletes an event type after confirmation', async () => {
    eventTypesApi.eventTypesList.mockResolvedValueOnce([consultation]).mockResolvedValueOnce([])
    eventTypesApi.eventTypesDelete.mockResolvedValue(undefined)
    const { user } = renderApp('/admin/event-types')

    await user.click(await screen.findByRole('button', { name: 'Удалить' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Консультация/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }))

    await waitFor(() => expect(eventTypesApi.eventTypesDelete).toHaveBeenCalledWith({ id: 1 }))
    expect(await screen.findByText(/Пока нет ни одного типа встречи/)).toBeInTheDocument()
  })

  it('explains why an event type with bookings cannot be deleted', async () => {
    eventTypesApi.eventTypesList.mockResolvedValue([consultation])
    eventTypesApi.eventTypesDelete.mockRejectedValue(apiError(409, 'Event type 1 has bookings'))
    const { user } = renderApp('/admin/event-types')

    await user.click(await screen.findByRole('button', { name: 'Удалить' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))

    expect(await screen.findByText(/по нему уже есть записи/)).toBeInTheDocument()
    expect(screen.getByText('Консультация')).toBeInTheDocument()
  })
})
