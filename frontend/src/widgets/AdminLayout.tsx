import { AppShell, Button, Container, Group, Text } from '@mantine/core'
import { NavLink, Outlet, useLocation } from 'react-router'

const NAV_ITEMS = [
  { to: '/admin/event-types', label: 'Типы встреч' },
  { to: '/admin/schedule', label: 'Расписание' },
  { to: '/admin/bookings', label: 'Записи' },
]

export function AdminLayout() {
  const { pathname } = useLocation()

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Text fw={700} size="lg">
              Календарь звонков
            </Text>
            <Group gap="xs" component="nav" wrap="nowrap">
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  variant={pathname.startsWith(item.to) ? 'light' : 'subtle'}
                  aria-current={pathname.startsWith(item.to) ? 'page' : undefined}
                >
                  {item.label}
                </Button>
              ))}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg" py="md">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
