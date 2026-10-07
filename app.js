/* =========================================================
   NTALK - COMPLETE APP.JS
   Supabase Auth + Profiles + Private Chats + Messages
   ========================================================= */

const SUPABASE_URL =
  window.NTALK_CONFIG?.SUPABASE_URL ||
  "https://ilzqlqjiuuajbrolusli.supabase.co";

const SUPABASE_ANON_KEY =
  window.NTALK_CONFIG?.SUPABASE_ANON_KEY || "";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================================
   GLOBAL STATE
   ========================================================= */

window.currentChat = null;
window.currentChatId = null;

let currentUser = null;
let currentProfile = null;
let messageChannel = null;


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function uid() {
  return currentUser?.id || null;
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function avatarName(name) {
  return (
    String(name || "User")
      .trim()
      .charAt(0)
      .toUpperCase() || "U"
  );
}

function formatTime(date) {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(date) {
  if (!date) return "";

  return new Date(date).toLocaleDateString([], {
    day: "2-digit",
    month: "short"
  });
}


/* =========================================================
   AUTH SESSION
   ========================================================= */

async function initApp() {
  try {
    const {
      data: { session },
      error
    } = await sb.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      return;
    }

    if (session?.user) {
      currentUser = session.user;

      await loadProfile();
      await loadChats();
      setupRealtime();

      showApp();
    } else {
      showAuth();
    }

  } catch (err) {
    console.error("Init error:", err);
  }
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

sb.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;

    await loadProfile();
    await loadChats();
    setupRealtime();

    showApp();
  } else {
    currentUser = null;
    currentProfile = null;

    showAuth();
  }
});


/* =========================================================
   SHOW AUTH / APP
   ========================================================= */

function showAuth() {
  const auth = $("authScreen");
  const app = $("app");

  if (auth) auth.style.display = "";
  if (app) app.style.display = "none";
}

function showApp() {
  const auth = $("authScreen");
  const app = $("app");

  if (auth) auth.style.display = "none";
  if (app) app.style.display = "";
}


/* =========================================================
   LOAD CURRENT PROFILE
   ========================================================= */

async function loadProfile() {
  if (!uid()) return null;

  const { data, error } = await sb
    .from("profiles")
    .select("id,username,full_name,avatar_url")
    .eq("id", uid())
    .maybeSingle();

  if (error) {
    console.error("Profile error:", error);
    return null;
  }

  currentProfile = data;

  updateProfileUI(); 

  return data;
}


/* =========================================================
   PROFILE UI
   ========================================================= */

function updateProfileUI() {
  if (!currentProfile) return;

  const name =
    currentProfile.full_name ||
    currentProfile.username ||
    "User";

  const username =
    currentProfile.username || "";

  const nameElements = [
    $("profileName"),
    $("userName"),
    $("myName"),
    $("accountName")
  ];

  nameElements.forEach(el => {
    if (el) el.textContent = name;
  });

  const usernameElements = [
    $("profileUsername"),
    $("userUsername"),
    $("myUsername"),
    $("accountUsername")
  ];

  usernameElements.forEach(el => {
    if (el) {
      el.textContent =
        username ? "@" + username : "";
    }
  });

  const avatarElements = [
    $("profileAvatar"),
    $("userAvatar"),
    $("myAvatar")
  ];

  avatarElements.forEach(el => {
    if (!el) return;

    if (currentProfile.avatar_url) {
      el.src = currentProfile.avatar_url;
    } else {
      el.textContent = avatarName(name);
    }
  });
}


/* =========================================================
   REGISTER
   ========================================================= */

