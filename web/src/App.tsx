import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHealth, type Health } from '@/api/client'

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((error: unknown) => {
        console.error(error)
        setFailed(true)
      })
  }, [])

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>the-mok-team</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {health && `Backend ${health.status}, version ${health.version}`}
          {!health && !failed && 'Checking the backend...'}
        </CardContent>
      </Card>
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
