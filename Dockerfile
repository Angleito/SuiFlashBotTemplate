# Stage 1: Build Nix dependencies
FROM nixos/nix:latest AS nix-builder

WORKDIR /build

# Copy Nix definition and necessary lock files
COPY docker.nix .
COPY package.json ./

# Build the Nix environments
# The output paths will be symlinks in the current directory
RUN nix-build docker.nix -A buildEnv -o /nix-deps/build && \
    nix-build docker.nix -A runtimeEnv -o /nix-deps/runtime

# Stage 2: Build the application using Nix build dependencies
FROM node:18 AS app-builder

WORKDIR /app

# Copy project files
COPY package.json tsconfig.json ./
COPY src ./src/

# Clean cache and install dependencies
RUN rm -rf node_modules && npm cache clean --force && npm install

# Build TypeScript source
RUN npx tsc

# Stage 3: Create the final production image
FROM node:18-alpine AS final

# Set PATH to include Nix runtime dependencies
COPY --from=nix-builder /nix-deps/runtime /nix-deps/runtime
ENV PATH=/nix-deps/runtime/bin:$PATH

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built application artifacts and necessary files from app-builder
COPY --from=app-builder /app/dist ./dist
COPY --from=app-builder /app/node_modules ./node_modules
COPY --from=app-builder /app/package.json ./package.json

# Set environment to production but use simulation mode
ENV NODE_ENV=production
ENV SIMULATION_ONLY=true
ENV DEMO_MODE=true

# Create logs directory and set permissions
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

# Change ownership of app files to the non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD node /app/dist/utils/health-check.js || exit 1

# Define the command to run the application
CMD ["node", "dist/examples/simulatedArbitrage.js"]
