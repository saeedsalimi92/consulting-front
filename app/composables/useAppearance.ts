export type Appearance = 'light' | 'dark' | 'system'
export const useAppearance = () => {
  const appearance = useState<Appearance>('appearance-mode', () => 'system')
  const apply = (mode: Appearance) => {
    appearance.value = mode
    if (import.meta.client) {
      const resolved = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved
      try { localStorage.setItem('appearance-mode', mode) } catch { /* Theme still applies when storage is unavailable. */ }
    }
  }
  const cycle = () => apply(appearance.value === 'system' ? 'light' : appearance.value === 'light' ? 'dark' : 'system')
  onMounted(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem('appearance-mode') } catch { /* Use system appearance when storage is unavailable. */ }
    const mode: Appearance = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
    apply(mode)
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => { if (appearance.value === 'system') apply('system') }
    media.addEventListener?.('change', update)
    onBeforeUnmount(() => media.removeEventListener?.('change', update))
  })
  return { appearance, apply, cycle }
}
