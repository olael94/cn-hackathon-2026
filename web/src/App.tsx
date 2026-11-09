import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useHealth } from '@/api/client'

function App() {
  const { data: health, isError: failed } = useHealth()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">RoomPass</CardTitle>
          <CardDescription>
            Live captions in English and Spanish, and Q&amp;A that tells you if your question was
            already answered. Scan the room's QR code, no account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">Captions start when the speaker starts the talk.</p>
          <p className="text-muted-foreground text-xs">Machine captions, may contain errors.</p>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs" role="status">
        {health && `Backend ${health.status} · version ${health.version}`}
        {!health && !failed && 'Checking the backend...'}
      </p>
      {failed && (
        <Alert variant="destructive">
          <AlertTitle>Can't reach the backend</AlertTitle>
          <AlertDescription>Try again in a moment.</AlertDescription>
        </Alert>
      )}
    </main>
  )
}

export default App
