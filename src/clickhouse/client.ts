import { createClient, ClickHouseClient } from "@clickhouse/client";
import { getClientConfig } from "../config.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("clickhouse-client");

let clientInstance: ClickHouseClient | null = null;

/**
 * Create or return an existing ClickHouse client.
 *
 * @returns A configured ClickHouse client
 */
export function getClickHouseClient(): ClickHouseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const clientConfig = getClientConfig();

  logger.debug(`Client config: ${JSON.stringify(clientConfig)}`);

  logger.info(
    `Creating ClickHouse client connection to ${clientConfig.host}:${clientConfig.port} ` +
      `as ${clientConfig.username} ` +
      `(secure=${clientConfig.secure}, verify=${clientConfig.verify}, ` +
      `connect_timeout=${clientConfig.connect_timeout}s, ` +
      `send_receive_timeout=${clientConfig.send_receive_timeout}s)`
  );

  try {
    clientInstance = createClient({
      host: `${clientConfig.secure ? "https" : "http"}://${clientConfig.host}:${
        clientConfig.port
      }`,
      username: clientConfig.username,
      password: clientConfig.password,
      database: clientConfig.database,
      request_timeout: clientConfig.send_receive_timeout * 1000, // Convert to ms
      // connect_timeout: clientConfig.connect_timeout * 1000, // Convert to ms
    });

    return clientInstance;
  } catch (error) {
    logger.error(`Failed to create ClickHouse client: ${error}`);
    throw error;
  }
}

/**
 * Execute a SELECT query with timeout.
 *
 * @param query SQL query string
 * @param timeoutMs Timeout in milliseconds
 * @returns Query results
 */
export async function executeSelectQuery(
  query: string,
  timeoutMs: number = 30000
): Promise<any> {
  const client = getClickHouseClient();

  logger.info(`Executing SELECT query with ${timeoutMs}ms timeout: ${query}`);

  try {
    // Create the query promise
    const result = await client.query({
      query,
      format: "JSONEachRow",
    });

    // Process the result properly
    const json = await result.json();
    logger.info(`Query returned results successfully`);
    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error executing query: ${message}`);

    // Return a structured response for errors
    return {
      status: "error",
      message: `Query failed: ${message}`,
    };
  }
}

/**
 * Execute a command query (non-SELECT).
 *
 * @param query SQL command to execute
 * @returns Success status
 */
export async function executeCommand(
  query: string
): Promise<{ success: boolean; message?: string }> {
  const client = getClickHouseClient();

  logger.info(`Executing command: ${query}`);

  try {
    await client.command({
      query,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error executing command: ${message}`);
    return {
      success: false,
      message: message,
    };
  }
}

/**
 * Quote an identifier for safe use in SQL.
 *
 * @param identifier SQL identifier to quote
 * @returns Quoted identifier
 */
export function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "\\`")}\``;
}

/**
 * Format a value for use in a SQL query.
 *
 * @param value Value to format
 * @returns Formatted value for SQL
 */
export function formatQueryValue(value: any): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "string") {
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return String(value);
}

/**
 * Get the ClickHouse server version.
 *
 * @returns Server version string
 */
export async function getServerVersion(): Promise<string> {
  const client = getClickHouseClient();

  try {
    const result: any = await client.query({
      query: "SELECT version() AS version",
      format: "JSONEachRow",
    });

    if (result.rows.length > 0) {
      return result.rows[0].version as string;
    }
    return "unknown";
  } catch (error) {
    logger.error(`Error getting server version: ${error}`);
    return "unknown";
  }
}