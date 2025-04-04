/**
 * Logger Utility
 * 
 * A simple, centralized logging utility for the Sui Flashloan Bot.
 * Provides consistent logging format and context-based logging.
 */

export class Logger {
  private context: string;
  private static instance: Logger | null = null;

  /**
   * Private constructor to enforce singleton pattern
   * @param context The context identifier for this logger instance
   */
  private constructor(context: string) {
    this.context = context;
  }

  /**
   * Get a logger instance with the specified context
   * @param context The context identifier for the logger
   * @returns A Logger instance
   */
  static getInstance(context: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    } else {
      // Update the context if a new one is provided
      Logger.instance.context = context;
    }
    return Logger.instance;
  }

  /**
   * Format a log message with metadata
   * @param level The log level
   * @param message The message to log
   * @param metadata Additional metadata to include in the log
   * @returns A formatted log object
   */
  private formatLog(level: string, message: string, metadata?: Record<string, unknown>): object {
    return {
      level,
      context: this.context,
      message,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }

  /**
   * Log an informational message
   * @param message The message to log
   * @param metadata Additional metadata to include in the log
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(JSON.stringify(this.formatLog('INFO', message, metadata)));
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param metadata Additional metadata to include in the log
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    console.warn(JSON.stringify(this.formatLog('WARN', message, metadata)));
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param metadata Additional metadata to include in the log
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    console.error(JSON.stringify(this.formatLog('ERROR', message, metadata)));
  }

  /**
   * Log a debug message (only in development environments)
   * @param message The message to log
   * @param metadata Additional metadata to include in the log
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(this.formatLog('DEBUG', message, metadata)));
    }
  }
}
