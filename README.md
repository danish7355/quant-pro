# Crypto Trading Bot - Deployment Guide

This repository contains the full-stack algorithmic cryptocurrency trading bot. The frontend is built with React/Vite, and the backend engine runs on Node.js/Express.

## 🚀 Deploying to Render.com

This app is pre-configured for 1-click deployment on [Render](https://render.com) using the included `render.yaml` Blueprint.

### Steps to deploy:

1. **Push to GitHub**: Make sure this code is pushed to your own GitHub repository.
2. **Connect to Render**: 
   - Go to the [Render Dashboard](https://dashboard.render.com/).
   - Click **New +** and select **Blueprint**.
   - Connect your GitHub account and select your repository.
3. **Configure Environment Variables**:
   - Render will automatically detect the settings in `render.yaml`.
   - You will be prompted to enter the `FIREBASE_CONFIG` environment variable.
   - For `FIREBASE_CONFIG`, paste the raw JSON contents of your `firebase-applet-config.json` file. It should look like this:
     ```json
     {
       "apiKey": "AIzaSy...",
       "authDomain": "...",
       "projectId": "...",
       ...
     }
     ```
4. **Deploy**: Click **Apply** to start the build and deployment process.

Render will run `npm install`, build the Vite frontend, compile the Node.js backend using `esbuild`, and start the combined full-stack Express server on port 3000 (which Render will automatically route external traffic to).

### Required Environment Variables

If you deploy this manually (without the Blueprint), you must configure these environment variables on your Render Web Service:
- `NODE_VERSION`: `22.14.0` (or higher)
- `PORT`: `3000`
- `FIREBASE_CONFIG`: (Your JSON stringified Firebase credentials)
