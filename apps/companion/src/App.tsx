import { useState } from "react";
import { useActor } from "./identity/useActor.js";
import { NamePickPrompt } from "./identity/NamePickPrompt.js";
import { PilotLibrary } from "./pilots/PilotLibrary.js";

export function App() {
  const actor = useActor();
  const [changingName, setChangingName] = useState(false);

  if (!actor.actorName || changingName) {
    return (
      <NamePickPrompt
        onSubmit={(name) => {
          actor.setActorName(name);
          setChangingName(false);
        }}
      />
    );
  }

  return (
    <div>
      <header>
        <span>Operating as {actor.actorName}</span>
        <button onClick={() => setChangingName(true)}>Change</button>
      </header>
      <PilotLibrary actor={actor} />
    </div>
  );
}
