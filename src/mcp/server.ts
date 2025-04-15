// /**
//  * ClickHouse MCP Server implementation using the Model Context Protocol SDK.
//  */
// import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { z } from "zod";
// import { Logger } from "../utils/logger.js";
// import { getClickHouseClient, executeSelectQuery } from "../clickhouse/client.js";
// import { 
//   importCSVWithClickHouse, 
//   storeCSVContent, 
//   retrieveCSVFilePath,
//   exportDataToCsvDirect 
// } from "../handlers/csvHandler.js";
// import { checkTableExists, getTableSchema } from "../clickhouse/schema.js";
// import { ClickHouseClient } from "@clickhouse/client";

// const logger = new Logger('mcp-server');

// const MCP_SERVER_NAME = "mcp-clickhouse";
// const MCP_SERVER_VERSION = "0.1.5";

// /**
//  * Create and configure the MCP server for ClickHouse.
//  * 
//  * @returns Configured MCP server
//  */
// export function createMCPServer(): McpServer {
//   // Create the MCP server
//   const server = new McpServer({
//     name: MCP_SERVER_NAME,
//     version: MCP_SERVER_VERSION
//   });

//   // Create a client that can be shared
//   let client: ClickHouseClient;
//   try {
//     client = getClickHouseClient();
//   } catch (error) {
//     logger.error(`Failed to create ClickHouse client: ${error}`);
//     throw error;
//   }

//   // Resource: CSV Upload
//   server.resource(
//     "csv_upload",
//     new ResourceTemplate("resource://csv-upload/{url}", { list: undefined }),
//     async (uri, { url }) => {
//       try {
//         // Parse URL parameters
//         const urlObj = new URL(url, "http://localhost");
//         const filename = urlObj.searchParams.get("filename") || "uploaded.csv";
        
//         // In a real implementation, the content would be extracted from the request
//         // For testing, we'll use a placeholder content
//         const csvContent = "This would be the actual CSV content from the upload";
        
//         // Store CSV content and generate unique ID
//         const uploadId = storeCSVContent(csvContent, filename);
        
//         // Return info about the upload
//         return {
//           contents: [
//             {
//               uri: `csv-upload:${uploadId}`,
//               mimeType: "text/csv",
//               text: `CSV successfully uploaded with ID: ${uploadId}\nFilename: ${filename}\nSize: ${csvContent.length} bytes`
//             }
//           ]
//         };
//       } catch (error) {
//         logger.error(`Error handling CSV upload: ${error}`);
//         return {
//           contents: [
//             {
//               uri: "csv-upload:error",
//               mimeType: "text/plain",
//               text: `Error uploading CSV: ${error}`
//             }
//           ]
//         };
//       }
//     }
//   );

//   // Tool: List Databases
//   server.tool(
//     "list_databases",
//     {},
//     async () => {
//       logger.info("Listing all databases");
//       try {
//         const result = await client.query({
//           query: "SHOW DATABASES",
//           format: "JSONEachRow"
//         });
        
//         logger.info(`Found ${result.rows.length} databases`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: JSON.stringify(result.rows, null, 2) 
//           }]
//         };
//       } catch (error) {
//         logger.error(`Error listing databases: ${error}`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: `Error listing databases: ${error}`
//           }],
//           isError: true
//         };
//       }
//     }
//   );

//   // Tool: List Tables
//   server.tool(
//     "list_tables",
//     {
//       database: z.string().describe("Database name"),
//       like: z.string().optional().describe("Optional LIKE pattern for filtering table names")
//     },
//     async ({ database, like }) => {
//       logger.info(`Listing tables in database '${database}'`);
//       try {
//         // Build query
//         let query = `SHOW TABLES FROM \`${database}\``;
//         if (like) {
//           query += ` LIKE '${like}'`;
//         }
        
//         const result = await client.query({
//           query,
//           format: "JSONEachRow"
//         });
        
//         // Get all table comments in one query
//         const tableCommentsQuery = `
//           SELECT name, comment 
//           FROM system.tables 
//           WHERE database = '${database}'
//         `;
//         const tableCommentsResult = await client.query({
//           query: tableCommentsQuery,
//           format: "JSONEachRow"
//         });
        
//         // Create table comments lookup
//         const tableComments: Record<string, string> = {};
//         for (const row of tableCommentsResult.rows) {
//           tableComments[(row as any).name] = (row as any).comment || "";
//         }
        
//         // Get all column comments in one query
//         const columnCommentsQuery = `
//           SELECT table, name, comment 
//           FROM system.columns 
//           WHERE database = '${database}'
//         `;
//         const columnCommentsResult = await client.query({
//           query: columnCommentsQuery,
//           format: "JSONEachRow"
//         });
        
//         // Create column comments lookup
//         const columnComments: Record<string, Record<string, string>> = {};
//         for (const row of columnCommentsResult.rows) {
//           const table = (row as any).table;
//           const colName = (row as any).name;
//           const comment = (row as any).comment || "";
          
