#!/bin/bash

# Local DeepSeek Subtitle Checker Setup Script for Ubuntu 22
# This script sets up Ollama and DeepSeek models for local processing

echo "🚀 Setting up Local DeepSeek Subtitle Checker..."

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

# Check system requirements
check_system() {
    print_status "Checking system requirements..."
    
    # Check Ubuntu version
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "ubuntu" && "$VERSION_ID" == "22.04" ]]; then
            print_success "Ubuntu 22.04 detected"
        else
            print_warning "This script is optimized for Ubuntu 22.04, but continuing..."
        fi
    fi
    
    # Check available memory (Ollama needs at least 8GB for 7B models)
    TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 8 ]; then
        print_warning "Low memory detected ($TOTAL_MEM GB). DeepSeek 7B model requires at least 8GB RAM."
        print_warning "Consider using smaller models like deepseek-coder:6.7b"
    else
        print_success "Sufficient memory available ($TOTAL_MEM GB)"
    fi
}

# Install Ollama
install_ollama() {
    print_status "Installing Ollama..."
    
    if command -v ollama >/dev/null 2>&1; then
        print_success "Ollama is already installed"
        ollama --version
    else
        print_status "Downloading and installing Ollama..."
        curl -fsSL https://ollama.ai/install.sh | sh
        
        if command -v ollama >/dev/null 2>&1; then
            print_success "Ollama installed successfully"
        else
            print_error "Failed to install Ollama"
            exit 1
        fi
    fi
}

# Setup Ollama as a service
setup_ollama_service() {
    print_status "Setting up Ollama service..."
    
    # Create systemd service file if it doesn't exist
    if [ ! -f /etc/systemd/system/ollama.service ]; then
        print_status "Creating Ollama systemd service..."
        
        sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="OLLAMA_HOST=0.0.0.0"

[Install]
WantedBy=default.target
EOF
        
        # Create ollama user
        sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama 2>/dev/null || true
        
        # Reload systemd and enable service
        sudo systemctl daemon-reload
        sudo systemctl enable ollama
        
        print_success "Ollama service created and enabled"
    else
        print_success "Ollama service already exists"
    fi
}

# Pull DeepSeek models
pull_deepseek_models() {
    print_status "Pulling DeepSeek models..."
    
    # Start Ollama service
    sudo systemctl start ollama
    sleep 5
    
    # Check available models
    print_status "Available models:"
    ollama list
    
    # Pull recommended models
    print_status "Pulling deepseek-chat:7b (recommended for general use)..."
    ollama pull deepseek-chat:7b
    
    print_status "Pulling deepseek-coder:6.7b (smaller, good for coding tasks)..."
    ollama pull deepseek-coder:6.7b
    
    print_success "DeepSeek models installed successfully"
    
    # Show installed models
    print_status "Installed models:"
    ollama list
}

# Test Ollama installation
test_ollama() {
    print_status "Testing Ollama installation..."
    
    # Test if service is running
    if systemctl is-active --quiet ollama; then
        print_success "Ollama service is running"
    else
        print_warning "Starting Ollama service..."
        sudo systemctl start ollama
        sleep 3
    fi
    
    # Test API endpoint
    if curl -s http://localhost:11434/api/tags >/dev/null; then
        print_success "Ollama API is responding"
    else
        print_error "Ollama API is not responding"
        print_status "Trying to start Ollama manually..."
        ollama serve &
        sleep 5
    fi
    
    # Test model inference
    print_status "Testing model inference..."
    RESPONSE=$(echo "Test: Hello world" | ollama run deepseek-chat:7b 2>/dev/null | head -1)
    if [ ! -z "$RESPONSE" ]; then
        print_success "Model inference test passed"
    else
        print_warning "Model inference test failed - models may still be loading"
    fi
}

# Setup local subtitle checker
setup_local_checker() {
    print_status "Setting up local subtitle checker..."
    
    # Make local script executable
    chmod +x subtitle-checker-local.js 2>/dev/null || true
    
    # Create run script for local version
    cat > run-local-checker.sh << 'EOF'
#!/bin/bash

echo "🏠 Starting Local Subtitle Checker..."

# Check if Ollama is running
if ! systemctl is-active --quiet ollama; then
    echo "⚡ Starting Ollama service..."
    sudo systemctl start ollama
    sleep 3
fi

# Set default model if not specified
export DEEPSEEK_MODEL="${DEEPSEEK_MODEL:-deepseek-chat:7b}"

echo "🤖 Using model: $DEEPSEEK_MODEL"

# Run the local checker
node subtitle-checker-local.js
EOF

    chmod +x run-local-checker.sh
    print_success "Created local run script: run-local-checker.sh"
}

# Create model management script
create_model_manager() {
    print_status "Creating model management script..."
    
    cat > manage-models.sh << 'EOF'
#!/bin/bash

# DeepSeek Model Manager for Ollama

case "$1" in
    "list")
        echo "📋 Installed models:"
        ollama list
        ;;
    "pull")
        if [ -z "$2" ]; then
            echo "Usage: $0 pull <model-name>"
            echo "Example: $0 pull deepseek-chat:7b"
            exit 1
        fi
        echo "⬇️  Pulling model: $2"
        ollama pull "$2"
        ;;
    "remove")
        if [ -z "$2" ]; then
            echo "Usage: $0 remove <model-name>"
            exit 1
        fi
        echo "🗑️  Removing model: $2"
        ollama rm "$2"
        ;;
    "test")
        MODEL="${2:-deepseek-chat:7b}"
        echo "🧪 Testing model: $MODEL"
        echo "Hello, please respond briefly." | ollama run "$MODEL"
        ;;
    "status")
        echo "📊 Ollama service status:"
        systemctl status ollama --no-pager
        echo ""
        echo "📡 API status:"
        curl -s http://localhost:11434/api/tags | jq . 2>/dev/null || echo "API not responding"
        ;;
    *)
        echo "🤖 DeepSeek Model Manager"
        echo ""
        echo "Usage: $0 {list|pull|remove|test|status}"
        echo ""
        echo "Commands:"
        echo "  list          - List installed models"
        echo "  pull <model>  - Download a new model"
        echo "  remove <model> - Remove a model"
        echo "  test [model]  - Test model inference"
        echo "  status        - Show service and API status"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 pull deepseek-coder:6.7b"
        echo "  $0 test deepseek-chat:7b"
        ;;
esac
EOF

    chmod +x manage-models.sh
    print_success "Created model management script: manage-models.sh"
}

# Main setup function
main() {
    print_status "Starting local DeepSeek setup..."
    echo ""
    
    check_system
    install_ollama
    setup_ollama_service
    pull_deepseek_models
    test_ollama
    setup_local_checker
    create_model_manager
    
    echo ""
    print_success "Local DeepSeek setup completed! 🎉"
    echo ""
    echo "📋 Quick Start:"
    echo "1. Run the local checker:"
    echo "   ./run-local-checker.sh"
    echo ""
    echo "2. Manage models:"
    echo "   ./manage-models.sh list"
    echo "   ./manage-models.sh test"
    echo ""
    echo "3. Change model (optional):"
    echo "   export DEEPSEEK_MODEL=\"deepseek-coder:6.7b\""
    echo "   ./run-local-checker.sh"
    echo ""
    echo "4. Service management:"
    echo "   sudo systemctl start ollama"
    echo "   sudo systemctl stop ollama"
    echo "   sudo systemctl status ollama"
    echo ""
    print_status "Your subtitles are ready to be checked locally! 📝✨"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Some operations will be performed with sudo."
fi

# Run main function
main 