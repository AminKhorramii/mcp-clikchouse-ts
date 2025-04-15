// import * as fs from "fs";
// import * as path from "path";
// import * as os from "os";
// import { v4 as uuidv4 } from "uuid";
// import { parse as csvParse } from "csv-parse/sync";
// import { ClickHouseClient } from "@clickhouse/client";
// import { Logger } from "../utils/logger.js";
// import {
//   ImportCsvOptions,
//   TableSettings,
//   ColumnDefinition,
//   ExportFormatOptions,
// } from "../models/csvModels.js";
// import {
//   checkSchemaInferenceSupport,
//   inferSchemaWithClickHouse,
//   suggestTableSettings,
//   generateCreateTableSQL,
//   checkTableExists,
//   getTableSchema,
//   enhanceColumnType,
//   sanitizeIdentifier,
// } from "../clickhouse/schema.js";
// import { quoteIdentifier, executeCommand } from "../clickhouse/client.js";

// const logger = new Logger("csv-handler");

// // In-memory storage for uploaded CSV files with 30-minute expiration
// interface CsvStorageItem {
//   filePath: string;
//   filename: string;
//   timestamp: number;
//   size: number;
// }

// const csvStorage: Record<string, CsvStorageItem> = {};

// /**
//  * Store CSV content and return a unique ID for later retrieval.
//  *
//  * @param content - CSV data as string
//  * @param filename - Original filename
//  * @returns Unique ID for the stored CSV
//  */
// export function storeCSVContent(
//   content: string,
//   filename: string = "uploaded.csv"
// ): string {
//   const uploadId = uuidv4();
//   const tempDir = os.tmpdir();
//   const filePath = path.join(tempDir, `clickhouse-import-${uploadId}.csv`);

//   fs.writeFileSync(filePath, content, { encoding: "utf8" });

//   csvStorage[uploadId] = {
//     filePath,
//     filename,
//     timestamp: Date.now(),
//     size: content.length,
//   };

//   logger.info(
//     `Stored CSV with ID ${uploadId}, size ${content.length} bytes, path: ${filePath}`
//   );

//   // Set expiration (cleanup after 30 minutes)
//   setTimeout(() => {
//     const fileInfo = csvStorage[uploadId];
//     if (fileInfo && fs.existsSync(fileInfo.filePath)) {
//       try {
//         fs.unlinkSync(fileInfo.filePath);
//         logger.info(`Removed expired CSV file: ${fileInfo.filePath}`);
//       } catch (error) {
//         logger.warning(`Failed to delete expired CSV file: ${error}`);
//       }
//     }
//     delete csvStorage[uploadId];
//     logger.info(`Removed expired CSV entry with ID ${uploadId}`);
//   }, 30 * 60 * 1000); // 30 minutes

//   return uploadId;
// }

// /**
//  * Retrieve stored CSV content by upload ID.
//  *
//  * @param uploadId - ID of the stored CSV
//  * @returns CSV file path or null if not found/expired
//  */
// export function retrieveCSVFilePath(uploadId: string): string | null {
//   if (!(uploadId in csvStorage)) {
//     logger.warning(`CSV with ID ${uploadId} not found`);
//     return null;
//   }

//   const upload = csvStorage[uploadId];

//   // Check if expired (30 minutes)
//   if (Date.now() - upload.timestamp > 30 * 60 * 1000) {
//     logger.info(`CSV with ID ${uploadId} has expired, removing`);

//     if (fs.existsSync(upload.filePath)) {
//       try {
//         fs.unlinkSync(upload.filePath);
//       } catch (error) {
//         logger.warning(`Failed to delete expired CSV file: ${error}`);
//       }
//     }

//     delete csvStorage[uploadId];
//     return null;
//   }

//   return upload.filePath;
// }

// /**
//  * Analyze CSV data and return structure and type information.
//  *
//  * @param filePath - Path to CSV file
//  * @param options - CSV parsing options
//  * @returns Analysis results
//  */
// export function analyzeCSV(
//   filePath: string,
//   options: ImportCsvOptions
// ): {
//   header: string[];
//   sanitizedHeader: string[];
//   totalRows: number;
//   sampleRows: any[][];
//   columnAnalysis: ColumnDefinition[];
// } {
//   // Extract options
//   const hasHeader = options.has_header_row;
//   const delimiter = options.delimiter;
//   const quoteChar = options.quote_char;

