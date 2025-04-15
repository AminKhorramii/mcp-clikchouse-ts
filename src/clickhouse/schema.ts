// import * as path from 'path';
// import { createHash } from 'crypto';
// import { ClickHouseClient } from '@clickhouse/client';
// import { quoteIdentifier, formatQueryValue, executeCommand } from './client.js';
// import { ColumnDefinition, TableSettings, ImportCsvOptions } from '../models/csvModels.js';
// import { Logger } from '../utils/logger.js';

// const logger = new Logger('clickhouse-schema');

// // Minimum ClickHouse version that supports schema inference
// // const MIN_SCHEMA_INFERENCE_VERSION = '21.8.0';

// /**
//  * Check if schema inference is supported by the ClickHouse server.
//  * 
//  * @param client - ClickHouse client
//  * @returns Whether schema inference is supported
//  */
// export async function checkSchemaInferenceSupport(client: ClickHouseClient): Promise<boolean> {
//   try {
//     const result = await client.query({
//       query: 'SELECT version() as v',
//       format: 'JSONEachRow',
//     });
    
//     if (result.rows.length === 0) {
//       return false;
//     }
    
//     const serverVersion = (result.rows[0].v as string) || '';
//     // Extract major.minor.patch from version string like "21.8.10.1-alpine"
//     const versionParts = serverVersion.split('.');
//     if (versionParts.length < 3) {
//       return false;
//     }
    
//     // Check major version
//     const majorVersion = parseInt(versionParts[0], 10);
//     if (majorVersion < 21) {
//       return false;
//     }
    
//     // Check minor version for major version 21
//     if (majorVersion === 21) {
//       const minorVersion = parseInt(versionParts[1], 10);
//       return minorVersion >= 8;
//     }
    
//     // All versions 22+ support schema inference
//     return true;
//   } catch (error) {
//     logger.warning(`Failed to detect schema inference support: ${error}`);
//     return false;
//   }
// }

// /**
//  * Sanitize a name for use as a ClickHouse identifier.
//  * 
//  * @param name - Original name
//  * @returns Sanitized name
//  */
// export function sanitizeIdentifier(name: string): string {
//   // Replace spaces and special chars with underscores
//   let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  
//   // Ensure it doesn't start with a number
//   if (/^\d/.test(sanitized)) {
//     sanitized = 'col_' + sanitized;
//   }
  
//   return sanitized;
// }

// /**
//  * Use ClickHouse's native schema inference to determine column types.
//  * 
//  * @param client - ClickHouse client
//  * @param filePath - Path to CSV file
//  * @param options - CSV options
//  * @returns Array of column definitions with inferred types
//  */
// export async function inferSchemaWithClickHouse(
//   client: ClickHouseClient,
//   filePath: string,
//   options: ImportCsvOptions
// ): Promise<ColumnDefinition[]> {
//   // Generate a unique table name using a hash of the file path
//   const fileHash = createHash('md5').update(filePath).digest('hex').substring(0, 8);
//   const tempTable = `temp_import_${fileHash}`;
  
//   try {
//     // Determine format based on header option
//     const csvFormat = options.has_header_row ? 'CSVWithNames' : 'CSV';
    
//     // Add format settings for delimiter and quotes
//     const formatSettings: string[] = [];
//     if (options.delimiter && options.delimiter !== ',') {
//       formatSettings.push(`format_csv_delimiter = '${options.delimiter}'`);
//     }
//     if (options.quote_char && options.quote_char !== '"') {
//       formatSettings.push(`format_csv_quote = '${options.quote_char}'`);
//     }
    
//     const settingsClause = formatSettings.length > 0 
//       ? `SETTINGS input_format_schema_inference=1, ${formatSettings.join(', ')}`
//       : 'SETTINGS input_format_schema_inference=1';
    
//     // Create a temporary table with schema inference
//     const createTempQuery = `
//       CREATE TEMPORARY TABLE ${tempTable}
//       ENGINE = Memory
//       AS SELECT * FROM file('${filePath}', '${csvFormat}')
//       ${settingsClause}
//       LIMIT 0
//     `;
    
//     logger.info(`Creating temporary table with schema inference: ${createTempQuery}`);
//     await executeCommand(createTempQuery);
    
//     // Retrieve the inferred schema
//     const schemaResult = await client.query({
//       query: `DESCRIBE TABLE ${tempTable}`,
//       format: 'JSONEachRow'
//     });
    
//     // Process schema result
//     const columns: ColumnDefinition[] = schemaResult.rows.map(row => ({
//       name: sanitizeIdentifier(row.name as string),
//       inferred_type: row.type as string,
//       default_type: row.default_type as string | undefined,
//       default_expression: row.default_expression as string | undefined
//     }));
    
