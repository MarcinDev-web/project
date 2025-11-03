#!/bin/sh
# Install wasm-pack if not already installed
# Used by CI/CD build environments that don't have wasm-pack pre-installed

if command -v wasm-pack >/dev/null 2>&1; then
  echo "wasm-pack is already installed: $(wasm-pack --version)"
  exit 0
fi

echo "Installing wasm-pack..."

# Detect architecture
ARCH=$(uname -m)
OS=$(uname -s)

# Default to x86_64 linux musl (most common for CI/CD)
TARGET="x86_64-unknown-linux-musl"
VERSION="v0.12.1"

# Adjust for different architectures if needed
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  TARGET="aarch64-unknown-linux-musl"
elif [ "$OS" = "Darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    TARGET="aarch64-apple-darwin"
  else
    TARGET="x86_64-apple-darwin"
  fi
fi

URL="https://github.com/rustwasm/wasm-pack/releases/download/${VERSION}/wasm-pack-${VERSION}-${TARGET}.tar.gz"

# Download and install
curl -LO "$URL" || {
  echo "Failed to download wasm-pack"
  exit 1
}

tar -xzf "wasm-pack-${VERSION}-${TARGET}.tar.gz" || {
  echo "Failed to extract wasm-pack"
  exit 1
}

# Move to a directory in PATH (prefer /usr/local/bin, fallback to local)
INSTALL_DIR="/usr/local/bin"
if [ ! -w "$INSTALL_DIR" ] 2>/dev/null; then
  # Try local bin directory (for CI environments)
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR" 2>/dev/null || {
    # Final fallback: current directory (will add to PATH)
    INSTALL_DIR="$(pwd)/.wasm-pack-bin"
    mkdir -p "$INSTALL_DIR"
    export PATH="$PATH:$INSTALL_DIR"
    echo "Warning: Installing wasm-pack to $INSTALL_DIR (not in system PATH)"
  }
  export PATH="$PATH:$INSTALL_DIR"
fi

if mv "wasm-pack-${VERSION}-${TARGET}/wasm-pack" "$INSTALL_DIR/" 2>/dev/null; then
  chmod +x "$INSTALL_DIR/wasm-pack" 2>/dev/null || true
  echo "Installed wasm-pack to $INSTALL_DIR"
  
  # Ensure PATH includes the install directory for subsequent commands
  if [ "$INSTALL_DIR" != "/usr/local/bin" ] && [ "$INSTALL_DIR" != "/usr/bin" ]; then
    export PATH="$PATH:$INSTALL_DIR"
    # Write to a file that can be sourced by subsequent commands
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" > .wasm-pack-env.sh 2>/dev/null || true
  fi
else
  echo "Failed to install wasm-pack"
  exit 1
fi
rm -rf "wasm-pack-${VERSION}-${TARGET}" "wasm-pack-${VERSION}-${TARGET}.tar.gz"

# Verify installation
if "$INSTALL_DIR/wasm-pack" --version >/dev/null 2>&1; then
  echo "wasm-pack installed successfully: $($INSTALL_DIR/wasm-pack --version)"
else
  echo "Warning: wasm-pack installed but verification failed"
fi

