import { expect, test } from '@playwright/test'

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

/**
 * The main scenario from README on real servers: the owner creates an event type and sets the
 * schedule, a guest books the first free slot from the home page, the owner sees the booking.
 */
test('owner publishes an event type, guest books it, owner sees the booking', async ({ page }) => {
  // Unique per run: a reused local server may keep data from previous runs.
  const runId = Date.now().toString(36)
  const title = `E2E консультация ${runId}`
  const slug = `e2e-${runId}`
  const guestName = `Гость ${runId}`
  const guestEmail = `guest-${runId}@example.com`

  // Owner: create an event type.
  await page.goto('/admin/event-types')
  await page.getByRole('button', { name: 'Новый тип встречи' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Название').fill(title)
  await form.getByLabel('Ссылка').fill(slug)
  await form.getByLabel('Длительность, минут').fill('30')
  await form.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText(title)).toBeVisible()

  // Owner: every day 00:00-23:59 UTC, so there are free slots whatever day and time the test runs.
  await page.goto('/admin/schedule')
  await page.getByRole('textbox', { name: 'Понедельник: начало интервала 1' }).waitFor()
  await page.getByRole('combobox', { name: 'Часовой пояс' }).fill('UTC')
  await page.getByRole('option', { name: 'UTC', exact: true }).click()
  for (const day of DAYS) {
    const checkbox = page.getByRole('checkbox', { name: day })
    if (!(await checkbox.isChecked())) {
      await checkbox.check()
    }
    await page.getByLabel(`${day}: начало интервала 1`).fill('00:00')
    await page.getByLabel(`${day}: конец интервала 1`).fill('23:59')
  }
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('Расписание сохранено')).toBeVisible()

  // Guest: from the home page to the booking page of the event type.
  await page.goto('/')
  const card = page.locator('.mantine-Card-root', { hasText: title })
  await card.getByRole('link', { name: 'Записаться' }).click()
  await expect(page).toHaveURL(new RegExp(`/book/${slug}$`))
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // Guest: first free slot, guest data, confirmation.
  const firstSlot = page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first()
  await firstSlot.click()
  await page.getByLabel('Имя').fill(guestName)
  await page.getByLabel('Email').fill(guestEmail)
  await page.getByRole('button', { name: 'Записаться' }).click()
  await expect(page.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible()
  await expect(page.getByText(`${guestName}, ${guestEmail}`)).toBeVisible()

  // Owner: the booking appears in the owner's list.
  await page.goto('/admin/bookings')
  const row = page.getByRole('row', { name: new RegExp(guestEmail) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(title)
  await expect(row).toContainText(guestName)
  await expect(row).toContainText('Подтверждена')
})
