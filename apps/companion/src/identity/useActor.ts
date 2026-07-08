import { useCallback, useState } from "react";

const ACTOR_NAME_KEY = "soarscore.actorName";
const CLIENT_ID_KEY = "soarscore.clientId";

function readClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

export interface Actor {
  actorName: string | null;
  clientId: string;
  setActorName: (name: string) => void;
}

export function useActor(): Actor {
  const [actorName, setActorNameState] = useState<string | null>(() =>
    localStorage.getItem(ACTOR_NAME_KEY),
  );
  const [clientId] = useState<string>(readClientId);

  const setActorName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    localStorage.setItem(ACTOR_NAME_KEY, trimmed);
    setActorNameState(trimmed);
  }, []);

  return { actorName, clientId, setActorName };
}
