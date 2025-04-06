#!/bin/bash

# Configuration - REPLACE WITH YOUR ACTUAL VALUES
REMOTE_USER="your_username"
REMOTE_HOST="your.server.ip.address"
PROJECT_DIR="/path/to/local/project"
REMOTE_PROJECT_DIR="/path/to/remote/project"
IMAGE_NAME="sui-arbitrage-bot-template"
CONTAINER_NAME="sui-arbitrage-bot-template"

# Step 1: Create a tar of the project directory (excluding node_modules, dist, etc.)
echo "Creating project archive..."
tar --exclude="node_modules" --exclude="dist" --exclude=".git" -czf project.tar.gz -C "${PROJECT_DIR}" .

# Step 2: Copy the tar file to the remote server
echo "Copying project to remote server..."
scp project.tar.gz ${REMOTE_USER}@${REMOTE_HOST}:~/project.tar.gz

# Step 3: SSH into the remote server and build/run the container
echo "Building and running on remote server..."
ssh ${REMOTE_USER}@${REMOTE_HOST} << EOF
  # Create project directory if it doesn't exist
  mkdir -p ${REMOTE_PROJECT_DIR}
  
  # Extract the project files
  tar -xzf ~/project.tar.gz -C ${REMOTE_PROJECT_DIR}
  
  # Navigate to the project directory
  cd ${REMOTE_PROJECT_DIR}
  
  # Build the Docker image
  echo "Building Docker image on remote server..."
  docker build -t ${IMAGE_NAME} .
  
  # Stop and remove existing container if it exists
  docker stop ${CONTAINER_NAME} 2>/dev/null || true
  docker rm ${CONTAINER_NAME} 2>/dev/null || true
  
  # Run the new container
  echo "Starting container on remote server..."
  docker run -d --name ${CONTAINER_NAME} \
    -p 3000:3000 -p 3001:3001 \
    --restart always \
    --env-file .env.example \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e SIMULATION_ONLY=true \
    -e DEMO_MODE=true \
    ${IMAGE_NAME}
  
  # Clean up the tar file
  rm ~/project.tar.gz
  
  # Check if the container is running
  echo "Container status:"
  docker ps | grep ${CONTAINER_NAME}
EOF

# Clean up local tar file
echo "Cleaning up local tar file..."
rm project.tar.gz

echo "Remote build and deployment complete!"
