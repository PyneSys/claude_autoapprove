// This code based on https://gist.github.com/Richard-Weiss/95f8bf90b55a3a41b4ae0ddd7a614942

if (window.__autoapprove === undefined) {
    window.__autoapprove = true;

    // Trusted servers, all tools are allowed by default
    const trustedServers = [];

    // Tools to explicitly allow
    const trustedTools = [];

    // Tools to explicitly block
    const blockedTools = [];

    // Cooldown tracking
    let lastClickTime = 0;
    const COOLDOWN_MS = 1000; // 1 second cooldown

    // Log throttling
    const logHistory = {};
    const LOG_THROTTLE_MS = 5000; // Only log the same message every 5 seconds

    // Smart logging with throttling
    function throttledLog(level, message, ...args) {
        const key = message + JSON.stringify(args);
        const now = Date.now();

        // If we've logged this exact message recently, skip it
        if (logHistory[key] && now - logHistory[key] < LOG_THROTTLE_MS) {
            return;
        }

        // Update the log history
        logHistory[key] = now;

        // Output the log
        console[level](message, ...args);
    }

    const log = {
        debug: (message, ...args) => throttledLog('debug', message, ...args),
        log: (message, ...args) => throttledLog('log', message, ...args),
        error: (message, ...args) => throttledLog('error', message, ...args)
    };

    const observer = new MutationObserver((mutations) => {
        // Check if we're still in cooldown
        const now = Date.now();
        if (now - lastClickTime < COOLDOWN_MS) {
            log.debug('🕒 Still in cooldown period, skipping...');
            return;
        }

        log.debug('🔍 Checking mutations...');

        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;

        // Try to extract tool name
        const buttonWithDiv = dialog.querySelector('button div');
        let toolName = null;
        if (buttonWithDiv && buttonWithDiv.textContent) {
            log.debug('📝 Found tool request:', buttonWithDiv.textContent);
            toolName = buttonWithDiv.textContent.match(/Run (\S+) from/)?.[1];
            if (toolName) log.log('🛠️ Tool name:', toolName);
        }

        // Try to extract server name
        const h2Element = dialog.querySelector('h2');
        let serverName = null;

        if (h2Element) {
            const serverDiv = h2Element.querySelector('div');
            if (serverDiv) {
                if (serverDiv.textContent) {
                    // The format is "Allow tool from "file-system-windows-python" (local)?"
                    const serverMatch = serverDiv.textContent.match(/Allow tool from [“|"]([^[”|"]+)[”|"]/);

                    serverName = serverMatch?.[1];
                    log.debug('🌐 Extracted server name:', serverName);
                }
            } else {
                log.error('⚠️ Server name could not be extracted.');
            }
        } else {
            log.error('⚠️ Server name could not be extracted.');
        }

        // If neither was found, exit
        if (!toolName && !serverName) return;

        // Decision logic - prioritizing server access with tool constraints
        let shouldApprove = false;

        if (serverName && trustedServers.includes(serverName)) {
            // Server is trusted by default
            if (toolName && blockedTools.includes(toolName)) {
                log.log('🚫 Tool is explicitly blocked:', toolName);
                shouldApprove = false;
            } else {
                log.log('✅ Server is trusted:', serverName);
                shouldApprove = true;
            }
        }

        else if (toolName && trustedTools.includes(toolName)) {
            // If server isn't trusted but tool is on the allowed list
            log.log('✅ Tool is explicitly allowed:', toolName);
            shouldApprove = true;
        } else {
            log.log('❌ Neither server nor tool meets approval criteria');
            shouldApprove = false;
        }

        if (shouldApprove) {
            const allowButton = Array.from(dialog.querySelectorAll('button'))
                .find(button => button.textContent.toLowerCase().includes('allow for this chat'));

            if (allowButton) {
                log.log('🚀 Auto-approving request');
                lastClickTime = now; // Set cooldown
                allowButton.click();
            }
        }
    });

    // Start observing
    console.log('👀 Starting observer for trusted servers:', trustedServers);
    console.log('✅ Trusted tools:', trustedTools);
    console.log('🚫 Blocked tools:', blockedTools);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Return to REPL
window.__autoapprove;
