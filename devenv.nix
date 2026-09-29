{ pkgs, ... }:

let
  nodejs = pkgs.nodejs_24;
in
{
  # Node.js 24 + Corepack (reads packageManager: yarn@4.18.1)
  languages.javascript.enable = true;
  languages.javascript.package = nodejs;
  languages.javascript.corepack.enable = true;

  packages = with pkgs; [
    # jq-likes equivalents from the devcontainer feature
    jq
    yq-go

    # Nix tooling for IDE support (used by jnoortheen.nix-ide)
    nil
    nixpkgs-fmt

    # Basic tooling
    git
    gnumake
  ];

  git-hooks.hooks = {
    nixpkgs-fmt.enable = true;
  };
}
