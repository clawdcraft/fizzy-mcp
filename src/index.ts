#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Environment configuration
const FIZZY_URL = process.env.FIZZY_URL || "http://localhost:3737";
const FIZZY_TOKEN = process.env.FIZZY_TOKEN || "";
const FIZZY_ACCOUNT_ID = process.env.FIZZY_ACCOUNT_ID || "1";

interface FizzyBoard {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface FizzyCard {
  id: string;
  title: string;
  body?: string;
  board_id: string;
  column_id?: string;
  created_at: string;
  updated_at: string;
}

interface FizzyColumn {
  id: string;
  name: string;
  board_id: string;
  position: number;
}

interface FizzyComment {
  id: string;
  body: string;
  card_id: string;
  user_id: string;
  created_at: string;
}

function validateToolArgs<T extends Record<string, any>>(
  args: unknown,
  schema: Record<string, 'string' | 'string?'>,
  toolName: string
): T {
  if (!args || typeof args !== 'object') {
    throw new Error(`Tool '${toolName}' requires arguments object`);
  }

  const validated = {} as T;
  const missing: string[] = [];
  const wrongType: string[] = [];

  for (const [field, expectedType] of Object.entries(schema)) {
    const isOptional = expectedType.endsWith('?');
    const baseType = isOptional ? expectedType.slice(0, -1) : expectedType;
    const value = (args as Record<string, any>)[field];

    if (value === undefined || value === null) {
      if (!isOptional) missing.push(field);
      continue;
    }

    if (typeof value !== baseType) {
      wrongType.push(`${field} (expected ${baseType}, got ${typeof value})`);
      continue;
    }

    (validated as any)[field] = value;
  }

  if (missing.length > 0 || wrongType.length > 0) {
    let message = `Tool '${toolName}' validation failed:`;
    if (missing.length > 0) message += ` Missing: ${missing.join(', ')}.`;
    if (wrongType.length > 0) message += ` Wrong type: ${wrongType.join(', ')}.`;
    throw new Error(message);
  }

  return validated;
}

// API client for Fizzy
class FizzyClient {
  private baseUrl: string;
  private token: string;
  private accountId: string;

  constructor(baseUrl: string, token: string, accountId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.accountId = accountId;
  }

  private validateId(id: string, paramName: string): void {
    if (!id || typeof id !== "string") {
      throw new Error(`Invalid ${paramName}: must be a non-empty string`);
    }
    
    const idPattern = /^[a-zA-Z0-9]+$/;
    if (!idPattern.test(id)) {
      throw new Error(`Invalid ${paramName}: "${id}" contains invalid characters. Only alphanumeric characters are allowed.`);
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/${this.accountId}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fizzy API error (${response.status}): ${text}`);
    }

    // Handle 201 Created with Location header
    if (response.status === 201) {
      const location = response.headers.get("Location");
      if (location) {
        // Extract card number from location like /1/cards/19.json
        const match = location.match(/\/cards\/(\d+)/);
        const cardNumber = match ? match[1] : null;
        return { 
          success: true, 
          message: "Card created",
          card_number: cardNumber,
          location 
        } as T;
      }
      return { success: true } as T;
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;

    try {
      return JSON.parse(text);
    } catch {
      return { html: text } as T;
    }
  }

  // Boards
  async listBoards(): Promise<FizzyBoard[]> {
    return this.request<FizzyBoard[]>("/boards");
  }

  async getBoard(boardId: string): Promise<FizzyBoard> {
    this.validateId(boardId, "boardId");
    return this.request<FizzyBoard>(`/boards/${boardId}`);
  }

  async createBoard(name: string, description?: string): Promise<FizzyBoard> {
    return this.request<FizzyBoard>("/boards", {
      method: "POST",
      body: JSON.stringify({ board: { name, description } }),
    });
  }

  // Cards
  async listCards(boardId?: string): Promise<FizzyCard[]> {
    // Cards endpoint is global; filter client-side by board if specified
    const cards = await this.request<FizzyCard[]>(`/cards`);
    if (boardId) {
      return cards.filter((c: any) => c.board?.id === boardId || c.board_id === boardId);
    }
    return cards;
  }

  async getCard(cardId: string): Promise<FizzyCard> {
    this.validateId(cardId, "cardId");
    return this.request<FizzyCard>(`/cards/${cardId}`);
  }

  async createCard(
    boardId: string,
    title: string,
    description?: string
  ): Promise<FizzyCard> {
    this.validateId(boardId, "boardId");
    return this.request<FizzyCard>(`/boards/${boardId}/cards`, {
      method: "POST",
      body: JSON.stringify({ card: { title, description } }),
    });
  }

  async updateCard(
    cardId: string,
    updates: { title?: string; description?: string }
  ): Promise<FizzyCard> {
    this.validateId(cardId, "cardId");
    return this.request<FizzyCard>(`/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify({ card: updates }),
    });
  }

