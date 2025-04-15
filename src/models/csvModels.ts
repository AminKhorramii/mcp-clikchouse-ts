/**
 * Models for ClickHouse CSV import/export functionality.
 */

// Source of CSV data for import
export interface CsvSource {
    /** Source type: 'direct' or 'upload' */
    type: 'direct' | 'upload';
    /** CSV data as string (for 'direct' type) */
    data?: string;
    /** Upload ID (for 'upload' type) */
    upload_id?: string;
  }
  
  // ClickHouse-specific table settings for creation
  export interface TableSettings {
    /** ClickHouse table engine */
    engine: string;
    /** ORDER BY clause (required for MergeTree) */
    order_by?: string;
    /** PRIMARY KEY clause (defaults to ORDER BY) */
    primary_key?: string;
    /** PARTITION BY clause for data partitioning */
    partition_by?: string;
    /** TTL expression for automatic data expiration */
    ttl?: string;
    /** Storage policy name */
    storage_policy?: string;
    /** Additional engine settings */
    settings?: Record<string, any>;
  }
  
  // Options for CSV import operation
  export interface ImportCsvOptions {
    /** Whether CSV has a header row */
    has_header_row: boolean;
    /** CSV delimiter character */
    delimiter: string;
    /** CSV quote character */
    quote_char: string;
    /** CSV escape character */
    escape_char: string;
    /** CSV newline character */
    newline: string;
    /** Map CSV columns to table columns */
    column_mapping?: Record<string, string>;
    /** Batch size for import */
    batch_size: number;
    /** Analyze without importing */
    dry_run: boolean;
    /** Create table automatically if it doesn't exist */
    auto_create_table: boolean;
    /** Create table only, don't import data */
    create_only: boolean;
  }
  
  // Input schema for CSV import tool
  export interface ImportCsvDataInput {
    /** Target database */
    database: string;
    /** Target table (will be created if doesn't exist) */
    table_name: string;
    /** CSV data source */
    csv_source: CsvSource;
    /** Import options */
    options?: ImportCsvOptions;
    /** Table creation settings */
    table_settings?: TableSettings;
  }
  
  // Options for formatting exported data
  export interface ExportFormatOptions {
    /** Output format (CSV, TSV, JSONEachRow, etc) */
    format: string;
    /** Delimiter for CSV/TSV formats */
    delimiter: string;
    /** Include header row */
    with_names: boolean;
    /** Include type information row */
    with_types: boolean;
    /** Quote character for CSV/TSV formats */
    quote_char: string;
  }
  
  // Input schema for CSV export tool
  export interface ExportCsvDataInput {
    /** Source database */
    database: string;
    /** Source table name */
    table_name: string;
    /** Custom query instead of SELECT * FROM table */
    query?: string;
    /** Specific columns to export */
    columns?: string[];
    /** WHERE clause */
    where?: string;
    /** Limit number of rows */
    limit?: number;
    /** Format options */
    format_options?: ExportFormatOptions;
  }
  
  // Column definition for schema operations
  export interface ColumnDefinition {
    /** Column name */
    name: string;
    /** Inferred data type */
    inferred_type: string;
    /** Default type */
    default_type?: string;
    /** Default expression */
    default_expression?: string;
    /** Column statistics */
    stats?: {
      /** Percentage of unique values */
      unique_percent: number;
      /** Percentage of non-null values */
      non_null_percent: number;
      /** Sample values */
      sample_values: string[];
    };
  }
  
  // Schema analysis result
  export interface CsvAnalysisResult {
    /** Original header */
    header: string[];
    /** Sanitized header */
    sanitized_header: string[];
    /** Total rows in CSV */
    total_rows: number;
    /** Sample rows for preview */
    sample_rows: string[][];
    /** Column analysis */
    column_analysis: ColumnDefinition[];
  }