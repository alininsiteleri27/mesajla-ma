// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, push, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDh4eT_k2bJCTemTqtuzVBvWJ_xpdt0rg0",
    authDomain: "minioyun-e3443.firebaseapp.com",
    databaseURL: "https://minioyun-e3443-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "minioyun-e3443",
    storageBucket: "minioyun-e3443.firebasestorage.app",
    messagingSenderId: "920583447480",
    appId: "1:920583447480:web:f4de965ff1b66139e5a54d",
    measurementId: "G-ZS0VHNMCZ7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global Variables
let currentUser = null;
let currentChatId = null;
let currentChatUser = null;
let userMood = 'happy';
let typingTimeout = null;
let recaptchaVerifier = null;
let confirmationResult = null;

// Smart Replies Database
const smartRepliesDB = {
    greetings: ["Merhaba! 👋", "Selam 😊", "Nasılsın?", "Hey! Ne var ne yok?"],
    positive: ["Harika! 🎉", "Süper 😍", "Kesinlikle! ✨", "Muhteşem 🔥"],
    questions: ["Peki sen?", "Ne yapıyorsun?", "Nasıl gidiyor?", "Anlatır mısın?"],
    casual: ["Tamam 👍", "Anladım 💡", "Haklısın", "Olur 😊"]
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupEventListeners();
    checkAuthState();
});

// Auth State Check
function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserData();
            showScreen('mainScreen');
        } else {
            showScreen('authScreen');
        }
    });
}

// Initialize Authentication
function initializeAuth() {
    // Setup Recaptcha
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'sendOtpBtn', {
        size: 'invisible',
        callback: (response) => {
            console.log('Recaptcha verified');
        }
    });
}

// Event Listeners
function setupEventListeners() {
    // Mood Selection
    document.querySelectorAll('.mood-btn, .mood-btn-small').forEach(btn => {
        btn.addEventListener('click', () => {
            const mood = btn.dataset.mood;
            selectMood(mood, btn.parentElement);
        });
    });

    // Auth Buttons
    document.getElementById('sendOtpBtn').addEventListener('click', sendOTP);
    document.getElementById('verifyOtpBtn').addEventListener('click', verifyOTP);

    // Navigation Buttons
    document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
    document.getElementById('groupsBtn').addEventListener('click', () => openModal('groupsModal'));
    document.getElementById('newChatBtn').addEventListener('click', () => openModal('newChatModal'));
    document.getElementById('backBtn').addEventListener('click', () => showScreen('mainScreen'));

    // Chat Actions
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('messageInput').addEventListener('input', handleTyping);
    document.getElementById('waveBtn').addEventListener('click', sendWave);
    document.getElementById('ghostModeBtn').addEventListener('click', toggleGhostMode);

    // Settings
    document.getElementById('moodThemeToggle').addEventListener('change', (e) => {
        if (e.target.checked) {
            applyMoodTheme(userMood);
        } else {
            document.body.removeAttribute('data-theme');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);

    // New Chat
    document.getElementById('startChatBtn').addEventListener('click', startNewChat);

    // Close Modals
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal').id);
        });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Mood Selection
function selectMood(mood, container) {
    userMood = mood;
    
    // Update UI
    container.querySelectorAll('.mood-btn, .mood-btn-small').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Apply theme
    if (document.getElementById('moodThemeToggle')?.checked !== false) {
        applyMoodTheme(mood);
    }
    
    // Update user mood display
    const moodEmojis = {
        happy: '😊',
        cool: '😎',
        love: '😍',
        calm: '😌'
    };
    
    const moodDisplay = document.getElementById('userMoodDisplay');
    if (moodDisplay) {
        moodDisplay.textContent = moodEmojis[mood];
    }
    
    // Save to Firebase
    if (currentUser) {
        update(ref(database, `users/${currentUser.uid}`), {
            mood: mood
        });
    }
}

function applyMoodTheme(mood) {
    document.body.setAttribute('data-theme', mood);
}

// Send OTP
async function sendOTP() {
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    
    if (!phoneNumber) {
        showToast('Lütfen telefon numaranızı girin');
        return;
    }

    try {
        const appVerifier = window.recaptchaVerifier;
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        
        document.getElementById('otpSection').classList.remove('hidden');
        showToast('Doğrulama kodu gönderildi!');
    } catch (error) {
        console.error('OTP Error:', error);
        showToast('Kod gönderilemedi. Lütfen tekrar deneyin.');
    }
}

// Verify OTP
async function verifyOTP() {
    const code = document.getElementById('otpCode').value.trim();
    
    if (!code) {
        showToast('Lütfen doğrulama kodunu girin');
        return;
    }

    try {
        const result = await confirmationResult.confirm(code);
        currentUser = result.user;
        
        // Save user data
        await set(ref(database, `users/${currentUser.uid}`), {
            phone: currentUser.phoneNumber,
            mood: userMood,
            createdAt: serverTimestamp(),
            online: true
        });
        
        showToast('Giriş başarılı! 🎉');
        showScreen('mainScreen');
    } catch (error) {
        console.error('Verification Error:', error);
        showToast('Geçersiz kod. Lütfen tekrar deneyin.');
    }
}

// Load User Data
async function loadUserData() {
    const userRef = ref(database, `users/${currentUser.uid}`);
    
    // Set user online
    update(userRef, { online: true });
    
    // Get user data
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        const userData = snapshot.val();
        userMood = userData.mood || 'happy';
        selectMood(userMood, document.querySelector('.mood-options'));
    }
    
    // Load chats
    loadChats();
    
    // Load stories
    loadStories();
    
    // Set offline on disconnect
    window.addEventListener('beforeunload', () => {
        update(userRef, { online: false });
    });
}

