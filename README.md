# Subtitle Spell & Grammar Checker

A Node.js application that automatically checks VTT subtitle files for spelling and grammar mistakes using DeepSeek V3 AI model.

## Features

- 🔍 **Automatic VTT File Detection**: Scans the `subtitles` folder for all `.vtt` files
- 📝 **Text Extraction**: Intelligently extracts subtitle text from VTT format, removing timestamps and formatting
- 🤖 **AI-Powered Analysis**: Uses DeepSeek V3 model for advanced spelling and grammar checking
- 📊 **Detailed Reports**: Provides comprehensive analysis with specific error locations and suggestions
- 🎨 **Colorized Output**: Beautiful terminal output with color-coded results
- ⚡ **Error Handling**: Robust error handling for network issues and file problems

## Prerequisites

- Node.js (version 14 or higher)
- DeepSeek API key (sign up at [DeepSeek](https://www.deepseek.com/))

## Installation

1. **Clone or download this project**
   ```bash
   cd /path/to/your/project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your DeepSeek API key**
   ```bash
   export DEEPSEEK_API_KEY="your-deepseek-api-key-here"
   ```
   
   Or add it to your `.bashrc` or `.zshrc` for persistence:
   ```bash
   echo 'export DEEPSEEK_API_KEY="your-deepseek-api-key-here"' >> ~/.bashrc
   source ~/.bashrc
   ```

## Usage

### Basic Usage

1. **Place your VTT files in the `subtitles` folder**
   ```bash
   mkdir -p subtitles
   # Copy your VTT files to the subtitles folder
   ```

2. **Run the checker**
   ```bash
   npm start
   ```
   
   Or directly:
   ```bash
   node subtitle-checker.js
   ```

### Command Line Options

- `--help` or `-h`: Show usage instructions
  ```bash
  node subtitle-checker.js --help
  ```

## VTT File Format Support

The tool supports standard WebVTT (.vtt) files with the following format:
```
WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello, welcome to our course on emotional mastery.

2
00:00:04.500 --> 00:00:08.000
In this lesson, we'll explore the fundamentals.
```

## Example Output

```
🔍 Starting Subtitle Spell & Grammar Checker
Using DeepSeek V3 model for analysis

📁 Found 5 VTT files to check:

🔍 Checking: [vi057I5LKytkjaEW5eqOiJo]_Emotional_Mastery-3.mp4_en.vtt
   ✅ Analysis complete

📊 SUBTITLE CHECKING REPORT
══════════════════════════════════════════════════

📄 File: [vi057I5LKytkjaEW5eqOiJo]_Emotional_Mastery-3.mp4_en.vtt
──────────────────────────────────
✅ Analysis Results:
Spelling Errors Found: 2
Grammar Errors Found: 1

Specific Issues:
1. Line 15: "recieve" should be "receive"
2. Line 23: "there" should be "their" (possessive)
3. Line 31: Missing comma before "however"

Overall Assessment: Good quality text with minor corrections needed.

Tokens used: 156

📈 SUMMARY
────────────────────
✅ Successfully analyzed: 5 files
❌ Errors encountered: 0 files
📁 Total files processed: 5
```

## Project Structure

```
CheckSpelling/
├── package.json              # Project dependencies and scripts
├── subtitle-checker.js       # Main application script
├── README.md                 # This file
└── subtitles/                # Place your VTT files here
    ├── video1_en.vtt
    ├── video1_es.vtt
    └── ...
```

## Configuration

### Environment Variables

- `DEEPSEEK_API_KEY`: Your DeepSeek API key (required)

### Customization

You can modify the script to:
- Change the subtitles directory path
- Adjust the AI prompt for different analysis types
- Modify output formatting
- Add support for other subtitle formats

## Error Handling

The application handles various error scenarios:
- Missing API key (graceful degradation)
- Network connectivity issues
- Invalid VTT file formats
- Empty or corrupted files
- API rate limiting

## Troubleshooting

### Common Issues

1. **"No VTT files found"**
   - Ensure your files have the `.vtt` extension
   - Check that files are in the `subtitles` folder

2. **API Errors**
   - Verify your DeepSeek API key is correct
   - Check your internet connection
   - Ensure you have sufficient API credits

3. **Permission Errors**
   - Make sure the script has read permissions for the subtitles folder
   - Check file ownership and permissions

### Getting Help

If you encounter issues:
1. Run with `--help` to see usage instructions
2. Check the console output for specific error messages
3. Verify your API key and network connection

## License

ISC License - See package.json for details.

## Contributing

Feel free to submit issues and enhancement requests! 