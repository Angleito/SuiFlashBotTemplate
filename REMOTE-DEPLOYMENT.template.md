# Remote Deployment Guide

This guide explains how to deploy the SuiFlasherBot to a remote server using Docker and SSH.

## Prerequisites

- Docker installed on both local and remote machines
- SSH access to the remote server
- The remote server has Docker and Docker Compose installed

## Setup

1. **Rename Template Files**

   Before using these scripts, rename the template files by removing the `.template` suffix:

   ```bash
   cp setup-ssh-key.template.sh setup-ssh-key.sh
   cp deploy-to-remote-compose.template.sh deploy-to-remote-compose.sh
   cp check-remote-status.template.sh check-remote-status.sh
   cp stop-remote.template.sh stop-remote.sh
   cp remote-build-run.template.sh remote-build-run.sh
   cp docker-compose.template.yml docker-compose.remote.yml
   ```

2. **Update Configuration**

   Edit each script and update the configuration variables at the top with your actual values:

   - `REMOTE_USER`: Your username on the remote server
   - `REMOTE_HOST`: The IP address or hostname of your remote server
   - `PROJECT_DIR`: The path to your local project directory
   - `REMOTE_PROJECT_DIR`: The path where you want to deploy the project on the remote server

3. **Make Scripts Executable**

   ```bash
   chmod +x setup-ssh-key.sh
   chmod +x deploy-to-remote-compose.sh
   chmod +x check-remote-status.sh
   chmod +x stop-remote.sh
   chmod +x remote-build-run.sh
   ```

## Setup SSH Key Authentication

Before deploying, you need to set up SSH key authentication with the remote server:

```bash
./setup-ssh-key.sh
```

This script will:
1. Create an SSH key if one doesn't exist
2. Copy the SSH key to the remote server
3. Test the SSH connection

You will be prompted for the remote server password during this process.

## Deploy to Remote Server

To deploy the application to the remote server:

```bash
./deploy-to-remote-compose.sh
```

This script will:
1. Create a tar archive of the project (excluding node_modules, dist, and .git)
2. Copy the archive to the remote server
3. Extract the archive on the remote server
4. Build and run the Docker container using docker-compose
5. Clean up temporary files

## Check Remote Status

To check the status of the application on the remote server:

```bash
./check-remote-status.sh
```

This script will:
1. Check if the container is running
2. Display the container logs (last 20 lines)
3. Check the health endpoint status

## Stop Remote Application

To stop the application on the remote server:

```bash
./stop-remote.sh
```

This script will:
1. Stop and remove the Docker container
2. Verify that the container has been stopped

## Alternative Deployment Method

If you prefer to use Docker directly instead of Docker Compose, you can use the `remote-build-run.sh` script:

```bash
./remote-build-run.sh
```

This script performs similar actions to `deploy-to-remote-compose.sh` but uses Docker commands directly instead of Docker Compose.

## Docker Compose Configuration

The remote deployment uses a separate Docker Compose file (`docker-compose.remote.yml`) that is optimized for the remote server. This file includes:

- Higher resource limits (4 CPUs, 4GB memory)
- Exposed ports for both the application (3000) and health check (3001)
- Production environment settings

## Security Considerations

- These scripts contain sensitive information (server addresses, usernames, etc.) once configured
- Add the configured scripts to your `.gitignore` file to prevent them from being committed to your repository
- Consider using environment variables or a secure secrets management solution for production deployments

## Troubleshooting

If you encounter issues with the deployment:

1. Check the SSH connection: `ssh -i ~/.ssh/id_ed25519 your_username@your.server.ip.address`
2. Verify Docker is running on the remote server: `ssh -i ~/.ssh/id_ed25519 your_username@your.server.ip.address "docker info"`
3. Check the container logs: `ssh -i ~/.ssh/id_ed25519 your_username@your.server.ip.address "docker logs sui-arbitrage-bot-template"`