//   // Read file content
//   const csvData = fs.readFileSync(filePath, { encoding: "utf8" });

//   // Parse CSV
//   const parseOptions = {
//     delimiter,
//     quote: quoteChar,
//     columns: hasHeader,
//     skip_empty_lines: true,
//     skip_records_with_error: true,
//   };

//   const records = csvParse(csvData, parseOptions);

//   // Get header
//   let header: string[];
//   let dataRows: any[];

//   if (hasHeader) {
//     // When columns:true is used, records become an array of objects
//     header = Object.keys(records[0] || {});
//     dataRows = records;
//   } else {
//     // For no header, generate column names and records are arrays
//     dataRows = records;
//     const firstRow = dataRows[0] || [];
//     header = Array.from(
//       { length: firstRow.length },
//       (_, i) => `column_${i + 1}`
//     );
//   }

//   // Create sanitized header
//   const sanitizedHeader = header.map((h) => sanitizeIdentifier(h));

//   // Sample rows for analysis
//   const sampleSize = Math.min(100, dataRows.length);
//   const sampleRows: any[][] = [];

//   for (let i = 0; i < sampleSize; i++) {
//     if (hasHeader) {
//       // Convert objects to arrays in the same order as header
//       sampleRows.push(header.map((h) => dataRows[i][h]));
//     } else {
//       sampleRows.push(dataRows[i]);
//     }
//   }

//   // Analyze column types
//   const columnAnalysis: ColumnDefinition[] = [];

//   for (let i = 0; i < header.length; i++) {
//     const columnName = header[i];
//     const sanitizedName = sanitizedHeader[i];

//     // Extract column values for analysis
//     const columnValues: string[] = [];
//     for (const row of sampleRows) {
//       const value = row[i]?.toString() || "";
//       columnValues.push(value);
//     }

//     // Calculate statistics
//     const nonNull = columnValues.filter((v) => v.trim() !== "").length;
//     const uniqueValues = new Set(columnValues).size;

//     // Infer type (basic implementation, for older ClickHouse)
//     const inferredType = inferColumnType(columnValues);

//     columnAnalysis.push({
//       name: sanitizedName,
//       inferred_type: inferredType,
//       stats: {
//         non_null_percent: sampleRows.length
//           ? (nonNull / sampleRows.length) * 100
//           : 0,
//         unique_percent: sampleRows.length
//           ? (uniqueValues / sampleRows.length) * 100
//           : 0,
//         sample_values: columnValues.slice(0, 5),
//       },
//     });
//   }

//   return {
//     header,
//     sanitizedHeader,
//     totalRows: dataRows.length,
//     sampleRows: sampleRows.slice(0, 5), // First 5 for preview
//     columnAnalysis,
//   };
// }

// /**
//  * Infer ClickHouse data type from sample values.
//  * (Fallback method for older ClickHouse versions)
//  *
//  * @param values - List of sample values
//  * @returns ClickHouse data type
//  */
// function inferColumnType(values: string[]): string {
//   // Remove empty values
//   const nonEmpty = values.filter((v) => v.trim() !== "");
//   if (nonEmpty.length === 0) {
//     return "String";
//   }

//   // Check for integers
//   const intRegex = /^-?\d+$/;
//   const allInt = nonEmpty.every((v) => intRegex.test(v));

//   if (allInt) {
//     // Determine appropriate integer type
//     try {
//       const nums = nonEmpty.map((v) => parseInt(v, 10));
//       const maxVal = Math.max(...nums);
//       const minVal = Math.min(...nums);

//       if (minVal >= 0) {
//         // Unsigned
//         if (maxVal < 256) {
//           return "UInt8";
//         } else if (maxVal < 65536) {
//           return "UInt16";
//         } else if (maxVal < 4294967296) {
//           return "UInt32";
//         } else {
//           return "UInt64";
//         }
//       } else {
//         // Signed
//         if (minVal >= -128 && maxVal < 128) {
//           return "Int8";
//         } else if (minVal >= -32768 && maxVal < 32768) {
//           return "Int16";
//         } else if (minVal >= -2147483648 && maxVal < 2147483648) {
//           return "Int32";
//         } else {
//           return "Int64";
//         }
//       }
//     } catch (err) {
//       return "String"; // Fallback if parsing fails
//     }
//   }

//   // Check for floating point
//   const floatRegex = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
//   const allFloat = nonEmpty.every((v) => floatRegex.test(v));

