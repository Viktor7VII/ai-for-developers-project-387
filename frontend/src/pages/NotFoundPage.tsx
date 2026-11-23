import { Anchor, Center, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Center mih="100vh">
      <Stack align="center" gap="xs">
        <Title order={2}>Страница не найдена</Title>
        <Text c="dimmed">Проверьте адрес ссылки.</Text>
        <Anchor component={Link} to="/">
          На главную
        </Anchor>
      </Stack>
    </Center>
  )
}
