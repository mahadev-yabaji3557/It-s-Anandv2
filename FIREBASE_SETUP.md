# Firebase Setup Instructions

Your SAAC application requires Firebase credentials to function. Follow these steps:

## Step 1: Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **smart-classroom-attendan-12911**
3. Click **⚙️ Project Settings** (gear icon)
4. Go to the **Service Accounts** tab
5. Click **"Generate New Private Key"** button
6. A JSON file will download - **DO NOT lose this file**

## Step 2: Add Credentials to .env

You now have the JSON file with your credentials. Choose ONE of these options:

### Option A: Direct JSON (Easier for local development)
1. Open the downloaded JSON file with a text editor
2. Copy the entire contents (everything inside `{ }`)
3. Paste it into your `.env` file, replacing the value of `FIREBASE_SERVICE_ACCOUNT_JSON`:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"smart-classroom-attendan-12911",...}
```

⚠️ **Important:** Keep it all on ONE line. Remove any line breaks.

### Option B: Base64 Encoding (Better for production)
1. Copy the entire JSON content
2. Go to [base64encode.org](https://www.base64encode.org/) or use command:
   ```powershell
   $json = Get-Content -Raw .\path\to\service-account.json
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
   ```
3. Paste the encoded string into `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6InNtYXJ0LWNsYXNzcm9vbS1hdHRlbmRhbiIsIn0...
   ```

## Step 3: Other Environment Variables

- **JWT_SECRET**: Change "change_me_to_a_long_random_secret" to a strong random string
- **SEED_KEY**: Change "change_me_seed_secret" to a random string

## Step 4: Start Your Server

```powershell
npm start
```

Your server should now run without authentication errors!

## Troubleshooting

- **"Missing Firebase service account"**: You skipped Step 2. Make sure `.env` has valid credentials.
- **"Invalid JSON"**: Check that your JSON is on ONE line with no line breaks.
- **"Firebase REST GET failed: 401"**: Your credentials are invalid. Download a new JSON file from Firebase Console.
