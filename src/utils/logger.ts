/**
 * Simple logging utility for MCP ClickHouse.
 */

export enum LogLevel {
    ERROR = 0,
    WARNING = 1,
    INFO = 2,
    DEBUG = 3
  }
  
  export class Logger {
    private name: string;
    private static level: LogLevel = LogLevel.INFO;
  
    /**
     * Creates a new logger instance.
     * 
     * @param name - The name of the logger component
     */
    constructor(name: string) {
      this.name = name;
    }
  
    /**
     * Set the global log level.
     * 
     * @param level - The log level to set
     */
    static setLogLevel(level: LogLevel): void {
      Logger.level = level;
    }
  
    /**
     * Format the current timestamp for logging.
     * 
     * @returns Formatted timestamp string
     */
    private getTimestamp(): string {
      return new Date().toISOString();
    }
  
    /**
     * Log a debug message.
     * 
     * @param message - The message to log
     */
    debug(message: string): void {
      if (Logger.level >= LogLevel.DEBUG) {
        console.debug(`${this.getTimestamp()} - ${this.name} - DEBUG - ${message}`);
      }
    }
  
    /**
     * Log an info message.
     * 
     * @param message - The message to log
     */
    info(message: string): void {
      if (Logger.level >= LogLevel.INFO) {
        console.info(`${this.getTimestamp()} - ${this.name} - INFO - ${message}`);
      }
    }
  
    /**
     * Log a warning message.
     * 
     * @param message - The message to log
     */
    warning(message: string): void {
      if (Logger.level >= LogLevel.WARNING) {
        console.warn(`${this.getTimestamp()} - ${this.name} - WARNING - ${message}`);
      }
    }
  
    /**
     * Log an error message.
     * 
     * @param message - The message to log
     */
    error(message: string): void {
      if (Logger.level >= LogLevel.ERROR) {
        console.error(`${this.getTimestamp()} - ${this.name} - ERROR - ${message}`);
      }
    }
  }
  
  // Initialize from environment variable if available
  if (process.env.LOG_LEVEL) {
    const levelMap: Record<string, LogLevel> = {
      'error': LogLevel.ERROR,
      'warning': LogLevel.WARNING,
      'info': LogLevel.INFO,
      'debug': LogLevel.DEBUG
    };
    
    const levelName = process.env.LOG_LEVEL.toLowerCase();
    if (levelName in levelMap) {
      Logger.setLogLevel(levelMap[levelName]);
    }
  }