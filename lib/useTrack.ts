export function useTrack() {
  const track = (event: string, data?: Record<string, string | number | boolean>) => {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(event, data)
    }
  }
  return { track }
}
