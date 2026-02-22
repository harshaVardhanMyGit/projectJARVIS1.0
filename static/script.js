// ===== Auth Guard =====
const currentUser = localStorage.getItem("jarvis-current-user");
if (!currentUser) {
    window.location.href = "/login";
}
const userData = currentUser ? JSON.parse(currentUser) : {};

// ===== DOM =====
const chatArea = document.getElementById("chatArea");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const logoutBtn = document.getElementById("logoutBtn");
const themeBtn = document.getElementById("themeBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarList = document.getElementById("sidebarList");
const newChatBtn = document.getElementById("newChatBtn");

let isWaiting = false;
let activeChatId = null;

// ===== Chat Storage =====
const STORAGE_KEY = "jarvis-chats";

function getChats() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveChats(chats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function getChatById(id) {
    return getChats().find((c) => c.id === id);
}

function updateChat(id, updates) {
    const chats = getChats();
    const idx = chats.findIndex((c) => c.id === id);
    if (idx !== -1) {
        chats[idx] = { ...chats[idx], ...updates };
        saveChats(chats);
    }
}

function deleteChat(id) {
    const chats = getChats().filter((c) => c.id !== id);
    saveChats(chats);
    if (activeChatId === id) {
        activeChatId = null;
        showWelcome();
    }
    renderSidebar();
}

function createNewChat() {
    const chat = {
        id: Date.now().toString(),
        title: "New Chat",
        messages: [],
        createdAt: new Date().toISOString(),
    };
    const chats = getChats();
    chats.unshift(chat);
    saveChats(chats);
    return chat;
}

function addMessageToChat(chatId, role, text) {
    const chats = getChats();
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    chat.messages.push({ role, text, time: getTimeString() });
    // Auto-title from first user message
    if (role === "user" && chat.title === "New Chat") {
        chat.title = text.length > 40 ? text.slice(0, 40) + "..." : text;
    }
    saveChats(chats);
}

// ===== Sidebar =====
function toggleSidebar() {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("active");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
}

sidebarToggle.addEventListener("click", toggleSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

function renderSidebar() {
    const chats = getChats();
    if (chats.length === 0) {
        sidebarList.innerHTML = '<div class="sidebar-empty">No saved chats yet</div>';
        return;
    }
    sidebarList.innerHTML = chats
        .map(
            (chat) => `
        <div class="sidebar-item ${chat.id === activeChatId ? "active" : ""}" data-id="${chat.id}">
            <div class="sidebar-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <div class="sidebar-item-text">
                <div class="sidebar-item-title">${escapeHtml(chat.title)}</div>
                <div class="sidebar-item-date">${formatDate(chat.createdAt)}</div>
            </div>
            <button class="sidebar-item-delete" data-delete-id="${chat.id}" title="Delete chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>`
        )
        .join("");

    // Click to load chat
    sidebarList.querySelectorAll(".sidebar-item").forEach((item) => {
        item.addEventListener("click", (e) => {
            if (e.target.closest(".sidebar-item-delete")) return;
            loadChat(item.dataset.id);
            closeSidebar();
        });
    });

    // Delete buttons
    sidebarList.querySelectorAll(".sidebar-item-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteChat(btn.dataset.deleteId);
        });
    });
}

function loadChat(chatId) {
    const chat = getChatById(chatId);
    if (!chat) return;
    activeChatId = chatId;
    chatArea.innerHTML = "";
    chat.messages.forEach((msg) => {
        appendMessage(msg.role, msg.text, false, msg.time);
    });
    if (chat.messages.length === 0) {
        showWelcome();
    }
    renderSidebar();
    // Clear server-side history and replay for context
    replayConversationToServer(chat.messages);
}

async function replayConversationToServer(messages) {
    // Reset server conversation, then silently replay so context is correct
    try {
        await fetch("/clear", { method: "POST" });
        for (const msg of messages) {
            if (msg.role === "user") {
                await fetch("/replay", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "user", content: msg.text }),
                });
            } else if (msg.role === "jarvis") {
                await fetch("/replay", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "assistant", content: msg.text }),
                });
            }
        }
    } catch (_) {}
}

