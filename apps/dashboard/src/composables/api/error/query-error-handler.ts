import { useToast } from '@/composables/useToast'

export class QueryError extends Error {
  public status?: number
  public data?: any

  constructor(message: string, status?: number, data?: any) {
    super(message)
    this.name = 'QueryError'
    this.status = status
    this.data = data
  }
}

export const queryErrorHandler = (error: unknown): QueryError => {
  const { showError } = useToast()

  if (error instanceof QueryError) {
    return error
  } else if (error instanceof Error) {
    console.error('Query Error:', error.message)
    showError(error.message)
    return new QueryError(error.message)
  } else if (typeof error === 'object' && error !== null) {
    const objError = error as any
    const message = objError.message || objError.error || 'An unknown error occurred'
    const status = objError.status || objError.statusCode

    console.error('Query Error:', message, status)
    showError(message)

    return new QueryError(message, status, objError)
  } else {
    const message = String(error) || 'An unknown error occurred'
    console.error('Query Error:', message)
    showError(message)

    return new QueryError(message)
  }
}

export const customRetryFunction = (failureCount: number, error: any): boolean => {
  if (error.status >= 40 && error.status < 500) {
    return false
  }

  if (error.name === 'QueryError' && error.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/auth/login'
    return false
  }

  return failureCount < 3
}
