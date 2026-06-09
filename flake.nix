{
  description = "NixOS electron dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }@inputs:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        mkFhsUserEnv =
          if builtins.hasAttr "buildFHSUserEnv" pkgs then pkgs.buildFHSUserEnv
          else if builtins.hasAttr "buildFHSUserEnvBubblewrap" pkgs then pkgs.buildFHSUserEnvBubblewrap
          else if builtins.hasAttr "buildFHSEnv" pkgs then pkgs.buildFHSEnv
          else null;
        fhs =
          if pkgs.stdenv.isLinux && mkFhsUserEnv != null then
            mkFhsUserEnv {
              name = "electron-fhs-shell";
              targetPkgs =
                pkgs:
                (with pkgs; [
                  alsa-lib
                  atkmm
                  at-spi2-atk
                  cairo
                  cups
                  dbus
                  expat
                  glib
                  glibc
                  mesa.drivers
                  gtk2
                  gtk3
                  gtk4
                  libdrm
                  libxkbcommon
                  mesa
                  libgbm
                  nspr
                  nss
                  nodePackages.npm
                  nodejs_20
                  pango
                  udev
                ])
                ++ (with pkgs.xorg; [
                  libXcomposite
                  libXdamage
                  libXext
                  libXfixes
                  libXrandr
                  libX11
                  xcbutil
                  libxcb
                ]);

              extraOutputsToInstall = [ "drivers" ];

              runScript = "npm run dev";
            }
          else
            null;
      in
      {
        devShells.default =
          if fhs != null then fhs.env else pkgs.mkShell { buildInputs = [ pkgs.nodejs_20 ]; };
      }
    );
}
