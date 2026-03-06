# GitHub MCP Server

This is a Model Context Protocol (MCP) server for GitHub. It allows AI models to interact with your GitHub repositories, issues, and pull requests.

## Setup

1.  The GitHub Personal Access Token is already configured in the `.env` file.
2.  To start the server, run the `./start.ps1` script in PowerShell.

## Integration with Claude Desktop

To use this with Claude Desktop, add the following to your `claude_desktop_config.json` (usually found in `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Replace the token if you rotate it.