//   if (allFloat) {
//     return "Float64";
//   }

//   // Check for dates (YYYY-MM-DD)
//   const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//   const allDate = nonEmpty.every((v) => dateRegex.test(v));

//   if (allDate) {
//     return "Date";
//   }

//   // Check for datetimes (YYYY-MM-DD HH:MM:SS)
//   const datetimeRegex = /^\d{4}-\d{2}-\d{2}(\s|T)\d{2}:\d{2}:\d{2}$/;
//   const allDatetime = nonEmpty.every((v) => datetimeRegex.test(v));

//   if (allDatetime) {
//     return "DateTime";
//   }

//   // Check for boolean values
//   const boolValues = new Set([
//     "true",
//     "false",
//     "yes",
//     "no",
//     "1",
//     "0",
//     "t",
//     "f",
//     "y",
//     "n",
//   ]);
//   const allBool = nonEmpty.every((v) => boolValues.has(v.toLowerCase()));

//   if (allBool && new Set(nonEmpty.map((v) => v.toLowerCase())).size <= 2) {
//     return "UInt8"; // ClickHouse doesn't have Boolean, uses UInt8
//   }

//   // Check for low cardinality strings
//   const uniquePercent = (new Set(nonEmpty).size / nonEmpty.length) * 100;
//   if (uniquePercent < 30) {
//     // If less than 30% unique values
//     return "LowCardinality(String)";
//   }

//   // Default to String
//   return "String";
// }

// /**
//  * Enhance the schema inferred by ClickHouse with additional optimizations.
//  *
//  * @param inferredSchema - Schema inferred by ClickHouse
//  * @param csv - CSV analysis results
//  * @returns Enhanced column definitions
//  */
// export function enhanceInferredSchema(
//   inferredSchema: ColumnDefinition[],
//   csv: ReturnType<typeof analyzeCSV>
// ): ColumnDefinition[] {
//   // Map column stats to inferred schema
//   const columnStats: Record<string, any> = {};

//   for (const col of csv.columnAnalysis) {
//     columnStats[col.name] = {
//       unique_percent: col.stats?.unique_percent || 0,
//       non_null_percent: col.stats?.non_null_percent || 0,
//       sample_values: col.stats?.sample_values || [],
//     };
//   }

//   // Enhance each column based on statistics
//   return inferredSchema.map((col) => {
//     // Get stats for this column
//     const stats = columnStats[col.name] || {
//       unique_percent: 100,
//       non_null_percent: 100,
//       sample_values: [],
//     };

//     // Apply optimizations
//     const enhancedType = enhanceColumnType(
//       col.inferred_type,
//       stats.unique_percent,
//       stats.sample_values
//     );

//     return {
//       name: col.name,
//       inferred_type: enhancedType,
//       default_type: col.default_type,
//       default_expression: col.default_expression,
//       stats: {
//         unique_percent: stats.unique_percent,
//         non_null_percent: stats.non_null_percent,
//         sample_values: stats.sample_values,
//       },
//     };
//   });
// }

// /**
//  * Generate an export query for data retrieval.
//  *
//  * @param database - Database name
//  * @param tableName - Table name
//  * @param query - Custom query
//  * @param columns - Columns to select
//  * @param where - WHERE clause
//  * @param limit - Row limit
//  * @returns SQL query string
//  */
// export function generateExportQuery(
//   database: string,
//   tableName: string,
//   query?: string,
//   columns?: string[],
//   where?: string,
//   limit?: number
// ): string {
//   if (query) {
//     // Use custom query as-is
//     return query;
//   }

//   // Build query from components
//   let sql = "SELECT ";

//   // Add columns
//   if (columns && columns.length > 0) {
//     sql += columns.map((col) => quoteIdentifier(col)).join(", ");
//   } else {
//     sql += "*";
//   }

//   // Add FROM clause
//   sql += ` FROM ${quoteIdentifier(database)}.${quoteIdentifier(tableName)}`;

//   // Add WHERE clause if provided
//   if (where) {
//     sql += ` WHERE ${where}`;
//   }

//   // Add LIMIT if provided
//   if (limit) {
//     sql += ` LIMIT ${limit}`;
//   }

//   return sql;
// }

