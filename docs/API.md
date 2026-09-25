# API Nelya

Le frontend GitHub Pages communique avec le modèle via une API HTTP.

## Configuration

Modifier `js/config.js` :

```js
window.NELYA_CONFIG = {
  VERSION: "0.1.1",
  API_URL: "https://adresse-de-ton-api",
  CHAT_ENDPOINT: "/chat",
  FEEDBACK_ENDPOINT: "/feedback"
};
```

## POST /chat

Requête :

```json
{
  "message": "Bonjour Nelya",
  "history": [
    {
      "role": "user",
      "content": "Bonjour Nelya"
    }
  ],
  "version": "0.1.1"
}
```

Réponse :

```json
{
  "reply": "Bonjour !"
}
```

## POST /feedback

Une validation :

```json
{
  "id": "uuid",
  "createdAt": "2026-09-25T00:00:00.000Z",
  "version": "0.1.1",
  "input": "Comment tu t'appelles ?",
  "output": "Je m'appelle Nelya.",
  "source": "validated"
}
```

Une correction :

```json
{
  "id": "uuid",
  "createdAt": "2026-09-25T00:00:00.000Z",
  "version": "0.1.1",
  "input": "Comment tu t'appelles ?",
  "originalOutput": "Nelya nom.",
  "output": "Je m'appelle Nelya.",
  "source": "corrected"
}
```

L'API peut ajouter ces objets à un fichier JSONL servant de dataset.

## Cycle d'entraînement prévu

1. Le frontend collecte les conversations et corrections.
2. `/feedback` ajoute les exemples validés au dataset.
3. Tous les 20 000 exemples, une session d'entraînement est lancée.
4. Un checkpoint et un test sont sauvegardés.
5. Le frontend reste indépendant du moteur d'entraînement.