//           if (!columnComments[table]) {
//             columnComments[table] = {};
//           }
//           columnComments[table][colName] = comment;
//         }
        
//         // Process tables
//         const tables = [];
//         for (const row of result.rows) {
//           const tableName = (row as any).name;
          
//           // Get schema info
//           const schemaQuery = `DESCRIBE TABLE \`${database}\`.\`${tableName}\``;
//           const schemaResult = await client.query({
//             query: schemaQuery,
//             format: "JSONEachRow"
//           });
          
//           // Process columns
//           const columns = [];
//           for (const colRow of schemaResult.rows) {
//             const colDict: Record<string, any> = { ...colRow as object };
            
//             // Add comment
//             if (columnComments[tableName] && columnComments[tableName][colDict.name]) {
//               colDict.comment = columnComments[tableName][colDict.name];
//             } else {
//               colDict.comment = null;
//             }
            
//             columns.push(colDict);
//           }
          
//           // Get CREATE TABLE statement
//           const createTableQuery = `SHOW CREATE TABLE ${database}.\`${tableName}\``;
//           const createTableResult = await client.query({
//             query: createTableQuery,
//             format: "Raw"
//           });
          
//           tables.push({
//             database,
//             name: tableName,
//             comment: tableComments[tableName] || null,
//             columns,
//             create_table_query: createTableResult.toString()
//           });
//         }
        
//         logger.info(`Found ${tables.length} tables`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: JSON.stringify(tables, null, 2) 
//           }]
//         };
//       } catch (error) {
//         logger.error(`Error listing tables: ${error}`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: `Error listing tables: ${error}` 
//           }],
//           isError: true
//         };
//       }
//     }
//   );

//   // Tool: Run Select Query
//   server.tool(
//     "run_select_query",
//     {
//       query: z.string().describe("SQL SELECT query to execute")
//     },
//     async ({ query }) => {
//       logger.info(`Executing SELECT query: ${query}`);
//       try {
//         const result = await executeSelectQuery(query, 30000);
        
//         // Check if we received an error structure
//         if (typeof result === 'object' && 'status' in result && result.status === 'error') {
//           logger.warning(`Query failed: ${result.message}`);
//           return {
//             content: [{ 
//               type: "text", 
//               text: `Query failed: ${result.message}` 
//             }],
//             isError: true
//           };
//         }
        
//         return {
//           content: [{ 
//             type: "text", 
//             text: JSON.stringify(result, null, 2) 
//           }]
//         };
//       } catch (error) {
//         logger.error(`Error executing query: ${error}`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: `Error executing query: ${error}` 
//           }],
//           isError: true
//         };
//       }
//     }
//   );

//   // Tool: Import CSV Data
//   server.tool(
//     "import_csv_data",
//     {
//       database: z.string().describe("Target database"),
//       table_name: z.string().describe("Target table (will be created if doesn't exist)"),
//       csv_source: z.object({
//         type: z.enum(['direct', 'upload']).describe("Source type: 'direct' or 'upload'"),
//         data: z.string().optional().describe("CSV data as string (for 'direct' type)"),
//         upload_id: z.string().optional().describe("Upload ID (for 'upload' type)")
//       }).describe("CSV data source"),
//       options: z.object({
//         has_header_row: z.boolean().default(true).describe("Whether CSV has a header row"),
//         delimiter: z.string().default(",").describe("CSV delimiter character"),
//         quote_char: z.string().default("\"").describe("CSV quote character"),
//         escape_char: z.string().default("\"").describe("CSV escape character"),
//         newline: z.string().default("\n").describe("CSV newline character"),
//         column_mapping: z.record(z.string()).optional().describe("Map CSV columns to table columns"),
//         batch_size: z.number().default(100000).describe("Batch size for import"),
//         dry_run: z.boolean().default(false).describe("Analyze without importing"),
//         auto_create_table: z.boolean().default(false).describe("Create table automatically if it doesn't exist"),
//         create_only: z.boolean().default(false).describe("Create table only, don't import data")
//       }).optional().describe("Import options"),
//       table_settings: z.object({
//         engine: z.string().default("MergeTree()").describe("ClickHouse table engine"),
//         order_by: z.string().optional().describe("ORDER BY clause (required for MergeTree)"),
//         primary_key: z.string().optional().describe("PRIMARY KEY clause (defaults to ORDER BY)"),
//         partition_by: z.string().optional().describe("PARTITION BY clause for data partitioning"),
//         ttl: z.string().optional().describe("TTL expression for automatic data expiration"),
//         storage_policy: z.string().optional().describe("Storage policy name"),
//         settings: z.record(z.any()).optional().describe("Additional engine settings")
//       }).optional().describe("Table creation settings")
//     },
//     async ({ database, table_name, csv_source, options = {}, table_settings }) => {
//       logger.info(`Importing CSV data into ${database}.${table_name}`);
      
//       try {
//         // Get CSV data from source
//         let csvFilePath: string | null = null;
        
