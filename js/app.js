const config = window.NELYA_CONFIG;

const chat = document.getElementById("chat");
const welcome = document.getElementById("welcome");
const composer = document.getElementById("composer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const conversationList = document.getElementById("conversationList");
const chatSearch = document.getElementById("chatSearch");
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
let chatSearchQuery = "";
let openConversationMenuId = null;
let renamingConversationId = null;
let pendingDeleteConversationId = null;

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

function getConversationGroup(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);

  if (date >= startToday) return "Aujourd’hui";
  if (date >= startWeek) return "7 derniers jours";
  return "Plus anciens";
}

function selectConversation(id) {
  if (sending) return;

  activeConversationId = id;
  openConversationMenuId = null;
  renamingConversationId = null;
  pendingDeleteConversationId = null;

  saveConversations();
  renderAll();
  messageInput.focus();
}

function deleteConversation(id) {
  conversations = conversations.filter(conversation => conversation.id !== id);

  if (conversations.length === 0) {
    const fresh = createConversation();
    conversations = [fresh];
    activeConversationId = fresh.id;
  } else if (activeConversationId === id) {
    const sorted = [...conversations].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    activeConversationId = sorted[0].id;
  }

  openConversationMenuId = null;
  renamingConversationId = null;
  pendingDeleteConversationId = null;

  saveConversations();
  renderAll();
}

function finishRename(id, value) {
  const conversation = conversations.find(item => item.id === id);
  if (!conversation) return;

  const title = value.replace(/\s+/g, " ").trim();

  if (title) {
    conversation.title = title.slice(0, 60);
    conversation.updatedAt = new Date().toISOString();
  }

  renamingConversationId = null;
  saveConversations();
  renderConversationList();
}

function renderConversationList() {
  conversationList.innerHTML = "";

  const query = chatSearchQuery.trim().toLowerCase();

  const sorted = [...conversations]
    .filter(conversation =>
      !query ||
      (conversation.title || "Nouveau chat").toLowerCase().includes(query)
    )
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.className = "conversation-empty";
    empty.textContent = "Aucun chat trouvé";
    conversationList.appendChild(empty);
    return;
  }

  let currentGroup = "";

  sorted.forEach(conversation => {
    const group = getConversationGroup(conversation.updatedAt);

    if (group !== currentGroup) {
      currentGroup = group;

      const heading = document.createElement("div");
      heading.className = "conversation-group";
      heading.textContent = group;
      conversationList.appendChild(heading);
    }

    const row = document.createElement("div");
    row.className = "conversation-row";

    if (conversation.id === activeConversationId) {
      row.classList.add("active");
    }

    if (renamingConversationId === conversation.id) {
      const input = document.createElement("input");
      input.className = "conversation-rename";
      input.value = conversation.title || "Nouveau chat";
      input.maxLength = 60;

      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          finishRename(conversation.id, input.value);
        }

        if (event.key === "Escape") {
          renamingConversationId = null;
          renderConversationList();
        }
      });

      input.addEventListener("blur", () => {
        if (renamingConversationId === conversation.id) {
          finishRename(conversation.id, input.value);
        }
      });

      row.appendChild(input);
      conversationList.appendChild(row);

      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });

      return;
    }

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "conversation-select";
    selectButton.title = conversation.title || "Nouveau chat";

    const title = document.createElement("span");
    title.textContent = conversation.title || "Nouveau chat";

    selectButton.appendChild(title);
    selectButton.addEventListener("click", () => {
      selectConversation(conversation.id);
    });

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "conversation-menu-button";
    menuButton.textContent = "•••";
    menuButton.setAttribute("aria-label", "Options du chat");

    menuButton.addEventListener("click", event => {
      event.stopPropagation();

      openConversationMenuId =
        openConversationMenuId === conversation.id
          ? null
          : conversation.id;

      pendingDeleteConversationId = null;
      renderConversationList();
    });

    row.append(selectButton, menuButton);

    if (openConversationMenuId === conversation.id) {
      const menu = document.createElement("div");
      menu.className = "conversation-menu";

      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.textContent = "Renommer";
      renameButton.addEventListener("click", event => {
        event.stopPropagation();
        openConversationMenuId = null;
        renamingConversationId = conversation.id;
        renderConversationList();
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "conversation-delete";

      if (pendingDeleteConversationId === conversation.id) {
        deleteButton.textContent = "Confirmer la suppression";
        deleteButton.classList.add("confirm");
      } else {
        deleteButton.textContent = "Supprimer";
      }

      deleteButton.addEventListener("click", event => {
        event.stopPropagation();

        if (pendingDeleteConversationId === conversation.id) {
          deleteConversation(conversation.id);
          return;
        }

        pendingDeleteConversationId = conversation.id;
        renderConversationList();
      });

      menu.append(renameButton, deleteButton);
      row.appendChild(menu);
    }

    conversationList.appendChild(row);
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
  meta.textContent = isUser ? "Toi" : config.NAME;
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
    model: config.MODEL_ID,
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
      config.API_URL ? config.NAME + " connectée" : "Mode local"
    );
  } catch (error) {
    history.push({
      role: "assistant",
      content: "Je n\'arrive pas à contacter " + config.NAME + " pour le moment.",
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
      model: config.MODEL_ID,
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
    return "Salut. Je suis " + config.NAME + " V" + config.VERSION + ".";
  }

  return "Le modèle " + config.NAME + " n\'est pas encore branché à cette réponse.";
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

    setConnectionState("online", config.NAME + " connectée");
  } catch {
    setConnectionState("error", config.NAME + " hors ligne");
  }
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: config.VERSION,
    model: config.MODEL_ID,
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

  const active = getActiveConversation();

  if (active && active.history.length === 0) {
    activeConversationId = active.id;
    openConversationMenuId = null;
    renamingConversationId = null;
    pendingDeleteConversationId = null;
    saveConversations();
    renderAll();
    messageInput.focus();
    return;
  }

  const conversation = createConversation();
  conversations.push(conversation);
  activeConversationId = conversation.id;

  openConversationMenuId = null;
  renamingConversationId = null;
  pendingDeleteConversationId = null;

  saveConversations();
  renderAll();
  messageInput.focus();
});

chatSearch.addEventListener("input", () => {
  chatSearchQuery = chatSearch.value;
  openConversationMenuId = null;
  pendingDeleteConversationId = null;
  renderConversationList();
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

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    openConversationMenuId = null;
    pendingDeleteConversationId = null;

    if (renamingConversationId) {
      renamingConversationId = null;
    }

    renderConversationList();
  }
});

document.addEventListener("click", event => {
  if (
    openConversationMenuId &&
    !event.target.closest(".conversation-row")
  ) {
    openConversationMenuId = null;
    pendingDeleteConversationId = null;
    renderConversationList();
  }

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
