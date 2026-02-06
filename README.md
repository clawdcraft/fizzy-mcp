# Fizzy-MCP

An MCP (Model Context Protocol) server for [Fizzy](https://github.com/basecamp/fizzy), Basecamp's open-source Kanban tool.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) lets AI assistants (like Claude) use external tools. This server gives Claude the ability to manage your Fizzy boards and cards.

## Quick Start

### 1. Install

```bash
git clone https://github.com/clawdcraft/fizzy-mcp.git
cd fizzy-mcp
npm install
npm run build
```

### 2. Get a Fizzy API Token

1. Open your Fizzy instance (e.g., `http://localhost:3000`)
2. Click your avatar → **My profile**
3. Go to **Access Tokens**
4. Click **Generate a new access token**
5. Enter a description (e.g., "MCP Server")
6. Select **Read + Write** permission
7. Copy the token (you won't see it again!)

### 3. Configure Your Claude Client

#### Claude Code (macOS/Linux)

Edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "fizzy": {
      "command": "node",
      "args": ["/full/path/to/fizzy-mcp/dist/index.js"],
      "env": {
        "FIZZY_URL": "http://localhost:3000",
        "FIZZY_TOKEN": "your-api-token-here",
        "FIZZY_ACCOUNT_ID": "1"
      }
    }
  }
}
```

#### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fizzy": {
      "command": "node",
      "args": ["/full/path/to/fizzy-mcp/dist/index.js"],
      "env": {
        "FIZZY_URL": "http://localhost:3000",
        "FIZZY_TOKEN": "your-api-token-here",
        "FIZZY_ACCOUNT_ID": "1"
      }
    }
  }
}
```

Then restart Claude.

### 4. Use It

Ask Claude things like:
- "List my Fizzy boards"
- "Create a card called 'Fix login bug' on the Ravenus board"
- "Move card 15 to Done"
- "Add a comment to card 12"

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FIZZY_URL` | Your Fizzy instance URL | `http://localhost:3000` |
| `FIZZY_TOKEN` | API access token | *(required)* |
| `FIZZY_ACCOUNT_ID` | Account ID (from URL path) | `1` |

## Available Tools

### Boards

| Tool | Description |
|------|-------------|
| `fizzy_list_boards` | List all boards in the account |
| `fizzy_get_board` | Get details of a specific board |
| `fizzy_create_board` | Create a new board |

### Cards

| Tool | Description |
|------|-------------|
| `fizzy_list_cards` | List all cards (optionally filter by board_id) |
| `fizzy_get_card` | Get card details |
| `fizzy_create_card` | Create a new card |
| `fizzy_update_card` | Update card title/description |
| `fizzy_move_card` | Move to column, "done", or "not_now" |

### Tags

| Tool | Description |
|------|-------------|
| `fizzy_add_tag` | Add a tag to a card (creates tag if needed) |
| `fizzy_remove_tag` | Remove a tag from a card |

### Columns & Comments

| Tool | Description |
|------|-------------|
| `fizzy_list_columns` | List columns on a board |
| `fizzy_add_comment` | Add a comment to a card |
| `fizzy_list_comments` | List comments on a card |

## Examples

### Create a card with HTML description

```
Create a card on board "03fjavj4afm5qrvuvluoi0po9" with:
- Title: "🔧 Fix database connection"
- Description with a link to the GitHub issue
```

The MCP server supports HTML in descriptions:
```html
Fix the connection pooling issue.

📄 <a href="https://github.com/example/repo/issues/42">Issue #42</a>
```

### Move cards through workflow

```
Move card 15 to "done"
Move card 12 to "not_now"
```

### Tag cards

```
Add tag "bug" to card 15
Remove tag "feature" from card 12
```

Tags are created automatically if they don't exist.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## Testing Manually

```bash
export FIZZY_URL="http://localhost:3000"
export FIZZY_TOKEN="your-token"
export FIZZY_ACCOUNT_ID="1"

# List tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# Call a tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"fizzy_list_boards","arguments":{}}}' | node dist/index.js
```

## Troubleshooting

### 406 Not Acceptable
- Check that `FIZZY_TOKEN` is set and valid
- Verify the token has Read + Write permissions

### Connection refused
- Ensure Fizzy is running at the configured URL
- Check the port matches your Fizzy setup

### Card not found
- Card IDs are the card *number* (e.g., `11`), not the CUID

## License

MIT
