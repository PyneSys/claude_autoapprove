import sys
import os
import argparse
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


def get_trusted_tools(claude_config):
    """
    Get the list of trusted tools from the Claude MCP config.
    """
    trusted_tools = []
    if 'mcpServers' in claude_config:
        for server in claude_config['mcpServers'].values():
            if 'autoapprove' in server:
                trusted_tools.extend(server['autoapprove'])
    return trusted_tools


def get_blocked_tools(claude_config):
    """
    Get the list of blocked tools from the Claude MCP config.
    """
    blocked_tools = []
    if 'mcpServers' in claude_config:
        for server in claude_config['mcpServers'].values():
            if 'autoblock' in server:
                blocked_tools.extend(server['autoblock'])
    return blocked_tools


async def inject_script(claude_config, port=DEFAULT_PORT):
    """
    Inject the script into the Claude Desktop App.

    This uses a single, simple approach: inject the script directly
    without specifying a context ID, which will use the default context.
    """
    # Get active targets (windows, tabs)
    response = requests.get(f'http://localhost:{port}/json')
    targets = response.json()

    # Add trusted and blocked tools to `js_to_inject`
    js_to_inject = open(pathlib.Path(__file__).parent / 'inject.js', 'r', encoding='utf-8').read()
    js_with_tools = js_to_inject.replace(
        'const trustedTools = [];',
        f'const trustedTools = {json.dumps(get_trusted_tools(claude_config))};'
    ).replace(
        'const blockedTools = [];',
        f'const blockedTools = {json.dumps(get_blocked_tools(claude_config))};'
    )

    # Find the Claude tab
    target = next(t for t in targets if 'url' in t and 'claude' in t['url'].lower())
    ws_url = target['webSocketDebuggerUrl']

    max_attempts = 10
    for attempt in range(max_attempts):
        try:
            async with websockets.connect(ws_url) as ws:
                # Execute JS code in the default context (no contextId specified)
                print(f'Attempt {attempt + 1}: Injecting script in default context')

                await ws.send(json.dumps({
                    'id': 1,
                    'method': 'Runtime.evaluate',
                    'params': {
                        'expression': js_with_tools,
                        'replMode': True
                    }
                }))

                result = await ws.recv()
                result_data = json.loads(result)

                if 'result' in result_data and 'result' in result_data['result'] and result_data['result']['result'].get('value') is True:
                    print('Successfully injected autoapprove script.')
                    return
                else:
                    print(f'Attempt {attempt + 1}: Unexpected result:', result)
                    # Parse the result to provide better error info
                    try:
                        result_obj = json.loads(result)
                        if 'error' in result_obj:
                            print(f'Error details: {result_obj["error"]}')
                    except:
                        pass
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
    # macOS
    if sys.platform == "darwin":
        subprocess.run(["open", "-a", "Claude", "--args", f"--remote-debugging-port={port}"], check=True)

    # Windows
    elif sys.platform == "win32":
        claude_path = pathlib.Path(os.environ["LOCALAPPDATA"]) / "AnthropicClaude" / "claude.exe"
        subprocess.run([str(claude_path), f"--remote-debugging-port={port}"], check=True)

    else:
        raise OSError(f"Unsupported operating system: {sys.platform}")

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
    parser = argparse.ArgumentParser(description="Claude Auto-Approve tools")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Debugger port for Claude Desktop")

    args = parser.parse_args()

    try:
        asyncio.run(async_main())
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
