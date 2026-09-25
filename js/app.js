const config = window.NELYA_CONFIG;

const chat = document.getElementById("chat");
const welcome = document.getElementById("welcome");
const composer = document.getElementById("composer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const conversationList = document.getElementById("conversationList");
const exportBtn = document.getElementById("exportBtn");
const validatedCount = document.getElementById("validatedCount");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const messageTemplate = document.getElementById("messageTemplate");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const darkTheme = document.getElementById("darkTheme");
const lightTheme = document.getElementById("lightTheme");
const themeColor = document.getElementById("themeColor");
const themeOptions = document.querySelectorAll(".theme-option");

const STORAGE_KEYS = {
  oldHistory: "nelya_history_v011",
  conversations: "nelya_conversations_v011",
  activeConversation: "nelya_active_conversation_v011",
  feedback: "nelya_feedback_v011",
  theme: "nelya_theme"
};

let feedback = readJSON(STORAGE_KEYS.feedback, []);
let conversations = readJSON(STORAGE_KEYS.conversations, []);
let sending = false;

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createConversation(initialHistory = []) {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: initialHistory.find(item => item.role === "user")?.content?.trim().slice(0, 34) || "Nouveau chat",
    history: initialHistory,
    createdAt: now,
    updatedAt: now
  };
}

if (!Array.isArray(conversations) || conversations.length === 0) {
  const oldHistory = readJSON(STORAGE_KEYS.oldHistory, []);
  conversations = [createConversation(Array.isArray(oldHistory) ? oldHistory : [])];
}

let activeConversationId =
  localStorage.getItem(STORAGE_KEYS.activeConversation) ||
  conversations[0].id;

if (!conversations.some(conversation => conversation.id === activeConversationId)) {
  activeConversationId = conversations[0].id;
}

function getActiveConversation() {
  return conversations.find(conversation => conversation.id === activeConversationId);
}

function getHistory() {
  return getActiveConversation()?.history || [];
}

function saveConversations() {
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
  localStorage.setItem(STORAGE_KEYS.activeConversation, activeConversationId);
}

function saveFeedback() {
  localStorage.setItem(STORAGE_KEYS.feedback, JSON.stringify(feedback));
  updateStats();
}

function getTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  const selected = theme === "light" ? "light" : "dark";

  darkTheme.disabled = selected !== "dark";
  lightTheme.disabled = selected !== "light";
  themeColor.content = selected === "light" ? "#f5f6f8" : "#0a0c0f";

  localStorage.setItem(STORAGE_KEYS.theme, selected);
  document.documentElement.dataset.theme = selected;

  themeOptions.forEach(button => {
    const active = button.dataset.theme === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateStats() {
  validatedCount.textContent = feedback.length.toLocaleString("fr-FR");
}

function setConnectionState(state, text) {
  connectionDot.className = "status-dot" + (state ? " " + state : "");
  connectionText.textContent = text;
}

function makeConversationTitle(message) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.length > 34 ? cleaned.slice(0, 34) + "…" : cleaned;
}

function renderConversationList() {
  conversationList.innerHTML = "";

  const sorted = [...conversations].sort((a, b) =>
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  sorted.forEach(conversation => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-item";

    if (conversation.id === activeConversationId) {
      button.classList.add("active");
    }

    const title = document.createElement("span");
    title.textContent = conversation.title || "Nouveau chat";

    button.appendChild(title);
    button.addEventListener("click", () => {
      if (sending) return;
      activeConversationId = conversation.id;
      saveConversations();
      renderConversationList();
      renderAll();
      messageInput.focus();
    });

    conversationList.appendChild(button);
  });
}

function renderAll() {
  const history = getHistory();
  chat.innerHTML = "";

  if (history.length === 0) {
    chat.appendChild(welcome);
  } else {
    history.forEach((item, index) => {
      chat.appendChild(createMessage(item, index));
    });
  }

  renderConversationList();

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
  const history = getHistory();
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
  saveFeedback();
  sendFeedback(item);
}

function openCorrection(messageNode, index) {
  if (messageNode.querySelector(".correction-box")) return;

  const history = getHistory();
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
    saveFeedback();
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
  const conversation = getActiveConversation();
  const history = conversation.history;

  history.push({
    role: "user",
    content: message,
    createdAt: new Date().toISOString()
  });

  if (history.filter(item => item.role === "user").length === 1) {
    conversation.title = makeConversationTitle(message);
  }

  conversation.updatedAt = new Date().toISOString();
  saveConversations();
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
      content: "Je n'arrive pas à contacter Nelya pour le moment.",
      createdAt: new Date().toISOString()
    });

    setConnectionState("error", "Connexion impossible");
    console.error(error);
  } finally {
    conversation.updatedAt = new Date().toISOString();
    sending = false;
    sendBtn.disabled = false;
    saveConversations();
    renderAll();
  }
}

async function askApi(message) {
  const history = getHistory();

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
  await new Promise(resolve => setTimeout(resolve, 250));

  if (/^(salut|bonjour|hello|yo)\b/i.test(message)) {
    return "Salut. Je suis Nelya V0.1.1.";
  }

  return "Le modèle Nelya n'est pas encore branché à cette réponse.";
}

async function checkApiHealth() {
  if (!config.API_URL) {
    setConnectionState("", "Mode local");
    return;
  }

  try {
    const response = await fetch(config.API_URL + "/health", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) throw new Error("health " + response.status);

    setConnectionState("online", "Nelya connectée");
  } catch {
    setConnectionState("error", "Nelya hors ligne");
  }
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: config.VERSION,
    conversations,
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
  if (sending) return;

  const conversation = createConversation();
  conversations.push(conversation);
  activeConversationId = conversation.id;

  saveConversations();
  renderAll();
  messageInput.focus();
});

settingsBtn.addEventListener("click", () => {
  const opening = settingsPanel.hidden;
  settingsPanel.hidden = !opening;
  settingsBtn.setAttribute("aria-expanded", opening ? "true" : "false");
});

themeOptions.forEach(button => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
  });
});

exportBtn.addEventListener("click", exportData);

document.addEventListener("click", event => {
  if (
    !settingsPanel.hidden &&
    !settingsPanel.contains(event.target) &&
    !settingsBtn.contains(event.target)
  ) {
    settingsPanel.hidden = true;
    settingsBtn.setAttribute("aria-expanded", "false");
  }
});

applyTheme(getTheme());
updateStats();
saveConversations();
renderAll();
checkApiHealth();