// /**
//  * Import CSV data into a ClickHouse table.
//  *
//  * @param client - ClickHouse client
//  * @param database - Database name
//  * @param tableName - Table name
//  * @param csvFilePath - Path to CSV file
//  * @param options - Import options
//  * @param tableSettings - Table creation settings
//  * @returns Import results
//  */
// export async function importCSVWithClickHouse(
//   client: ClickHouseClient,
//   database: string,
//   tableName: string,
//   csvFilePath: string,
//   options: ImportCsvOptions,
//   tableSettings?: TableSettings
// ): Promise<any> {
//   const startTime = Date.now();

//   try {
//     // Check schema inference support
//     const supportsSchemaInference = await checkSchemaInferenceSupport(client);
//     logger.info(
//       `ClickHouse schema inference support: ${supportsSchemaInference}`
//     );

//     // Check if table exists
//     const tableExists = await checkTableExists(client, database, tableName);

//     // If table doesn't exist, we need to create it
//     if (!tableExists) {
//       let schema: ColumnDefinition[];

//       // Use ClickHouse's schema inference if supported
//       if (supportsSchemaInference) {
//         schema = await inferSchemaWithClickHouse(client, csvFilePath, options);

//         // Analyze CSV to get column statistics
//         const csvAnalysis = analyzeCSV(csvFilePath, options);

//         // Enhance the inferred schema
//         schema = enhanceInferredSchema(schema, csvAnalysis);
//       } else {
//         // Fall back to manual inference
//         const csvAnalysis = analyzeCSV(csvFilePath, options);
//         schema = csvAnalysis.columnAnalysis;
//       }

//       // Return schema if auto_create is false
//       if (!options.auto_create_table) {
//         // Suggest table settings
//         const suggestedSettings = suggestTableSettings(schema, tableSettings);

//         // Generate CREATE TABLE SQL
//         const proposedSql = generateCreateTableSQL(
//           database,
//           tableName,
//           schema,
//           suggestedSettings
//         );

//         return {
//           status: "table_needed",
//           message: `Table ${database}.${tableName} does not exist. Schema analyzed successfully.`,
//           schema,
//           proposed_sql: proposedSql,
//           suggested_settings: suggestedSettings,
//           csv_file_path: csvFilePath,
//           supports_schema_inference: supportsSchemaInference,
//         };
//       }

//       // Create the table with the inferred/enhanced schema
//       const suggestedSettings = suggestTableSettings(schema, tableSettings);
//       const createSql = generateCreateTableSQL(
//         database,
//         tableName,
//         schema,
//         suggestedSettings
//       );

//       logger.info(`Creating table with SQL: ${createSql}`);
//       await executeCommand(createSql);

//       // Exit early if create_only option is set
//       if (options.create_only) {
//         return {
//           status: "success",
//           message: `Table ${database}.${tableName} created successfully. Import skipped as requested.`,
//           create_sql: createSql,
//           schema,
//           suggested_settings: suggestedSettings,
//           csv_file_path: csvFilePath,
//           execution_time_seconds: (Date.now() - startTime) / 1000,
//         };
//       }
//     }

//     // Get table schema
//     const tableSchema = await getTableSchema(client, database, tableName);

//     // Dry run option - don't actually import
//     if (options.dry_run) {
//       return {
//         status: "dry_run",
//         message: `Dry run completed for ${database}.${tableName}`,
//         table_schema: tableSchema,
//         csv_file_path: csvFilePath,
//         execution_time_seconds: (Date.now() - startTime) / 1000,
//       };
//     }

//     // Import data using ClickHouse's native file loading
//     const csvFormat = options.has_header_row ? "CSVWithNames" : "CSV";

//     // Add format settings for delimiter and quotes
//     const formatSettings: string[] = [];
//     if (options.delimiter && options.delimiter !== ",") {
//       formatSettings.push(`format_csv_delimiter = '${options.delimiter}'`);
//     }
//     if (options.quote_char && options.quote_char !== '"') {
//       formatSettings.push(`format_csv_quote = '${options.quote_char}'`);
//     }

//     const settingsClause =
//       formatSettings.length > 0 ? `SETTINGS ${formatSettings.join(", ")}` : "";

//     // Construct the import query
//     const importQuery = `
//       INSERT INTO ${quoteIdentifier(database)}.${quoteIdentifier(tableName)} 
//       FROM INFILE '${csvFilePath}' 
//       FORMAT ${csvFormat}
//       ${settingsClause}
//     `;

//     logger.info(`Executing import query: ${importQuery}`);
//     await executeCommand(importQuery);

