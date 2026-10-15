import { useCallback, useState } from 'react'
import { RoomScene } from './components/RoomScene'

function App() {
  const [roomWelcomeActive, setRoomWelcomeActive] = useState(true)
  const finishRoomWelcome = useCallback(() => setRoomWelcomeActive(false), [])

  return (
    <main>
      <RoomScene
        welcomeActive={roomWelcomeActive}
        onWelcomeComplete={finishRoomWelcome}
      />
    </main>
  )
}

export default App
