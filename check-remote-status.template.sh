#!/bin/bash

# Configuration - REPLACE WITH YOUR ACTUAL VALUES
REMOTE_USER="your_username"
REMOTE_HOST="your.server.ip.address"

# SSH into the remote server and check the status
echo "Checking container status on remote server..."
ssh -i ~/.ssh/id_ed25519 ${REMOTE_USER}@${REMOTE_HOST} << EOF
  # Check if the container is running
  echo "Container status:"
  docker ps | grep sui-arbitrage-bot-template
  
  # Check container logs
  echo -e "\nContainer logs (last 20 lines):"
  docker logs --tail 20 sui-arbitrage-bot-template
  
  # Check health endpoint
  echo -e "\nHealth endpoint status:"
  curl -s http://localhost:3001/health || echo "Health endpoint not accessible"
EOF

echo "Status check complete!"
