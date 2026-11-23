import 'dayjs/locale/ru'

import { createTheme, MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'

dayjs.locale('ru')

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
})

interface AppProvidersProps {
  children: ReactNode
  /** 'test' disables transitions and portals in Mantine components. */
  env?: 'default' | 'test'
}

export function AppProviders({ children, env = 'default' }: AppProvidersProps) {
  return (
    <MantineProvider theme={theme} env={env}>
      <DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1 }}>
        {children}
      </DatesProvider>
    </MantineProvider>
  )
}
