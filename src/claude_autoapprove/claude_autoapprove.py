import pathlib
import requests
import websockets
import json
import asyncio
import subprocess
import platform
import time
import socket
import os


js_to_inject = open(pathlib.Path(__file__).parent / 'inject.js').read()


async def inject_script(claude_config):
    # Get active targets (windows, tabs)
    response = requests.get('http://localhost:9222/json')
    targets = response.json()

    # Extract trusted tools from config
    trusted_tools = []
    if 'mcpServers' in claude_config:
        for server in claude_config['mcpServers'].values():
            if 'autoapprove' in server:
                trusted_tools.extend(server['autoapprove'])

    # Add trusted tools to `js_to_inject`
    js_with_tools = js_to_inject.replace(
        'const trustedTools = [];',
        f'const trustedTools = {json.dumps(trusted_tools)};'
    )

    # Optionally target a specific tab (e.g., based on URL)
    target = next(t for t in targets if 'url' in t and 'claude' in t['url'].lower())

    ws_url = target['webSocketDebuggerUrl']
    max_attempts = 10
    for attempt in range(max_attempts):
        try:
            async with websockets.connect(ws_url) as ws:
                # Execute JS code
                await ws.send(json.dumps({
                    'id': 1,
                    'method': 'Runtime.evaluate',
                    'params': {
                        'expression': js_with_tools,
                        'contextId': 1,
                        'replMode': True
                    }
                }))
                result = await ws.recv()
                if result == '{"id":1,"result":{"result":{"type":"boolean","value":true}}}':
                    print('Success:', result)
                    return
                else:
                    print(f'Attempt {attempt + 1}: Unexpected result:', result)
        except Exception as e:
            print(f'Attempt {attempt + 1} failed:', e)
        if attempt < max_attempts - 1:
            await asyncio.sleep(1)
    raise ValueError('Max retry attempts reached without success')


def start_claude():
    def is_port_open(port, host="localhost"):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex((host, port)) == 0

    # Determine the operating system
    os_name = platform.system()

    # macOS
    if os_name == "Darwin":
        config_path = pathlib.Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"
        subprocess.run(["open", "-a", "Claude", "--args", "--remote-debugging-port=9222"], check=True)

    # Windows
    elif os_name == "Windows":
        config_path = pathlib.Path(os.environ["APPDATA"]) / "Claude" / "claude_desktop_config.json"
        subprocess.run(["start", "", "Claude", "--remote-debugging-port=9222"], shell=True, check=True)

    else:
        raise OSError(f"Unsupported operating system: {os_name}")

    # Read Claude MCP config
    try:
        with open(config_path, "r") as f:
            claude_config = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Claude config file not found at {config_path}")
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON in config file at {config_path}")

    # Wait for the port to become available
    max_attempts = 10
    for _ in range(max_attempts):
        if is_port_open(9222):
            break
        time.sleep(1)
    else:
        raise TimeoutError("Failed to connect to port 9222 after multiple attempts")

    return claude_config


async def async_main():
    """
    Entry point for the claude-autoapprove CLI.
    """
    claude_config = start_claude()
    await inject_script(claude_config)


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
