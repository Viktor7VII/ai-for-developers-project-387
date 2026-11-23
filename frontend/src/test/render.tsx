import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppProviders } from '../app/AppProviders'
import { AppRoutes } from '../app/AppRoutes'
import { ResponseError } from '../shared/api/generated'

/** Renders the whole application at the given URL. */
export function renderApp(url: string) {
  const user = userEvent.setup()
  const result = render(
    <AppProviders env="test">
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  )
  return { user, ...result }
}

/** An error as thrown by the generated API client for a non-2xx response. */
export function apiError(status: number, message = 'Error'): ResponseError {
  const response = new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
  return new ResponseError(response, 'Response returned an error code')
}
