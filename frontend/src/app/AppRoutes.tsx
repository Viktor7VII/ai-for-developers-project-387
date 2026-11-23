import { Navigate, Route, Routes } from 'react-router'
import { BookingsPage } from '../pages/admin/BookingsPage'
import { EventTypesPage } from '../pages/admin/EventTypesPage'
import { SchedulePage } from '../pages/admin/SchedulePage'
import { BookingPage } from '../pages/booking/BookingPage'
import { HomePage } from '../pages/home/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AdminLayout } from '../widgets/AdminLayout'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="event-types" replace />} />
        <Route path="event-types" element={<EventTypesPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="bookings" element={<BookingsPage />} />
      </Route>
      <Route path="/book/:slug" element={<BookingPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
