import { ResponseError } from '../api/generated'

export function isResponseStatus(error: unknown, status: number): boolean {
  return error instanceof ResponseError && error.response.status === status
}

/** Extracts a human-readable message from an API error. */
export async function getErrorMessage(error: unknown): Promise<string> {
  if (error instanceof ResponseError) {
    try {
      const body: unknown = await error.response.clone().json()
      if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
      ) {
        return body.message
      }
    } catch {
      // Not a JSON body: fall through to the generic message.
    }
    return `Ошибка сервера (${error.response.status})`
  }
  if (error instanceof Error && error.name === 'FetchError') {
    return 'Сервер недоступен. Проверьте, что backend запущен.'
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.'
}
