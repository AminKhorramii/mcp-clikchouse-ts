/**
 * Environment configuration for the MCP ClickHouse server.
 * 
 * This module handles all environment variable configuration with sensible defaults
 * and type conversion.
 */
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration for ClickHouse connection settings.
 * 
 * This interface handles all environment variable configuration with sensible defaults
 * and type conversion.
 * 
 * Required environment variables:
 *   CLICKHOUSE_HOST: The hostname of the ClickHouse server
 *   CLICKHOUSE_USER: The username for authentication
 *   CLICKHOUSE_PASSWORD: The password for authentication
 * 
 * Optional environment variables (with defaults):
 *   CLICKHOUSE_PORT: The port number (default: 8443 if secure=true, 8123 if secure=false)
 *   CLICKHOUSE_SECURE: Enable HTTPS (default: true)
 *   CLICKHOUSE_VERIFY: Verify SSL certificates (default: true)
 *   CLICKHOUSE_CONNECT_TIMEOUT: Connection timeout in seconds (default: 30)
 *   CLICKHOUSE_SEND_RECEIVE_TIMEOUT: Send/receive timeout in seconds (default: 300)
 *   CLICKHOUSE_DATABASE: Default database to use (default: undefined)
 */
export interface ClickHouseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  secure: boolean;
  verify: boolean;
  connect_timeout: number;
  send_receive_timeout: number;
  client_name: string;
}

/**
 * Validates that all required environment variables are set.
 * 
 * @throws Error if any required environment variable is missing.
 */
function validateRequiredVars(): void {
  const missingVars: string[] = [];
  
  ['CLICKHOUSE_HOST', 'CLICKHOUSE_USER'].forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}


validateRequiredVars();

/**
 * Get the configuration object for the ClickHouse client.
 * 
 * @returns ClickHouse client configuration
 */
export function getClientConfig(): ClickHouseConfig {
  // Parse boolean from environment variable
  const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  };
  
  // Get secure setting first as it affects default port
  const secure = parseBoolean(process.env.CLICKHOUSE_SECURE, true);
  
  // Get port with default based on secure setting
  const defaultPort = secure ? 8443 : 8123;
  const port = process.env.CLICKHOUSE_PORT 
    ? parseInt(process.env.CLICKHOUSE_PORT, 10) 
    : defaultPort;
  
  const config: ClickHouseConfig = {
    host: process.env.CLICKHOUSE_HOST!,
    port,
    username: process.env.CLICKHOUSE_USER!,
    password: process.env.CLICKHOUSE_PASSWORD!,
    secure,
    verify: parseBoolean(process.env.CLICKHOUSE_VERIFY, true),
    connect_timeout: parseInt(process.env.CLICKHOUSE_CONNECT_TIMEOUT || '30', 10),
    send_receive_timeout: parseInt(process.env.CLICKHOUSE_SEND_RECEIVE_TIMEOUT || '300', 10),
    client_name: 'mcp_clickhouse_ts'
  };
  
  // Add optional database if set
  if (process.env.CLICKHOUSE_DATABASE) {
    config.database = process.env.CLICKHOUSE_DATABASE;
  }
  
  return config;
}

export const config = {
  getClientConfig
};

export default config;