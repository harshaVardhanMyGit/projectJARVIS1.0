// ===== Theme (same as main app) =====
function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("jarvis-theme", theme);
}
setTheme(localStorage.getItem("jarvis-theme") || "dark");

// ===== DOM Elements =====
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authTabs = document.querySelectorAll(".auth-tab");
const authMessage = document.getElementById("authMessage");

// ===== Tab Switching =====
authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        authTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const target = tab.dataset.tab;
        if (target === "login") {
            loginForm.classList.add("active");
            signupForm.classList.remove("active");
        } else {
            loginForm.classList.remove("active");
            signupForm.classList.add("active");
        }
        hideMessage();
    });
});

// ===== Helper: Get users from localStorage =====
function getUsers() {
    const data = localStorage.getItem("jarvis-users");
    return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
    localStorage.setItem("jarvis-users", JSON.stringify(users));
}

// ===== Helper: Show message =====
function showMessage(text, type = "error") {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
}

function hideMessage() {
    authMessage.className = "auth-message";
    authMessage.textContent = "";
}

// ===== Sign Up =====
signupForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupConfirm").value;

    if (username.length < 3) {
        return showMessage("Username must be at least 3 characters.");
    }

    if (password.length < 4) {
        return showMessage("Password must be at least 4 characters.");
    }

    if (password !== confirm) {
        return showMessage("Passwords do not match.");
    }

    const users = getUsers();

    // Check if username already exists
    if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
        return showMessage("That identity already exists in the system.");
    }

    // Store user
    users.push({ username, password });
    saveUsers(users);

    showMessage("Identity created successfully! You may now log in.", "success");

    // Switch to login tab
    setTimeout(() => {
        authTabs[0].click();
        document.getElementById("loginUsername").value = username;
        document.getElementById("loginPassword").focus();
    }, 1000);

    signupForm.reset();
});

// ===== Login =====
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
        return showMessage("Please enter both username and password.");
    }

    const users = getUsers();
    const user = users.find(
        (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!user) {
        return showMessage("Invalid credentials. Access denied.");
    }

    // Mark as logged in
    localStorage.setItem("jarvis-current-user", JSON.stringify({ username: user.username }));

    showMessage(`Access granted. Welcome back, ${user.username}.`, "success");

    // Redirect to chat
    setTimeout(() => {
        window.location.href = "/";
    }, 800);
});

// ===== If already logged in, redirect =====
const currentUser = localStorage.getItem("jarvis-current-user");
if (currentUser) {
    window.location.href = "/";
}
