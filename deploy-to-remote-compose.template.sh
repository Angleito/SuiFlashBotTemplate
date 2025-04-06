#!/bin/bash

# Configuration - REPLACE WITH YOUR ACTUAL VALUES
REMOTE_USER="your_username"
REMOTE_HOST="your.server.ip.address"
PROJECT_DIR="/path/to/local/project"
REMOTE_PROJECT_DIR="/path/to/remote/project"

# Step 1: Create a tar of the project directory (excluding node_modules, dist, etc.)
echo "Creating project archive..."
tar --exclude="node_modules" --exclude="dist" --exclude=".git" -czf project.tar.gz -C "${PROJECT_DIR}" .

# Step 2: Copy the tar file to the remote server
echo "Copying project to remote server..."
scp -i ~/.ssh/id_ed25519 project.tar.gz ${REMOTE_USER}@${REMOTE_HOST}:~/project.tar.gz

# Step 3: SSH into the remote server and build/run the container
echo "Building and running on remote server..."
ssh -i ~/.ssh/id_ed25519 ${REMOTE_USER}@${REMOTE_HOST} << EOF
  # Create project directory if it doesn't exist
  mkdir -p ${REMOTE_PROJECT_DIR}
  
  # Extract the project files
  tar -xzf ~/project.tar.gz -C ${REMOTE_PROJECT_DIR}
  
  # Navigate to the project directory
  cd ${REMOTE_PROJECT_DIR}
  
  # Stop and remove existing containers
  docker-compose -f docker-compose.template.yml down
  
  # Build and start the containers
  docker-compose -f docker-compose.template.yml up -d --build
  
  # Clean up the tar file
  rm ~/project.tar.gz
  
  # Check if the container is running
  echo "Container status:"
  docker ps | grep sui-arbitrage-bot-template
EOF

# Clean up local tar file
echo "Cleaning up local tar file..."
rm project.tar.gz

echo "Remote build and deployment complete!"
