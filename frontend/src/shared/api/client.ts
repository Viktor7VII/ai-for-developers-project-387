import {
  BookingsApi,
  Configuration,
  DefaultApi,
  EventTypesApi,
  PublicBookingApi,
  ScheduleApi,
} from './generated'

// Empty base path = same origin. In development Vite proxies /api to the backend (see vite.config.ts).
// VITE_API_URL can point to a backend on another origin.
const configuration = new Configuration({
  basePath: import.meta.env.VITE_API_URL ?? '',
})

export const api = new DefaultApi(configuration)

export const eventTypesApi = new EventTypesApi(configuration)

export const scheduleApi = new ScheduleApi(configuration)

export const bookingsApi = new BookingsApi(configuration)

export const publicBookingApi = new PublicBookingApi(configuration)