// Load Chats
function loadChats() {
    const chatsRef = ref(database, `userChats/${currentUser.uid}`);
    
    onValue(chatsRef, async (snapshot) => {
        const chatsList = document.getElementById('chatsList');
        chatsList.innerHTML = '';
        
        if (snapshot.exists()) {
            const chats = snapshot.val();
            
            for (const chatId in chats) {
                const chat = chats[chatId];
                const otherUserId = chat.userId;
                
                // Get other user data
                const userSnapshot = await get(ref(database, `users/${otherUserId}`));
                const userData = userSnapshot.val();
                
                // Get last message
                const messagesSnapshot = await get(ref(database, `messages/${chatId}`));
                let lastMessage = 'Yeni sohbet';
                let lastMessageTime = '';
                let unreadCount = 0;
                
                if (messagesSnapshot.exists()) {
                    const messages = Object.values(messagesSnapshot.val());
                    const last = messages[messages.length - 1];
                    lastMessage = last.text || '👋 Selam';
                    lastMessageTime = formatTime(last.timestamp);
                    
                    // Count unread
                    unreadCount = messages.filter(m => 
                        m.senderId !== currentUser.uid && !m.read
                    ).length;
                }
                
                // Get streak
                const streakSnapshot = await get(ref(database, `streaks/${chatId}`));
                const streak = streakSnapshot.exists() ? streakSnapshot.val().count : 0;
                
                const chatItem = createChatItem(
                    chatId,
                    userData,
                    lastMessage,
                    lastMessageTime,
                    unreadCount,
                    streak
                );
                
                chatsList.appendChild(chatItem);
            }
        } else {
            chatsList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Henüz sohbetiniz yok. Yeni sohbet başlatın! 💬</div>';
        }
    });
}

// Create Chat Item
function createChatItem(chatId, userData, lastMessage, time, unreadCount, streak) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat(chatId, userData);
    
    const moodEmojis = {
        happy: '😊',
        cool: '😎',
        love: '😍',
        calm: '😌'
    };
    
    div.innerHTML = `
        <div class="chat-item-avatar">
            ${moodEmojis[userData.mood] || '😊'}
            ${userData.online ? '<div class="online-indicator"></div>' : ''}
        </div>
        <div class="chat-item-info">
            <div class="chat-item-header">
                <span class="chat-item-name">${userData.phone || 'Kullanıcı'}</span>
                <span class="chat-item-time">${time}</span>
            </div>
            <div class="chat-item-preview">
                <span>${lastMessage}</span>
            </div>
        </div>
        ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
        ${streak > 0 ? `<div class="streak-indicator">🔥 ${streak}</div>` : ''}
    `;
    
    return div;
}

// Load Stories
function loadStories() {
    const storiesRef = ref(database, 'stories');
    
    onValue(storiesRef, async (snapshot) => {
        const storiesList = document.getElementById('storiesList');
        storiesList.innerHTML = '';
        
        if (snapshot.exists()) {
            const stories = snapshot.val();
            
            for (const userId in stories) {
                if (userId !== currentUser.uid) {
                    const userSnapshot = await get(ref(database, `users/${userId}`));
                    const userData = userSnapshot.val();
                    
                    const storyItem = document.createElement('div');
                    storyItem.className = 'story-item';
                    
                    const moodEmojis = {
                        happy: '😊',
                        cool: '😎',
                        love: '😍',
                        calm: '😌'
                    };
                    
                    storyItem.innerHTML = `
                        <div class="story-avatar has-story">${moodEmojis[userData.mood] || '😊'}</div>
                        <span>${userData.phone?.slice(-4) || 'User'}</span>
                    `;
                    
                    storiesList.appendChild(storyItem);
                }
            }
        }
    });
}

