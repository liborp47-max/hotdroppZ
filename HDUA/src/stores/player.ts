import { create } from 'zustand'
import { Audio, type AVPlaybackStatus } from 'expo-av'

/**
 * Global audio player (HDUA-08 sub01). Plays the Spotify preview snippets
 * (FeedItem.audioPreviewUrl) through a single expo-av Sound that lives for the
 * app's lifetime, so playback continues across navigation. The Sound instance
 * is kept module-level (not in React state); only serialisable primitives go
 * through the store so components re-render cheaply.
 *
 * Background audio + lock-screen controls are HDUA-08 sub03 (native config).
 */
export type PlayerTrack = {
  id: string
  title: string
  artist?: string | null
  cover?: string | null
  audioUrl: string
}

interface PlayerState {
  track: PlayerTrack | null
  queue: PlayerTrack[]
  index: number
  isPlaying: boolean
  isLoading: boolean
  position: number
  duration: number
  expanded: boolean
  /** Start a track, optionally seeding a queue it belongs to. */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => Promise<void>
  toggle: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  seek: (millis: number) => Promise<void>
  setExpanded: (v: boolean) => void
  close: () => Promise<void>
}

let sound: Audio.Sound | null = null
let audioModeReady = false

async function ensureAudioMode() {
  if (audioModeReady) return
  audioModeReady = true
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false })
  } catch {
    /* non-fatal — playback still works with platform defaults */
  }
}

export const usePlayer = create<PlayerState>((set, get) => {
  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return
    set({
      isPlaying: status.isPlaying,
      position: status.positionMillis ?? 0,
      duration: status.durationMillis ?? 0,
    })
    if (status.didJustFinish) void get().next()
  }

  const loadIndex = async (i: number) => {
    const { queue } = get()
    const track = queue[i]
    if (!track) return
    await ensureAudioMode()
    if (sound) {
      await sound.unloadAsync().catch(() => {})
      sound = null
    }
    set({ track, index: i, isLoading: true, isPlaying: false, position: 0, duration: 0 })
    try {
      const { sound: s } = await Audio.Sound.createAsync({ uri: track.audioUrl }, { shouldPlay: true }, onStatus)
      sound = s
      set({ isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  }

  return {
    track: null,
    queue: [],
    index: 0,
    isPlaying: false,
    isLoading: false,
    position: 0,
    duration: 0,
    expanded: false,

    play: async (track, queue) => {
      const q = queue && queue.length ? queue : [track]
      const i = Math.max(0, q.findIndex((t) => t.id === track.id))
      set({ queue: q })
      await loadIndex(i)
    },

    toggle: async () => {
      if (!sound) return
      const status = await sound.getStatusAsync()
      if (!status.isLoaded) return
      if (status.isPlaying) await sound.pauseAsync()
      else await sound.playAsync()
    },

    next: async () => {
      const { index, queue } = get()
      if (index < queue.length - 1) await loadIndex(index + 1)
      else await get().close()
    },

    prev: async () => {
      const { index, position } = get()
      // Restart the current track if we're past the first few seconds.
      if (position > 3000 || index === 0) {
        await sound?.setPositionAsync(0).catch(() => {})
        return
      }
      await loadIndex(index - 1)
    },

    seek: async (millis) => {
      await sound?.setPositionAsync(Math.max(0, millis)).catch(() => {})
    },

    setExpanded: (v) => set({ expanded: v }),

    close: async () => {
      if (sound) {
        await sound.unloadAsync().catch(() => {})
        sound = null
      }
      set({ track: null, queue: [], index: 0, isPlaying: false, isLoading: false, position: 0, duration: 0, expanded: false })
    },
  }
})
