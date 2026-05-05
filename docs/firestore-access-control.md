# Firestore Access Control (Splitters)

Para **como operar papéis, aprovações e presets na gestão de usuários** (texto voltado a TI / NotebookLM), ver **`docs/gestao-permissoes-usuarios.md`**.

## Collection
- `splitters_users/{uid}`

## Document shape
```json
{
  "uid": "firebase-auth-uid",
  "email": "usuario@empresa.com",
  "displayName": "Nome Sobrenome",
  "isActive": true,
  "permissions": {
    "canViewSplitters": true,
    "canViewMassiva": true,
    "canOpenMassiva": false,
    "canViewIntelligence": true,
    "isAdmin": false
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "lastLoginAt": "serverTimestamp"
}
```

## Important
- Passwords are handled by Firebase Authentication.
- Do not store plaintext passwords in Firestore.

## Suggested Firestore rules (starting point)
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isSelf(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/splitters_users/$(request.auth.uid)).data.permissions.isAdmin == true;
    }

    match /splitters_users/{uid} {
      allow read: if isSelf(uid) || isAdmin();
      allow create: if isSelf(uid);
      allow update: if isAdmin() || isSelf(uid);
      allow delete: if false;
    }
  }
}
```
