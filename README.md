# claude-autoapprove

A CLI tool to automatically approve Claude Desktop App tool requests

If you want a more user-friendly way, you can use the [claude_autoapprove_mcp](https://github.com/PyneSys/claude_autoapprove_mcp).

## Requirements

- Python 3.11 or newer
- Claude Desktop App (macOS or Windows)

## Installation

### From PyPI

```bash
pip install claude-autoapprove
```

_This is the recommended way for most users._

### From source (for developers)

```bash
pip install -e .
```

_Use this if you want to develop or modify the project locally._

## Usage

```bash
claude-autoapprove [port]
```

Port is where the Claude Desktop App will be listening for remote debugging connections.
If no port is provided, the tool will use the default port `19222`, most of the time it is good. You only need to change
if there is another process using the default port.

- The tool will automatically start Claude Desktop App with remote debugging enabled (if not already running).
- It will inject a JavaScript script into Claude to auto-approve tool requests based on your configuration.
- Supported platforms: **macOS** and **Windows**

## How it works

- The script launches Claude Desktop App with the `--remote-debugging-port=9222` flag.
- It reads your trusted tool/server configuration from the Claude MCP config file (typically located in your user profile).
- It injects a JavaScript observer into Claude's UI, which auto-approves tool requests according to your rules.
- Only tools/servers listed in your config will be auto-approved; everything else will require manual approval.

## Configuration

The list of trusted tools and servers is read from your `claude_desktop_config.json` (the `mcpServers` section, `autoapprove` list).

**Config file locations:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

You can edit this file directly or via the Claude Desktop App settings.

### Example config

```json
{
  "mcpServers": {
    "fetch": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "mcp/fetch", "--ignore-robots-txt", "--user-agent=\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36\""] ,
      "autoapprove": ["fetch"]
    },
    "brave-search": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "BRAVE_API_KEY", "mcp/brave-search"],
      "env": {"BRAVE_API_KEY": "..."},
      "autoapprove": ["brave_local_search", "brave_web_search"]
    }
    // ... more servers ...
  }
}
```

## Features

- Automatically injects JavaScript into Claude Desktop App
- Auto-approves tool requests based on configurable rules
- Works with Claude's remote debugging interface
- Smart logging and cooldown to avoid accidental multiple approvals

## Security

The remote debugging port allows any application on your localhost (your machine) to connect to the running Claude Desktop App. This may be a security risk, because any app or script can connect to it and execute arbitrary code inside Claude Desktop App context. This may be used for malicious purposes. It is a low risk, if you know what is running on your computer.

So be careful when using this feature and use it at your own risk.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
