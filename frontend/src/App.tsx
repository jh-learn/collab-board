import { useState } from "react";
import { Landing } from "./pages/Landing";
import { Room } from "./pages/Room";

interface Session { roomId: string; token: string; }

export function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <Landing onEnter={(roomId, token) => setSession({ roomId, token })} />;
  }
  return <Room roomId={session.roomId} token={session.token} onLeave={() => setSession(null)} />;
}