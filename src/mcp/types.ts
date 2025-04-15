/**
 * Type definitions for the MCP server implementation.
 */

// Function type for tool handlers
export type ToolHandler = (...args: any[]) => Promise<any> | any;

// Function type for resource handlers
export type ResourceHandler = (url: string) => Promise<any> | any;

// Configuration for a tool
export interface ToolConfig {
  name: string;
  description: string;
  handler: ToolHandler;
  parameters?: Record<string, ParameterConfig>;
}

// Configuration for a tool parameter
export interface ParameterConfig {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: any;
}

// Configuration for a resource
export interface ResourceConfig {
  name: string;
  uri: string;
  mimeType: string;
  handler: ResourceHandler;
}

// Request format for tool calls
export interface ToolCallRequest {
  name: string;
  parameters: Record<string, any>;
}

// Response format for tool calls
export interface ToolCallResponse {
  result: any;
  error?: string;
}

// Options for initializing an MCP server
export interface MCPServerOptions {
  dependencies?: string[];
  description?: string;
  version?: string;
}

// Response format for resource calls
export interface ResourceResponse {
  contents: ResourceContent[];
}

// Content in a resource response
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}