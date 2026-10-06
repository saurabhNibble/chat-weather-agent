/**
 * AETHERIS AGENT INTERACTIVE CLIENT
 * Real-Time ReAct Reasoning, Tool Telemetry & Chat Interaction
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const messagesContainer = document.getElementById('messages-container');
  const chatStream = document.getElementById('chat-stream');
  const welcomeHero = document.getElementById('welcome-hero');
  const agentThinkingPill = document.getElementById('agent-thinking-pill');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('sidebar');

  // Weather Widget Elements
  const weatherLookupForm = document.getElementById('weather-lookup-form');
  const weatherCityInput = document.getElementById('weather-city-input');
  const widgetCityName = document.getElementById('widget-city-name');
  const widgetCountry = document.getElementById('widget-country');
  const widgetTemp = document.getElementById('widget-temp');
  const widgetDesc = document.getElementById('widget-desc');
  const widgetFeels = document.getElementById('widget-feels');
  const widgetHumidity = document.getElementById('widget-humidity');
  const widgetWind = document.getElementById('widget-wind');
  const widgetVisibility = document.getElementById('widget-visibility');
  const widgetWeatherIcon = document.getElementById('widget-weather-icon');

  // Configure marked.js for safe markdown rendering
  if (window.marked) {
    window.marked.setOptions({
      breaks: true,
      gfm: true,
    });
  }

  // Initial Load: Fetch default weather for New Delhi
  fetchWeatherTelemetry('New Delhi');

  // =========================================================================
  // TEXTAREA AUTO-RESIZE & KEYBOARD SHORTCUTS
  // =========================================================================
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit();
    }
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
  });

  // =========================================================================
  // MESSAGE SENDING & API DISPATCH
  // =========================================================================
  async function handleFormSubmit() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Hide welcome hero on first query
    if (welcomeHero && !welcomeHero.classList.contains('hidden')) {
      welcomeHero.classList.add('hidden');
    }

    // Append User Message
    appendUserMessage(message);

    // Disable composer during generation
    setInputState(true);

    // Append Loading Placeholder
    const loadingCardId = appendAgentLoadingCard();
    scrollToBottom();

    const startTime = performance.now();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const durationMs = Math.round(performance.now() - startTime);

      // Remove loading indicator
      removeLoadingCard(loadingCardId);

      if (data.success) {
        appendAgentMessage(data.output, data.steps || [], durationMs);
      } else {
        appendAgentErrorMessage(data.error || data.output || 'Unknown error occurred.');
      }
    } catch (err) {
      console.error('Agent chat error:', err);
      removeLoadingCard(loadingCardId);
      appendAgentErrorMessage(err.message || 'Failed to reach agent backend.');
    } finally {
      setInputState(false);
      chatInput.focus();
      scrollToBottom();
    }
  }

  // =========================================================================
  // MESSAGE RENDERING HELPERS
  // =========================================================================
  function appendUserMessage(text) {
    const msgItem = document.createElement('div');
    msgItem.className = 'message-item message-user';

    const timestamp = getFormattedTime();

    msgItem.innerHTML = `
      <div class="msg-avatar user-avatar" title="You">
        <i class="fa-solid fa-user"></i>
      </div>
      <div class="msg-bubble user-bubble">
        <div class="msg-content">${escapeHtml(text)}</div>
      </div>
    `;

    messagesContainer.appendChild(msgItem);
    scrollToBottom();
  }

  function appendAgentLoadingCard() {
    const id = 'loading-' + Date.now();
    const msgItem = document.createElement('div');
    msgItem.className = 'message-item message-agent';
    msgItem.id = id;

    msgItem.innerHTML = `
      <div class="msg-avatar agent-avatar" title="Aetheris Agent">
        <img src="/static/assets/logo.jpg" alt="Agent Avatar">
      </div>
      <div class="agent-loading-card">
        <div class="loading-dots-wave">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
        <span>Agent reasoning & executing tools...</span>
      </div>
    `;

    messagesContainer.appendChild(msgItem);
    return id;
  }

  function removeLoadingCard(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function appendAgentMessage(markdownContent, steps, durationMs) {
    const msgItem = document.createElement('div');
    msgItem.className = 'message-item message-agent';

    const timestamp = getFormattedTime();
    const parsedHtml = window.marked ? window.marked.parse(markdownContent) : markdownContent;

    // Check if tools were used
    const hasSteps = steps && steps.length > 0;
    let toolsAccordionHtml = '';

    if (hasSteps) {
      const stepItemsHtml = steps.map((s, idx) => {
        const isWeatherTool = s.tool === 'get_weather';
        const iconClass = isWeatherTool ? 'fa-solid fa-cloud-sun text-emerald' : 'fa-solid fa-globe text-indigo';
        
        return `
          <div class="tool-step-card">
            <div class="tool-step-header">
              <span class="tool-step-name">
                <i class="${iconClass}"></i> ${escapeHtml(s.tool)}
              </span>
              <span class="tool-active-tag">Step #${idx + 1}</span>
            </div>
            <div class="tool-step-input">
              <strong>Input:</strong> ${escapeHtml(s.tool_input)}
            </div>
            <div class="tool-step-obs">
              ${escapeHtml(s.observation)}
            </div>
          </div>
        `;
      }).join('');

      toolsAccordionHtml = `
        <div class="agent-tools-accordion">
          <button class="tools-accordion-toggle" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded');">
            <span class="toggle-title">
              <i class="fa-solid fa-network-wired text-cyan"></i>
              <span>Agent Tool Telemetry</span>
              <span class="toggle-badge">${steps.length} Tool Call${steps.length > 1 ? 's' : ''}</span>
            </span>
            <i class="fa-solid fa-chevron-down toggle-icon"></i>
          </button>
          <div class="tools-accordion-content">
            ${stepItemsHtml}
          </div>
        </div>
      `;
    }

    // Check if any step was get_weather to render a dedicated weather card
    let weatherSnippetHtml = '';
    const weatherStep = steps.find(s => s.tool === 'get_weather');
    if (weatherStep && weatherStep.observation && !weatherStep.observation.includes('Unable to get weather')) {
      const matchTemp = weatherStep.observation.match(/Temperature:\s*(-?\d+)/i);
      const matchCity = weatherStep.observation.match(/Weather in\s*([^,:]+)/i);
      const matchDesc = weatherStep.observation.match(/:\s*([^,]+),\s*Temperature/i);

      if (matchTemp && matchCity) {
        const temp = matchTemp[1];
        const city = matchCity[1].trim();
        const cond = matchDesc ? matchDesc[1].trim() : 'Live Metric';

        weatherSnippetHtml = `
          <div class="chat-weather-card">
            <div class="weather-card-left">
              <span class="weather-card-city"><i class="fa-solid fa-location-dot text-cyan"></i> ${escapeHtml(city)}</span>
              <span class="weather-card-condition">${escapeHtml(cond)}</span>
            </div>
            <div class="weather-card-right">
              <span class="weather-card-temp">${escapeHtml(temp)}°C</span>
              <i class="fa-solid fa-cloud-sun weather-card-icon"></i>
            </div>
          </div>
        `;
      }
    }

    msgItem.innerHTML = `
      <div class="msg-avatar agent-avatar" title="Aetheris Agent">
        <img src="/static/assets/logo.jpg" alt="Agent Avatar">
      </div>
      <div class="msg-bubble agent-bubble">
        <div class="agent-msg-header">
          <span class="agent-name-tag">
            <i class="fa-solid fa-robot"></i> Aetheris Intelligence
          </span>
          <span class="msg-timestamp">
            <i class="fa-regular fa-clock"></i> ${timestamp} &bull; ${durationMs}ms
          </span>
        </div>

        ${toolsAccordionHtml}
        ${weatherSnippetHtml}

        <div class="msg-content">
          ${parsedHtml}
        </div>

        <div class="msg-actions">
          <button class="btn-action-sm copy-btn" title="Copy response">
            <i class="fa-regular fa-copy"></i> <span>Copy</span>
          </button>
        </div>
      </div>
    `;

    // Copy event listener
    const copyBtn = msgItem.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(markdownContent).then(() => {
          showToast('Copied to clipboard');
          copyBtn.innerHTML = '<i class="fa-solid fa-check text-emerald"></i> <span>Copied!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy</span>';
          }, 2000);
        });
      });
    }

    messagesContainer.appendChild(msgItem);
    scrollToBottom();
  }

  function appendAgentErrorMessage(errorText) {
    const msgItem = document.createElement('div');
    msgItem.className = 'message-item message-agent';

    msgItem.innerHTML = `
      <div class="msg-avatar agent-avatar" title="Aetheris Agent">
        <img src="/static/assets/logo.jpg" alt="Agent Avatar">
      </div>
      <div class="msg-bubble agent-bubble" style="border-color: rgba(244, 63, 94, 0.4);">
        <div class="agent-msg-header">
          <span class="agent-name-tag" style="color: var(--accent-rose);">
            <i class="fa-solid fa-triangle-exclamation"></i> Execution Error
          </span>
          <span class="msg-timestamp">${getFormattedTime()}</span>
        </div>
        <div class="msg-content" style="color: #fecdd3;">
          <p><strong>Agent Encountered an Issue:</strong></p>
          <pre><code>${escapeHtml(errorText)}</code></pre>
        </div>
      </div>
    `;

    messagesContainer.appendChild(msgItem);
    scrollToBottom();
  }

  // =========================================================================
  // LIVE WEATHER WIDGET LOOKUP
  // =========================================================================
  weatherLookupForm.addEventListener('submit', () => {
    const city = weatherCityInput.value.trim();
    if (city) {
      fetchWeatherTelemetry(city);
      weatherCityInput.value = '';
    }
  });

  async function fetchWeatherTelemetry(city) {
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const data = await res.json();

      if (data.error) {
        showToast(`Weather error: ${data.error}`);
        return;
      }

      widgetCityName.textContent = data.city || city;
      widgetCountry.textContent = data.country ? `${data.country}` : 'Global';
      widgetTemp.textContent = data.temperature !== undefined ? data.temperature : '--';
      widgetDesc.textContent = data.weather_description || 'Clear';
      widgetFeels.textContent = `${data.feelslike || data.temperature || '--'}°C`;
      widgetHumidity.textContent = `${data.humidity || 0}%`;
      widgetWind.textContent = `${data.wind_speed || 0} km/h`;
      widgetVisibility.textContent = `${data.visibility || 0} km`;

      // Update weather icon based on description
      updateWeatherIcon(data.weather_description || '');
      showToast(`Updated weather for ${data.city}`);
    } catch (err) {
      console.error('Weather telemetry fetch failed:', err);
    }
  }

  function updateWeatherIcon(description) {
    const desc = description.toLowerCase();
    widgetWeatherIcon.className = 'fa-solid';

    if (desc.includes('rain') || desc.includes('drizzle')) {
      widgetWeatherIcon.classList.add('fa-cloud-showers-heavy', 'text-cyan');
    } else if (desc.includes('thunder') || desc.includes('storm')) {
      widgetWeatherIcon.classList.add('fa-cloud-bolt', 'text-violet');
    } else if (desc.includes('snow') || desc.includes('ice')) {
      widgetWeatherIcon.classList.add('fa-snowflake', 'text-cyan');
    } else if (desc.includes('cloud') || desc.includes('overcast')) {
      widgetWeatherIcon.classList.add('fa-cloud', 'text-indigo');
    } else if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze')) {
      widgetWeatherIcon.classList.add('fa-smog', 'text-tertiary');
    } else {
      widgetWeatherIcon.classList.add('fa-sun', 'text-amber');
    }
  }

  // =========================================================================
  // QUICK PROMPTS & SUGGESTIONS CHIPS
  // =========================================================================
  document.querySelectorAll('.prompt-chip, .suggestion-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      if (query) {
        chatInput.value = query;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
        handleFormSubmit();
      }
    });
  });

  // =========================================================================
  // CLEAR CHAT & SIDEBAR TOGGLE
  // =========================================================================
  clearChatBtn.addEventListener('click', () => {
    messagesContainer.innerHTML = '';
    if (welcomeHero) welcomeHero.classList.remove('hidden');
    showToast('Conversation session cleared');
  });

  sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // =========================================================================
  // UTILITY HELPERS
  // =========================================================================
  function setInputState(isBusy) {
    sendButton.disabled = isBusy;
    if (isBusy) {
      agentThinkingPill.classList.remove('hidden');
    } else {
      agentThinkingPill.classList.add('hidden');
    }
  }

  function scrollToBottom() {
    chatStream.scrollTop = chatStream.scrollHeight;
  }

  function getFormattedTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-info text-cyan"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
});