//     return columns;
//   } catch (error) {
//     logger.error(`Error in ClickHouse schema inference: ${error}`);
//     throw error;
//   } finally {
//     // Drop the temporary table
//     try {
//       await executeCommand(`DROP TABLE IF EXISTS ${tempTable}`);
//     } catch (error) {
//       logger.warning(`Failed to drop temporary table: ${error}`);
//     }
//   }
// }

// /**
//  * Enhance a column type based on statistics and sample values.
//  * 
//  * @param inferredType - Type inferred by ClickHouse
//  * @param uniquePercent - Percentage of unique values
//  * @param sampleValues - Sample values from the column
//  * @returns Enhanced type
//  */
// export function enhanceColumnType(
//   inferredType: string, 
//   uniquePercent: number, 
//   sampleValues: string[]
// ): string {
//   // Apply LowCardinality for string columns with low uniqueness
//   if (inferredType === 'String' && uniquePercent < 30) {
//     return 'LowCardinality(String)';
//   }
  
//   // Optimize integer width if possible
//   if (inferredType === 'Int64' || inferredType === 'UInt64') {
//     // Check if values are actually small
//     try {
//       const numValues = sampleValues
//         .filter(v => v.trim() !== '')
//         .map(v => parseInt(v, 10));
      
//       if (numValues.length > 0) {
//         const maxVal = Math.max(...numValues);
//         const minVal = Math.min(...numValues);
        
//         if (minVal >= 0) {  // Unsigned
//           if (maxVal < 256) {
//             return 'UInt8';
//           } else if (maxVal < 65536) {
//             return 'UInt16';
//           } else if (maxVal < 4294967296) {
//             return 'UInt32';
//           }
//         } else {  // Signed
//           if (minVal >= -128 && maxVal < 128) {
//             return 'Int8';
//           } else if (minVal >= -32768 && maxVal < 32768) {
//             return 'Int16';
//           } else if (minVal >= -2147483648 && maxVal < 2147483648) {
//             return 'Int32';
//           }
//         }
//       }
//     } catch (error) {
//       // If we can't parse, stick with inferred type
//     }
//   }
  
//   // Default to the inferred type
//   return inferredType;
// }

// /**
//  * Suggest optimal table settings based on the schema.
//  * 
//  * @param schema - Enhanced schema with column statistics
//  * @param settings - User-provided settings
//  * @returns Suggested settings
//  */
// export function suggestTableSettings(
//   schema: ColumnDefinition[],
//   settings?: TableSettings
// ): TableSettings {
//   // Start with user settings or defaults
//   const suggestedSettings: TableSettings = settings ? { ...settings } : { engine: 'MergeTree()' };
  
//   // Only suggest for MergeTree family
//   if (!suggestedSettings.engine.toLowerCase().includes('mergetree')) {
//     return suggestedSettings;
//   }
  
//   // Suggest ORDER BY if not provided
//   if (!suggestedSettings.order_by) {
//     // Look for ID columns with high uniqueness
//     const idColumns = schema.filter(col => 
//       col.name.toLowerCase().includes('id') && 
//       (col.stats?.unique_percent || 0) > 90
//     );
    
//     if (idColumns.length > 0) {
//       suggestedSettings.order_by = idColumns[0].name;
//     } else {
//       // Look for date columns
//       const dateColumns = schema.filter(col => 
//         col.inferred_type === 'Date' || col.inferred_type === 'DateTime'
//       );
      
//       if (dateColumns.length > 0) {
//         // If we have a date column and a unique column, use both
//         const uniqueColumns = schema.filter(col => 
//           (col.stats?.unique_percent || 0) > 90
//         );
        
//         if (uniqueColumns.length > 0) {
//           suggestedSettings.order_by = `(${dateColumns[0].name}, ${uniqueColumns[0].name})`;
//         } else {
//           suggestedSettings.order_by = dateColumns[0].name;
//         }
//       } else {
//         // Fall back to first column or a unique column if available
//         const uniqueColumns = schema.filter(col => 
//           (col.stats?.unique_percent || 0) > 90
//         );
        
//         if (uniqueColumns.length > 0) {
//           suggestedSettings.order_by = uniqueColumns[0].name;
//         } else if (schema.length > 0) {
//           suggestedSettings.order_by = schema[0].name;
//         }
//       }
//     }
//   }
  
//   // Suggest PARTITION BY for date columns if not provided
//   if (!suggestedSettings.partition_by) {
//     for (const col of schema) {
//       if (col.inferred_type === 'Date') {
//         suggestedSettings.partition_by = `toYYYYMM(${col.name})`;
//         break;
//       } else if (col.inferred_type === 'DateTime') {
//         suggestedSettings.partition_by = `toYYYYMM(${col.name})`;
//         break;
//       }
//     }
//   }
  
