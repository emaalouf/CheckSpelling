#!/bin/bash

# Subtitle Checker Setup Script for Ubuntu Server
# This script sets up the subtitle checker with all dependencies

echo "🚀 Setting up Subtitle Spell & Grammar Checker..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is already installed: $NODE_VERSION"
    else
        print_warning "Node.js not found. Installing Node.js..."
        
        # Install Node.js using NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        
        if command -v node >/dev/null 2>&1; then
            NODE_VERSION=$(node --version)
            print_success "Node.js installed successfully: $NODE_VERSION"
        else
            print_error "Failed to install Node.js"
            exit 1
        fi
    fi
}

# Check if npm is available
check_npm() {
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        print_success "npm is available: $NPM_VERSION"
    else
        print_error "npm is not available"
        exit 1
    fi
}

# Install project dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Create subtitles directory if it doesn't exist
setup_directories() {
    print_status "Setting up directories..."
    
    if [ ! -d "subtitles" ]; then
        mkdir -p subtitles
        print_success "Created 'subtitles' directory"
    else
        print_success "'subtitles' directory already exists"
    fi
}

# Check for DeepSeek API key
check_api_key() {
    print_status "Checking for DeepSeek API key..."
    
    if [ -z "$DEEPSEEK_API_KEY" ]; then
        print_warning "DEEPSEEK_API_KEY environment variable not set"
        echo ""
        echo "To set your API key, run:"
        echo "export DEEPSEEK_API_KEY=\"your-api-key-here\""
        echo ""
        echo "To make it permanent, add it to your ~/.bashrc:"
        echo "echo 'export DEEPSEEK_API_KEY=\"your-api-key-here\"' >> ~/.bashrc"
        echo "source ~/.bashrc"
        echo ""
    else
        print_success "DeepSeek API key is configured"
    fi
}

# Create a run script
create_run_script() {
    print_status "Creating run script..."
    
    cat > run-checker.sh << 'EOF'
#!/bin/bash

# Quick run script for subtitle checker
echo "🔍 Starting Subtitle Checker..."

# Check if API key is set
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️  Warning: DEEPSEEK_API_KEY not set"
    echo "Please set it with: export DEEPSEEK_API_KEY=\"your-key\""
fi

# Run the checker
node subtitle-checker.js
EOF

    chmod +x run-checker.sh
    print_success "Created executable run script: run-checker.sh"
}

# Main setup process
main() {
    print_status "Starting setup process..."
    echo ""
    
    # System checks
    check_nodejs
    check_npm
    
    # Project setup
    install_dependencies
    setup_directories
    create_run_script
    
    # Configuration check
    check_api_key
    
    echo ""
    print_success "Setup completed successfully! 🎉"
    echo ""
    echo "Next steps:"
    echo "1. Set your DeepSeek API key (if not already done):"
    echo "   export DEEPSEEK_API_KEY=\"your-api-key-here\""
    echo ""
    echo "2. Copy your VTT files to the 'subtitles' folder"
    echo ""
    echo "3. Run the checker:"
    echo "   ./run-checker.sh"
    echo "   # or"
    echo "   npm start"
    echo "   # or"
    echo "   node subtitle-checker.js"
    echo ""
    print_status "Happy spell checking! 📝✨"
}

# Run main function
main 