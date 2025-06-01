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
        this.fixedFiles = [];
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
            
            // If analysis was successful and contains corrections, apply them
            if (analysis.status === 'success' && analysis.corrections && analysis.corrections.length > 0) {
                const fixResult = await this.applyCorrections(filePath, content, analysis.corrections, filename);
                this.results.push({
                    filename,
                    analysis,
                    originalLength: subtitleText.length,
                    fixResult
                });
                
                if (fixResult.success) {
                    console.log(chalk.green(`   ✅ Analysis complete - ${fixResult.changesCount} corrections applied\n`));
                } else {
                    console.log(chalk.green(`   ✅ Analysis complete\n`));
                }
            } else {
                this.results.push({
                    filename,
                    analysis,
                    originalLength: subtitleText.length
                });
                console.log(chalk.green(`   ✅ Analysis complete\n`));
            }

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
            const prompt = `Please analyze the following subtitle text for spelling and grammar mistakes and provide corrections.

IMPORTANT: Structure your response as JSON with this exact format:
{
  "summary": {
    "spellingErrors": number,
    "grammarErrors": number,
    "overallQuality": "description"
  },
  "corrections": [
    {
      "original": "exact text to replace",
      "corrected": "corrected text",
      "type": "spelling|grammar",
      "explanation": "brief explanation"
    }
  ],
  "analysis": "detailed analysis text"
}

If no errors are found, return an empty corrections array.

Subtitle text to analyze:
"${text}"`;

            const response = await axios.post(this.openrouterApiUrl, {
                model: "openrouter/auto",
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

            const responseContent = response.data.choices[0].message.content;
            
            // Try to parse JSON response
            let parsedResponse;
            try {
                // Extract JSON from response if it's wrapped in markdown
                const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                const jsonString = jsonMatch ? jsonMatch[1] : responseContent;
                parsedResponse = JSON.parse(jsonString);
            } catch (parseError) {
                console.log(chalk.yellow(`   ⚠️  Could not parse structured response, using raw analysis`));
                return {
                    status: 'success',
                    analysis: responseContent,
                    usage: response.data.usage,
                    corrections: []
                };
            }

            return {
                status: 'success',
                analysis: parsedResponse.analysis || responseContent,
                summary: parsedResponse.summary,
                corrections: parsedResponse.corrections || [],
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

    async applyCorrections(filePath, originalContent, corrections, filename) {
        try {
            let modifiedContent = originalContent;
            let changesCount = 0;
            const appliedChanges = [];

            console.log(chalk.cyan(`   🔧 Applying ${corrections.length} corrections to ${filename}...`));

            // Apply corrections one by one
            for (const correction of corrections) {
                const originalText = correction.original;
                const correctedText = correction.corrected;
                
                if (modifiedContent.includes(originalText)) {
                    modifiedContent = modifiedContent.replace(originalText, correctedText);
                    changesCount++;
                    appliedChanges.push({
                        original: originalText,
                        corrected: correctedText,
                        type: correction.type,
                        explanation: correction.explanation
                    });
                    console.log(chalk.gray(`     • ${correction.type}: "${originalText}" → "${correctedText}"`));
                }
            }

            if (changesCount > 0) {
                // Create backup of original file
                const backupPath = filePath.replace('.vtt', '.vtt.backup');
                await fs.copy(filePath, backupPath);
                
                // Write corrected content
                await fs.writeFile(filePath, modifiedContent, 'utf8');
                
                this.fixedFiles.push({
                    filename,
                    changesCount,
                    appliedChanges,
                    backupPath
                });

                console.log(chalk.green(`     ✅ ${changesCount} corrections applied, backup saved as ${path.basename(backupPath)}`));
            }

            return {
                success: true,
                changesCount,
                appliedChanges
            };

        } catch (error) {
            console.error(chalk.red(`     ❌ Error applying corrections to ${filename}:`), error.message);
            return {
                success: false,
                error: error.message
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
                
                // Show summary if available
                if (result.analysis.summary) {
                    console.log(chalk.white(`📊 Summary:`));
                    console.log(chalk.white(`   • Spelling errors: ${result.analysis.summary.spellingErrors || 0}`));
                    console.log(chalk.white(`   • Grammar errors: ${result.analysis.summary.grammarErrors || 0}`));
                    console.log(chalk.white(`   • Quality: ${result.analysis.summary.overallQuality || 'N/A'}`));
                }
                
                // Show corrections applied
                if (result.fixResult && result.fixResult.success && result.fixResult.changesCount > 0) {
                    console.log(chalk.cyan(`\n🔧 Corrections Applied (${result.fixResult.changesCount}):`));
                    for (const change of result.fixResult.appliedChanges) {
                        console.log(chalk.white(`   • ${change.type}: "${change.original}" → "${change.corrected}"`));
                        if (change.explanation) {
                            console.log(chalk.gray(`     ${change.explanation}`));
                        }
                    }
                } else if (result.analysis.corrections && result.analysis.corrections.length === 0) {
                    console.log(chalk.green(`\n✨ No errors found - text is already correct!`));
                }
                
                console.log(chalk.white(`\n📝 Detailed Analysis:`));
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

        // Show summary of fixes
        if (this.fixedFiles.length > 0) {
            const totalCorrections = this.fixedFiles.reduce((sum, file) => sum + file.changesCount, 0);
            console.log(chalk.cyan(`\n🔧 CORRECTIONS APPLIED`));
            console.log(chalk.cyan('─'.repeat(25)));
            console.log(chalk.white(`📝 Files corrected: ${this.fixedFiles.length}`));
            console.log(chalk.white(`🔄 Total corrections: ${totalCorrections}`));
            
            console.log(chalk.gray('\n📋 Fixed files:'));
            for (const fixedFile of this.fixedFiles) {
                console.log(chalk.white(`   • ${fixedFile.filename}: ${fixedFile.changesCount} corrections`));
                console.log(chalk.gray(`     Backup: ${path.basename(fixedFile.backupPath)}`));
            }
            
            console.log(chalk.yellow('\n💡 Note: Original files have been backed up with .backup extension'));
        } else {
            console.log(chalk.green(`\n✨ No corrections needed - all files are already error-free!`));
        }
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