function showWelcome() {
    chatArea.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="4"></circle>
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                </svg>
            </div>
            <h2>Good day, ${userData.username || "there"}.</h2>
            <p>All systems operational. How may I assist you today?</p>
        </div>`;
}

// ===== New Chat =====
newChatBtn.addEventListener("click", async () => {
    const chat = createNewChat();
    activeChatId = chat.id;
    showWelcome();
    renderSidebar();
    closeSidebar();
    try {
        await fetch("/clear", { method: "POST" });
    } catch (_) {}
});

// ===== Logout =====
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("jarvis-current-user");
    window.location.href = "/login";
});

// ===== Theme Toggle =====
function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("jarvis-theme", theme);
}

setTheme(localStorage.getItem("jarvis-theme") || "dark");

themeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
});

// ===== Send Message =====
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message || isWaiting) return;

    // Create a new chat if none active
    if (!activeChatId) {
        const chat = createNewChat();
        activeChatId = chat.id;
    }

    // Remove welcome message
    const welcome = chatArea.querySelector(".welcome-message");
    if (welcome) welcome.remove();

    // Add user message
    appendMessage("user", message);
    addMessageToChat(activeChatId, "user", message);
    renderSidebar();

    userInput.value = "";
    setWaiting(true);

    const typingEl = showTyping();

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
        });

        typingEl.remove();

        if (res.ok) {
            const { bubbleEl, finalize } = appendMessage("jarvis", "", true);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") break;
                        try {
                            const parsed = JSON.parse(data);
                            fullText += parsed.token;
                            bubbleEl.querySelector(".bubble-text").textContent = fullText;
                            scrollToBottom();
                        } catch (_) {}
                    }
                }
            }

            if (finalize) finalize();
            // Save JARVIS response
            addMessageToChat(activeChatId, "jarvis", fullText);
            renderSidebar();
        } else {
            const errText = "I'm afraid something went wrong.";
            appendMessage("jarvis", errText);
            addMessageToChat(activeChatId, "jarvis", errText);
        }
    } catch (err) {
        typingEl.remove();
        const errText = "Network error. Please verify your connection.";
        appendMessage("jarvis", errText);
        addMessageToChat(activeChatId, "jarvis", errText);
    }

    setWaiting(false);
    userInput.focus();
});

// ===== Clear Chat =====
clearBtn.addEventListener("click", async () => {
    try {
        await fetch("/clear", { method: "POST" });
    } catch (_) {}
    activeChatId = null;
    showWelcome();
    renderSidebar();
});

// ===== Helpers =====
function getTimeString() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function appendMessage(role, text, isStream = false, time = null) {
    const msg = document.createElement("div");
    msg.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "YOU" : "J";

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const bubbleText = document.createElement("span");
    bubbleText.className = "bubble-text";
    bubbleText.textContent = text;
    bubble.appendChild(bubbleText);

    if (role === "jarvis" && !isStream) {
        bubble.appendChild(createCopyBtn(text));
    }

    contentWrapper.appendChild(bubble);

    const timestamp = document.createElement("span");
    timestamp.className = "message-time";
    timestamp.textContent = time || getTimeString();
    contentWrapper.appendChild(timestamp);

    msg.appendChild(avatar);
    msg.appendChild(contentWrapper);
    chatArea.appendChild(msg);
    scrollToBottom();

    if (isStream && role === "jarvis") {
        return {
            bubbleEl: bubble,
            finalize: () => {
                const finalText = bubble.querySelector(".bubble-text").textContent;
                bubble.appendChild(createCopyBtn(finalText));
            },
        };
    }

    return { bubbleEl: bubble };
}

function createCopyBtn(text) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.title = "Copy to clipboard";
    copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>`;
    copyBtn.addEventListener("click", () => {
        const bubble = copyBtn.closest(".message-bubble");
        const currentText = bubble ? bubble.querySelector(".bubble-text").textContent : text;
        navigator.clipboard.writeText(currentText).then(() => {
            copyBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
            copyBtn.classList.add("copied");
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>`;
                copyBtn.classList.remove("copied");
            }, 2000);
        });
    });
    return copyBtn;
}

function showTyping() {
    const msg = document.createElement("div");
    msg.className = "message jarvis";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "J";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = `
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>`;

    msg.appendChild(avatar);
    msg.appendChild(bubble);
    chatArea.appendChild(msg);
    scrollToBottom();
    return msg;
}

function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
}

function setWaiting(val) {
    isWaiting = val;
    sendBtn.disabled = val;
    userInput.disabled = val;
    if (!val) userInput.focus();
}

// ===== Settings / Change Password =====
const settingsBtn = document.getElementById("settingsBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const changePwForm = document.getElementById("changePwForm");
const modalMessage = document.getElementById("modalMessage");

function openModal() {
    modalOverlay.classList.add("active");
    changePwForm.reset();
    modalMessage.className = "modal-message";
}

function closeModal() {
    modalOverlay.classList.remove("active");
}

settingsBtn.addEventListener("click", openModal);
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});

changePwForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const currentPw = document.getElementById("currentPw").value;
    const newPw = document.getElementById("newPw").value;
    const confirmPw = document.getElementById("confirmPw").value;

    // Get users from localStorage
    const usersRaw = localStorage.getItem("jarvis-users");
    const users = usersRaw ? JSON.parse(usersRaw) : [];
    const user = users.find(
        (u) => u.username.toLowerCase() === userData.username.toLowerCase()
    );

    if (!user) {
        modalMessage.textContent = "User not found.";
        modalMessage.className = "modal-message error";
        return;
    }

    if (user.password !== currentPw) {
        modalMessage.textContent = "Current password is incorrect.";
        modalMessage.className = "modal-message error";
        return;
    }

    if (newPw.length < 4) {
        modalMessage.textContent = "New password must be at least 4 characters.";
        modalMessage.className = "modal-message error";
        return;
    }

    if (newPw !== confirmPw) {
        modalMessage.textContent = "New passwords do not match.";
        modalMessage.className = "modal-message error";
        return;
    }

    if (newPw === currentPw) {
        modalMessage.textContent = "New password must be different from current.";
        modalMessage.className = "modal-message error";
        return;
    }

    // Update password
    user.password = newPw;
    localStorage.setItem("jarvis-users", JSON.stringify(users));

    modalMessage.textContent = "Password updated successfully!";
    modalMessage.className = "modal-message success";
    changePwForm.reset();

    setTimeout(closeModal, 1500);
});

// ===== Init =====
showWelcome();
renderSidebar();