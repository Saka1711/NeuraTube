// --- Configuration ---
const API_ENDPOINT = "https://neuratube-backend.vercel.app/api/summarizer";

let titleRetryInterval = null;
let currentVideoId = null;

// Utility function to extract the video ID from the URL
function getVideoId(url) {
    try {
        const params = new URLSearchParams(new URL(url).search);
        return params.get('v');
    } catch (e) {
        return null;
    }
}

// Utility function to attempt to extract transcript text
function getTranscriptText() {
    const transcriptContainer = document.querySelector("#segments-container");
    
    if (transcriptContainer && transcriptContainer.innerText.length > 100) {
        const rawText = transcriptContainer.innerText;
        const cleanedText = rawText.replace(/(\d+:\d{2}:\d{2})\s*\n?/g, ' ').trim();
        return cleanedText.substring(0, 5000); 
    }
    
    const transcriptBody = document.querySelector('ytd-transcript-body-renderer');
    if (transcriptBody) {
        const textElements = transcriptBody.querySelectorAll('yt-formatted-string');
        if (textElements.length > 0) {
            let fullTranscript = '';
            textElements.forEach(el => {
                const text = el.textContent.trim();
                if (text) {
                    fullTranscript += text + ' ';
                }
            });
            return fullTranscript.trim().substring(0, 5000);
        }
    }
    
    return "";
}

// Fixes the "Untitled Video (Loading...)" issue after navigation
function aggressivelyUpdateTitle() {
    if (titleRetryInterval) clearInterval(titleRetryInterval);
    
    let attempts = 0;
    const maxAttempts = 50; 
    
    titleRetryInterval = setInterval(() => {
        if (!document.getElementById("neuratube-sidebar") || attempts >= maxAttempts) {
            clearInterval(titleRetryInterval);
            titleRetryInterval = null;
            return;
        }
        
        const { title } = updateVideoInfo();
        attempts++;
        
        if (title.length > 5 && title !== "Untitled Video (Loading...)") {
            clearInterval(titleRetryInterval);
            titleRetryInterval = null; 
        }
    }, 100); 
}


// HYBRID OBSERVER: Using Title Observer for Navigation (Fixes Title) + Interval for Reload (Fixes Panel)
function waitForVideoPage() {
    
    const titleElement = document.querySelector('head > title');
    if (titleElement) {
        const navObserver = new MutationObserver(() => {
            const newVideoId = getVideoId(window.location.href);
            const sidebarExists = document.getElementById("neuratube-sidebar");
            const secondaryContainer = document.querySelector("#secondary-inner"); 

            if (window.location.href.includes("watch?v=") && newVideoId) {
                
                if (newVideoId !== currentVideoId || (sidebarExists && newVideoId === currentVideoId)) {
                    
                    if (sidebarExists) {
                        sidebarExists.remove();
                        if (titleRetryInterval) clearInterval(titleRetryInterval);
                    }
                    
                    currentVideoId = newVideoId;

                    if (secondaryContainer) {
                        injectSidebar();
                        aggressivelyUpdateTitle(); 
                    }
                }
            } else {
                if (sidebarExists) {
                    if (titleRetryInterval) clearInterval(titleRetryInterval);
                    sidebarExists.remove();
                }
                currentVideoId = null;
            }
        });

        navObserver.observe(titleElement, { characterData: true, childList: true, subtree: true });
    }

    // Initial Load Check (Fixes Panel Disappearing on Reload)
    const initialLoadCheck = setInterval(() => {
        currentVideoId = getVideoId(window.location.href);
        const secondaryContainer = document.querySelector("#secondary-inner");
        
        if (currentVideoId && secondaryContainer && !document.getElementById("neuratube-sidebar")) {
            clearInterval(initialLoadCheck);
            injectSidebar();
            aggressivelyUpdateTitle();
        }
    }, 500); 
}


