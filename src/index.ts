import { config as dotenvConfig } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { Logger, LogLevel } from "./utils/logger.js";
import { 
  getClickHouseClient, 
  executeSelectQuery, 
  executeCommand
} from "./clickhouse/client.js";

// Load environment variables
dotenvConfig();

// Set up logging level
if (process.env.DEBUG === "true") {
  Logger.setLogLevel(LogLevel.DEBUG);
} else if (process.env.LOG_LEVEL) {
  const levelMap: Record<string, LogLevel> = {
    'error': LogLevel.ERROR,
    'warning': LogLevel.WARNING,
    'info': LogLevel.INFO,
    'debug': LogLevel.DEBUG
  };
  
  const levelName = process.env.LOG_LEVEL?.toLowerCase() || 'info';
  if (levelName in levelMap) {
    Logger.setLogLevel(levelMap[levelName]);
  }
}

const logger = new Logger("main");
const MCP_SERVER_NAME = "mcp-clickhouse";
const MCP_SERVER_VERSION = "0.0.1";

/**
 * Main function to start the MCP server.
 */
async function main(): Promise<void> {
  logger.info("Starting ClickHouse MCP server");
  
  try {
    // Test the database connection first
    logger.info("Testing ClickHouse connection...");
    
    // Create the MCP server
    const server = new McpServer({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION
    });

    // Tool: List Databases
    server.tool(
      "list_databases",
      {},
      async () => {
        logger.info("Listing all databases");
        try {
          
          const databases = await executeSelectQuery("SHOW DATABASES");
          
          // Handle error response
          if (databases && typeof databases === 'object' && 'status' in databases && databases.status === 'error') {
            return {
              content: [{ 
                type: "text", 
                text: `Error listing databases: ${databases.message}` 
              }],
              isError: true
            };
          }
          
          logger.info(`Found ${Array.isArray(databases) ? databases.length : 0} databases`);
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(databases, null, 2) 
            }]
          };
        } catch (error) {
          logger.error(`Error in list_databases: ${error}`);
          return {
            content: [{ 
              type: "text", 
              text: `Error listing databases: ${error instanceof Error ? error.message : String(error)}` 
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Run Select Query
    server.tool(
      "run_select_query",
      {
        query: z.string().describe("SQL SELECT query to execute")
      },
      async ({ query }) => {
        logger.info(`Executing SELECT query: ${query}`);
        try {
          // Validate query is a SELECT statement (basic check)
          const trimmedQuery = query.trim().toLowerCase();
          if (!trimmedQuery.startsWith('select') && !trimmedQuery.startsWith('show')) {
            logger.warning(`Query rejected - not a SELECT/SHOW statement: ${query}`);
            return {
              content: [{ 
                type: "text", 
                text: "Only SELECT and SHOW queries are allowed for security reasons." 
              }],
              isError: true
            };
          }
          
          const result = await executeSelectQuery(query, 30000);
          
          // Check if we received an error structure
          if (typeof result === 'object' && result !== null && 'status' in result && result.status === 'error') {
            logger.warning(`Query failed: ${result.message}`);
            return {
              content: [{ 
                type: "text", 
                text: `Query failed: ${result.message}` 
              }],
              isError: true
            };
          }
          
          // Handle empty results
          if (!result || (Array.isArray(result) && result.length === 0)) {
            return {
              content: [{ 
                type: "text", 
                text: "Query executed successfully, but returned no results." 
              }]
            };
          }
          
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify(result, null, 2) 
            }]
          };
        } catch (error) {
          logger.error(`Error executing query: ${error}`);
          return {
            content: [{ 
              type: "text", 
              text: `Error executing query: ${error instanceof Error ? error.message : String(error)}` 
            }],
            isError: true
          };
        }
      }
    );

    const transport = new StdioServerTransport();
    
    logger.info(`Starting ${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} with stdio transport`);
    await server.connect(transport);
    
    logger.info("MCP server connected and ready");

  } catch (error) {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.debug(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
}

export { main };