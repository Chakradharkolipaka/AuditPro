import admin from "firebase-admin";

let initialized = false;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function initFirebaseAdmin() {
  if (initialized) return;

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    // Auth is optional in local/dev if not configured.
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  initialized = true;
}

export async function verifyFirebaseToken(idToken) {
  initFirebaseAdmin();
  if (!admin.apps.length) {
    throw Object.assign(new Error("Firebase Admin is not configured"), { status: 500 });
  }
  return admin.auth().verifyIdToken(idToken, true);
}
