const config = window.NELYA_CONFIG;

const chat = document.getElementById("chat");
const welcome = document.getElementById("welcome");
const composer = document.getElementById("composer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const exportBtn = document.getElementById("exportBtn");
const validatedCount = document.getElementById("validatedCount");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const messageTemplate = document.getElementById("messageTemplate");

const STORAGE_KEYS = {
  history: "nelya_history_v011",
  feedback: "nelya_feedback_v011"
};

let history = readJSON(STORAGE_KEYS.history, []);
let feedback = readJSON(STORAGE_KEYS.feedback, []);
let sending = false;

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  localStorage.setItem(STORAGE_KEYS.feedback, JSON.stringify(feedback));
  updateStats();
}

function updateStats() {
  validatedCount.textContent = feedback.length.toLocaleString("fr-FR");
}

function setConnectionState(state, text) {
  connectionDot.className = "status-dot" + (state ? " " + state : "");
  connectionText.textContent = text;
}

function renderAll() {
  chat.innerHTML = "";

  if (history.length === 0) {
    chat.appendChild(welcome);
    return;
  }

  history.forEach((item, index) => {
    chat.appendChild(createMessage(item, index));
  });

  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

function createMessage(item, index) {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  const avatar = node.querySelector(".message-avatar");
  const meta = node.querySelector(".message-meta");
  const text = node.querySelector(".message-text");
  const actions = node.querySelector(".message-actions");

  const isUser = item.role === "user";

  avatar.textContent = isUser ? "T" : "N";
  meta.textContent = isUser ? "Toi" : "Nelya";
  text.textContent = item.content;

  if (!isUser) {
    const goodButton = document.createElement("button");
    goodButton.className = "message-action";
    goodButton.textContent = "Bonne réponse";
    goodButton.addEventListener("click", () => validateAnswer(index));

    const correctionButton = document.createElement("button");
    correctionButton.className = "message-action";
    correctionButton.textContent = "Corriger";
    correctionButton.addEventListener("click", () => openCorrection(node, index));

    actions.append(goodButton, correctionButton);
  }

  return node;
}

function validateAnswer(index) {
  const assistantMessage = history[index];
  const userMessage = history[index - 1];

  if (!assistantMessage || !userMessage || userMessage.role !== "user") return;

  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    version: config.VERSION,
    input: userMessage.content,
    output: assistantMessage.content,
    source: "validated"
  };

  feedback.push(item);
  saveState();
  sendFeedback(item);
}

function openCorrection(messageNode, index) {
  if (messageNode.querySelector(".correction-box")) return;

  const assistantMessage = history[index];
  const userMessage = history[index - 1];
  if (!assistantMessage || !userMessage) return;

  const box = document.createElement("div");
  box.className = "correction-box";

  const textarea = document.createElement("textarea");
  textarea.value = assistantMessage.content;

  const buttons = document.createElement("div");
  buttons.className = "correction-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "correction-save";
  saveButton.textContent = "Enregistrer la correction";

  const cancelButton = document.createElement("button");
  cancelButton.className = "correction-cancel";
  cancelButton.textContent = "Annuler";

  saveButton.addEventListener("click", () => {
    const corrected = textarea.value.trim();
    if (!corrected) return;

    const item = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      version: config.VERSION,
      input: userMessage.content,
      originalOutput: assistantMessage.content,
      output: corrected,
      source: "corrected"
    };

    feedback.push(item);
    saveState();
    sendFeedback(item);
    box.remove();
  });

  cancelButton.addEventListener("click", () => box.remove());

  buttons.append(saveButton, cancelButton);
  box.append(textarea, buttons);
  messageNode.querySelector(".message-content").appendChild(box);
  textarea.focus();
}

async function sendMessage(message) {
  history.push({
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  });

  saveState();
  renderAll();

  sending = true;
  sendBtn.disabled = true;

  try {
    const reply = config.API_URL
      ? await askApi(message)
      : await localDemoReply(message);

    history.push({
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString()
    });

    setConnectionState(
      config.API_URL ? "online" : "",
      config.API_URL ? "Nelya connectée" : "Mode local"
    );
  } catch (error) {
    history.push({
      role: "assistant",
      content: "Je n'arrive pas à contacter le modèle pour le moment.",
      createdAt: new Date().toISOString()
    });

    setConnectionState("error", "Connexion impossible");
    console.error(error);
  } finally {
    sending = false;
    sendBtn.disabled = false;
    saveState();
    renderAll();
  }
}

async function askApi(message) {
  const response = await fetch(config.API_URL + config.CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      history: history.slice(-20),
      version: config.VERSION
    })
  });

  if (!response.ok) {
    throw new Error("API chat: " + response.status);
  }

  const data = await response.json();

  if (!data.reply || typeof data.reply !== "string") {
    throw new Error("Réponse API invalide");
  }

  return data.reply;
}

async function sendFeedback(item) {
  if (!config.API_URL) return;

  try {
    await fetch(config.API_URL + config.FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(item)
    });
  } catch (error) {
    console.warn("Feedback conservé localement, envoi API impossible.", error);
  }
}

async function localDemoReply(message) {
  await new Promise(resolve => setTimeout(resolve, 280));

  const normalized = message.toLowerCase();

  if (/^(salut|bonjour|hello|yo)\b/.test(normalized)) {
    return "Salut. Je suis Nelya V0.1.1. Pour l'instant je fonctionne en mode local de démonstration.";
  }

  return "Je n'ai pas encore mon modèle branché. Ton message a bien été enregistré dans la conversation et l'interface est prête à se connecter à l'API de Nelya.";
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: config.VERSION,
    history,
    feedback
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nelya-v" + config.VERSION + "-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

composer.addEventListener("submit", event => {
  event.preventDefault();

  if (sending) return;

  const message = messageInput.value.trim();
  if (!message) return;

  messageInput.value = "";
  messageInput.style.height = "auto";
  sendMessage(message);
});

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + "px";
});

newChatBtn.addEventListener("click", () => {
  history = [];
  saveState();
  renderAll();
  messageInput.focus();
});

exportBtn.addEventListener("click", exportData);

updateStats();
renderAll();

if (config.API_URL) {
  setConnectionState("online", "API configurée");
} else {
  setConnectionState("", "Mode local");
}
