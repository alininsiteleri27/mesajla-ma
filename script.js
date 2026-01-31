import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    limit,
    addDoc,
    onSnapshot,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Yapılandırma ---
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

// Uygulamayı Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'tr'; // SMS dili Türkçe olsun
const db = getFirestore(app);

// --- Dom Elementleri ---
const screens = {
    loading: document.getElementById('loading-screen'),
    login: document.getElementById('login-screen'),
    home: document.getElementById('home-screen'),
    chat: document.getElementById('chat-screen')
};

// --- Uygulama Durumu ---
let currentUser = null;
let currentChatId = null;
let confirmationResult = null;

// --- Yardımcı Fonksiyonlar ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- Auth İşlemleri ---
// Recaptcha Hazırlığı
window.setupRecaptcha = () => {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
            console.log("Recaptcha doğrulandı");
        }
    });
};

// Giriş Durumu Kontrolü
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Kullanıcıyı veritabanına kaydet/güncelle
        await setDoc(doc(db, "users", user.uid), {
            phoneNumber: user.phoneNumber,
            lastSeen: serverTimestamp(),
            status: "online"
        }, { merge: true });

        loadChats();
        showScreen('home');
    } else {
        currentUser = null;
        setupRecaptcha();
        showScreen('login');
    }
    // Loading ekranını kaldır (ilk açılışta)
    setTimeout(() => {
        if (screens.loading.classList.contains('active')) {
            // Eğer hala loading ise ve kullanıcı durumu belli olduysa
            screens.loading.classList.remove('active');
        }
    }, 1000);
});

// Kod Gönder
document.getElementById('get-code-btn').addEventListener('click', () => {
    const phoneNumber = document.getElementById('phone-number').value;
    const appVerifier = window.recaptchaVerifier;

    if (!phoneNumber) {
        alert("Lütfen numaranızı girin.");
        return;
    }

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((confirmation) => {
            confirmationResult = confirmation;
            document.getElementById('get-code-btn').classList.add('hidden');
            document.getElementById('recaptcha-container').classList.add('hidden'); // alanı gizle
            document.getElementById('verification-area').classList.remove('hidden');
            alert("SMS gönderildi!");
        }).catch((error) => {
            console.error(error);
            alert("Hata: " + error.message);
            window.recaptchaVerifier.render().then(widgetId => {
                grecaptcha.reset(widgetId);
            });
        });
});

// Kodu Doğrula
document.getElementById('verify-code-btn').addEventListener('click', () => {
    const code = document.getElementById('verification-code').value;
    if (!code) return;

    confirmationResult.confirm(code).then((result) => {
        const user = result.user;
        console.log("Giriş başarılı:", user);
        // onAuthStateChanged tetiklenecek
    }).catch((error) => {
        alert("Kod hatalı!");
    });
});

// Çıkış Yap
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => {
        location.reload();
    });
});

// --- Sohbet Mantığı ---

// Sohbetleri Yükle (Listen)
function loadChats() {
    const chatListEl = document.getElementById('chat-list');

    // Basit bir sorgu: içinde bulunduğum sohbetler
    // Not: Gerçek bir uygulamada array-contains kullanın veya subcollection
    // Burada demo amaçlı 'users' koleksiyonunu çekip listeleyeceğiz
    // (Birebir sohbet senaryosu)

    // DEMO: Sistemdeki diğer kullanıcıları listele (Rehber gibi)
    const q = query(collection(db, "users"), limit(20));

    onSnapshot(q, (snapshot) => {
        chatListEl.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (docSnap.id === currentUser.uid) return; // Kendini gösterme

            const el = document.createElement('div');
            el.className = 'chat-item';
            el.innerHTML = `
                <div class="avatar"></div>
                <div class="chat-info">
                    <div class="chat-header-row">
                        <span class="chat-name">${userData.phoneNumber || 'Kullanıcı'}</span>
                        <span class="chat-time">Şimdi</span>
                    </div>
                    <div class="chat-preview">
                        <span>Sohbet başlatmak için dokun</span>
                    </div>
                </div>
            `;
            el.addEventListener('click', () => openChat(docSnap.id, userData));
            chatListEl.appendChild(el);
        });
    });
}

// Sohbeti Aç
async function openChat(targetUserId, targetUserData) {
    currentChatId = [currentUser.uid, targetUserId].sort().join("_"); // Unique chat ID

    document.getElementById('current-chat-name').innerText = targetUserData.phoneNumber;
    showScreen('chat');

    loadMessages(currentChatId);
}

// Mesajları Yükle
let unsubscribeMessages = null;

function loadMessages(chatId) {
    const msgArea = document.getElementById('messages-area');
    msgArea.innerHTML = ""; // Temizle

    if (unsubscribeMessages) unsubscribeMessages();

    const q = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("timestamp", "asc")
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        msgArea.innerHTML = "";
        snapshot.forEach((doc) => {
            const msg = doc.data();
            renderMessage(msg, msg.senderId === currentUser.uid);
        });
        // Scroll to bottom
        msgArea.scrollTop = msgArea.scrollHeight;
    });
}

function renderMessage(msgData, isSent) {
    const msgArea = document.getElementById('messages-area');
    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    div.innerHTML = `
        ${msgData.text}
        <div class="message-meta">
            ${new Date(msgData.timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            ${isSent ? '<i class="ri-check-double-line"></i>' : ''}
        </div>
    `;
    msgArea.appendChild(div);
}

// Mesaj Gönder
document.getElementById('send-msg-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (!text || !currentChatId) return;

    input.value = ""; // Hemen temizle

    try {
        await addDoc(collection(db, "chats", currentChatId, "messages"), {
            text: text,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

        // Son mesajı güncelle (İsteğe bağlı ana chat listesi için)
        /* await setDoc(doc(db, "chats", currentChatId), {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            users: [currentUser.uid, targetUserId] // targetUserId'ye erişim lazım
        }, { merge: true }); */

    } catch (e) {
        console.error("Mesaj gönderme hatası:", e);
    }
}

// --- UI Etkileşimleri ---
document.getElementById('back-to-home').addEventListener('click', () => {
    if (unsubscribeMessages) unsubscribeMessages();
    showScreen('home');
});

document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('open');
});

document.getElementById('close-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('open');
});

// Yeni Chat Butonu (Demo: Sadece alert)
document.getElementById('new-chat-btn').addEventListener('click', () => {
    alert("Rehber entegrasyonu yakında!");
});

// Hikaye Ekleme (Demo)
document.querySelector('.add-story').addEventListener('click', () => {
    // Burada kamera açılır veya dosya seçilir
    alert("Hikaye ekleme özelliği hazırlanıyor...");
});


