#!/bin/bash

# Configuration - REPLACE WITH YOUR ACTUAL VALUES
REMOTE_USER="your_username"
REMOTE_HOST="your.server.ip.address"

# Check if SSH key exists, if not create one
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "SSH key not found. Creating a new one..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
else
    echo "SSH key already exists."
fi

# Copy the SSH key to the remote server
echo "Copying SSH key to remote server..."
echo "You will be prompted for the remote server password."
ssh-copy-id -i ~/.ssh/id_ed25519.pub ${REMOTE_USER}@${REMOTE_HOST}

# Test the connection
echo "Testing SSH connection..."
ssh -i ~/.ssh/id_ed25519 ${REMOTE_USER}@${REMOTE_HOST} "echo SSH connection successful"

echo "SSH key setup complete!"