  async moveCardToColumn(cardId: string, columnId: string): Promise<void> {
    this.validateId(cardId, "cardId");
    this.validateId(columnId, "columnId");
    await this.request(`/cards/${cardId}/column`, {
      method: "PATCH",
      body: JSON.stringify({ column_id: columnId }),
    });
  }

  async moveCardToDone(cardId: string): Promise<void> {
    this.validateId(cardId, "cardId");
    await this.request(`/cards/${cardId}/closure`, {
      method: "POST",
    });
  }

  async moveCardToNotNow(cardId: string): Promise<void> {
    this.validateId(cardId, "cardId");
    await this.request(`/cards/${cardId}/not_now`, {
      method: "POST",
    });
  }

  // Columns
  async listColumns(boardId: string): Promise<FizzyColumn[]> {
    this.validateId(boardId, "boardId");
    return this.request<FizzyColumn[]>(`/boards/${boardId}/columns`);
  }

  // Comments
  async listComments(cardId: string): Promise<FizzyComment[]> {
    this.validateId(cardId, "cardId");
    return this.request<FizzyComment[]>(`/cards/${cardId}/comments`);
  }

  async addComment(cardId: string, body: string): Promise<FizzyComment> {
    this.validateId(cardId, "cardId");
    return this.request<FizzyComment>(`/cards/${cardId}/comments`, {
      method: "POST",
      body: JSON.stringify({ comment: { body } }),
    });
  }

  // Tags
  async addTag(cardId: string, tagTitle: string): Promise<void> {
    this.validateId(cardId, "cardId");
    await this.request(`/cards/${cardId}/taggings`, {
      method: "POST",
      body: JSON.stringify({ tag_title: tagTitle }),
    });
  }

  async removeTag(cardId: string, tagTitle: string): Promise<void> {
    this.validateId(cardId, "cardId");
    // toggle_tag_with removes if exists
    await this.request(`/cards/${cardId}/taggings`, {
      method: "POST",
      body: JSON.stringify({ tag_title: tagTitle }),
    });
  }
}

// Define MCP tools
const TOOLS: Tool[] = [
  {
    name: "fizzy_list_boards",
    description: "List all Fizzy boards in the account",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fizzy_get_board",
    description: "Get details of a specific Fizzy board",
    inputSchema: {
      type: "object",
      properties: {
        board_id: {
          type: "string",
          description: "The ID of the board",
        },
      },
      required: ["board_id"],
    },
  },
  {
    name: "fizzy_create_board",
    description: "Create a new Fizzy board",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the board",
        },
        description: {
          type: "string",
          description: "Optional description of the board",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "fizzy_list_cards",
    description: "List cards. Optionally filter by board ID.",
    inputSchema: {
      type: "object",
      properties: {
        board_id: {
          type: "string",
          description: "Optional: filter cards by board ID",
        },
      },
      required: [],
    },
  },
  {
    name: "fizzy_get_card",
    description: "Get details of a specific card",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID of the card",
        },
      },
      required: ["card_id"],
    },
  },
  {
    name: "fizzy_create_card",
    description: "Create a new card on a Fizzy board",
    inputSchema: {
      type: "object",
      properties: {
        board_id: {
          type: "string",
          description: "The ID of the board",
        },
        title: {
          type: "string",
          description: "Title of the card",
        },
        description: {
          type: "string",
          description: "Optional description of the card (supports HTML with links)",
        },
      },
      required: ["board_id", "title"],
    },
  },
  {
    name: "fizzy_update_card",
    description: "Update an existing card",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID of the card",
        },
        title: {
          type: "string",
          description: "New title for the card",
        },
        description: {
          type: "string",
          description: "New description for the card (supports HTML with links)",
        },
      },
      required: ["card_id"],
    },
  },
  {
    name: "fizzy_move_card",
    description:
      "Move a card to a different column (use 'done' or 'not_now' for special columns)",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID of the card",
        },
        column: {
          type: "string",
          description:
            "Target column: 'done', 'not_now', or a column ID for custom columns",
        },
      },
      required: ["card_id", "column"],
    },
  },
  {
    name: "fizzy_list_columns",
    description: "List all columns on a Fizzy board",
    inputSchema: {
      type: "object",
      properties: {
        board_id: {
          type: "string",
          description: "The ID of the board",
        },
      },
      required: ["board_id"],
    },
  },
  {
    name: "fizzy_add_comment",
    description: "Add a comment to a card",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID of the card",
        },
        body: {
          type: "string",
          description: "Comment text (supports HTML)",
        },
      },
      required: ["card_id", "body"],
    },
  },
  {
    name: "fizzy_list_comments",
    description: "List all comments on a card",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID or number of the card",
        },
      },
      required: ["card_id"],
    },
  },
  {
    name: "fizzy_add_tag",
    description: "Add a tag to a card. Creates the tag if it doesn't exist.",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID or number of the card",
        },
        tag: {
          type: "string",
          description: "Tag name to add",
        },
      },
      required: ["card_id", "tag"],
    },
  },
  {
    name: "fizzy_remove_tag",
    description: "Remove a tag from a card",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "The ID or number of the card",
        },
        tag: {
          type: "string",
          description: "Tag name to remove",
        },
      },
      required: ["card_id", "tag"],
    },
  },
];

