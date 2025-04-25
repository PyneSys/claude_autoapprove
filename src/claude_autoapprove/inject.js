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
        console.debug('🔍 Checking mutations...');

        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog || dialog === lastDialog) return;
        lastDialog = dialog;

        // Try to extract tool name
        const buttonWithDiv = dialog.querySelector('button div');
        let toolName = null;
        if (buttonWithDiv && buttonWithDiv.textContent) {
            console.debug('📝 Found tool request:', buttonWithDiv.textContent);
            toolName = buttonWithDiv.textContent.match(/Run (\S+) from/)?.[1];
            if (toolName) console.log('🛠️ Tool name:', toolName);
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
                    console.debug('🌐 Extracted server name:', serverName);
                }
            } else {
                return;
            }
        } else {
            return;
        }

        // If neither was found, exit
        if (!toolName && !serverName) return;

        /**
         * Decision logic
         */

        let shouldApprove = false;
        let shouldBlock = false;

        if (toolName && trustedTools.includes(toolName)) {
            // If server isn't trusted but tool is on the allowed list
            console.log('✅ Tool is explicitly allowed:', toolName);
            shouldApprove = true;
        } else if (toolName && blockedTools.includes(toolName)) {
            // If server isn't trusted but tool is on the blocked list
            console.log('🚫 Tool is explicitly blocked:', toolName);
            shouldBlock = true;
        } else {
            console.log('❌ Neither server nor tool meets approval criteria');
            return;
        }

        // Approve tool
        if (shouldApprove) {
            // Find the "Allow" button
            const allowButton = Array.from(dialog.querySelectorAll('button'))
                .find(button => button.textContent.toLowerCase().includes('allow for this chat'));
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
                .find(button => button.textContent.toLowerCase().includes('deny'));
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
        banner.style.transition = 'opacity 0.8s';
        banner.style.opacity = '0';
        setTimeout(() => {
            banner.remove();
        }, 800);
    }

    setTimeout(removeBanner, 20000);
    banner.addEventListener('click', removeBanner);
}

// Return to REPL
window.__autoapprove;