//   return suggestedSettings;
// }

// /**
//  * Generate SQL to create a ClickHouse table.
//  * 
//  * @param database - Database name
//  * @param tableName - Table name
//  * @param columns - Column definitions
//  * @param settings - Table settings
//  * @returns CREATE TABLE SQL statement
//  */
// export function generateCreateTableSQL(
//   database: string,
//   tableName: string,
//   columns: ColumnDefinition[],
//   settings: TableSettings
// ): string {
//   // Sanitize identifiers
//   const safeDb = quoteIdentifier(database);
//   const safeTable = quoteIdentifier(tableName);
  
//   // Format column definitions
//   const columnDefs = columns.map(col => 
//     `${quoteIdentifier(col.name)} ${col.inferred_type}`
//   );
  
//   // Extract engine settings
//   const engine = settings.engine || 'MergeTree()';
//   const orderBy = settings.order_by;
//   const primaryKey = settings.primary_key;
//   const partitionBy = settings.partition_by;
//   const ttl = settings.ttl;
//   const storagePolicy = settings.storage_policy;
//   const engineSettings = settings.settings || {};
  
//   // Build CREATE TABLE statement
//   let sql = `CREATE TABLE ${safeDb}.${safeTable} (\n  `;
//   sql += columnDefs.join(',\n  ');
//   sql += `\n) ENGINE = ${engine}`;
  
//   // Add required clauses for MergeTree
//   if (engine.toLowerCase().includes('mergetree')) {
//     // ORDER BY is required for MergeTree
//     if (!orderBy && columns.length > 0) {
//       // Use first column as default
//       sql += `\nORDER BY (${quoteIdentifier(columns[0].name)})`;
//     } else if (orderBy) {
//       sql += `\nORDER BY (${orderBy})`;
//     }
    
//     // Add optional PRIMARY KEY if different from ORDER BY
//     if (primaryKey && primaryKey !== orderBy) {
//       sql += `\nPRIMARY KEY (${primaryKey})`;
//     }
    
//     // Add optional PARTITION BY
//     if (partitionBy) {
//       sql += `\nPARTITION BY ${partitionBy}`;
//     }
    
//     // Add optional TTL
//     if (ttl) {
//       sql += `\nTTL ${ttl}`;
//     }
//   }
  
//   // Add storage policy if specified
//   if (storagePolicy) {
//     sql += `\nSETTINGS storage_policy = '${storagePolicy}'`;
//   }
  
//   // Add any additional engine settings
//   if (Object.keys(engineSettings).length > 0) {
//     const settingsStrs = Object.entries(engineSettings).map(
//       ([k, v]) => `${k} = ${v}`
//     );
    
//     if (!storagePolicy) {
//       sql += '\nSETTINGS ';
//     } else {
//       sql += ', ';
//     }
    
//     sql += settingsStrs.join(', ');
//   }
  
//   return sql;
// }

// /**
//  * Check if a table exists in the database.
//  * 
//  * @param client - ClickHouse client
//  * @param database - Database name
//  * @param tableName - Table name
//  * @returns Whether the table exists
//  */
// export async function checkTableExists(
//   client: ClickHouseClient, 
//   database: string, 
//   tableName: string
// ): Promise<boolean> {
//   const query = `
//     SELECT 1 
//     FROM system.tables 
//     WHERE database = ${formatQueryValue(database)} AND name = ${formatQueryValue(tableName)}
//   `;
  
//   try {
//     const result = await client.query({
//       query,
//       format: 'JSONEachRow'
//     });
    
//     return result.rows.length > 0;
//   } catch (error) {
//     logger.error(`Error checking if table exists: ${error}`);
//     return false;
//   }
// }

// /**
//  * Get schema information for a table.
//  * 
//  * @param client - ClickHouse client
//  * @param database - Database name
//  * @param tableName - Table name
//  * @returns List of column definitions
//  */
// export async function getTableSchema(
//   client: ClickHouseClient,
//   database: string,
//   tableName: string
// ): Promise<ColumnDefinition[]> {
//   const query = `DESCRIBE TABLE ${quoteIdentifier(database)}.${quoteIdentifier(tableName)}`;
  
//   try {
//     const result = await client.query({
//       query,
//       format: 'JSONEachRow'
//     });
    
//     return result.rows.map(row => ({
//       name: row.name as string,
//       inferred_type: row.type as string,
//       default_type: row.default_type as string | undefined,
//       default_expression: row.default_expression as string | undefined
//     }));
//   } catch (error) {
//     logger.error(`Error getting table schema: ${error}`);
//     throw error;
//   }
// }