import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { search } from '@/api/content'
import { FeedCard } from '@/components/cards/FeedCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { colors, radius, spacing, typography } from '@/styles/theme'

/** Search tab — full-text over the feed (HDUA-02 `search`). */
export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['search', term],
    queryFn: () => search(term),
    enabled: term.trim().length > 1,
  })

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.heading}>Search</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textFaint} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => setTerm(text)}
          returnKeyType="search"
          placeholder="Artists, drops, trends…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCorrect={false}
        />
        {text ? (
          <Pressable onPress={() => { setText(''); setTerm('') }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {isFetching ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : term.trim().length > 1 ? (
        <FlatList
          data={data ?? []}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <FeedCard item={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          ListEmptyComponent={<EmptyState icon="search-outline" title="Nic nenalezeno" hint={`Pro "${term}" žádné výsledky.`} />}
        />
      ) : (
        <EmptyState icon="search-outline" title="Hledej v HotDroppZ" hint="Zadej jméno umělce, track nebo téma." />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  heading: { color: colors.text, fontSize: typography.title, fontWeight: '800', marginBottom: spacing.md },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md,
    height: 44, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: typography.body, height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
})
