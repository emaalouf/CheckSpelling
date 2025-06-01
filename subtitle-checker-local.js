const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

class LocalSubtitleChecker {
    constructor() {
        this.subtitlesDir = path.join(__dirname, 'subtitles');
        this.ollamaUrl = 'http://localhost:11434/api/generate';
        this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat:7b';
        this.results = [];
    }

    async init() {
        console.log(chalk.blue('🔍 Starting Local Subtitle Spell & Grammar Checker'));
        console.log(chalk.gray('Using local DeepSeek model via Ollama\n'));

        // Check if Ollama is running
        const isOllamaRunning = await this.checkOllamaConnection();
        if (!isOllamaRunning) {
            console.log(chalk.red('❌ Cannot connect to Ollama service'));
            console.log(chalk.yellow('Please ensure Ollama is installed and running:'));
            console.log(chalk.gray('1. Install: curl -fsSL https://ollama.ai/install.sh | sh'));
            console.log(chalk.gray('2. Pull model: ollama pull deepseek-chat:7b'));
            console.log(chalk.gray('3. Start service: ollama serve'));
            console.log(chalk.gray('4. Or run in background: systemctl start ollama\n'));
            return;
        }

        console.log(chalk.green(`✅ Connected to Ollama service (Model: ${this.model})\n`));

        // Check if subtitles directory exists
        if (!await fs.pathExists(this.subtitlesDir)) {
            console.log(chalk.red(`❌ Subtitles directory not found: ${this.subtitlesDir}`));
            console.log(chalk.gray('Creating subtitles directory...'));
            await fs.ensureDir(this.subtitlesDir);
            console.log(chalk.green('✅ Subtitles directory created. Please add VTT files to check.\n'));
            return;
        }

        await this.processVTTFiles();
        this.generateReport();
    }

    async checkOllamaConnection() {
        try {
            const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async processVTTFiles() {
        try {
            const files = await fs.readdir(this.subtitlesDir);
            const vttFiles = files.filter(file => file.endsWith('.vtt'));

            if (vttFiles.length === 0) {
                console.log(chalk.yellow('⚠️  No VTT files found in the subtitles directory.'));
                return;
            }

            console.log(chalk.green(`📁 Found ${vttFiles.length} VTT files to check:\n`));

            for (const file of vttFiles) {
                await this.checkVTTFile(file);
            }

        } catch (error) {
            console.error(chalk.red('❌ Error reading subtitles directory:'), error.message);
        }
    }

    async checkVTTFile(filename) {
        const filePath = path.join(this.subtitlesDir, filename);
        
        try {
            console.log(chalk.cyan(`🔍 Checking: ${filename}`));
            
            const content = await fs.readFile(filePath, 'utf8');
            const subtitleText = this.extractTextFromVTT(content);
            
            if (!subtitleText || subtitleText.trim().length === 0) {
                console.log(chalk.yellow(`   ⚠️  No text content found in ${filename}\n`));
                return;
            }

            // Limit text length for local processing
            const maxLength = 2000;
            const processText = subtitleText.length > maxLength 
                ? subtitleText.substring(0, maxLength) + '...'
                : subtitleText;

            const analysis = await this.analyzeWithLocalDeepSeek(processText, filename);
            this.results.push({
                filename,
                analysis,
                originalLength: subtitleText.length,
                processedLength: processText.length
            });

            console.log(chalk.green(`   ✅ Analysis complete\n`));

        } catch (error) {
            console.error(chalk.red(`   ❌ Error processing ${filename}:`), error.message);
            this.results.push({
                filename,
                error: error.message
            });
        }
    }

    extractTextFromVTT(vttContent) {
        // Parse VTT content and extract subtitle text
        const lines = vttContent.split('\n');
        const textLines = [];
        let isTextLine = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip VTT header
            if (trimmedLine === 'WEBVTT') continue;
            
            // Skip timestamp lines (format: 00:00:00.000 --> 00:00:00.000)
            if (trimmedLine.match(/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/)) {
                isTextLine = true;
                continue;
            }
            
            // Skip empty lines and cue identifiers
            if (trimmedLine === '' || trimmedLine.match(/^\d+$/)) {
                isTextLine = false;
                continue;
            }
            
            // Extract subtitle text
            if (isTextLine && trimmedLine.length > 0) {
                // Remove VTT formatting tags
                const cleanText = trimmedLine
                    .replace(/<[^>]*>/g, '') // Remove HTML/VTT tags
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .trim();
                
                if (cleanText.length > 0) {
                    textLines.push(cleanText);
                }
            }
        }

        return textLines.join(' ');
    }

    async analyzeWithLocalDeepSeek(text, filename) {
        try {
            const prompt = `Please analyze the following subtitle text for spelling and grammar mistakes. Provide a concise report including:

1. Number of spelling errors found
2. Number of grammar errors found  
3. List of specific errors with suggestions
4. Overall quality assessment

Subtitle text: "${text}"

Please be concise and specific in your response.`;

            console.log(chalk.gray(`   🤖 Analyzing with local DeepSeek model...`));

            const response = await axios.post(this.ollamaUrl, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_k: 10,
                    top_p: 0.9
                }
            }, {
                timeout: 60000, // 60 seconds timeout for local processing
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                status: 'success',
                analysis: response.data.response,
                model: this.model,
                local: true
            };

        } catch (error) {
            console.error(chalk.red(`   ❌ Local DeepSeek error for ${filename}:`), error.message);
            
            if (error.code === 'ECONNREFUSED') {
                console.error(chalk.red('   💡 Hint: Make sure Ollama is running (ollama serve)'));
            }
            
            return {
                status: 'error',
                message: error.message,
                local: true
            };
        }
    }

