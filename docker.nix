# docker.nix
# Defines Nix environments for Docker build stages

let
  # Pin nixpkgs to a specific revision for reproducibility
  nixpkgsRev = "nixos-23.11"; # Use the branch name
  pkgs = import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/${nixpkgsRev}.tar.gz") {};

in
{
  # Build-time dependencies
  buildEnv = pkgs.buildEnv {
    name = "suiflashbot-template-build-deps";
    paths = [
      # nodejs is provided by the base image now
      # Add other build-time system dependencies if needed
    ];
  };

  # Runtime dependencies
  runtimeEnv = pkgs.buildEnv {
    name = "suiflashbot-template-runtime-deps";
    paths = [
      pkgs.nodejs-18_x # Use Node.js 18
      # Add other runtime system dependencies if needed
    ];
  };
}