// Create and run the server
async function main() {
  const client = new FizzyClient(FIZZY_URL, FIZZY_TOKEN, FIZZY_ACCOUNT_ID);

  const server = new Server(
    {
      name: "fizzy-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case "fizzy_list_boards":
          result = await client.listBoards();
          break;

        case "fizzy_get_board": {
          const v = validateToolArgs<{ board_id: string }>(args, { board_id: 'string' }, name);
          result = await client.getBoard(v.board_id);
          break;
        }

        case "fizzy_create_board": {
          const v = validateToolArgs<{ name: string, description?: string }>(args, { name: 'string', description: 'string?' }, name);
          result = await client.createBoard(v.name, v.description);
          break;
        }

        case "fizzy_list_cards": {
          const v = validateToolArgs<{ board_id?: string }>(args, { board_id: 'string?' }, name);
          result = await client.listCards(v.board_id);
          break;
        }

        case "fizzy_get_card": {
          const v = validateToolArgs<{ card_id: string }>(args, { card_id: 'string' }, name);
          result = await client.getCard(v.card_id);
          break;
        }

        case "fizzy_create_card": {
          const v = validateToolArgs<{ board_id: string, title: string, description?: string }>(args, { board_id: 'string', title: 'string', description: 'string?' }, name);
          result = await client.createCard(v.board_id, v.title, v.description);
          break;
        }

        case "fizzy_update_card": {
          const v = validateToolArgs<{ card_id: string, title?: string, description?: string }>(args, { card_id: 'string', title: 'string?', description: 'string?' }, name);
          result = await client.updateCard(v.card_id, {
            title: v.title,
            description: v.description,
          });
          break;
        }

        case "fizzy_move_card": {
          const v = validateToolArgs<{ card_id: string, column: string }>(args, { card_id: 'string', column: 'string' }, name);
          if (v.column === "done") {
            await client.moveCardToDone(v.card_id);
          } else if (v.column === "not_now") {
            await client.moveCardToNotNow(v.card_id);
          } else {
            await client.moveCardToColumn(v.card_id, v.column);
          }
          result = { success: true, message: `Card moved to ${v.column}` };
          break;
        }

        case "fizzy_list_columns": {
          const v = validateToolArgs<{ board_id: string }>(args, { board_id: 'string' }, name);
          result = await client.listColumns(v.board_id);
          break;
        }

        case "fizzy_add_comment": {
          const v = validateToolArgs<{ card_id: string, body: string }>(args, { card_id: 'string', body: 'string' }, name);
          result = await client.addComment(v.card_id, v.body);
          break;
        }

        case "fizzy_list_comments": {
          const v = validateToolArgs<{ card_id: string }>(args, { card_id: 'string' }, name);
          result = await client.listComments(v.card_id);
          break;
        }

        case "fizzy_add_tag": {
          const v = validateToolArgs<{ card_id: string, tag: string }>(args, { card_id: 'string', tag: 'string' }, name);
          await client.addTag(v.card_id, v.tag);
          result = { success: true, message: `Tag '${v.tag}' added to card` };
          break;
        }

        case "fizzy_remove_tag": {
          const v = validateToolArgs<{ card_id: string, tag: string }>(args, { card_id: 'string', tag: 'string' }, name);
          await client.removeTag(v.card_id, v.tag);
          result = { success: true, message: `Tag '${v.tag}' removed from card` };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fizzy MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
