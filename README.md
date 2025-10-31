## README.md: NeuraTube – AI Video Summarizer

NeuraTube is a Chrome extension that provides instant AI summaries, key takeaways, and insights for YouTube videos.

---

## 🚀 Features

* **Instant AI Summaries (Gemini 2.5 Flash)**: Generates a summary with key takeaways from a video's title, description, or transcript.
* **Persistent Sidebar**: Injects a custom sidebar directly into the YouTube watch page.
* **Robust Content Gathering**: Automatically pulls the video title and description.
* **Intelligent Fallback**: If the description is too short, it attempts to extract the video transcript/captions for a more detailed summary.

---

## 🔒 Security & Architecture (IMPORTANT)

This extension **does not contain the Gemini API Key**. For security, all AI summary requests are routed through a **secure, proprietary proxy server**.

* The file `content.js` calls the live endpoint: `https://neuratube-backend.vercel.app/api/summarizer`
* This proxy server securely holds and uses the Gemini API key, protecting it from being exposed on the client side.
* **If you fork this repository, the extension will continue to rely on the owner's active proxy server to function.** To use your own AI key, you must create and host your own serverless function or API endpoint and update the `API_ENDPOINT` constant in `content.js`.

---

## 🛠️ Key Technical Solutions (SPA Fixes)

This extension includes robust solutions to handle the unique challenges of YouTube's Single-Page Application (SPA) architecture:

1.  **Resolved Title Persistence**: Uses a dedicated `MutationObserver` on the browser's `<title>` tag combined with an aggressive retry loop to instantly detect navigation and force the correct video title to display immediately.
2.  **Resolved Panel Reload Failure**: Utilizes an `initialLoadCheck` interval to ensure the sidebar is injected only after the main YouTube container (`#secondary-inner`) is fully loaded, preventing the panel from disappearing on a full page reload.

---

## 📝 Installation

1.  **Clone or Download** this repository.
2.  **Open Chrome** and navigate to `chrome://extensions`.
3.  Enable **Developer mode** using the toggle switch in the top right.
4.  Click **Load unpacked** and select the extension directory.

The extension should now be active on any YouTube watch page.

---

### 🎥 Video Demo

Watch a full demonstration of NeuraTube's functionality, SPA handling, and AI summarization in the video below.

[**Watch the NeuraTube Demo on YouTube**](https://www.youtube.com/watch?v=L2lUBj6eCG0)
