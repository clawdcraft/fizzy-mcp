# Fizzy MCP Server

An MCP (Model Context Protocol) server for [Fizzy](https://github.com/basecamp/fizzy), Basecamp's open-source Kanban tool.

## Features

- **Boards**: List, get, and create boards
- **Cards**: List, get, create, update cards
- **Columns**: List columns, move cards between columns
- **Comments**: List and add comments to cards
- **Special actions**: Move cards to "Done" or "Not Now"

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `FIZZY_URL` | Base URL of your Fizzy instance | `http://localhost:3000` |
| `FIZZY_TOKEN` | API access token (Bearer token) | *(required)* |
| `FIZZY_ACCOUNT_ID` | Account ID in Fizzy | `1` |

### Getting an API Token

1. Log into your Fizzy instance
2. Go to your profile settings
3. Navigate to "Access Tokens"
4. Create a new token with appropriate permissions

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fizzy": {
      "command": "node",
      "args": ["/path/to/fizzy-mcp/dist/index.js"],
      "env": {
        "FIZZY_URL": "http://localhost:3000",
        "FIZZY_TOKEN": "your-api-token",
        "FIZZY_ACCOUNT_ID": "1"
      }
    }
  }
}
```

## Available Tools

### Board Operations

- **fizzy_list_boards** - List all boards
- **fizzy_get_board** - Get board details
- **fizzy_create_board** - Create a new board

### Card Operations

- **fizzy_list_cards** - List cards on a board
- **fizzy_get_card** - Get card details
- **fizzy_create_card** - Create a new card
- **fizzy_update_card** - Update card title/body
- **fizzy_move_card** - Move card to column, "done", or "not_now"

### Column Operations

- **fizzy_list_columns** - List columns on a board

### Comment Operations

- **fizzy_add_comment** - Add comment to a card
- **fizzy_list_comments** - List comments on a card

## Examples

### Create a card with a PRD link

```
fizzy_create_card({
  board_id: "abc123",
  title: "🔧 Set up monorepo infrastructure",
  body: "Bun monorepo with Biome linting and TypeScript.<br><br>📄 <a href='https://github.com/example/repo/blob/main/docs/PRD-01.md'>PRD-01</a>"
})
```

### Move a card to Done

```
fizzy_move_card({
  card_id: "xyz789",
  column: "done"
})
```

## License

MIT