//         if (csv_source.type === "direct") {
//           if (!csv_source.data) {
//             return {
//               content: [{ 
//                 type: "text", 
//                 text: "Missing CSV data in direct source" 
//               }],
//               isError: true
//             };
//           }
//           csvFilePath = storeCSVContent(csv_source.data);
//         } else if (csv_source.type === "upload") {
//           if (!csv_source.upload_id) {
//             return {
//               content: [{ 
//                 type: "text", 
//                 text: "Missing upload_id in upload source" 
//               }],
//               isError: true
//             };
//           }
          
//           csvFilePath = retrieveCSVFilePath(csv_source.upload_id);
//           if (!csvFilePath) {
//             return {
//               content: [{ 
//                 type: "text", 
//                 text: `CSV upload with ID ${csv_source.upload_id} not found or expired` 
//               }],
//               isError: true
//             };
//           }
//         } else {
//           return {
//             content: [{ 
//               type: "text", 
//               text: `Invalid CSV source type: ${csv_source.type}` 
//             }],
//             isError: true
//           };
//         }
        
//         // Use our integrated ClickHouse import function
//         const importResult = await importCSVWithClickHouse(
//           client,
//           database,
//           table_name,
//           csvFilePath,
//           {
//             has_header_row: options.has_header_row ?? true,
//             delimiter: options.delimiter ?? ",",
//             quote_char: options.quote_char ?? "\"",
//             escape_char: options.escape_char ?? "\"",
//             newline: options.newline ?? "\n",
//             column_mapping: options.column_mapping,
//             batch_size: options.batch_size ?? 100000,
//             dry_run: options.dry_run ?? false,
//             auto_create_table: options.auto_create_table ?? false,
//             create_only: options.create_only ?? false
//           },
//           table_settings
//         );
        
//         return {
//           content: [{ 
//             type: "text", 
//             text: JSON.stringify(importResult, null, 2) 
//           }]
//         };
//       } catch (error) {
//         logger.error(`Error in import_csv_data: ${error}`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: `Import failed: ${error}` 
//           }],
//           isError: true
//         };
//       }
//     }
//   );

//   // Tool: Export CSV Data
//   server.tool(
//     "export_csv_data",
//     {
//       database: z.string().describe("Source database"),
//       table_name: z.string().describe("Source table name"),
//       query: z.string().optional().describe("Custom query instead of SELECT * FROM table"),
//       columns: z.array(z.string()).optional().describe("Specific columns to export"),
//       where: z.string().optional().describe("WHERE clause"),
//       limit: z.number().optional().describe("Limit number of rows"),
//       format_options: z.object({
//         format: z.string().default("CSV").describe("Output format (CSV, TSV, JSONEachRow, etc)"),
//         delimiter: z.string().default(",").describe("Delimiter for CSV/TSV formats"),
//         with_names: z.boolean().default(true).describe("Include header row"),
//         with_types: z.boolean().default(false).describe("Include type information row"),
//         quote_char: z.string().default("\"").describe("Quote character for CSV/TSV formats")
//       }).optional().describe("Format options")
//     },
//     async ({ database, table_name, query, columns, where, limit, format_options }) => {
//       logger.info(`Exporting data from ${database}.${table_name}`);
      
//       try {
//         // Check if table exists
//         const tableExists = await checkTableExists(client, database, table_name);
//         if (!tableExists && !query) {
//           return {
//             content: [{ 
//               type: "text", 
//               text: `Table ${database}.${table_name} does not exist` 
//             }],
//             isError: true
//           };
//         }
        
//         // Use direct export with ClickHouse's native formatters
//         const [data, mimeType, stats] = await exportDataToCsvDirect(
//           client,
//           database,
//           table_name,
//           query,
//           columns,
//           where,
//           limit,
//           format_options || {
//             format: "CSV",
//             delimiter: ",",
//             with_names: true,
//             with_types: false,
//             quote_char: "\""
//           }
//         );
        
//         // Return formatted data with metadata
//         return {
//           content: [
//             { 
//               type: "text", 
//               text: JSON.stringify({
//                 status: stats.status || "error",
//                 format: format_options?.format || "CSV",
//                 row_count: stats.row_count || 0,
//                 mime_type: mimeType,
//                 stats
//               }, null, 2)
//             },
//             {
//               type: "text",
//               text: data
//             }
//           ]
//         };
//       } catch (error) {
//         logger.error(`Error in export_csv_data: ${error}`);
//         return {
//           content: [{ 
//             type: "text", 
//             text: `Export failed: ${error}` 
//           }],
//           isError: true
//         };
//       }
//     }
//   );

//   return server;
// }

// /**
//  * Run the MCP server with standard I/O transport.
//  */
// export async function runMCPServer(): Promise<void> {
//   try {
//     const server = createMCPServer();
    
//     // Start with stdio transport
//     const transport = new StdioServerTransport();
    
//     logger.info(`Starting ${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} with stdio transport`);
//     await server.connect(transport);
    
//     logger.info("MCP server connected and ready");
//   } catch (error) {
//     logger.error(`Failed to start MCP server: ${error}`);
//     process.exit(1);
//   }
// }