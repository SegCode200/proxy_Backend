// src/lib/notifications.ts
import prisma from "../lib/prisma";

// FCM option (recommended if you use Firebase)
import admin from "firebase-admin";
// Expo option
import { Expo } from "expo-server-sdk";

let expo = new Expo();

// Initialize firebase-admin only if credentials provided
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  } catch (err) {
    console.warn("Failed to init firebase-admin:", err);
  }
}

export async function sendFcm(token: string, title: string, body: string, data?: Record<string, string>) {
  if (!admin.apps.length) {
    console.warn("Firebase admin not initialized; skipping FCM send");
    return;
  }
  try {
    await admin.messaging().send({
      token,
      android: { priority: "high" },
      apns: { headers: { "apns-priority": "10" } },
      notification: { title, body },
      data: data || {},
    });
  } catch (err) {
    console.error("FCM send error", err);
  }
}

export async function sendExpo(token: string, title: string, body: string, data?: any) {
  if (!Expo.isExpoPushToken(token)) {
    console.warn("Invalid Expo push token:", token);
    return;
  }
  const message = {
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
  };
  try {
    const ticket = await expo.sendPushNotificationsAsync([message]);
    // you might handle receipts here in production
    return ticket;
  } catch (err) {
    console.error("Expo send error", err);
  }
}
