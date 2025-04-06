{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_18
    docker
    docker-compose
    python3
    gnumake
    gcc
    git
  ];

  shellHook = ''
    echo "Entering SuiFlashBotTemplate development environment..."
    echo "Node.js version: $(node --version)"
    echo "Docker version: $(docker --version)"
    echo "Docker Compose version: $(docker-compose --version)"
    
    # Create local directories if they don't exist
    mkdir -p logs
    
    # Set environment variables
    export PATH="$PWD/node_modules/.bin:$PATH"
    
    # Set simulation mode by default
    export SIMULATION_ONLY=true
    export DEMO_MODE=true
  '';
}
