import sys
import os

import pathlib
import requests
import websockets
import json
import asyncio
import subprocess
import platform
import time
import socket

DEFAULT_PORT = 19222


async def inject_script(claude_config, port=DEFAULT_PORT):
    """
    Inject the script into the Claude Desktop App.
    """
    # Get active targets (windows, tabs)
    response = requests.get(f'http://localhost:{port}/json')
    targets = response.json()

    # Extract trusted tools from config
    trusted_tools = []
    if 'mcpServers' in claude_config:
        for server in claude_config['mcpServers'].values():
            if 'autoapprove' in server:
                trusted_tools.extend(server['autoapprove'])

    # Add trusted tools to `js_to_inject`
    js_to_inject = open(pathlib.Path(__file__).parent / 'inject.js').read()
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
                    print('Successfully injected autoapprove script.')
                    return
                else:
                    print(f'Attempt {attempt + 1}: Unexpected result:', result)
        except Exception as e:
            print(f'Attempt {attempt + 1} failed:', e)
        if attempt < max_attempts - 1:
            await asyncio.sleep(1)
    raise ValueError('Max retry attempts reached without success')


def is_port_open(port, host="localhost"):
    """
    Check if a port is open on a given host.

    Useful to check if the Claude Desktop App is running in debug mode.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0


def get_claude_config_path():
    """
    Get the path to the Claude MCP config file.
    """
    # Determine the operating system
    os_name = platform.system()

    # macOS
    if os_name == "Darwin":
        config_path = pathlib.Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"

    # Windows
    elif os_name == "Windows":
        config_path = pathlib.Path(os.environ["APPDATA"]) / "Claude" / "claude_desktop_config.json"

    else:
        raise OSError(f"Unsupported operating system: {os_name}")

    return config_path


def get_claude_config():
    """
    Get the Claude MCP config.
    """
    config_path = get_claude_config_path()
    # Read Claude MCP config
    try:
        with open(config_path, "r") as f:
            claude_config = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Claude config file not found at {config_path}")
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON in config file at {config_path}")

    return claude_config


def start_claude(port=DEFAULT_PORT):
    """
    Start the Claude Desktop App.
    """
    # Determine the operating system
    os_name = platform.system()

    # macOS
    if os_name == "Darwin":
        subprocess.run(["open", "-a", "Claude", "--args", f"--remote-debugging-port={port}"], check=True)

    # Windows
    elif os_name == "Windows":
        subprocess.run(["start", "", "Claude", f"--remote-debugging-port={port}"], shell=True, check=True)

    else:
        raise OSError(f"Unsupported operating system: {os_name}")

    # Wait for the port to become available
    max_attempts = 10
    for _ in range(max_attempts):
        if is_port_open(port):
            break
        time.sleep(1)
    else:
        raise TimeoutError(f"Failed to connect to port {port} after multiple attempts")


async def async_main():
    """
    Async entry point
    """
    # Get port from args if provided
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}")
            sys.exit(1)
    else:
        port = DEFAULT_PORT

    start_claude(port)
    await asyncio.sleep(1)
    await inject_script(get_claude_config(), port)


def main():
    """
    Entry point for the claude-autoapprove CLI.
    """
    try:
        asyncio.run(async_main())
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