//     // Get row count after import
//     const countResult = await client.query({
//       query: `SELECT count() AS count FROM ${quoteIdentifier(
//         database
//       )}.${quoteIdentifier(tableName)}`,
//       format: "JSONEachRow",
//     });

//     const rowCount =
//       countResult.rows.length > 0 ? (countResult.rows[0] as any).count : 0;

//     // Calculate execution time
//     const executionTime = (Date.now() - startTime) / 1000;

//     return {
//       status: "success",
//       message: `Successfully imported data into ${database}.${tableName} using native ClickHouse mechanisms`,
//       row_count: rowCount,
//       table_schema: tableSchema,
//       csv_file_path: csvFilePath,
//       execution_time_seconds: executionTime,
//       method: "clickhouse_native_import",
//     };
//   } catch (error) {
//     logger.error(`Error in importCSVWithClickHouse: ${error}`);
//     return {
//       status: "error",
//       message: `Import failed: ${error}`,
//       csv_file_path: csvFilePath,
//       execution_time_seconds: (Date.now() - startTime) / 1000,
//     };
//   }
// }

// /**
//  * Export data from ClickHouse to CSV using native formatting.
//  *
//  * @param client - ClickHouse client
//  * @param database - Database name
//  * @param tableName - Table name
//  * @param query - Custom query
//  * @param columns - Columns to export
//  * @param where - WHERE clause
//  * @param limit - Row limit
//  * @param formatOptions - Format options
//  * @returns Exported data, MIME type, and stats
//  */
// export async function exportDataToCsvDirect(
//   client: ClickHouseClient,
//   database: string,
//   tableName: string,
//   query?: string,
//   columns?: string[],
//   where?: string,
//   limit?: number,
//   formatOptions?: ExportFormatOptions
// ): Promise<[string, string, Record<string, any>]> {
//   const startTime = Date.now();

//   // Use defaults for format options
//   const options = formatOptions || {
//     format: "CSV",
//     delimiter: ",",
//     with_names: true,
//     with_types: false,
//     quote_char: '"',
//   };

//   // Generate the export query
//   const exportQuery = generateExportQuery(
//     database,
//     tableName,
//     query,
//     columns,
//     where,
//     limit
//   );

//   // Get format options
//   const formatType = options.format.toUpperCase();
//   const withNames = options.with_names;

//   // Determine output format and MIME type
//   let outputFormat: string;
//   let mimeType: string;
//   let settings: Record<string, any> = {};

//   if (formatType === "CSV") {
//     outputFormat = withNames ? "CSVWithNames" : "CSV";
//     settings = {
//       format_csv_delimiter: options.delimiter || ",",
//     };
//     mimeType = "text/csv";
//   } else if (formatType === "TSV") {
//     outputFormat = withNames ? "TSVWithNames" : "TSV";
//     mimeType = "text/tab-separated-values";
//   } else if (formatType === "JSONEACHROW") {
//     outputFormat = "JSONEachRow";
//     mimeType = "application/json";
//   } else {
//     // Default to CSV
//     outputFormat = "CSVWithNames";
//     mimeType = "text/csv";
//   }

//   // Add FORMAT clause
//   const queryWithFormat = `${exportQuery} FORMAT ${outputFormat}`;

//   // Execute query with format
//   logger.info(`Executing export query: ${queryWithFormat}`);

//   try {
//     // Execute query directly
//     const result = await client.query({
//       query: queryWithFormat,
//       format: "raw",
//       // @ts-ignore - settings may not be in type definition but works in practice
//       settings,
//     });

//     const data = result.toString();

//     // Calculate stats
//     const executionTime = (Date.now() - startTime) / 1000;

//     // Count rows (rough estimate by counting newlines)
//     let rowCount = (data.match(/\n/g) || []).length;
//     if (withNames && rowCount > 0) {
//       rowCount -= 1; // Subtract header row
//     }

//     const stats = {
//       status: "success",
//       method: "clickhouse_native_export",
//       row_count: rowCount,
//       execution_time_seconds: executionTime,
//       format: outputFormat,
//     };

//     return [data, mimeType, stats];
//   } catch (error) {
//     logger.error(`Error in direct export: ${error}`);
//     return [
//       `Export error: ${error}`,
//       "text/plain",
//       {
//         status: "error",
//         method: "clickhouse_native_export",
//         error_message: String(error),
//       },
//     ];
//   }
// }
