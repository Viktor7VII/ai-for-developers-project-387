import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiError, renderApp } from '../../test/render'

const { scheduleApi } = vi.hoisted(() => ({
  scheduleApi: {
    schedulesGet: vi.fn(),
    schedulesUpdate: vi.fn(),
  },
}))

vi.mock('../../shared/api/client', () => ({ scheduleApi }))

const schedule = {
  timeZone: 'Europe/Moscow',
  intervals: [
    { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 'MONDAY', startTime: '13:00', endTime: '17:00' },
    { dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '18:00' },
  ],
}

describe('SchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scheduleApi.schedulesGet.mockResolvedValue(schedule)
    scheduleApi.schedulesUpdate.mockImplementation(async ({ schedule: saved }) => saved)
  })

  it('shows the saved schedule', async () => {
    renderApp('/admin/schedule')

    expect(await screen.findByLabelText('Понедельник: начало интервала 1')).toHaveValue('09:00')
    expect(screen.getByLabelText('Понедельник: конец интервала 2')).toHaveValue('17:00')
    expect(screen.getByLabelText('Среда: начало интервала 1')).toHaveValue('10:00')
    expect(screen.getByRole('checkbox', { name: 'Понедельник' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Вторник' })).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Часовой пояс' })).toHaveValue('Europe/Moscow')
  })

  it('saves changed schedule', async () => {
    const { user } = renderApp('/admin/schedule')

    await user.click(await screen.findByRole('checkbox', { name: 'Суббота' }))
    await user.click(screen.getByRole('button', { name: 'Понедельник: удалить интервал 2' }))
    fireEvent.change(screen.getByLabelText('Среда: конец интервала 1'), { target: { value: '16:30' } })
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(scheduleApi.schedulesUpdate).toHaveBeenCalledWith({
        schedule: {
          timeZone: 'Europe/Moscow',
          intervals: [
            { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
            { dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '16:30' },
            { dayOfWeek: 'SATURDAY', startTime: '09:00', endTime: '17:00' },
          ],
        },
      }),
    )
    expect(await screen.findByText('Расписание сохранено')).toBeInTheDocument()
  })

  it('does not send a range that ends before it starts', async () => {
    const { user } = renderApp('/admin/schedule')

    fireEvent.change(await screen.findByLabelText('Среда: конец интервала 1'), {
      target: { value: '08:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText(/Среда: время окончания должно быть позже/)).toBeInTheDocument()
    expect(scheduleApi.schedulesUpdate).not.toHaveBeenCalled()
  })

  it('shows server validation errors', async () => {
    scheduleApi.schedulesUpdate.mockRejectedValue(
      apiError(400, 'intervals: MONDAY intervals 09:00-12:00 and 11:00-13:00 overlap'),
    )
    const { user } = renderApp('/admin/schedule')

    await user.click(await screen.findByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText(/overlap/)).toBeInTheDocument()
  })
})
