// This code based on https://gist.github.com/Richard-Weiss/95f8bf90b55a3a41b4ae0ddd7a614942,
// but improved a lot

if (window.__autoapprove === undefined) {
    window.__autoapprove = true;

    // Tools to explicitly allow
    const trustedTools = [];

    // Tools to explicitly block (never approve)
    const blockedTools = [];

    // Track the last dialog to avoid processing the same dialog multiple times
    let lastDialog = null;

    /**
     * Mutation observer
     */

    const observer = new MutationObserver((mutations) => {
        const dialog = document.querySelector('[role="dialog"][data-state="open"]');
        if (!dialog || dialog === lastDialog) return;
        lastDialog = dialog;

        // Try to extract server name
        const serverNameElement = dialog.querySelector('button div span.font-medium');
        let serverName = null;
        if (serverNameElement && serverNameElement.textContent) {
            serverName = serverNameElement.textContent
            if (serverName) console.log('🌐 Server name:', serverName);
        }

        if (!serverName) return;

        // Try to extract tool name
        const toolNameElement = dialog.querySelector('button div div.text-sm');
        let toolName = null;
        if (toolNameElement && toolNameElement.textContent) {
            toolName = toolNameElement.textContent
            if (toolName) console.log('🛠️ Tool name:', toolName);
        }

        if (!toolName) return;

        let shouldApprove = false;
        let shouldBlock = false;

        /**
         * Bring back the allow for this chat button
         */

        // Get url of the current page
        const chat_url = window.location.href;

        // If the window.last_chat_url is the same as the current url
        if (!window.last_chat_url || window.last_chat_url !== chat_url) {
            console.log('🔄 Resetting allowed tools for this chat');
            // Update the window.last_chat_url
            window.last_chat_url = chat_url;
            window.allowed_tools_per_chat = {};
        }

        // Find allow always button
        const allowAlwaysButton = Array.from(dialog.querySelectorAll('button')).find(button =>
            button.textContent.toLowerCase().includes('allow always'));
        if (allowAlwaysButton) {
            console.log('🔄 Allow always button found. The allowed tools for this chat are:', window.allowed_tools_per_chat);

            // Approve if the tool is in the allowed_tools_per_chat
            if (window.allowed_tools_per_chat[toolName]) {
                shouldApprove = true;
            }
            // Otherwise modify the allow always button to allow for this chat
            else {
                // Create a DOM copy of the allow always button with the text "Allow for this chat"
                const allowForThisChatButton = allowAlwaysButton.cloneNode(true);
                allowForThisChatButton.textContent = 'Allow for this chat';
                allowAlwaysButton.parentNode.replaceChild(allowForThisChatButton, allowAlwaysButton);

                // Hide the allow always button
                allowAlwaysButton.style.display = 'none';

                // Add a click listener to the allow for this chat button
                allowForThisChatButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    // Find the "Allow" button
                    const allowButton = Array.from(dialog.querySelectorAll('button'))
                        .find(button => button.textContent.toLowerCase().includes('allow once'));
                    if (!allowButton) {
                        console.error('⚠️ Allow button not found');
                        return;
                    }

                    // Add the tool name to the window.allowed_tools_per_chat
                    window.allowed_tools_per_chat[toolName] = true;

                    // Just click the allow button
                    allowButton.click();
                });
            }
        }

        /**
         * Decision logic
         */

        if (toolName && trustedTools.includes(toolName)) {
            // If server isn't trusted but tool is on the allowed list
            console.log('✅ Tool is explicitly allowed:', toolName);
            shouldApprove = true;
        } else if (toolName && blockedTools.includes(toolName)) {
            // If server isn't trusted but tool is on the blocked list
            console.log('🚫 Tool is explicitly blocked:', toolName);
            shouldBlock = true;
        } else if (!shouldApprove && !shouldBlock) {
            console.log('❌ Neither server nor tool meets approval criteria');
            return;
        }

        // Approve tool
        if (shouldApprove) {
            // Find the "Allow" button
            const allowButton = Array.from(dialog.querySelectorAll('button'))
                .find(button =>
                    button.textContent.toLowerCase().includes('allow for this chat') ||
                    button.textContent.toLowerCase().includes('allow once'));
            if (!allowButton) {
                console.error('⚠️ Allow button not found');
                return;
            }
            console.log('🚀 Auto-approving request and hiding the dialog immediately');
            allowButton.click();
        }

        // Block tool
        else if (shouldBlock) {
            // Find the "Block" button
            const blockButton = Array.from(dialog.querySelectorAll('button'))
                .find(button => button.textContent.toLowerCase().includes('decline') ||
                    button.textContent.toLowerCase().includes('deny'));
            if (!blockButton) {
                console.error('⚠️ Block button not found');
                return;
            }
            console.log('🚀 Auto-blocking request and hiding the dialog immediately');
            blockButton.click();
        }

        if (shouldApprove || shouldBlock) {
            // Hide the dialog immediately
            const dimmingElement = dialog.parentElement;
            // Hide the dimming element immediately
            dimmingElement.style.display = 'none';
        }
    });

    // Start observing
    console.log('✅ Trusted tools:', trustedTools);
    console.log('🚫 Blocked tools:', blockedTools);
    console.log('👀 Starting observer.');
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    /**
     * Beautyful banner
     */

    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.top = '10px';
    banner.style.right = '10px';
    banner.style.backgroundColor = '#CA6443';
    banner.style.color = 'white';
    banner.style.padding = '10px';
    banner.style.zIndex = '9999';
    banner.style.fontFamily = 'Arial, sans-serif';
    banner.style.fontSize = '15px';
    banner.style.borderRadius = '8px';
    banner.style.cursor = 'pointer';
    banner.innerHTML = '<b>Claude Auto-Approve active.</b><br/> A local debug port is open for internal communication.<br/>It is accessible only from your device.<br/>Normal usage is safe, but debug ports can pose minor risks if misused.';

    document.body.appendChild(banner);

    function removeBanner() {
        banner.style.transition = 'opacity 0.5s';
        banner.style.opacity = '0';
        setTimeout(() => {
            banner.remove();
        }, 500);
    }

    setTimeout(removeBanner, 15000);
    banner.addEventListener('click', removeBanner);
}

// Return to REPL
window.__autoapprove;