// Open Chat
async function openChat(chatId, userData) {
    currentChatId = chatId;
    currentChatUser = userData;
    
    // Update UI
    const moodEmojis = {
        happy: '😊',
        cool: '😎',
        love: '😍',
        calm: '😌'
    };
    
    document.getElementById('chatUserAvatar').textContent = moodEmojis[userData.mood] || '😊';
    document.getElementById('chatUserName').textContent = userData.phone || 'Kullanıcı';
    
    const statusElement = document.getElementById('chatUserStatus');
    if (userData.online) {
        statusElement.textContent = 'çevrimiçi';
        statusElement.classList.add('online');
    } else {
        statusElement.textContent = 'çevrimdışı';
        statusElement.classList.remove('online');
    }
    
    // Load streak
    const streakSnapshot = await get(ref(database, `streaks/${chatId}`));
    const streak = streakSnapshot.exists() ? streakSnapshot.val().count : 0;
    document.getElementById('streakCount').textContent = streak;
    
    // Load messages
    loadMessages();
    
    // Mark messages as read
    markMessagesAsRead();
    
    // Listen for typing
    listenForTyping();
    
    // Show chat screen
    showScreen('chatScreen');
}

// Load Messages
function loadMessages() {
    const messagesRef = ref(database, `messages/${currentChatId}`);
    
    onValue(messagesRef, (snapshot) => {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        if (snapshot.exists()) {
            const messages = snapshot.val();
            
            Object.keys(messages).forEach(messageId => {
                const message = messages[messageId];
                const messageElement = createMessageElement(message);
                container.appendChild(messageElement);
            });
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
            
            // Show smart replies for last message
            const lastMessage = Object.values(messages)[Object.values(messages).length - 1];
            if (lastMessage.senderId !== currentUser.uid) {
                showSmartReplies(lastMessage.text);
            }
        }
    });
}

// Create Message Element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    if (message.type === 'wave') {
        bubble.className = 'wave-message';
        bubble.textContent = '👋';
    } else {
        bubble.innerHTML = `
            <div class="message-text">${message.text}</div>
            <div class="message-meta">
                <span>${formatTime(message.timestamp)}</span>
                ${message.senderId === currentUser.uid && message.read ? '<span>✓✓</span>' : ''}
            </div>
            ${message.reactions ? `
                <div class="message-reactions">
                    ${Object.values(message.reactions).map(r => `<span class="reaction">${r}</span>`).join('')}
                </div>
            ` : ''}
        `;
    }
    
    div.appendChild(bubble);
    return div;
}

// Send Message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !currentChatId) return;
    
    const messageData = {
        senderId: currentUser.uid,
        text: text,
        timestamp: serverTimestamp(),
        read: false
    };
    
    // Add to messages
    await push(ref(database, `messages/${currentChatId}`), messageData);
    
    // Update streak
    await updateStreak();
    
    // Clear input
    input.value = '';
    
    // Hide smart replies
    document.getElementById('smartReplies').classList.add('hidden');
}

// Send Wave
async function sendWave() {
    if (!currentChatId) return;
    
    const waveData = {
        senderId: currentUser.uid,
        type: 'wave',
        timestamp: serverTimestamp(),
        read: false
    };
    
    await push(ref(database, `messages/${currentChatId}`), waveData);
    showToast('👋 Selam gönderildi!');
}

// Handle Typing
function handleTyping() {
    if (!currentChatId) return;
    
    // Set typing status
    set(ref(database, `typing/${currentChatId}/${currentUser.uid}`), true);
    
    // Clear previous timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Remove typing status after 2 seconds
    typingTimeout = setTimeout(() => {
        remove(ref(database, `typing/${currentChatId}/${currentUser.uid}`));
    }, 2000);
}

// Listen for Typing
function listenForTyping() {
    const typingRef = ref(database, `typing/${currentChatId}`);
    
    onValue(typingRef, (snapshot) => {
        const indicator = document.getElementById('typingIndicator');
        
        if (snapshot.exists()) {
            const typing = snapshot.val();
            const otherUserTyping = Object.keys(typing).some(uid => uid !== currentUser.uid);
            
            if (otherUserTyping) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        } else {
            indicator.classList.add('hidden');
        }
    });
}

