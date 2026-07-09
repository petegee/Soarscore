import { useState } from "react";
import { useActor } from "./identity/useActor.js";
import { NamePickPrompt } from "./identity/NamePickPrompt.js";
import { PilotLibrary } from "./pilots/PilotLibrary.js";
import { LandingTableLibrary } from "./landing-tables/LandingTableLibrary.js";
import { CompetitionLibrary } from "./competitions/CompetitionLibrary.js";
import { TemplateLibrary } from "./templates/TemplateLibrary.js";

type Screen = "competitions" | "templates" | "pilots" | "landing-tables";

export function App() {
  const actor = useActor();
  const [changingName, setChangingName] = useState(false);
  const [screen, setScreen] = useState<Screen>("pilots");

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
      <header className="app-header">
        <span className="operator-name">Operating as {actor.actorName}</span>
        <button onClick={() => setChangingName(true)}>Change</button>
      </header>
      <nav className="app-nav">
        <button
          onClick={() => setScreen("competitions")}
          disabled={screen === "competitions"}
        >
          Competitions
        </button>
        <button onClick={() => setScreen("templates")} disabled={screen === "templates"}>
          Templates
        </button>
        <button onClick={() => setScreen("pilots")} disabled={screen === "pilots"}>
          Pilots
        </button>
        <button
          onClick={() => setScreen("landing-tables")}
          disabled={screen === "landing-tables"}
        >
          Landing tables
        </button>
      </nav>
      <main className="screen">
        {screen === "competitions" && <CompetitionLibrary actor={actor} />}
        {screen === "templates" && <TemplateLibrary actor={actor} />}
        {screen === "pilots" && <PilotLibrary actor={actor} />}
        {screen === "landing-tables" && <LandingTableLibrary actor={actor} />}
      </main>
    </div>
  );
}