function injectSidebar() {
  if (titleRetryInterval) clearInterval(titleRetryInterval);
  const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime) 
                  ? chrome.runtime.getURL('icons/icon48.png') 
                  : ''; // Use empty string if not available to prevent crash
  const sidebar = document.createElement("div");
  sidebar.id = "neuratube-sidebar";
  sidebar.innerHTML = `
    <div class="nt-header">
      <h2 class="nt-title">
        <img src="${iconUrl}" alt="NeuraTube Icon" class="nt-logo"> 
        NeuraTube AI
      </h2>
      <div class="nt-actions">
        <button id="nt-darkmode">🌙</button>
        <button id="nt-close">✕</button>
      </div>
    </div>
    <div id="nt-video-info"></div>
    <button id="nt-summarize">Summarize</button>
    <div id="nt-summary"></div>
  `;
  
  const secondaryContainer = document.querySelector("#secondary-inner");
  if (secondaryContainer) {
      secondaryContainer.prepend(sidebar);
  } else {
      document.body.appendChild(sidebar); 
  }

  document.getElementById("nt-close").onclick = () => {
      if (titleRetryInterval) clearInterval(titleRetryInterval);
      sidebar.remove();
  };
  document.getElementById("nt-darkmode").onclick = () =>
    sidebar.classList.toggle("dark");

  document.getElementById("nt-summarize").onclick = summarizeVideo;
  
  updateVideoInfo();
}

function updateVideoInfo() {
  const titleEl = document.querySelector('h1 yt-formatted-string') || document.querySelector("yt-formatted-string.ytd-watch-metadata");
  const descEl = document.querySelector("#description") || document.querySelector("#description-inline-expander");

  const title = titleEl && titleEl.innerText ? titleEl.innerText.trim() : "Untitled Video (Loading...)"; 
  const description = descEl && descEl.innerText ? descEl.innerText.trim() : "";

  const infoDiv = document.getElementById("nt-video-info");
  if (infoDiv) {
    infoDiv.innerHTML = `<h3>${title}</h3>`;
  }

  return { title, description };
}

async function summarizeVideo() {
  const summaryBox = document.getElementById("nt-summary");
  const summarizeButton = document.getElementById("nt-summarize");
  const originalButtonText = summarizeButton.textContent;
    
  summaryBox.innerHTML = `<p>⏳ Generating summary...</p>`;
  summarizeButton.disabled = true;
  summarizeButton.textContent = 'Summarizing...';

  const { title, description } = updateVideoInfo();
  
  let sourceText = description;
  let sourceName = "description";
  let promptPrefix = "";

  if (sourceText.length < 50) { 
    const transcript = getTranscriptText();
    
    if (transcript.length > 50) {
      sourceText = transcript;
      sourceName = "transcript";
    } else {
      sourceText = `The video title is: "${title}".`;
      sourceName = "title only";
      promptPrefix = "WARNING: Only the video title is available. Based ONLY on the title, infer the likely content. Separate this warning and the actual summary content with a line break (newline character).";
    }
  }

  try {
    const finalPrompt = `${promptPrefix} Summarize this YouTube video using the following ${sourceName} text: "${sourceText}". Give 3 clear bullet points and one short, final paragraph.`;
    
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(`Server request failed: ${response.status} - ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    const summary =
      data.summary ||
      "⚠️ Could not generate summary. Check your Vercel logs.";

    // --- NEW RENDERING LOGIC ---
    const separatorHtml = '<hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.2); margin: 10px 0;">';

    summaryBox.innerHTML = `
      <div class="nt-summary-box">
        <button id="nt-copy" title="Copy Summary">📋</button>
        <div id="summary-content-wrapper"></div>
      </div>
    `;
    
    const contentWrapper = document.getElementById('summary-content-wrapper');
    
    if (summary.startsWith("WARNING:")) {
        // Find the index of the first newline after the disclaimer
        const firstNewlineIndex = summary.indexOf('\n');
        const disclaimer = firstNewlineIndex !== -1 ? summary.substring(0, firstNewlineIndex).trim() : summary.trim();
        const actualContent = firstNewlineIndex !== -1 ? summary.substring(firstNewlineIndex + 1).trim() : '';

        contentWrapper.innerHTML = `
            <p class="nt-disclaimer">${disclaimer}</p>
            ${separatorHtml}
            <pre class="nt-summary-pre">${actualContent}</pre>
        `;
    } else {
         // Use <pre> tag to preserve the AI's intended formatting (bullets, spacing)
         contentWrapper.innerHTML = `<pre class="nt-summary-pre">${summary}</pre>`;
    }

    document.getElementById("nt-copy").onclick = () => {
      // Use the clean, original summary text for copying
      navigator.clipboard.writeText(summary); 
      alert("Summary copied!");
    };
  } catch (err) {
    console.error("Summarization error:", err);
    summaryBox.innerHTML = `<p>⚠️ Could not generate summary. Error: ${err.message}.</p>`;
  } finally {
      summarizeButton.disabled = false;
      summarizeButton.textContent = originalButtonText;
  }
}

waitForVideoPage();