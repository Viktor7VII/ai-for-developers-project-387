import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, renderApp } from '../../test/render'

const { bookingsApi } = vi.hoisted(() => ({
  bookingsApi: { bookingsList: vi.fn(), bookingsSetNote: vi.fn() },
}))

vi.mock('../../shared/api/client', () => ({ bookingsApi }))

function booking(id: number, startAt: string, endAt: string, guestName: string, note?: string) {
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
    note,
  }
}

/** Cell of the given column in the given row. */
function columnCell(table: HTMLElement, row: HTMLElement, column: string) {
  const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent)
  return within(row).getAllByRole('cell')[headers.indexOf(column)]
}

/** Cell of the "Заметка" column in the given row. */
function noteCell(table: HTMLElement, row: HTMLElement) {
  return columnCell(table, row, 'Заметка')
}

function rowOf(table: HTMLElement, guestName: string) {
  return within(table).getByText(guestName).closest('tr') as HTMLElement
}

/** Accessible name of the "add note" button for Anna's booking on 16.11.2026 at 09:00 (UTC in tests). */
const ADD_NOTE_ANNA = 'Добавить заметку: Anna, 16.11.2026 09:00'

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

  it('shows notes in a separate column and leaves the cell empty without a note', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(1, '2026-11-10T09:00:00Z', '2026-11-10T09:30:00Z', 'Past', 'Итоги встречи'),
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', 'Обсудить бюджет'),
      booking(3, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', 'Boris'),
    ])
    renderApp('/admin/bookings')

    await screen.findByRole('heading', { name: 'Предстоящие' })
    const [upcomingTable, pastTable] = screen.getAllByRole('table')

    expect(within(upcomingTable).getByRole('columnheader', { name: 'Заметка' })).toBeInTheDocument()
    expect(noteCell(upcomingTable, rowOf(upcomingTable, 'Anna'))).toHaveTextContent('Обсудить бюджет')
    expect(noteCell(upcomingTable, rowOf(upcomingTable, 'Boris'))).toBeEmptyDOMElement()
    expect(noteCell(pastTable, rowOf(pastTable, 'Past'))).toHaveTextContent('Итоги встречи')
  })

  it('shows the guest topic in its own column, separate from the note', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      { ...booking(1, '2026-11-10T09:00:00Z', '2026-11-10T09:30:00Z', 'Past'), topic: 'Итоги проекта' },
      { ...booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', 'Моя заметка'), topic: 'Бюджет' },
      booking(3, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', 'Boris'),
    ])
    renderApp('/admin/bookings')

    await screen.findByRole('heading', { name: 'Предстоящие' })
    const [upcomingTable, pastTable] = screen.getAllByRole('table')

    expect(within(upcomingTable).getByRole('columnheader', { name: 'Тема' })).toBeInTheDocument()
    expect(columnCell(upcomingTable, rowOf(upcomingTable, 'Anna'), 'Тема')).toHaveTextContent('Бюджет')
    expect(noteCell(upcomingTable, rowOf(upcomingTable, 'Anna'))).toHaveTextContent('Моя заметка')
    expect(columnCell(upcomingTable, rowOf(upcomingTable, 'Boris'), 'Тема')).toBeEmptyDOMElement()
    expect(columnCell(pastTable, rowOf(pastTable, 'Past'), 'Тема')).toHaveTextContent('Итоги проекта')
  })

  describe('guest topic', () => {
    const longTopic = 'Хочу обсудить интеграцию с CRM и сроки. '.repeat(25).trim()

    function withTopic(id: number, startAt: string, endAt: string, guestName: string, topic: string, note?: string) {
      return { ...booking(id, startAt, endAt, guestName, note), topic }
    }

    it('clamps a long topic in the cell and opens the full text in a read-only modal', async () => {
      bookingsApi.bookingsList.mockResolvedValue([
        withTopic(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', longTopic),
      ])
      const { user } = renderApp('/admin/bookings')

      const table = (await screen.findAllByRole('table'))[0]
      const clamped = within(columnCell(table, rowOf(table, 'Anna'), 'Тема')).getByText(longTopic)
      expect(clamped).toHaveAttribute('data-line-clamp')
      expect(clamped.style.getPropertyValue('--text-line-clamp')).toBe('2')

      await user.click(screen.getByRole('button', { name: 'Показать тему разговора: Anna, 16.11.2026 09:00' }))
      const dialog = await screen.findByRole('dialog', { name: 'Тема разговора' })
      expect(within(dialog).getByText(longTopic)).not.toHaveAttribute('data-line-clamp')
      expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Закрыть' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('gives each topic a unique accessible name and nothing to open without a topic', async () => {
      bookingsApi.bookingsList.mockResolvedValue([
        withTopic(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', 'Бюджет'),
        withTopic(3, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', 'Boris', 'Сроки'),
        booking(4, '2026-11-18T10:00:00Z', '2026-11-18T10:30:00Z', 'Clara'),
      ])
      renderApp('/admin/bookings')

      const table = (await screen.findAllByRole('table'))[0]
      expect(
        within(table)
          .getAllByRole('button', { name: /^Показать тему разговора: / })
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(['Показать тему разговора: Anna, 16.11.2026 09:00', 'Показать тему разговора: Boris, 17.11.2026 10:00'])
      const claraTopic = columnCell(table, rowOf(table, 'Clara'), 'Тема')
      expect(claraTopic).toBeEmptyDOMElement()
    })

    it('does not show the topic in the note modal', async () => {
      bookingsApi.bookingsList.mockResolvedValue([
        withTopic(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', 'Тема гостя', 'Моя заметка'),
      ])
      const { user } = renderApp('/admin/bookings')

      const table = (await screen.findAllByRole('table'))[0]
      await user.click(within(rowOf(table, 'Anna')).getByRole('button', { name: 'Изменить заметку: Anna, 16.11.2026 09:00' }))
      const dialog = await screen.findByRole('dialog', { name: 'Заметка к записи' })
      expect(within(dialog).getByLabelText('Заметка')).toHaveValue('Моя заметка')
      expect(within(dialog).queryByText('Тема гостя')).not.toBeInTheDocument()
    })
  })

  it('gives each "add note" button a unique accessible name with the guest and time', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'),
      booking(3, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z', 'Boris'),
    ])
    renderApp('/admin/bookings')

    const table = (await screen.findAllByRole('table'))[0]
    const buttons = within(table).getAllByRole('button', { name: /^Добавить заметку: / })
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      ADD_NOTE_ANNA,
      'Добавить заметку: Boris, 17.11.2026 10:00',
    ])
    expect(buttons[0]).toHaveTextContent('Добавить заметку')
  })

  it('adds a note to an upcoming booking in a modal', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'),
    ])
    bookingsApi.bookingsSetNote.mockResolvedValue(
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', 'Обсудить бюджет'),
    )
    const { user } = renderApp('/admin/bookings')

    const table = (await screen.findAllByRole('table'))[0]
    await user.click(within(rowOf(table, 'Anna')).getByRole('button', { name: ADD_NOTE_ANNA }))

    const dialog = await screen.findByRole('dialog', { name: 'Заметка к записи' })
    expect(within(dialog).getByText('0 / 1000')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Заметка'), ' Обсудить бюджет ')
    expect(within(dialog).getByText('15 / 1000')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(bookingsApi.bookingsSetNote).toHaveBeenCalledWith({
      id: 2,
      bookingNoteInput: { note: ' Обсудить бюджет ' },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const row = rowOf(screen.getAllByRole('table')[0], 'Anna')
    expect(noteCell(screen.getAllByRole('table')[0], row)).toHaveTextContent('Обсудить бюджет')
    expect(within(row).queryByRole('button', { name: /Добавить заметку/ })).not.toBeInTheDocument()
  })

  it('adds a note to a past booking', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(1, '2026-11-10T09:00:00Z', '2026-11-10T09:30:00Z', 'Past'),
    ])
    bookingsApi.bookingsSetNote.mockResolvedValue(
      booking(1, '2026-11-10T09:00:00Z', '2026-11-10T09:30:00Z', 'Past', 'Итоги встречи'),
    )
    const { user } = renderApp('/admin/bookings')

    await screen.findByRole('heading', { name: 'Прошедшие' })
    const pastTable = screen.getByRole('table')
    await user.click(
      within(rowOf(pastTable, 'Past')).getByRole('button', { name: 'Добавить заметку: Past, 10.11.2026 09:00' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Заметка к записи' })
    await user.type(within(dialog).getByLabelText('Заметка'), 'Итоги встречи')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(noteCell(screen.getByRole('table'), rowOf(screen.getByRole('table'), 'Past'))).toHaveTextContent(
        'Итоги встречи',
      ),
    )
    expect(bookingsApi.bookingsSetNote).toHaveBeenCalledWith({ id: 1, bookingNoteInput: { note: 'Итоги встречи' } })
  })

  it('does not send an empty or too long note', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'),
    ])
    const { user } = renderApp('/admin/bookings')

    const table = (await screen.findAllByRole('table'))[0]
    await user.click(within(rowOf(table, 'Anna')).getByRole('button', { name: ADD_NOTE_ANNA }))
    const dialog = await screen.findByRole('dialog', { name: 'Заметка к записи' })

    await user.type(within(dialog).getByLabelText('Заметка'), '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(await within(dialog).findByText('Введите заметку')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Заметка'))
    await user.click(within(dialog).getByLabelText('Заметка'))
    await user.paste('a'.repeat(1001))
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(await within(dialog).findByText('Не больше 1000 символов')).toBeInTheDocument()

    expect(bookingsApi.bookingsSetNote).not.toHaveBeenCalled()
  })

  it('shows a server error in the modal and keeps the entered note', async () => {
    bookingsApi.bookingsList.mockResolvedValue([
      booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'),
    ])
    bookingsApi.bookingsSetNote.mockRejectedValue(apiError(404, 'Booking 2 not found'))
    const { user } = renderApp('/admin/bookings')

    const table = (await screen.findAllByRole('table'))[0]
    await user.click(within(rowOf(table, 'Anna')).getByRole('button', { name: ADD_NOTE_ANNA }))
    const dialog = await screen.findByRole('dialog', { name: 'Заметка к записи' })
    await user.type(within(dialog).getByLabelText('Заметка'), 'Обсудить бюджет')
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(await within(dialog).findByText('Не удалось сохранить заметку')).toBeInTheDocument()
    expect(within(dialog).getByText('Booking 2 not found')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Заметка')).toHaveValue('Обсудить бюджет')
    expect(noteCell(screen.getAllByRole('table')[0], rowOf(screen.getAllByRole('table')[0], 'Anna'))).toBeEmptyDOMElement()
  })

  describe('existing note', () => {
    const EDIT_NOTE_ANNA = 'Изменить заметку: Anna, 16.11.2026 09:00'

    function withNote(note: string) {
      return booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna', note)
    }

    async function openEditModal(note: string) {
      bookingsApi.bookingsList.mockResolvedValue([withNote(note)])
      const { user } = renderApp('/admin/bookings')
      const table = (await screen.findAllByRole('table'))[0]
      await user.click(within(rowOf(table, 'Anna')).getByRole('button', { name: EDIT_NOTE_ANNA }))
      const dialog = await screen.findByRole('dialog', { name: 'Заметка к записи' })
      return { user, dialog, field: within(dialog).getByLabelText('Заметка') }
    }

    function annaNoteCell() {
      const table = screen.getAllByRole('table')[0]
      return noteCell(table, rowOf(table, 'Anna'))
    }

    it('changes the note in the modal that shows its full text', async () => {
      bookingsApi.bookingsSetNote.mockResolvedValue(withNote('Новая заметка'))
      const { user, dialog, field } = await openEditModal('Старая заметка')

      expect(field).toHaveValue('Старая заметка')
      await user.clear(field)
      await user.type(field, 'Новая заметка')
      await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

      expect(bookingsApi.bookingsSetNote).toHaveBeenCalledWith({ id: 2, bookingNoteInput: { note: 'Новая заметка' } })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(annaNoteCell()).toHaveTextContent('Новая заметка')
    })

    it('removes the note with the delete button', async () => {
      bookingsApi.bookingsSetNote.mockResolvedValue(booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'))
      const { user, dialog } = await openEditModal('Старая заметка')

      await user.click(within(dialog).getByRole('button', { name: 'Удалить заметку' }))

      expect(bookingsApi.bookingsSetNote).toHaveBeenCalledWith({ id: 2, bookingNoteInput: { note: '' } })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(annaNoteCell()).toBeEmptyDOMElement()
      expect(screen.getByRole('button', { name: ADD_NOTE_ANNA })).toBeInTheDocument()
    })

    it('removes the note when it is saved blank', async () => {
      bookingsApi.bookingsSetNote.mockResolvedValue(booking(2, '2026-11-16T09:00:00Z', '2026-11-16T09:30:00Z', 'Anna'))
      const { user, dialog, field } = await openEditModal('Старая заметка')

      await user.clear(field)
      await user.type(field, '   ')
      await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

      expect(within(dialog).queryByText('Введите заметку')).not.toBeInTheDocument()
      expect(bookingsApi.bookingsSetNote).toHaveBeenCalledWith({ id: 2, bookingNoteInput: { note: '   ' } })
      await waitFor(() => expect(annaNoteCell()).toBeEmptyDOMElement())
    })

    it('clamps a long note in the cell and shows the full text in the modal', async () => {
      const longNote = 'Длинная заметка о встрече. '.repeat(30).trim()
      const { field } = await openEditModal(longNote)

      const clamped = within(annaNoteCell()).getByText(longNote)
      expect(clamped).toHaveAttribute('data-line-clamp')
      expect(clamped.style.getPropertyValue('--text-line-clamp')).toBe('2')
      expect(field).toHaveValue(longNote)
    })

    it('shows a server error and keeps the entered text and the saved note', async () => {
      bookingsApi.bookingsSetNote.mockRejectedValue(
        apiError(400, 'Note must be at most 1000 characters after trimming'),
      )
      const { user, dialog, field } = await openEditModal('Старая заметка')

      await user.clear(field)
      await user.type(field, 'Новая заметка')
      await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

      expect(await within(dialog).findByText('Не удалось сохранить заметку')).toBeInTheDocument()
      expect(within(dialog).getByText('Note must be at most 1000 characters after trimming')).toBeInTheDocument()
      expect(field).toHaveValue('Новая заметка')
      expect(annaNoteCell()).toHaveTextContent('Старая заметка')
    })
  })
})
