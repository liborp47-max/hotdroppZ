import 'react-native-gesture-handler'
import '@/styles/global.css'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { AuthProvider } from '@/components/auth/AuthProvider'
import { ShareSheet } from '@/components/share/ShareSheet'
import { GlobalScrollbar } from '@/components/shared/GlobalScrollbar'
import { queryClient } from '@/lib/query-client'
import { colors } from '@/styles/theme'

/**
 * Root layout — providers + the top-level navigator. The (tabs) group holds the
 * 5-tab shell (HDUA-03); `post/[id]` is pushed over it for the detail/continuous
 * reader (HDUA-07).
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="post/[id]" options={{ animation: 'fade' }} />
              <Stack.Screen name="profile/settings" />
              <Stack.Screen name="profile/edit" />
              <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack>
            <ShareSheet />
            <GlobalScrollbar />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
