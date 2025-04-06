#!/bin/bash

# Production startup script for SuiFlashBotTemplate
# This script handles startup, monitoring, and automatic restarts
# Note: This runs in simulation mode despite the "production" name

# Set environment variables
export NODE_ENV=production
export SIMULATION_ONLY=true
export DEMO_MODE=true

# Function to check if the bot is running
is_bot_running() {
  if docker ps | grep -q sui-arbitrage-bot-template; then
    return 0  # Bot is running
  else
    return 1  # Bot is not running
  fi
}

# Function to start the bot
start_bot() {
  echo "Starting SuiFlashBotTemplate in production mode (simulation)..."
  docker-compose up -d arbitrage-bot
}

# Function to stop the bot
stop_bot() {
  echo "Stopping SuiFlashBotTemplate..."
  docker-compose stop arbitrage-bot
}

# Function to restart the bot
restart_bot() {
  echo "Restarting SuiFlashBotTemplate..."
  stop_bot
  sleep 5
  start_bot
}

# Function to check bot health
check_bot_health() {
  # Check if container is running
  if ! is_bot_running; then
    echo "Bot container is not running. Restarting..."
    start_bot
    return
  fi
  
  # Check if health endpoint is responding
  if ! curl -s http://localhost:3000/health | grep -q "ok"; then
    echo "Bot health check failed. Restarting..."
    restart_bot
  else
    echo "Bot health check passed."
  fi
}

# Main execution
case "$1" in
  start)
    start_bot
    ;;
  stop)
    stop_bot
    ;;
  restart)
    restart_bot
    ;;
  status)
    if is_bot_running; then
      echo "SuiFlashBotTemplate is running."
    else
      echo "SuiFlashBotTemplate is not running."
    fi
    ;;
  monitor)
    echo "Starting monitoring loop..."
    while true; do
      check_bot_health
      sleep 300  # Check every 5 minutes
    done
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|monitor}"
    exit 1
    ;;
esac

exit 0
