# ClickHouse MCP Server (TypeScript)

[![npm version](https://img.shields.io/npm/v/@clickhouse/mcp.svg)](https://www.npmjs.com/package/@clickhouse/mcp)

MCP (Model Context Protocol) server for ClickHouse, built in TypeScript. This is a work based on the [python package](https://github.com/ClickHouse/mcp-clickhouse).

## Features

## Claude Desktop Integration

To use this MCP server with Claude Desktop, update your Claude Desktop configuration file:

### Location

- On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

### Configuration

Add the following to your configuration:

```json
{
  "mcpServers": {
    "mcp-clickhouse": {
      "command": "npx",
      "args": ["@clickhouse/mcp"],
      "env": {
        "CLICKHOUSE_HOST": "<clickhouse-host>",
        "CLICKHOUSE_PORT": "<clickhouse-port>",
        "CLICKHOUSE_USER": "<clickhouse-user>",
        "CLICKHOUSE_PASSWORD": "<clickhouse-password>",
        "CLICKHOUSE_SECURE": "true",
        "CLICKHOUSE_VERIFY": "true",
        "CLICKHOUSE_CONNECT_TIMEOUT": "30",
        "CLICKHOUSE_SEND_RECEIVE_TIMEOUT": "30"
      }
    }
  }
}
```

### ClickHouse SQL Playground Configuration

To try it out with the ClickHouse SQL Playground, use:

```json
{
  "mcpServers": {
    "mcp-clickhouse": {
      "command": "npx",
      "args": ["@clickhouse/mcp"],
      "env": {
        "CLICKHOUSE_HOST": "sql-clickhouse.clickhouse.com",
        "CLICKHOUSE_PORT": "8443",
        "CLICKHOUSE_USER": "demo",
        "CLICKHOUSE_PASSWORD": "",
        "CLICKHOUSE_SECURE": "true",
        "CLICKHOUSE_VERIFY": "true",
        "CLICKHOUSE_CONNECT_TIMEOUT": "30",
        "CLICKHOUSE_SEND_RECEIVE_TIMEOUT": "30"
      }
    }
  }
}
```

Restart Claude Desktop to apply the changes.

## Installation

```bash
npm install @clickhouse/mcp
```

## Configuration for local development

Create a `.env` file in your project root with the following environment variables:

### Required Variables

- `CLICKHOUSE_HOST`: The hostname of your ClickHouse server
- `CLICKHOUSE_USER`: The username for authentication
- `CLICKHOUSE_PASSWORD`: The password for authentication

### Optional Variables

- `CLICKHOUSE_PORT`: The port number of your ClickHouse server
  - Default: `8443` if HTTPS is enabled, `8123` if disabled
  - Usually doesn't need to be set unless using a non-standard port
- `CLICKHOUSE_SECURE`: Enable/disable HTTPS connection
  - Default: `true`
  - Set to `false` for non-secure connections
- `CLICKHOUSE_VERIFY`: Enable/disable SSL certificate verification
  - Default: `true`
  - Set to `false` to disable certificate verification (not recommended for production)
- `CLICKHOUSE_CONNECT_TIMEOUT`: Connection timeout in seconds
  - Default: `30`
  - Increase this value if you experience connection timeouts
- `CLICKHOUSE_SEND_RECEIVE_TIMEOUT`: Send/receive timeout in seconds
  - Default: `300`
  - Increase this value for long-running queries
- `CLICKHOUSE_DATABASE`: Default database to use
  - Default: None (uses server default)
  - Set this to automatically connect to a specific database

## Development

### Setup

1. Clone the repository:

```bash
git clone https://github.com/aminkhorramii/mcp-clickhouse-ts.git
cd mcp-clickhouse-ts
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your ClickHouse connection details:

```
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse
CLICKHOUSE_SECURE=false
```

### Running Locally

For development:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run the built version:

```bash
npm start
```

### Docker

Build the Docker image:

```bash
npm run docker:build
```

Run with Docker:

```bash
docker run -e CLICKHOUSE_HOST=your-host -e CLICKHOUSE_USER=your-user -e CLICKHOUSE_PASSWORD=your-password mcp-clickhouse-ts
```

## Example Usage

Once the MCP server is connected to Claude, you can interact with ClickHouse using natural language:

- "List all databases in my ClickHouse instance"
- "Run this SQL query: SELECT count() FROM system.tables"
- "Show me the schema of the 'users' table in the 'default' database"

## Example Configurations

### For local development with Docker:

```
# Required variables
CLICKHOUSE_HOST=localhost
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse

# Optional: Override defaults for local development
CLICKHOUSE_SECURE=false  # Uses port 8123 automatically
CLICKHOUSE_VERIFY=false
```

### For ClickHouse Cloud:

```
# Required variables
CLICKHOUSE_HOST=your-instance.clickhouse.cloud
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password

# Optional: These use secure defaults
# CLICKHOUSE_SECURE=true  # Uses port 8443 automatically
# CLICKHOUSE_DATABASE=your_database
```

## License

MIT
