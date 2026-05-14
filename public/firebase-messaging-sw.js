/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCDAzfb5nHdg8hGPnq-g0S4ojT_lSHmdD4",
  authDomain: "planner-insanus---v2.firebaseapp.com",
  projectId: "planner-insanus---v2",
  storageBucket: "planner-insanus---v2.firebasestorage.app",
  messagingSenderId: "853047463220",
  appId: "1:853047463220:web:4d1f72aa5a197c49256961"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Mensagem em segundo plano recebida:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