async function doRegister() {
  const nameInput =
    $("registerName") ||
    $("fullName") ||
    $("displayName");

  const usernameInput =
    $("registerUsername") ||
    $("username");

  const emailInput =
    $("registerEmail") ||
    $("email");

  const passwordInput =
    $("registerPassword") ||
    $("password");

  const name =
    nameInput?.value.trim() || "";

  const username =
    usernameInput?.value.trim() || "";

  const email =
    emailInput?.value.trim() || "";

  const password =
    passwordInput?.value || "";

  if (!name || !username || !email || !password) {
    alert("Please fill all fields.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  try {

    const { data, error } =
      await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            full_name: name
          }
        }
      });

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    if (data.user) {

      const { error: profileError } =
        await sb
          .from("profiles")
          .upsert({
            id: data.user.id,
            username: username,
            full_name: name
          });

      if (profileError) {
        console.error(
          "Profile creation error:",
          profileError
        );
      }
    }

    alert(
      "Account created successfully!"
    );

    showLogin();

  } catch (err) {
    console.error(err);
    alert("Registration failed.");
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function doLogin() {

  const emailInput =
    $("loginEmail") ||
    $("email");

  const passwordInput =
    $("loginPassword") ||
    $("password");

  const email =
    emailInput?.value.trim() || "";

  const password =
    passwordInput?.value || "";

  if (!email || !password) {
    alert("Enter email and password.");
    return;
  }

  try {

    const { data, error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    currentUser = data.user;

    await loadProfile();
    await loadChats();

    setupRealtime();

    showApp();

  } catch (err) {
    console.error(err);
    alert("Login failed.");
  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function doLogout() {

  if (messageChannel) {
    await sb.removeChannel(messageChannel);
    messageChannel = null;
  }

  await sb.auth.signOut();

  currentUser = null;
  currentProfile = null;
  window.currentChat = null;
  window.currentChatId = null;

  showAuth();
}


/* =========================================================
   LOGIN / REGISTER SCREEN SWITCH
   ========================================================= */

function showLogin() {

  const login =
    $("loginForm") ||
    $("loginScreen");

  const register =
    $("registerForm") ||
    $("registerScreen");

  if (login) login.style.display = "";
  if (register) register.style.display = "none";
}

function showRegister() {

  const login =
    $("loginForm") ||
    $("loginScreen");

  const register =
    $("registerForm") ||
    $("registerScreen");

  if (login) login.style.display = "none";
  if (register) register.style.display = "";
}


/* =========================================================
   LOAD ALL USERS / CHATS
   ========================================================= */

async function loadChats() {

  if (!uid()) return;

  const { data, error } =
    await sb
      .from("profiles")
      .select(
        "id,username,full_name,avatar_url"
      )
      .neq("id", uid())
      .order("full_name");

  if (error) {
    console.error(
      "Load users error:",
      error
    );
    return;
  }

  renderUsers(data || []);
}


/* =========================================================
   RENDER USERS
   ========================================================= */

function renderUsers(users) {

  const container =
    $("chatList") ||
    $("usersList") ||
    $("contactsList");

  if (!container) return;

  container.innerHTML = "";

  if (!users.length) {

    container.innerHTML = `
      <div class="empty-users">
        No other users found
      </div>
    `;

    return;
  }

  users.forEach(user => {

    const name =
      user.full_name ||
      user.username ||
      "User";

    const item =
      document.createElement("div");

    item.className = "chat-item";

    item.innerHTML = `
      <div class="avatar">
        ${
          user.avatar_url
            ? `<img src="${escapeHTML(
                user.avatar_url
              )}" alt="">`
            : escapeHTML(
                avatarName(name)
              )
        }
      </div>

      <div class="chat-item-info">
        <div class="chat-item-name">
          ${escapeHTML(name)}
        </div>

        <div class="chat-item-username">
          @${escapeHTML(
            user.username || ""
          )}
        </div>
      </div>
    `;

    item.addEventListener(
      "click",
      () => openChat(user)
    );

    container.appendChild(item);
  });
}


/* =========================================================
   OPEN CHAT
   ========================================================= */

async function openChat(user) {

  if (!user || !user.id) return;

  window.currentChat = {
    user_id: user.id,
    name:
      user.full_name ||
      user.username ||
      "User",
    username:
      user.username || "",
    avatar_url:
      user.avatar_url || ""
  };

  // Find/create chat
  try {

    const chatId =
      await getOrCreateChat(user.id);

    window.currentChatId = chatId;

    updateChatHeader();

    await loadMessages(chatId);

  } catch (err) {

    console.error(
      "Open chat error:",
      err
    );

    alert(
      err.message ||
      "Unable to open chat."
    );
  }
}


/* =========================================================
   CHAT HEADER
   ========================================================= */

function updateChatHeader() {

  const chat = window.currentChat;

  if (!chat) return;

  const name =
    chat.name || "User";

  const nameElements = [
    $("chatName"),
    $("currentChatName"),
    $("activeChatName")
  ];

  nameElements.forEach(el => {
    if (el) el.textContent = name;
  });

  const usernameElements = [
    $("chatUsername"),
    $("currentChatUsername")
  ];

  usernameElements.forEach(el => {
    if (el) {
      el.textContent =
        chat.username
          ? "@" + chat.username
          : "";
    }
  });

  const avatarElements = [
    $("chatAvatar"),
    $("currentChatAvatar"),
    $("activeChatAvatar")
  ];

  avatarElements.forEach(el => {

    if (!el) return;

    if (chat.avatar_url) {
      el.src = chat.avatar_url;
    } else {
      el.textContent =
        avatarName(name);
    }
  });
}


/* =========================================================
   GET OR CREATE PRIVATE CHAT
   ========================================================= */

async function getOrCreateChat(otherUserId) {

  const myId = uid();

  if (!myId || !otherUserId) {
    throw new Error(
      "Invalid user."
    );
  }

  /*
    First check whether a previous message
    exists between these two users.
  */

  const { data: existingMessages, error } =
    await sb
      .from("messages")
      .select("chat_id")
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`
      )
      .order("created_at", {
        ascending: false
      })
      .limit(1);

  if (error) {
    console.error(
      "Find chat error:",
      error
    );

    throw error;
  }

  if (
    existingMessages &&
    existingMessages.length
  ) {
    return existingMessages[0].chat_id;
  }

  /*
    No previous message.
    Create a new private chat.
  */

  const { data: newChat, error: createError } =
    await sb
      .from("chats")
      .insert({
        chat_type: "private",
        created_by: myId
      })
      .select("id")
      .single();

  if (createError) {

    console.error(
      "Create chat error:",
      createError
    );

    throw createError;
  }

  return newChat.id;
}


/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages(chatId) {

  if (!chatId) return;

  const { data, error } =
    await sb
      .from("messages")
      .select(`
        id,
        chat_id,
        sender_id,
        receiver_id,
        content,
        message_type,
        file_path,
        file_name,
        file_size,
        mime_type,
        reply_to,
        created_at,
        delivered_at,
        seen_at,
        edited_at,
        deleted_at
      `)
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .order("created_at", {
        ascending: true
      });

  if (error) {

    console.error(
      "Load messages error:",
      error
    );

    return;
  }

  renderMessages(data || []);
}


/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages(messages) {

  const container =
    $("messages") ||
    $("messageList") ||
    $("messagesContainer");

  if (!container) return;

  container.innerHTML = "";

  messages.forEach(message => {

    const mine =
      message.sender_id === uid();

    const wrapper =
      document.createElement("div");

    wrapper.className =
      mine
        ? "message sent"
        : "message received";

    let content = "";

    if (
      message.message_type ===
      "image" &&
      message.file_path
    ) {

      content = `
        <img
          src="${escapeHTML(
            message.file_path
          )}"
          class="message-image"
          alt=""
        >
      `;

    } else {

      content =
        escapeHTML(
          message.content || ""
        );
    }

    wrapper.innerHTML = `
      <div class="message-bubble">
        <div class="message-content">
          ${content}
        </div>

        <div class="message-meta">
          ${formatTime(
            message.created_at
          )}
          ${
            mine
              ? message.seen_at
                ? " ✓✓"
                : message.delivered_at
                  ? " ✓✓"
                  : " ✓"
              : ""
          }
        </div>
      </div>
    `;

    container.appendChild(wrapper);
  });

  container.scrollTop =
    container.scrollHeight;
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

  const input =
    $("messageInput") ||
    $("messageText") ||
    $("chatInput");

  if (!input) {
    console.error(
      "Message input not found."
    );
    return;
  }

  const text =
    input.value.trim();

  if (!text) return;

  const chat =
    window.currentChat;

  if (!chat || !chat.user_id) {

    alert(
      "First select a user."
    );

    return;
  }

  try {

    const chatId =
      window.currentChatId ||
      await getOrCreateChat(
        chat.user_id
      );

    window.currentChatId =
      chatId;

    const { data, error } =
      await sb
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: uid(),
          receiver_id:
            chat.user_id,
          content: text,
          message_type: "text"
        })
        .select()
        .single();

    if (error) {

      console.error(
        "Send message error:",
        error
      );

      alert(error.message);
      return;
    }

    input.value = "";

    await loadMessages(chatId);

    console.log(
      "Message sent:",
      data
    );

  } catch (err) {

    console.error(
      "Send message error:",
      err
    );

    alert(
      err.message ||
      "Failed to send message."
    );
  }
}