    generateReport() {
        console.log(chalk.blue('\n📊 LOCAL SUBTITLE CHECKING REPORT'));
        console.log(chalk.blue('═'.repeat(50)));

        if (this.results.length === 0) {
            console.log(chalk.yellow('No files were processed.'));
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const result of this.results) {
            console.log(chalk.cyan(`\n📄 File: ${result.filename}`));
            console.log(chalk.gray('─'.repeat(30)));

            if (result.error) {
                console.log(chalk.red(`❌ Error: ${result.error}`));
                errorCount++;
            } else if (result.analysis.status === 'success') {
                console.log(chalk.green('✅ Local Analysis Results:'));
                console.log(chalk.white(result.analysis.analysis));
                
                if (result.processedLength < result.originalLength) {
                    console.log(chalk.gray(`\n📏 Text processed: ${result.processedLength}/${result.originalLength} chars (truncated for local processing)`));
                }
                
                console.log(chalk.gray(`🤖 Model: ${result.analysis.model}`));
                successCount++;
            } else {
                console.log(chalk.red(`❌ Analysis failed: ${result.analysis.message}`));
                errorCount++;
            }
        }

        console.log(chalk.blue('\n📈 SUMMARY'));
        console.log(chalk.blue('─'.repeat(20)));
        console.log(chalk.green(`✅ Successfully analyzed: ${successCount} files`));
        console.log(chalk.red(`❌ Errors encountered: ${errorCount} files`));
        console.log(chalk.gray(`📁 Total files processed: ${this.results.length}`));
        console.log(chalk.cyan(`🏠 Processed locally with ${this.model}`));
    }
}

// Usage instructions for local setup
function showLocalUsage() {
    console.log(chalk.blue('📚 LOCAL SUBTITLE CHECKER SETUP'));
    console.log(chalk.blue('═'.repeat(30)));
    console.log(chalk.white('1. Install Ollama:'));
    console.log(chalk.gray('   curl -fsSL https://ollama.ai/install.sh | sh'));
    console.log(chalk.white('\n2. Pull DeepSeek model:'));
    console.log(chalk.gray('   ollama pull deepseek-chat:7b'));
    console.log(chalk.white('\n3. Start Ollama service:'));
    console.log(chalk.gray('   ollama serve'));
    console.log(chalk.gray('   # or run in background:'));
    console.log(chalk.gray('   sudo systemctl enable ollama'));
    console.log(chalk.gray('   sudo systemctl start ollama'));
    console.log(chalk.white('\n4. Place VTT files in "subtitles" folder'));
    console.log(chalk.white('\n5. Run local checker:'));
    console.log(chalk.gray('   node subtitle-checker-local.js'));
    console.log(chalk.white('\n6. Optional - Set custom model:'));
    console.log(chalk.gray('   export DEEPSEEK_MODEL="deepseek-coder:6.7b"'));
    console.log(chalk.gray('   node subtitle-checker-local.js\n'));
}

// Main execution
async function main() {
    // Show usage if help is requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showLocalUsage();
        return;
    }

    const checker = new LocalSubtitleChecker();
    await checker.init();
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('❌ Unhandled error:'), error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n⏹️  Process interrupted by user'));
    process.exit(0);
});

// Run the script
main().catch((error) => {
    console.error(chalk.red('❌ Script failed:'), error);
    process.exit(1);
}); 