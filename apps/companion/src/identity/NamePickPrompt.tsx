import { useState, type FormEvent } from "react";

export function NamePickPrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(name);
  }

  return (
    <div className="name-pick">
      <form onSubmit={handleSubmit}>
        <label htmlFor="operator-name">Who is operating?</label>
        <input
          id="operator-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary">
          Continue
        </button>
      </form>
    </div>
  );
}