/* =========================================================
   ENTER KEY TO SEND
   ========================================================= */

function setupMessageInput() {

  const input =
    $("messageInput") ||
    $("messageText") ||
    $("chatInput");

  if (!input) return;

  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();
      }
    }
  );
}


/* =========================================================
   REALTIME MESSAGES
   ========================================================= */

function setupRealtime() {

  if (!uid()) return;

  if (messageChannel) {
    sb.removeChannel(
      messageChannel
    );
  }

  messageChannel =
    sb
      .channel(
        "ntalk-messages-" +
        uid()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        async payload => {

          const message =
            payload.new;

          /*
            Only refresh the currently
            open conversation.
          */

          if (
            window.currentChatId &&
            message.chat_id ===
              window.currentChatId
          ) {

            await loadMessages(
              window.currentChatId
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages"
        },
        async payload => {

          const message =
            payload.new;

          if (
            window.currentChatId &&
            message.chat_id ===
              window.currentChatId
          ) {

            await loadMessages(
              window.currentChatId
            );
          }
        }
      )
      .subscribe(status => {

        console.log(
          "Realtime status:",
          status
        );
      });
}


/* =========================================================
   MARK MESSAGES AS SEEN
   ========================================================= */

async function markMessagesSeen(chatId) {

  if (!chatId || !uid()) return;

  const { error } =
    await sb
      .from("messages")
      .update({
        seen_at: new Date().toISOString()
      })
      .eq("chat_id", chatId)
      .eq(
        "receiver_id",
        uid()
      )
      .is("seen_at", null);

  if (error) {
    console.error(
      "Seen update error:",
      error
    );
  }
}


/* =========================================================
   MARK MESSAGES DELIVERED
   ========================================================= */

