{
  description = "A devShell example";

  inputs = {
    nixpkgs.url      = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url  = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
      in
      with pkgs;
      {
        devShells.default = mkShell {
          buildInputs = [
            pkg-config
            eza
            fd
            clang
            llvmPackages.bintools
            rustup
            at-spi2-atk
            atkmm
            cairo
            gdk-pixbuf
            glib
            gtk3
            harfbuzz
            librsvg
            libsoup_3
            pango
            webkitgtk_4_1
            openssl
            glib-networking
            udev
            bun
            nodejs
            rust-analyzer
            (
              rust-bin.selectLatestNightlyWith (toolchain: toolchain.default.override {
                extensions = [ "rust-src" "rust-analysis" ];
              })
            )
          ];

          shellHook = ''
            alias ls=eza
            alias find=fd
            export GIO_MODULE_DIR=${glib-networking}/lib/gio/modules/

            # Make rust-analyzer work with nix
            export RUST_SRC_PATH=${rust-bin.selectLatestNightlyWith (toolchain: toolchain.default.override { extensions = [ "rust-src" ]; })}/lib/rustlib/src/rust/library
          '';
        };
      }
    );
}
