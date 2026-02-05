# Code Signing & Notarization Guide for macOS

## 🎯 Current Distribution Strategy: Unsigned Builds

**This project currently uses unsigned distribution** to avoid the $99/year Apple Developer Program cost.

### What This Means

- ✅ **App works perfectly** - All functionality is intact
- ⚠️ **Users see security warnings** - macOS Gatekeeper will block the app on first launch
- 📖 **Clear instructions provided** - See [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md)
- 🎯 **Target audience** - Technical users and early adopters

### Current Build Configuration

The app is built with these settings in `package.json`:

```json
"mac": {
  "identity": null,              // No code signing
  "gatekeeperAssess": false,     // Skip Gatekeeper assessment
  "hardenedRuntime": false,      // No hardened runtime
  "entitlements": null           // No entitlements
}
```

### When to Upgrade to Paid Signing

Consider enrolling in the Apple Developer Program ($99/year) when:

- 📈 You have a significant user base (100+ users)
- 💰 The app generates revenue
- 🎯 You need to reach non-technical users
- 🏢 You want a professional image
- 📦 You plan to distribute through channels other than GitHub

---

## 💳 Paid Code Signing (Apple Developer Program Required)

To distribute your macOS application without users seeing "App is damaged" or "Unidentified Developer" warnings, you must **sign** and **notarize** your application.

## Prerequisites

1.  **Apple Developer Program**: You must enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2.  **Xcode**: Install Xcode from the Mac App Store (required for notarization tools).

---

## Step 1: Generate Certificates

1.  Log in to [Apple Developer Account](https://developer.apple.com/account/).
2.  Go to **Certificates, Identifiers & Profiles**.
3.  Click **+** to create a new certificate.
4.  Select **Developer ID Application** (for distributing outside the Mac App Store).
5.  Follow the instructions to create a Certificate Signing Request (CSR) via Keychain Access.
6.  Download the `.cer` file and double-click it to install it into your Keychain.

## Step 2: Configure Code Signing (Local)

If you have the valid "Developer ID Application" certificate in your Keychain, `electron-builder` will try to find it automatically.

To check if you have a valid signing identity:
```bash
security find-identity -v -p codesigning
```
You should see your Developer ID listed.

## Step 3: Configure Notarization (Required for macOS Catalina+)

Even if signed, macOS will block the app unless it is notarized by Apple.

1.  **Generate an App-Specific Password**:
    *   Go to [appleid.apple.com](https://appleid.apple.com).
    *   Sign in and generate an App-Specific Password (e.g., `abcd-efgh-ijkl-mnop`).

2.  **Update `package.json`**:
    Ensure your `build` config has the correct `appId` matching your Apple Developer account settings (though for non-App Store builds, any unique ID usually works, matching a Provisioning Profile is safer).

3.  **Set Environment Variables**:
    When running the build, you need to provide credentials. **DO NOT** commit these to `package.json`.

    ```bash
    export APPLE_ID="your@email.com"
    export APPLE_ID_PASSWORD="abcd-efgh-ijkl-mnop"
    export CSC_IDENTITY_AUTO_DISCOVERY="true"
    
    npm run dist
    ```
    *Note: `electron-builder` automatically handles notarization if these variables are set and the app is signed.*

## Step 4: Setting up GitHub Actions (CI/CD)

To sign and notarize builds automatically in GitHub Actions:

1.  **Export Certificate**:
    *   Open Keychain Access.
    *   Right-click your **Developer ID Application** certificate (and private key) -> Export.
    *   Save as `cert.p12` with a strong password.

2.  **Encode Certificate**:
    Convert the `.p12` file to base64 string to store as a secret.
    ```bash
    base64 -i cert.p12 | pbcopy
    ```

3.  **Add GitHub Secrets**:
    Go to your Repo Settings -> Secrets and Variables -> Actions -> New Repository Secret.
    *   `CSC_LINK`: (Paste the base64 content)
    *   `CSC_KEY_PASSWORD`: (The password you set for the .p12 file)
    *   `APPLE_ID`: Your Apple ID email.
    *   `APPLE_APP_SPECIFIC_PASSWORD`: The app-specific password.

4.  **Update `release.yml`**:
    Pass these secrets to the build environment.

    ```yaml
    - name: Build and Sign Electron App
      run: npm run dist
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        CSC_LINK: ${{ secrets.CSC_LINK }}
        CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
        APPLE_ID: ${{ secrets.APPLE_ID }}
        APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    ```

## Troubleshooting: "Build Failed: specified item could not be found in keychain"

This error means `electron-builder` matched a certificate hash (identity) but couldn't access the private key in your Keychain.

*   **Fix**: Run `security find-identity -v -p codesigning`. If your cert is missing or has `(CSSMERR_TP_CERT_EXPIRED)`, delete it from Keychain, download the new one from Apple Developer, and install it.
*   **Workaround (Local Only)**: Disable signing to test a build locally.
    ```bash
    CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
    ```