// Mark Messages as Read
async function markMessagesAsRead() {
    const messagesRef = ref(database, `messages/${currentChatId}`);
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
        const messages = snapshot.val();
        const updates = {};
        
        Object.keys(messages).forEach(messageId => {
            const message = messages[messageId];
            if (message.senderId !== currentUser.uid && !message.read) {
                updates[`messages/${currentChatId}/${messageId}/read`] = true;
            }
        });
        
        if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);
        }
    }
}

// Update Streak
async function updateStreak() {
    const streakRef = ref(database, `streaks/${currentChatId}`);
    const snapshot = await get(streakRef);
    
    const today = new Date().toDateString();
    
    if (snapshot.exists()) {
        const streak = snapshot.val();
        const lastDate = new Date(streak.lastDate).toDateString();
        
        if (lastDate !== today) {
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            
            if (lastDate === yesterday) {
                // Continue streak
                await update(streakRef, {
                    count: streak.count + 1,
                    lastDate: today
                });
            } else {
                // Reset streak
                await set(streakRef, {
                    count: 1,
                    lastDate: today
                });
            }
        }
    } else {
        // Start new streak
        await set(streakRef, {
            count: 1,
            lastDate: today
        });
    }
}

// Show Smart Replies
function showSmartReplies(messageText) {
    const container = document.getElementById('smartReplies');
    container.innerHTML = '';
    
    // Determine message category
    let replies = [];
    const lowerText = messageText.toLowerCase();
    
    if (lowerText.includes('merhaba') || lowerText.includes('selam') || lowerText.includes('hey')) {
        replies = smartRepliesDB.greetings;
    } else if (lowerText.includes('?')) {
        replies = smartRepliesDB.questions;
    } else if (lowerText.includes('harika') || lowerText.includes('süper') || lowerText.includes('güzel')) {
        replies = smartRepliesDB.positive;
    } else {
        replies = smartRepliesDB.casual;
    }
    
    // Show 3 random replies
    const selectedReplies = replies.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    selectedReplies.forEach(reply => {
        const btn = document.createElement('button');
        btn.className = 'smart-reply';
        btn.textContent = reply;
        btn.onclick = () => {
            document.getElementById('messageInput').value = reply;
            sendMessage();
        };
        container.appendChild(btn);
    });
    
    container.classList.remove('hidden');
}

// Toggle Ghost Mode
let ghostModeActive = false;

function toggleGhostMode() {
    ghostModeActive = !ghostModeActive;
    const btn = document.getElementById('ghostModeBtn');
    
    if (ghostModeActive) {
        btn.style.background = 'var(--accent-color)';
        showToast('👻 Hayalet Modu Aktif - Mesajlar 3 saniye sonra silinecek');
        
        // Add ghost mode class to messages container
        document.getElementById('messagesContainer').classList.add('ghost-mode');
    } else {
        btn.style.background = '';
        showToast('Hayalet Modu Kapatıldı');
        document.getElementById('messagesContainer').classList.remove('ghost-mode');
    }
}

// Start New Chat
async function startNewChat() {
    const phone = document.getElementById('newChatPhone').value.trim();
    
    if (!phone) {
        showToast('Lütfen telefon numarası girin');
        return;
    }
    
    // Find user by phone
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
        const users = snapshot.val();
        let foundUserId = null;
        
        for (const userId in users) {
            if (users[userId].phone === phone) {
                foundUserId = userId;
                break;
            }
        }
        
        if (foundUserId) {
            // Create chat ID
            const chatId = [currentUser.uid, foundUserId].sort().join('_');
            
            // Add to user chats
            await set(ref(database, `userChats/${currentUser.uid}/${chatId}`), {
                userId: foundUserId
            });
            
            await set(ref(database, `userChats/${foundUserId}/${chatId}`), {
                userId: currentUser.uid
            });
            
            closeModal('newChatModal');
            showToast('Sohbet başlatıldı! 💬');
            
            // Open chat
            const userData = users[foundUserId];
            openChat(chatId, userData);
        } else {
            showToast('Kullanıcı bulunamadı');
        }
    }
}

// Logout
async function logout() {
    if (currentUser) {
        await update(ref(database, `users/${currentUser.uid}`), {
            online: false
        });
    }
    
    await auth.signOut();
    currentUser = null;
    showScreen('authScreen');
    showToast('Çıkış yapıldı');
}

// Utility Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Şimdi';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} dk önce`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} saat önce`;
    }
    
    // Show time
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
