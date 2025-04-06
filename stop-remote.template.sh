#!/bin/bash

# Configuration - REPLACE WITH YOUR ACTUAL VALUES
REMOTE_USER="your_username"
REMOTE_HOST="your.server.ip.address"
REMOTE_PROJECT_DIR="/path/to/remote/project"

# SSH into the remote server and stop the container
echo "Stopping container on remote server..."
ssh -i ~/.ssh/id_ed25519 ${REMOTE_USER}@${REMOTE_HOST} << EOF
  # Navigate to the project directory
  cd ${REMOTE_PROJECT_DIR}
  
  # Stop the containers
  docker-compose -f docker-compose.template.yml down
  
  # Check if any containers are still running
  echo "Container status after stopping:"
  docker ps | grep sui-arbitrage-bot-template || echo "No containers running"
EOF

echo "Remote container stopped!"
