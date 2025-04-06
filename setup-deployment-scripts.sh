#!/bin/bash

# This script sets up the deployment scripts from the templates

# Check if the templates exist
if [ ! -f "setup-ssh-key.template.sh" ] || [ ! -f "deploy-to-remote-compose.template.sh" ]; then
  echo "Error: Template files not found. Make sure you're in the right directory."
  exit 1
fi

# Copy template files to actual files
echo "Creating deployment scripts from templates..."
cp setup-ssh-key.template.sh setup-ssh-key.sh
cp deploy-to-remote-compose.template.sh deploy-to-remote-compose.sh
cp check-remote-status.template.sh check-remote-status.sh
cp stop-remote.template.sh stop-remote.sh
cp remote-build-run.template.sh remote-build-run.sh
cp docker-compose.template.yml docker-compose.remote.yml

# Make scripts executable
echo "Making scripts executable..."
chmod +x setup-ssh-key.sh
chmod +x deploy-to-remote-compose.sh
chmod +x check-remote-status.sh
chmod +x stop-remote.sh
chmod +x remote-build-run.sh

echo "Deployment scripts created successfully!"
echo ""
echo "IMPORTANT: You need to edit each script to update the configuration variables:"
echo "- REMOTE_USER: Your username on the remote server"
echo "- REMOTE_HOST: The IP address or hostname of your remote server"
echo "- PROJECT_DIR: The path to your local project directory"
echo "- REMOTE_PROJECT_DIR: The path where you want to deploy the project on the remote server"
echo ""
echo "For more information, see REMOTE-DEPLOYMENT.template.md"
