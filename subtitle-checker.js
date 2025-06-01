const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

class SubtitleChecker {
    constructor() {
        this.subtitlesDir = path.join(__dirname, 'subtitles');
        this.openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.results = [];
    }

    async init() {
        console.log(chalk.blue('🔍 Starting Subtitle Spell & Grammar Checker'));
        console.log(chalk.gray('Using OpenRouter AI models for analysis\n'));

        if (!this.apiKey) {
            console.log(chalk.yellow('⚠️  Warning: OPENROUTER_API_KEY environment variable not set.'));
            console.log(chalk.gray('Please set your OpenRouter API key: export OPENROUTER_API_KEY="your-api-key"\n'));
        }

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

            const analysis = await this.analyzeWithOpenRouter(subtitleText, filename);
            this.results.push({
                filename,
                analysis,
                originalLength: subtitleText.length
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

    async analyzeWithOpenRouter(text, filename) {
        if (!this.apiKey) {
            return {
                status: 'skipped',
                message: 'API key not provided'
            };
        }

        try {
            const prompt = `Please analyze the following subtitle text for spelling and grammar mistakes. 
Provide a detailed report including:
1. Number of spelling errors found
2. Number of grammar errors found  
3. List of specific errors with suggestions for correction
4. Overall assessment of the text quality

Subtitle text to analyze:
"${text}"

Please format your response in a clear, structured way.`;

            const response = await axios.post(this.openrouterApiUrl, {
                model: "google/gemini-pro-1.5",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert proofreader and grammar checker. Analyze text for spelling and grammar mistakes, providing detailed feedback and suggestions."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            return {
                status: 'success',
                analysis: response.data.choices[0].message.content,
                usage: response.data.usage
            };

        } catch (error) {
            console.error(chalk.red(`   ❌ OpenRouter API error for ${filename}:`), error.message);
            
            if (error.response) {
                console.error(chalk.red('   API Response:'), error.response.status, error.response.data);
            }
            
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    generateReport() {
        console.log(chalk.blue('\n📊 SUBTITLE CHECKING REPORT'));
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
            } else if (result.analysis.status === 'skipped') {
                console.log(chalk.yellow(`⏭️  Skipped: ${result.analysis.message}`));
            } else if (result.analysis.status === 'success') {
                console.log(chalk.green('✅ Analysis Results:'));
                console.log(chalk.white(result.analysis.analysis));
                
                if (result.analysis.usage) {
                    console.log(chalk.gray(`\nTokens used: ${result.analysis.usage.total_tokens}`));
                }
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
    }
}

// Usage instructions
function showUsage() {
    console.log(chalk.blue('📚 SUBTITLE CHECKER USAGE'));
    console.log(chalk.blue('═'.repeat(25)));
    console.log(chalk.white('1. Set your OpenRouter API key:'));
    console.log(chalk.gray('   export OPENROUTER_API_KEY="your-api-key-here"'));
    console.log(chalk.white('\n2. Place VTT files in the "subtitles" folder'));
    console.log(chalk.white('3. Run the checker:'));
    console.log(chalk.gray('   npm start'));
    console.log(chalk.gray('   # or'));
    console.log(chalk.gray('   node subtitle-checker.js\n'));
}

// Main execution
async function main() {
    // Show usage if help is requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showUsage();
        return;
    }

    const checker = new SubtitleChecker();
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